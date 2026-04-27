/**
 * Transaction intent validation for the sponsor service.
 *
 * Validates that a deserialized PTB only contains commands that are safe
 * for the sponsor to co-sign.  The sponsor's gas coin MUST NOT be
 * reachable by any command — otherwise an attacker can SplitCoins from
 * the sponsor wallet and TransferObjects to themselves.
 *
 * Supports multiple app policies — each app declares its allowed
 * package ID, module/function targets, and command limit.  A single PTB
 * must target exactly one app (cross-app mixing is rejected).
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
  app?: string;
  commandKinds?: string[];
  reason?: string;
}

// ── App policy types ───────────────────────────────────────────────

/**
 * JSON-serialisable policy config (stored in APP_POLICIES env var).
 *
 * Supports two shapes:
 * - **Single-package** (legacy): `{ id, packageId, targets }` — for apps
 *   whose PTBs only call one package (e.g. Flappy Frontier).
 * - **Multi-package**: `{ id, packages }` — for apps whose PTBs call
 *   multiple packages in a single transaction (e.g. CivilizationControl
 *   calls both WORLD and CC packages).
 */
export interface AppPolicyConfig {
  /** Human-readable app identifier (used in audit logs). */
  id: string;
  /**
   * Multi-package targets: packageId → { module → [functions] }.
   * Use for apps whose PTBs call multiple on-chain packages.
   */
  packages?: Record<string, Record<string, string[]>>;
  /** Single-package shorthand — hex package ID (use `packages` for multi-package). */
  packageId?: string;
  /** Single-package shorthand — module → [functions] (use `packages` for multi-package). */
  targets?: Record<string, string[]>;
  /** Max PTB commands for this app (defaults to DEFAULT_MAX_COMMANDS). */
  maxCommands?: number;
}

/** Parsed, normalised policy for runtime validation. */
export interface AppPolicy {
  id: string;
  /** Package-scoped targets: lowercased packageId → Map<module, Set<function>>. */
  packages: Map<string, Map<string, Set<string>>>;
  maxCommands: number;
}

// ── Constants ──────────────────────────────────────────────────────

/** Default max commands per app if not specified in policy config. */
export const DEFAULT_MAX_COMMANDS = 6;

/**
 * Absolute ceiling — no policy can exceed this regardless of config.
 *
 * Set to 250 to accommodate CC governance batch operations.
 * A posture switch across all ~50 structures uses ~200 MoveCall commands
 * (borrow/action/[url]/return per structure).  250 gives headroom
 * without approaching Sui's 1024-command PTB limit.
 */
export const ABSOLUTE_MAX_COMMANDS = 250;

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

/**
 * Max request body size in bytes.
 *
 * Must accommodate CC governance batch PTBs.  A posture switch across
 * ~50 structures produces ~200 MoveCall commands with object-ID and
 * type-argument payloads, totalling 50–150 KB base64.  512 KB gives
 * ample headroom while staying far below Cloudflare's 100 MB limit.
 *
 * Flappy Frontier PTBs are 1–3 KB; this limit does not weaken FF security
 * because command-kind, GasCoin, and target allow-lists are the real guards.
 */
export const MAX_BODY_BYTES = 524_288;

/** Max age of a sponsor request timestamp (ms). */
export const MAX_REQUEST_AGE_MS = 60_000;

// ── Policy parsing ─────────────────────────────────────────────────

/**
 * Parse and normalise JSON policy configs into runtime policies.
 * Package IDs are lowercased for case-insensitive matching.
 * maxCommands is clamped to ABSOLUTE_MAX_COMMANDS.
 */
export function parseAppPolicies(configs: AppPolicyConfig[]): AppPolicy[] {
  if (!Array.isArray(configs) || configs.length === 0) {
    return [];
  }
  return configs.map((c) => {
    // Support both multi-package and legacy single-package shapes
    const rawPackages: Record<string, Record<string, string[]>> =
      c.packages ??
      (c.packageId && c.targets ? { [c.packageId]: c.targets } : {});

    const packages = new Map<string, Map<string, Set<string>>>();
    for (const [pkgId, targets] of Object.entries(rawPackages)) {
      packages.set(
        pkgId.toLowerCase(),
        new Map(
          Object.entries(targets).map(([mod, fns]) => [mod, new Set(fns)]),
        ),
      );
    }

    return {
      id: c.id,
      packages,
      maxCommands: Math.min(
        c.maxCommands ?? DEFAULT_MAX_COMMANDS,
        ABSOLUTE_MAX_COMMANDS,
      ),
    };
  });
}

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
 * Validate an array of parsed PTB commands against the sponsor policies.
 *
 * Rules enforced (defence-in-depth):
 *  1. Non-empty, ≤ ABSOLUTE_MAX_COMMANDS (global ceiling).
 *  2. Every command kind is in the allow-list (fail-closed for unknowns).
 *  3. NO command may reference GasCoin in any argument position.
 *  4. Every MoveCall targets an allowed package / module / function.
 *  5. All MoveCall commands must match the SAME app policy (no cross-app).
 *  6. Total commands ≤ matched policy's maxCommands.
 *  7. At least one MoveCall must be present.
 *
 * @param commands — deserialized `tx.getData().commands`
 * @param policies — parsed app policies from env config
 */
export function validateCommands(
  commands: Array<{ $kind: string; [key: string]: unknown }>,
  policies: AppPolicy[],
): ValidationResult & { matchedApp?: string } {
  if (!Array.isArray(commands) || commands.length === 0) {
    return { valid: false, reason: 'Empty transaction' };
  }
  if (commands.length > ABSOLUTE_MAX_COMMANDS) {
    return {
      valid: false,
      reason: `Too many commands (${commands.length}/${ABSOLUTE_MAX_COMMANDS})`,
    };
  }

  let matchedPolicy: AppPolicy | null = null;

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
      const call = cmd.MoveCall as {
        package: string;
        module: string;
        function: string;
      };
      if (!call || typeof call !== 'object') {
        return { valid: false, reason: `Command ${i}: malformed MoveCall` };
      }

      const pkg = call.package.toLowerCase();

      // Find matching policy — any policy whose packages map contains this pkg
      const policy = policies.find((p) => p.packages.has(pkg));
      if (!policy) {
        return { valid: false, reason: `Disallowed package in command ${i}` };
      }

      // All MoveCall commands must target the same app policy (no cross-app mixing)
      if (matchedPolicy && matchedPolicy.id !== policy.id) {
        return { valid: false, reason: 'Cross-app calls not allowed' };
      }
      matchedPolicy = policy;

      // Validate module against the matched package's targets
      const pkgTargets = policy.packages.get(pkg)!;
      const allowedFns = pkgTargets.get(call.module);
      if (!allowedFns) {
        return { valid: false, reason: `Disallowed module: ${call.module}` };
      }
      // Validate function
      if (!allowedFns.has(call.function)) {
        return { valid: false, reason: `Disallowed function: ${call.function}` };
      }
    }
  }

  if (!matchedPolicy) {
    return { valid: false, reason: 'No MoveCall commands' };
  }

  // Check command count against matched policy's per-app limit
  if (commands.length > matchedPolicy.maxCommands) {
    return {
      valid: false,
      reason: `Too many commands (${commands.length}/${matchedPolicy.maxCommands})`,
    };
  }

  return { valid: true, matchedApp: matchedPolicy.id };
}

// ── Audit logging ──────────────────────────────────────────────────

/** Emit a structured JSON audit log line (captured by Cloudflare Logs). */
export function auditLog(entry: AuditEntry): void {
  console.log(JSON.stringify(entry));
}
