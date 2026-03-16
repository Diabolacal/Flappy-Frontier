/**
 * Flappy Frontier — Gas Sponsor Service (Cloudflare Worker)
 *
 * Implements Sui-native dual-signature gas sponsorship.
 * The player signs TransactionKind; this service adds gas payment
 * from a dedicated sponsor wallet and co-signs.
 *
 * SECURITY: The sponsor's gas coin must NEVER be reachable by PTB
 * commands.  All transaction intent validation is in validation.ts.
 * See the security audit (2026-03-16) for the full threat model.
 *
 * API:
 *   POST /sponsor
 *   Body:    { txKindB64: string; sender: string; timestamp?: number }
 *   Returns: { txB64: string; sponsorSignature: string }
 *
 * Secrets (set via `wrangler secret put`):
 *   SPONSOR_PRIVATE_KEY — bech32-encoded Sui private key (suiprivkey1...)
 *   SPONSOR_API_KEY    — shared bearer token for caller authentication
 */

import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import {
  validateCommands,
  auditLog,
  MAX_BODY_BYTES,
  MAX_REQUEST_AGE_MS,
} from './validation';

// ── Types ──────────────────────────────────────────────────────────

interface Env {
  /** bech32-encoded sponsor private key (suiprivkey1...) */
  SPONSOR_PRIVATE_KEY: string;
  /** Sui fullnode RPC URL (defaults to testnet) */
  SUI_RPC_URL?: string;
  /** Comma-separated allowed CORS origins */
  ALLOWED_ORIGINS?: string;
  /** Gas budget in MIST (defaults to 50_000_000 = 0.05 SUI) */
  GAS_BUDGET?: string;
  /** Shared secret API key — callers must send Authorization: Bearer <key> */
  SPONSOR_API_KEY?: string;
  /** Flappy Frontier package ID — only MoveCall targets matching this are sponsored */
  ALLOWED_PACKAGE_ID?: string;
  /**
   * Emergency kill switch — set to 'false' to disable all sponsorship.
   * Defaults to 'true' (enabled) when not set.
   */
  SPONSOR_ENABLED?: string;
  /** Comma-separated sender addresses to block (manual deny-list). */
  BLOCKED_SENDERS?: string;
}

interface SponsorRequest {
  txKindB64: string;
  sender: string;
  /** Client-side timestamp for replay-window validation (ms since epoch). */
  timestamp?: number;
}

interface SponsorResponse {
  txB64: string;
  sponsorSignature: string;
}

// ── Constants ──────────────────────────────────────────────────────

const DEFAULT_RPC = 'https://fullnode.testnet.sui.io:443';
const DEFAULT_GAS_BUDGET = 50_000_000; // 0.05 SUI
const DEFAULT_ALLOWED_ORIGINS = [
  'https://flappyfrontier.com',
  'https://www.flappyfrontier.com',
  'https://flappy-frontier.pages.dev',
  'http://localhost:5173',
];

/** Wildcard suffix patterns — origins ending with these are allowed */
const ALLOWED_ORIGIN_SUFFIXES = ['.flappy-frontier.pages.dev'];

// ── Helpers ────────────────────────────────────────────────────────

function getAllowedOrigins(env: Env): string[] {
  if (env.ALLOWED_ORIGINS) {
    return env.ALLOWED_ORIGINS.split(',').map((s) => s.trim());
  }
  return DEFAULT_ALLOWED_ORIGINS;
}

/** Check if an origin is allowed (exact match OR wildcard suffix match) */
function isOriginAllowed(origin: string, env: Env): boolean {
  const allowed = getAllowedOrigins(env);
  if (allowed.includes(origin)) return true;

  // Wildcard: allow any *.flappy-frontier.pages.dev subdomain (preview deploys)
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== 'https:') return false;
    return ALLOWED_ORIGIN_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
  } catch {
    return false;
  }
}

