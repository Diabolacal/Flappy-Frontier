/**
 * Unit tests for the sponsor service transaction validation.
 *
 * These test the core `validateCommands`, `containsGasCoinReference`,
 * and `parseAppPolicies` functions using mock command arrays — no Sui
 * RPC or BCS encoding needed.
 *
 * Run: cd workers/sponsor-service && npm test
 */
import { describe, it, expect } from 'vitest';
import {
  validateCommands,
  containsGasCoinReference,
  parseAppPolicies,
  DEFAULT_MAX_COMMANDS,
  ABSOLUTE_MAX_COMMANDS,
  type AppPolicy,
} from '../validation';

// ── Helpers ────────────────────────────────────────────────────────

type Command = { $kind: string; [key: string]: unknown };

const PACKAGE = '0xde1554bde721b2a256ea6b3b21ed08b174308a676216e11df8c651f34353e4eb';
const BAD_PACKAGE = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
const CC_PACKAGE = '0xcc00000000000000000000000000000000000000000000000000000000000000';
const WORLD_PACKAGE = '0xd12a70c74c1e759445d6f209b01d43d860e97fcf2ef72ccbbd00afd828043f75';

const FF_MODULE = 'game';
const FF_FUNCTIONS = ['start_run', 'submit_score', 'trigger_payout', 'discard_receipt'];

const FF_POLICY: AppPolicy = {
  id: 'flappy-frontier',
  packages: new Map([
    [PACKAGE.toLowerCase(), new Map([[FF_MODULE, new Set(FF_FUNCTIONS)]])],
  ]),
  maxCommands: DEFAULT_MAX_COMMANDS,
};

const CC_POLICY: AppPolicy = {
  id: 'civilization-control',
  packages: new Map([
    [
      WORLD_PACKAGE.toLowerCase(),
      new Map([
        ['character', new Set(['borrow_owner_cap', 'return_owner_cap'])],
        ['gate', new Set(['authorize_extension', 'update_metadata_url', 'online', 'offline'])],
        ['turret', new Set(['authorize_extension', 'online', 'offline'])],
      ]),
    ],
    [
      CC_PACKAGE.toLowerCase(),
      new Map([
        ['gate_control', new Set(['set_policy_preset', 'remove_policy_preset', 'set_treasury'])],
        ['posture', new Set(['set_posture'])],
      ]),
    ],
  ]),
  maxCommands: 200,
};

const BOTH_POLICIES = [FF_POLICY, CC_POLICY];

function makeMoveCall(
  pkg: string = PACKAGE,
  module: string = FF_MODULE,
  fn: string = 'start_run',
): Command {
  return {
    $kind: 'MoveCall',
    MoveCall: {
      package: pkg,
      module,
      function: fn,
      typeArguments: [],
      arguments: [
        { $kind: 'Input', Input: 0 },
        { $kind: 'Input', Input: 1 },
      ],
    },
  };
}

function makeSplitCoins(
  coin: Record<string, unknown>,
  amounts: Array<Record<string, unknown>>,
): Command {
  return {
    $kind: 'SplitCoins',
    SplitCoins: { coin, amounts },
  };
}

function makeTransferObjects(
  objects: Array<Record<string, unknown>>,
  address: Record<string, unknown>,
): Command {
  return {
    $kind: 'TransferObjects',
    TransferObjects: { objects, address },
  };
}

function makeMergeCoins(
  destination: Record<string, unknown>,
  sources: Array<Record<string, unknown>>,
): Command {
  return {
    $kind: 'MergeCoins',
    MergeCoins: { destination, sources },
  };
}

function makeMakeMoveVec(
  elements: Array<Record<string, unknown>>,
): Command {
  return {
    $kind: 'MakeMoveVec',
    MakeMoveVec: { type: null, elements },
  };
}

const GAS_COIN = { $kind: 'GasCoin' };
const INPUT_0 = { $kind: 'Input', Input: 0 };
const INPUT_1 = { $kind: 'Input', Input: 1 };
const RESULT_0 = { $kind: 'Result', Result: 0 };

// ── containsGasCoinReference ───────────────────────────────────────

