/**
 * Gas sponsorship detection and execution for Flappy Frontier transactions.
 *
 * Two sponsorship models are detected:
 *
 * 1. **EVE Frontier Assembly Sponsorship** (`evefrontier:sponsoredTransaction`)
 *    Both the SSU wallet and Eve Vault advertise this capability.
 *    It is scoped to EVE Frontier world assembly operations (set_name, etc.)
 *    and requires assembly-specific parameters. NOT usable for game contract calls.
 *
 * 2. **Custom Sponsor Service** (Sui-native dual-signature gas sponsorship)
 *    A backend service signs as gas owner so the player doesn't need SUI.
 *    Configurable via VITE_SPONSOR_SERVICE_URL env variable.
 *    When configured, ranked transactions are automatically sponsored.
 */

// ── Constants ──────────────────────────────────────────────────────

export const EVEFRONTIER_SPONSORED_TRANSACTION =
  'evefrontier:sponsoredTransaction' as const;

/**
 * Sponsor service URL. When set, the app requests Sui-native gas sponsorship
 * from this endpoint instead of requiring the player to hold SUI.
 *
 * Expected API:
 *   POST /sponsor
 *   Body:    { txKindB64: string; sender: string }
 *   Returns: { txB64: string; sponsorSignature: string }
 */
export const SPONSOR_SERVICE_URL: string =
  import.meta.env.VITE_SPONSOR_SERVICE_URL ?? '';

/**
 * API key for sponsor service authentication.
 * Set via VITE_SPONSOR_API_KEY environment variable.
 */
const SPONSOR_API_KEY: string =
  import.meta.env.VITE_SPONSOR_API_KEY ?? '';

// ── Types ──────────────────────────────────────────────────────────

export interface SponsorshipInfo {
  /** Wallet advertises evefrontier:sponsoredTransaction */
  hasEFCapability: boolean;
  /** Game transactions can be gas-sponsored (sponsor service is configured) */
  canSponsorGameTx: boolean;
  /** Human-readable explanation of sponsorship status */
  reason: string;
}

export interface SponsorResponse {
  /** Base64-encoded full transaction bytes (with sponsor gas payment) */
  txB64: string;
  /** Sponsor's signature over the full transaction (base64) */
  sponsorSignature: string;
}

// ── Detection ──────────────────────────────────────────────────────

/**
 * Detect sponsorship capabilities from the connected wallet.
 * Accepts any wallet-like object with a features map.
 */
export function detectSponsorshipInfo(
  wallet: { features?: Record<string, unknown> } | null,
): SponsorshipInfo {
  const hasEF = !!(wallet?.features as Record<string, unknown> | undefined)?.[
    EVEFRONTIER_SPONSORED_TRANSACTION
  ];
  const hasService = !!SPONSOR_SERVICE_URL;

  if (hasService) {
    return {
      hasEFCapability: hasEF,
      canSponsorGameTx: true,
      reason: 'Gas sponsored via service — no SUI required.',
    };
  }

  if (hasEF) {
    return {
      hasEFCapability: true,
      canSponsorGameTx: false,
      reason:
        'Wallet supports EVE Frontier assembly sponsorship only. ' +
        'Game transactions require SUI for gas until a sponsor service is configured.',
    };
  }

  return {
    hasEFCapability: false,
    canSponsorGameTx: false,
    reason: 'No sponsorship available. SUI required for gas.',
  };
}

// ── Sponsor Service Client ─────────────────────────────────────────

/**
 * Request gas sponsorship from the configured backend service.
 * The service wraps the TransactionKind with gas payment from a sponsor
 * keypair and returns the full transaction bytes + sponsor signature.
 */
export async function requestSponsorship(
  txKindBytes: Uint8Array,
  sender: string,
): Promise<SponsorResponse> {
  if (!SPONSOR_SERVICE_URL) {
    throw new Error('Sponsor service not configured');
  }

  const txKindB64 = uint8ArrayToB64(txKindBytes);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (SPONSOR_API_KEY) {
    headers['Authorization'] = `Bearer ${SPONSOR_API_KEY}`;
  }

  const res = await fetch(`${SPONSOR_SERVICE_URL}/sponsor`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ txKindB64, sender }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Sponsor service error (${res.status}): ${text}`);
  }

  return res.json() as Promise<SponsorResponse>;
}

// ── Helpers ─────────────────────────────────────────────────────────

function uint8ArrayToB64(bytes: Uint8Array): string {
  return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''));
}

export function b64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