function corsHeaders(origin: string | null, env: Env): Record<string, string> {
  const matched = origin && isOriginAllowed(origin, env) ? origin : '';
  return {
    'Access-Control-Allow-Origin': matched,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(
  body: unknown,
  status: number,
  headers: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ── Security ───────────────────────────────────────────────────────

/** Verify Bearer token matches the configured API key. */
function checkAuth(request: Request, env: Env): boolean {
  if (!env.SPONSOR_API_KEY) return true; // no key configured = auth disabled
  const auth = request.headers.get('Authorization');
  if (!auth) return false;
  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return false;
  return parts[1] === env.SPONSOR_API_KEY;
}

/** Check if the sponsor service is enabled (emergency kill switch). */
function isSponsorEnabled(env: Env): boolean {
  return env.SPONSOR_ENABLED?.toLowerCase() !== 'false';
}

/** Check if a sender address is blocked. */
function isSenderBlocked(sender: string, env: Env): boolean {
  if (!env.BLOCKED_SENDERS) return false;
  const blocked = env.BLOCKED_SENDERS.split(',').map((s) => s.trim().toLowerCase());
  return blocked.includes(sender.toLowerCase());
}

/**
 * Validate that the TransactionKind only targets safe Flappy Frontier operations.
 *
 * Defence-in-depth:
 *  - Fail closed if ALLOWED_PACKAGE_ID is not configured.
 *  - Command-kind allow-list (no TransferObjects, Publish, Upgrade, etc.).
 *  - GasCoin reference detection blocks SplitCoins/TransferObjects abuse.
 *  - MoveCall target validation (package + module + function).
 *
 * See validation.ts for the core rules and the 2026-03-16 audit report.
 */
function validateIntent(
  kindBytes: Uint8Array,
  env: Env,
): { valid: boolean; reason?: string; commandKinds?: string[] } {
  const packageId = env.ALLOWED_PACKAGE_ID;
  // FAIL CLOSED: refuse to sponsor if package allowlist is not configured.
  if (!packageId) {
    return { valid: false, reason: 'Package allowlist not configured' };
  }

  let tx: Transaction;
  try {
    tx = Transaction.fromKind(kindBytes);
  } catch {
    return { valid: false, reason: 'Malformed transaction' };
  }

  const commands = tx.getData().commands as Array<{
    $kind: string;
    [key: string]: unknown;
  }>;

  const result = validateCommands(commands, packageId);
  return {
    ...result,
    commandKinds: Array.isArray(commands)
      ? commands.map((c) => c.$kind)
      : undefined,
  };
}

// ── Worker Entry Point ─────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const cors = corsHeaders(origin, env);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    // Route: POST /sponsor
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/sponsor') {
      return jsonResponse({ error: 'Not Found' }, 404, cors);
    }

    const clientIp = request.headers.get('CF-Connecting-IP') ?? 'unknown';

    // ── Emergency kill switch ──
    if (!isSponsorEnabled(env)) {
      auditLog({
        event: 'sponsor_rejected',
        timestamp: new Date().toISOString(),
        ip: clientIp,
        sender: '',
        reason: 'Service disabled via SPONSOR_ENABLED=false',
      });
      return jsonResponse(
        { error: 'Sponsor service temporarily disabled' },
        503,
        cors,
      );
    }

    // ── Caller authentication ──
    if (!checkAuth(request, env)) {
      auditLog({
        event: 'sponsor_rejected',
        timestamp: new Date().toISOString(),
        ip: clientIp,
        sender: '',
        reason: 'Authentication failed',
      });
      return jsonResponse({ error: 'Unauthorized' }, 401, cors);
    }

    // ── Body size guard ──
    const contentLength = request.headers.get('Content-Length');
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
      return jsonResponse({ error: 'Request too large' }, 413, cors);
    }

    // Health check: sponsor key must be configured
    if (!env.SPONSOR_PRIVATE_KEY) {
      return jsonResponse(
        { error: 'Sponsor service not configured' },
        503,
        cors,
      );
    }

    try {
      // Parse request body
      const body: unknown = await request.json();
      const { txKindB64, sender } = body as SponsorRequest;

      if (!txKindB64 || typeof txKindB64 !== 'string') {
        return jsonResponse(
          { error: 'Missing or invalid txKindB64' },
          400,
          cors,
        );
      }
      if (
        !sender ||
        typeof sender !== 'string' ||
        !sender.startsWith('0x')
      ) {
        return jsonResponse(
          { error: 'Missing or invalid sender address' },
          400,
          cors,
        );
      }

      // ── Blocked sender check ──
      if (isSenderBlocked(sender, env)) {
        auditLog({
          event: 'sponsor_rejected',
          timestamp: new Date().toISOString(),
          ip: clientIp,
          sender,
          reason: 'Sender is blocked',
        });
        return jsonResponse(
          { error: 'Sponsorship unavailable' },
          403,
          cors,
        );
      }

      // ── Replay-window check ──
      const { timestamp: reqTimestamp } = body as SponsorRequest;
      if (typeof reqTimestamp === 'number') {
        const age = Math.abs(Date.now() - reqTimestamp);
        if (age > MAX_REQUEST_AGE_MS) {
          auditLog({
            event: 'sponsor_rejected',
            timestamp: new Date().toISOString(),
            ip: clientIp,
            sender,
            reason: `Request timestamp too old (${age}ms)`,
          });
          return jsonResponse(
            { error: 'Request expired — please retry' },
            400,
            cors,
          );
        }
      }

      // Reconstruct sponsor keypair from secret
      const { secretKey } = decodeSuiPrivateKey(env.SPONSOR_PRIVATE_KEY);
      const keypair = Ed25519Keypair.fromSecretKey(secretKey);
      const sponsorAddress = keypair.getPublicKey().toSuiAddress();

      // Create Sui client
      const rpcUrl = env.SUI_RPC_URL || DEFAULT_RPC;
      const client = new SuiJsonRpcClient({ url: rpcUrl, network: 'testnet' });

      // Reconstruct transaction from kind bytes, add gas sponsorship
      const kindBytes = fromBase64(txKindB64);

      // ── Intent validation (defence-in-depth) ──
      const intent = validateIntent(kindBytes, env);
      if (!intent.valid) {
        auditLog({
          event: 'sponsor_rejected',
          timestamp: new Date().toISOString(),
          ip: clientIp,
          sender,
          commandKinds: intent.commandKinds,
          reason: intent.reason,
        });
        // Return generic rejection — do not leak validation details to attacker
        return jsonResponse(
          { error: 'Transaction not eligible for sponsorship' },
          403,
          cors,
        );
      }

      const tx = Transaction.fromKind(kindBytes);
      tx.setSender(sender);
      tx.setGasOwner(sponsorAddress);

      const parsedBudget = env.GAS_BUDGET
        ? parseInt(env.GAS_BUDGET, 10)
        : NaN;
      const gasBudget = Number.isNaN(parsedBudget)
        ? DEFAULT_GAS_BUDGET
        : parsedBudget;
      tx.setGasBudget(gasBudget);

      // Build full transaction (resolves sponsor's gas coins via RPC)
      const txBytes = await tx.build({ client });

      // Sign with sponsor keypair
      const { signature: sponsorSignature } =
        await keypair.signTransaction(txBytes);

      const response: SponsorResponse = {
        txB64: toBase64(txBytes),
        sponsorSignature,
      };

      auditLog({
        event: 'sponsor_approved',
        timestamp: new Date().toISOString(),
        ip: clientIp,
        sender,
        commandKinds: intent.commandKinds,
      });

      return jsonResponse(response, 200, cors);
    } catch (err) {
      // Log full error server-side; return generic message to client
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('[sponsor-service] Error:', errMsg);
      auditLog({
        event: 'sponsor_error',
        timestamp: new Date().toISOString(),
        ip: clientIp,
        sender: '',
        reason: errMsg,
      });
      return jsonResponse(
        { error: 'Sponsorship failed. Please try again.' },
        500,
        cors,
      );
    }
  },
} satisfies ExportedHandler<Env>;
