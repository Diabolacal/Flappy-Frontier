/**
 * Flappy Frontier — Gas Sponsor Service (Cloudflare Worker)
 *
 * Implements Sui-native dual-signature gas sponsorship.
 * The player signs TransactionKind; this service adds gas payment
 * from a dedicated sponsor wallet and co-signs.
 *
 * API:
 *   POST /sponsor
 *   Body:    { txKindB64: string; sender: string }
 *   Returns: { txB64: string; sponsorSignature: string }
 *
 * Secrets (set via `wrangler secret put`):
 *   SPONSOR_PRIVATE_KEY — bech32-encoded Sui private key (suiprivkey1...)
 */

import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';

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
}

interface SponsorRequest {
  txKindB64: string;
  sender: string;
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

// ── Intent Validation ──────────────────────────────────────────────

/** Only these game module functions may be sponsored */
const ALLOWED_FUNCTIONS = new Set([
  'start_run',
  'submit_score',
  'trigger_payout',
  'discard_receipt',
]);

/** Only the game orchestration module is allowed */
const ALLOWED_MODULE = 'game';

/** Max commands per sponsored transaction (PTBs include coin-split helpers) */
const MAX_COMMANDS = 6;

/** Max request body size in bytes */
const MAX_BODY_BYTES = 16_384;

/** Command kinds that must never appear in sponsored transactions */
const DENIED_COMMAND_KINDS = new Set(['Publish', 'Upgrade']);

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

/** Verify Bearer token matches the configured API key */
function checkAuth(request: Request, env: Env): boolean {
  if (!env.SPONSOR_API_KEY) return true; // no key configured = auth disabled
  const auth = request.headers.get('Authorization');
  if (!auth) return false;
  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return false;
  return parts[1] === env.SPONSOR_API_KEY;
}

/**
 * Validate that the TransactionKind only targets Flappy Frontier game functions.
 * Allows supporting PTB commands (SplitCoins, MergeCoins, etc.) but enforces
 * that every MoveCall targets the allowed package/module/function.
 */
function validateIntent(
  kindBytes: Uint8Array,
  env: Env,
): { valid: boolean; reason?: string } {
  const packageId = env.ALLOWED_PACKAGE_ID;
  if (!packageId) return { valid: true }; // skip if not configured

  let tx: Transaction;
  try {
    tx = Transaction.fromKind(kindBytes);
  } catch {
    return { valid: false, reason: 'Malformed transaction' };
  }

  const data = tx.getData();
  const commands: Array<{ $kind: string; [key: string]: unknown }> =
    data.commands as Array<{ $kind: string; [key: string]: unknown }>;

  if (!Array.isArray(commands) || commands.length === 0) {
    return { valid: false, reason: 'Empty transaction' };
  }
  if (commands.length > MAX_COMMANDS) {
    return { valid: false, reason: 'Too many commands' };
  }

  const normalPkg = packageId.toLowerCase();
  let hasMoveCall = false;

  for (const cmd of commands) {
    const kind = cmd.$kind;
    if (DENIED_COMMAND_KINDS.has(kind)) {
      return { valid: false, reason: `Disallowed command: ${kind}` };
    }
    if (kind !== 'MoveCall') continue;
    hasMoveCall = true;

    const call = cmd.MoveCall as {
      package: string;
      module: string;
      function: string;
    };
    if (call.package.toLowerCase() !== normalPkg) {
      return { valid: false, reason: 'Disallowed package' };
    }
    if (call.module !== ALLOWED_MODULE) {
      return { valid: false, reason: 'Disallowed module' };
    }
    if (!ALLOWED_FUNCTIONS.has(call.function)) {
      return { valid: false, reason: 'Disallowed function' };
    }
  }

  if (!hasMoveCall) {
    return { valid: false, reason: 'No MoveCall commands' };
  }

  return { valid: true };
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

    // ── Caller authentication ──
    if (!checkAuth(request, env)) {
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

      // Reconstruct sponsor keypair from secret
      const { secretKey } = decodeSuiPrivateKey(env.SPONSOR_PRIVATE_KEY);
      const keypair = Ed25519Keypair.fromSecretKey(secretKey);
      const sponsorAddress = keypair.getPublicKey().toSuiAddress();

      // Create Sui client
      const rpcUrl = env.SUI_RPC_URL || DEFAULT_RPC;
      const client = new SuiJsonRpcClient({ url: rpcUrl, network: 'testnet' });

      // Reconstruct transaction from kind bytes, add gas sponsorship
      const kindBytes = fromBase64(txKindB64);

      // ── Intent validation ──
      const intent = validateIntent(kindBytes, env);
      if (!intent.valid) {
        console.warn('[sponsor-service] Intent rejected:', intent.reason);
        return jsonResponse(
          { error: `Transaction rejected: ${intent.reason}` },
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

      return jsonResponse(response, 200, cors);
    } catch (err) {
      // Log full error server-side; return generic message to client (M-4)
      console.error(
        '[sponsor-service] Error:',
        err instanceof Error ? err.message : err,
      );
      return jsonResponse(
        { error: 'Sponsorship failed. Please try again.' },
        500,
        cors,
      );
    }
  },
} satisfies ExportedHandler<Env>;
