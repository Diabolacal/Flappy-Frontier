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

// ── Helpers ────────────────────────────────────────────────────────

function getAllowedOrigins(env: Env): string[] {
  if (env.ALLOWED_ORIGINS) {
    return env.ALLOWED_ORIGINS.split(',').map((s) => s.trim());
  }
  return DEFAULT_ALLOWED_ORIGINS;
}

function corsHeaders(origin: string | null, env: Env): Record<string, string> {
  const allowed = getAllowedOrigins(env);
  const matched = origin && allowed.includes(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': matched,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
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
      const client = new SuiJsonRpcClient({ url: rpcUrl });

      // Reconstruct transaction from kind bytes, add gas sponsorship
      const kindBytes = fromBase64(txKindB64);
      const tx = Transaction.fromKind(kindBytes);
      tx.setSender(sender);
      tx.setGasOwner(sponsorAddress);

      const gasBudget = env.GAS_BUDGET
        ? parseInt(env.GAS_BUDGET, 10)
        : DEFAULT_GAS_BUDGET;
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
      const message = err instanceof Error ? err.message : 'Internal error';
      console.error('[sponsor-service]', message);
      return jsonResponse({ error: message }, 500, cors);
    }
  },
} satisfies ExportedHandler<Env>;
