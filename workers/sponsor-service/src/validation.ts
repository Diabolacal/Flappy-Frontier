/**
 * Transaction intent validation for the Flappy Frontier sponsor service.
 *
 * Validates that a deserialized PTB only contains commands that are safe
 * for the sponsor to co-sign.  The sponsor's gas coin MUST NOT be
 * reachable by any command — otherwise an attacker can SplitCoins from
 * the sponsor wallet and TransferObjects to themselves.
 *
 * Exported separately from the Worker entry point so the core logic
 * can be unit-tested without Cloudflare Worker scaffolding.
 */

// ── Public types ───────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/** Structured audit log entry (JSON-serialisable). */
export interface AuditEntry {
  event:
    | 'sponsor_request'
    | 'sponsor_rejected'
    | 'sponsor_approved'
    | 'sponsor_error';
  timestamp: string;
  ip: string;
  sender: string;
  commandKinds?: string[];
  reason?: string;
}

// ── Constants ──────────────────────────────────────────────────────

/** Only these game module functions may be sponsored. */
export const ALLOWED_FUNCTIONS = new Set([
  'start_run',
  'submit_score',
  'trigger_payout',
  'discard_receipt',
]);

/** Only the game orchestration module is allowed. */
export const ALLOWED_MODULE = 'game';

/** Max commands per sponsored transaction (game calls + coin-split helpers). */
export const MAX_COMMANDS = 6;

/**
 * Command-kind allow-list.  Only these $kind values are permitted.
 * Everything else — including TransferObjects, Publish, Upgrade — is
 * rejected.  This is an allow-list, not a deny-list, so newly-added
 * SDK command kinds are blocked by default (fail closed).
 */
export const ALLOWED_COMMAND_KINDS = new Set([
  'MoveCall',
  'SplitCoins',
  'MergeCoins',
  'MakeMoveVec',
]);

/** Max request body size in bytes. */
export const MAX_BODY_BYTES = 16_384;

/** Max age of a sponsor request timestamp (ms). */
export const MAX_REQUEST_AGE_MS = 60_000;

// ── GasCoin detection ──────────────────────────────────────────────

/**
 * Recursively check whether `value` contains a `{ $kind: 'GasCoin' }`
 * argument reference anywhere in its tree.
 *
 * In Sui PTBs the GasCoin sentinel resolves to the gas-owner's coin.
 * Because the sponsor is gas-owner, any command that touches GasCoin
 * could drain the sponsor wallet — not just gas, but the entire coin
 * balance.
 */
export function containsGasCoinReference(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;

  if (Array.isArray(value)) {
    return value.some((item) => containsGasCoinReference(item));
  }

  const obj = value as Record<string, unknown>;
  if (obj.$kind === 'GasCoin') return true;

  return Object.values(obj).some(
    (v) => typeof v === 'object' && v !== null && containsGasCoinReference(v),
  );
}

// ── Command-level validation ───────────────────────────────────────

/**
 * Validate an array of parsed PTB commands against the sponsor policy.
 *
 * Rules enforced (defence-in-depth):
 *  1. Non-empty, ≤ MAX_COMMANDS.
 *  2. Every command kind is in the allow-list (fail-closed for unknowns).
 *  3. NO command may reference GasCoin in any argument position.
 *  4. Every MoveCall targets the allowed package / module / function.
 *  5. At least one MoveCall must be present.
 *
 * @param commands  — deserialized `tx.getData().commands`
 * @param allowedPackageId — hex package ID from env (already validated non-empty)
 */
export function validateCommands(
  commands: Array<{ $kind: string; [key: string]: unknown }>,
  allowedPackageId: string,
): ValidationResult {
  if (!Array.isArray(commands) || commands.length === 0) {
    return { valid: false, reason: 'Empty transaction' };
  }
  if (commands.length > MAX_COMMANDS) {
    return { valid: false, reason: `Too many commands (${commands.length}/${MAX_COMMANDS})` };
  }

  const normalPkg = allowedPackageId.toLowerCase();
  let hasMoveCall = false;

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    const kind = cmd.$kind;

    // ── Allow-list gate ──
    if (!ALLOWED_COMMAND_KINDS.has(kind)) {
      return { valid: false, reason: `Disallowed command kind: ${kind}` };
    }

    // ── GasCoin reference gate (CRITICAL) ──
    if (containsGasCoinReference(cmd)) {
      return {
        valid: false,
        reason: `Command ${i} (${kind}) references GasCoin`,
      };
    }

    // ── MoveCall target validation ──
    if (kind === 'MoveCall') {
      hasMoveCall = true;
      const call = cmd.MoveCall as {
        package: string;
        module: string;
        function: string;
      };
      if (!call || typeof call !== 'object') {
        return { valid: false, reason: `Command ${i}: malformed MoveCall` };
      }
      if (call.package.toLowerCase() !== normalPkg) {
        return { valid: false, reason: `Disallowed package in command ${i}` };
      }
      if (call.module !== ALLOWED_MODULE) {
        return { valid: false, reason: `Disallowed module: ${call.module}` };
      }
      if (!ALLOWED_FUNCTIONS.has(call.function)) {
        return { valid: false, reason: `Disallowed function: ${call.function}` };
      }
    }
  }

  if (!hasMoveCall) {
    return { valid: false, reason: 'No MoveCall commands' };
  }

  return { valid: true };
}

// ── Audit logging ──────────────────────────────────────────────────

/** Emit a structured JSON audit log line (captured by Cloudflare Logs). */
export function auditLog(entry: AuditEntry): void {
  console.log(JSON.stringify(entry));
}