describe('containsGasCoinReference', () => {
  it('detects direct GasCoin', () => {
    expect(containsGasCoinReference(GAS_COIN)).toBe(true);
  });

  it('detects GasCoin nested in SplitCoins', () => {
    const cmd = makeSplitCoins(GAS_COIN, [INPUT_0]);
    expect(containsGasCoinReference(cmd)).toBe(true);
  });

  it('detects GasCoin nested in MergeCoins destination', () => {
    const cmd = makeMergeCoins(GAS_COIN, [INPUT_0]);
    expect(containsGasCoinReference(cmd)).toBe(true);
  });

  it('detects GasCoin deeply nested in TransferObjects', () => {
    const cmd = makeTransferObjects([GAS_COIN], INPUT_0);
    expect(containsGasCoinReference(cmd)).toBe(true);
  });

  it('returns false for Input arguments', () => {
    const cmd = makeSplitCoins(INPUT_0, [INPUT_1]);
    expect(containsGasCoinReference(cmd)).toBe(false);
  });

  it('returns false for Result arguments', () => {
    const cmd = makeTransferObjects([RESULT_0], INPUT_0);
    expect(containsGasCoinReference(cmd)).toBe(false);
  });

  it('returns false for primitives', () => {
    expect(containsGasCoinReference(null)).toBe(false);
    expect(containsGasCoinReference(undefined)).toBe(false);
    expect(containsGasCoinReference(42)).toBe(false);
    expect(containsGasCoinReference('GasCoin')).toBe(false);
  });
});

// ── validateCommands — happy path ──────────────────────────────────

describe('validateCommands — happy path', () => {
  it('accepts a single valid MoveCall', () => {
    const result = validateCommands([makeMoveCall()], [FF_POLICY]);
    expect(result.valid).toBe(true);
    expect(result.matchedApp).toBe('flappy-frontier');
  });

  it('accepts all allowed functions', () => {
    for (const fn of FF_FUNCTIONS) {
      const result = validateCommands([makeMoveCall(PACKAGE, FF_MODULE, fn)], [FF_POLICY]);
      expect(result.valid).toBe(true);
    }
  });

  it('accepts MoveCall + SplitCoins on player coin (not GasCoin)', () => {
    const cmds = [
      makeSplitCoins(INPUT_0, [INPUT_1]),
      makeMoveCall(),
    ];
    const result = validateCommands(cmds, [FF_POLICY]);
    expect(result.valid).toBe(true);
  });

  it('accepts MoveCall + MergeCoins on player coins', () => {
    const cmds = [
      makeMergeCoins(INPUT_0, [INPUT_1]),
      makeMoveCall(),
    ];
    const result = validateCommands(cmds, [FF_POLICY]);
    expect(result.valid).toBe(true);
  });

  it('accepts MoveCall + MakeMoveVec', () => {
    const cmds = [
      makeMakeMoveVec([INPUT_0, INPUT_1]),
      makeMoveCall(),
    ];
    const result = validateCommands(cmds, [FF_POLICY]);
    expect(result.valid).toBe(true);
  });

  it('is case-insensitive for package ID', () => {
    const result = validateCommands(
      [makeMoveCall(PACKAGE.toUpperCase())],
      [FF_POLICY],
    );
    expect(result.valid).toBe(true);
  });
});

// ── validateCommands — GasCoin exploitation ────────────────────────

describe('validateCommands — GasCoin exploitation', () => {
  it('rejects SplitCoins(GasCoin) — the critical theft vector', () => {
    const cmds = [
      makeSplitCoins(GAS_COIN, [INPUT_0]),
      makeTransferObjects([RESULT_0], INPUT_1),
      makeMoveCall(),
    ];
    const result = validateCommands(cmds, [FF_POLICY]);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('GasCoin');
  });

  it('rejects SplitCoins(GasCoin) even without TransferObjects', () => {
    const cmds = [
      makeSplitCoins(GAS_COIN, [INPUT_0]),
      makeMoveCall(),
    ];
    const result = validateCommands(cmds, [FF_POLICY]);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('GasCoin');
  });

  it('rejects MergeCoins into GasCoin', () => {
    const cmds = [
      makeMergeCoins(GAS_COIN, [INPUT_0]),
      makeMoveCall(),
    ];
    const result = validateCommands(cmds, [FF_POLICY]);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('GasCoin');
  });

  it('rejects MakeMoveVec containing GasCoin', () => {
    const cmds = [
      makeMakeMoveVec([GAS_COIN]),
      makeMoveCall(),
    ];
    const result = validateCommands(cmds, [FF_POLICY]);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('GasCoin');
  });
});

// ── validateCommands — disallowed commands ─────────────────────────

describe('validateCommands — disallowed commands', () => {
  it('rejects TransferObjects (not needed in sponsored PTBs)', () => {
    const cmds = [
      makeTransferObjects([RESULT_0], INPUT_0),
      makeMoveCall(),
    ];
    const result = validateCommands(cmds, [FF_POLICY]);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('TransferObjects');
  });

  it('rejects Publish', () => {
    const cmds = [
      { $kind: 'Publish', Publish: { modules: [], dependencies: [] } },
      makeMoveCall(),
    ];
    const result = validateCommands(cmds, [FF_POLICY]);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Publish');
  });

  it('rejects Upgrade', () => {
    const cmds = [
      { $kind: 'Upgrade', Upgrade: {} },
      makeMoveCall(),
    ];
    const result = validateCommands(cmds, [FF_POLICY]);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Upgrade');
  });

  it('rejects unknown command kinds (fail closed)', () => {
    const cmds = [
      { $kind: 'FutureNewCommand', FutureNewCommand: {} },
      makeMoveCall(),
    ];
    const result = validateCommands(cmds, [FF_POLICY]);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('FutureNewCommand');
  });
});

// ── validateCommands — MoveCall target validation ──────────────────

describe('validateCommands — MoveCall target validation', () => {
  it('rejects wrong package', () => {
    const result = validateCommands([makeMoveCall(BAD_PACKAGE)], [FF_POLICY]);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('package');
  });

  it('rejects wrong module', () => {
    const result = validateCommands(
      [makeMoveCall(PACKAGE, 'treasury')],
      [FF_POLICY],
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('module');
  });

  it('rejects wrong function', () => {
    const result = validateCommands(
      [makeMoveCall(PACKAGE, FF_MODULE, 'steal_all')],
      [FF_POLICY],
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('function');
  });

  it('rejects DEX router call alongside valid game call', () => {
    const cmds = [
      makeMoveCall(), // valid game call
      makeMoveCall(BAD_PACKAGE, 'router', 'swap_exact_input'), // DEX call
    ];
    const result = validateCommands(cmds, [FF_POLICY]);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('package');
  });
});

// ── validateCommands — structural validation ───────────────────────

describe('validateCommands — structural validation', () => {
  it('rejects empty commands', () => {
    const result = validateCommands([], [FF_POLICY]);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Empty');
  });

  it('rejects too many commands', () => {
    const cmds = Array.from({ length: DEFAULT_MAX_COMMANDS + 1 }, () => makeMoveCall());
    const result = validateCommands(cmds, [FF_POLICY]);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Too many');
  });

  it('rejects commands exceeding ABSOLUTE_MAX_COMMANDS', () => {
    const cmds = Array.from({ length: ABSOLUTE_MAX_COMMANDS + 1 }, () => makeMoveCall());
    const bigPolicy: AppPolicy = { ...FF_POLICY, maxCommands: 100 };
    const result = validateCommands(cmds, [bigPolicy]);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Too many');
  });

  it('rejects commands with no MoveCall', () => {
    const cmds = [makeSplitCoins(INPUT_0, [INPUT_1])];
    const result = validateCommands(cmds, [FF_POLICY]);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('No MoveCall');
  });

  it('accepts exactly DEFAULT_MAX_COMMANDS commands', () => {
    const cmds = Array.from({ length: DEFAULT_MAX_COMMANDS }, () => makeMoveCall());
    const result = validateCommands(cmds, [FF_POLICY]);
    expect(result.valid).toBe(true);
  });
});

// ── Combined attack scenario ───────────────────────────────────────

describe('validateCommands — combined attack scenarios', () => {
  it('rejects the 10-SUI drain attack: SplitCoins(GasCoin) + TransferObjects + valid MoveCall', () => {
    // This is the exact exploit class that caused the incident
    const cmds = [
      makeSplitCoins(GAS_COIN, [{ $kind: 'Input', Input: 0 }]),
      makeTransferObjects([RESULT_0], { $kind: 'Input', Input: 1 }),
      makeMoveCall(),
    ];
    const result = validateCommands(cmds, [FF_POLICY]);
    expect(result.valid).toBe(false);
    // Should be caught at the first offending command
    expect(result.reason).toContain('GasCoin');
  });

  it('rejects pure SplitCoins(GasCoin) with no MoveCall decoy', () => {
    const cmds = [makeSplitCoins(GAS_COIN, [INPUT_0])];
    const result = validateCommands(cmds, [FF_POLICY]);
    expect(result.valid).toBe(false);
  });

  it('rejects SplitCoins(GasCoin) hidden among many valid commands', () => {
    const cmds = [
      makeMoveCall(PACKAGE, FF_MODULE, 'start_run'),
      makeSplitCoins(INPUT_0, [INPUT_1]), // legitimate coin split
      makeSplitCoins(GAS_COIN, [INPUT_0]), // hidden attack
      makeMoveCall(PACKAGE, FF_MODULE, 'submit_score'),
    ];
    const result = validateCommands(cmds, [FF_POLICY]);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('GasCoin');
  });
});

// ── parseAppPolicies ───────────────────────────────────────────────

describe('parseAppPolicies', () => {
  it('parses legacy single-package config', () => {
    const configs = [
      {
        id: 'test-app',
        packageId: '0xABC123',
        targets: { game: ['start', 'stop'] },
      },
    ];
    const policies = parseAppPolicies(configs);
    expect(policies).toHaveLength(1);
    expect(policies[0].id).toBe('test-app');
    expect(policies[0].packages.get('0xabc123')?.get('game')).toEqual(new Set(['start', 'stop']));
    expect(policies[0].maxCommands).toBe(DEFAULT_MAX_COMMANDS);
  });

  it('parses multi-package config', () => {
    const configs = [
      {
        id: 'multi-app',
        packages: {
          '0xAAA': { mod_a: ['fn_a'] },
          '0xBBB': { mod_b: ['fn_b1', 'fn_b2'] },
        },
        maxCommands: 100,
      },
    ];
    const policies = parseAppPolicies(configs);
    expect(policies).toHaveLength(1);
    expect(policies[0].packages.size).toBe(2);
    expect(policies[0].packages.get('0xaaa')?.get('mod_a')).toEqual(new Set(['fn_a']));
    expect(policies[0].packages.get('0xbbb')?.get('mod_b')).toEqual(new Set(['fn_b1', 'fn_b2']));
    expect(policies[0].maxCommands).toBe(100);
  });

  it('clamps maxCommands to ABSOLUTE_MAX_COMMANDS', () => {
    const configs = [
      {
        id: 'greedy-app',
        packageId: '0x123',
        targets: { mod: ['fn'] },
        maxCommands: 9999,
      },
    ];
    const policies = parseAppPolicies(configs);
    expect(policies[0].maxCommands).toBe(ABSOLUTE_MAX_COMMANDS);
  });

  it('returns empty array for invalid input', () => {
    expect(parseAppPolicies([] as never)).toEqual([]);
    expect(parseAppPolicies(null as never)).toEqual([]);
    expect(parseAppPolicies(undefined as never)).toEqual([]);
  });

  it('respects custom maxCommands within ceiling', () => {
    const configs = [
      {
        id: 'custom-app',
        packageId: '0x456',
        targets: { mod: ['fn'] },
        maxCommands: 8,
      },
    ];
    const policies = parseAppPolicies(configs);
    expect(policies[0].maxCommands).toBe(8);
  });
});

// ── validateCommands — multi-app policy ────────────────────────────

describe('validateCommands — multi-app policy', () => {
  it('accepts FF calls when both policies are active', () => {
    const result = validateCommands([makeMoveCall()], BOTH_POLICIES);
    expect(result.valid).toBe(true);
    expect(result.matchedApp).toBe('flappy-frontier');
  });

  it('accepts CC calls (CC package) when both policies are active', () => {
    const cmds = [makeMoveCall(CC_PACKAGE, 'posture', 'set_posture')];
    const result = validateCommands(cmds, BOTH_POLICIES);
    expect(result.valid).toBe(true);
    expect(result.matchedApp).toBe('civilization-control');
  });

  it('accepts CC calls (WORLD package) when both policies are active', () => {
    const cmds = [makeMoveCall(WORLD_PACKAGE, 'gate', 'online')];
    const result = validateCommands(cmds, BOTH_POLICIES);
    expect(result.valid).toBe(true);
    expect(result.matchedApp).toBe('civilization-control');
  });

  it('accepts multi-package CC PTB (WORLD + CC in same tx)', () => {
    // Realistic governance PTB: borrow owner cap → action → return owner cap
    const cmds = [
      makeMoveCall(WORLD_PACKAGE, 'character', 'borrow_owner_cap'),
      makeMoveCall(WORLD_PACKAGE, 'turret', 'authorize_extension'),
      makeMoveCall(CC_PACKAGE, 'posture', 'set_posture'),
      makeMoveCall(WORLD_PACKAGE, 'character', 'return_owner_cap'),
    ];
    const result = validateCommands(cmds, BOTH_POLICIES);
    expect(result.valid).toBe(true);
    expect(result.matchedApp).toBe('civilization-control');
  });

  it('rejects cross-app PTB (FF + CC packages mixed)', () => {
    const cmds = [
      makeMoveCall(PACKAGE, FF_MODULE, 'start_run'),
      makeMoveCall(CC_PACKAGE, 'posture', 'set_posture'),
    ];
    const result = validateCommands(cmds, BOTH_POLICIES);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Cross-app');
  });

  it('rejects cross-app PTB (FF + WORLD packages mixed)', () => {
    const cmds = [
      makeMoveCall(PACKAGE, FF_MODULE, 'start_run'),
      makeMoveCall(WORLD_PACKAGE, 'gate', 'online'),
    ];
    const result = validateCommands(cmds, BOTH_POLICIES);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Cross-app');
  });

  it('respects per-policy maxCommands (CC allows 200)', () => {
    // 10 CC governance calls should pass easily
    const cmds = Array.from({ length: 10 }, () =>
      makeMoveCall(CC_PACKAGE, 'posture', 'set_posture'),
    );
    const result = validateCommands(cmds, BOTH_POLICIES);
    expect(result.valid).toBe(true);
  });

  it('enforces per-policy maxCommands limit', () => {
    // DEFAULT_MAX_COMMANDS + 1 FF calls should fail (FF policy.maxCommands = 6)
    const cmds = Array.from({ length: DEFAULT_MAX_COMMANDS + 1 }, () => makeMoveCall());
    const result = validateCommands(cmds, BOTH_POLICIES);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Too many');
  });

  it('rejects unknown package even when multiple policies exist', () => {
    const cmds = [makeMoveCall(BAD_PACKAGE)];
    const result = validateCommands(cmds, BOTH_POLICIES);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('package');
  });

  it('rejects CC function not in CC policy', () => {
    const cmds = [makeMoveCall(CC_PACKAGE, 'gate_control', 'steal_funds')];
    const result = validateCommands(cmds, BOTH_POLICIES);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('function');
  });

  it('rejects CC module not in CC policy', () => {
    const cmds = [makeMoveCall(CC_PACKAGE, 'treasury', 'drain')];
    const result = validateCommands(cmds, BOTH_POLICIES);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('module');
  });

  it('rejects excluded value-transfer CC function', () => {
    // request_jump_permit is intentionally excluded from CC policy
    const cmds = [makeMoveCall(CC_PACKAGE, 'gate_control', 'request_jump_permit')];
    const result = validateCommands(cmds, BOTH_POLICIES);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('function');
  });
});
