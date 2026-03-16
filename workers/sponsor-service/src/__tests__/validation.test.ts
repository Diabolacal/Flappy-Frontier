/**
 * Unit tests for the sponsor service transaction validation.
 *
 * These test the core `validateCommands` and `containsGasCoinReference`
 * functions using mock command arrays — no Sui RPC or BCS encoding needed.
 *
 * Run: cd workers/sponsor-service && npm test
 */
import { describe, it, expect } from 'vitest';
import {
  validateCommands,
  containsGasCoinReference,
  ALLOWED_FUNCTIONS,
  ALLOWED_MODULE,
  MAX_COMMANDS,
} from '../validation';

// ── Helpers ────────────────────────────────────────────────────────

type Command = { $kind: string; [key: string]: unknown };

const PACKAGE = '0xde1554bde721b2a256ea6b3b21ed08b174308a676216e11df8c651f34353e4eb';
const BAD_PACKAGE = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';

function makeMoveCall(
  pkg: string = PACKAGE,
  module: string = ALLOWED_MODULE,
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
    const result = validateCommands([makeMoveCall()], PACKAGE);
    expect(result.valid).toBe(true);
  });

  it('accepts all allowed functions', () => {
    for (const fn of ALLOWED_FUNCTIONS) {
      const result = validateCommands([makeMoveCall(PACKAGE, ALLOWED_MODULE, fn)], PACKAGE);
      expect(result.valid).toBe(true);
    }
  });

  it('accepts MoveCall + SplitCoins on player coin (not GasCoin)', () => {
    const cmds = [
      makeSplitCoins(INPUT_0, [INPUT_1]),
      makeMoveCall(),
    ];
    const result = validateCommands(cmds, PACKAGE);
    expect(result.valid).toBe(true);
  });

  it('accepts MoveCall + MergeCoins on player coins', () => {
    const cmds = [
      makeMergeCoins(INPUT_0, [INPUT_1]),
      makeMoveCall(),
    ];
    const result = validateCommands(cmds, PACKAGE);
    expect(result.valid).toBe(true);
  });

  it('accepts MoveCall + MakeMoveVec', () => {
    const cmds = [
      makeMakeMoveVec([INPUT_0, INPUT_1]),
      makeMoveCall(),
    ];
    const result = validateCommands(cmds, PACKAGE);
    expect(result.valid).toBe(true);
  });

  it('is case-insensitive for package ID', () => {
    const result = validateCommands(
      [makeMoveCall(PACKAGE.toUpperCase())],
      PACKAGE.toLowerCase(),
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
    const result = validateCommands(cmds, PACKAGE);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('GasCoin');
  });

  it('rejects SplitCoins(GasCoin) even without TransferObjects', () => {
    const cmds = [
      makeSplitCoins(GAS_COIN, [INPUT_0]),
      makeMoveCall(),
    ];
    const result = validateCommands(cmds, PACKAGE);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('GasCoin');
  });

  it('rejects MergeCoins into GasCoin', () => {
    const cmds = [
      makeMergeCoins(GAS_COIN, [INPUT_0]),
      makeMoveCall(),
    ];
    const result = validateCommands(cmds, PACKAGE);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('GasCoin');
  });

  it('rejects MakeMoveVec containing GasCoin', () => {
    const cmds = [
      makeMakeMoveVec([GAS_COIN]),
      makeMoveCall(),
    ];
    const result = validateCommands(cmds, PACKAGE);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('GasCoin');
  });
});

// ── validateCommands — disallowed commands ─────────────────────────

describe('validateCommands — disallowed commands', () => {
  it('rejects TransferObjects (not needed in game PTBs)', () => {
    const cmds = [
      makeTransferObjects([RESULT_0], INPUT_0),
      makeMoveCall(),
    ];
    const result = validateCommands(cmds, PACKAGE);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('TransferObjects');
  });

  it('rejects Publish', () => {
    const cmds = [
      { $kind: 'Publish', Publish: { modules: [], dependencies: [] } },
      makeMoveCall(),
    ];
    const result = validateCommands(cmds, PACKAGE);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Publish');
  });

  it('rejects Upgrade', () => {
    const cmds = [
      { $kind: 'Upgrade', Upgrade: {} },
      makeMoveCall(),
    ];
    const result = validateCommands(cmds, PACKAGE);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Upgrade');
  });

  it('rejects unknown command kinds (fail closed)', () => {
    const cmds = [
      { $kind: 'FutureNewCommand', FutureNewCommand: {} },
      makeMoveCall(),
    ];
    const result = validateCommands(cmds, PACKAGE);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('FutureNewCommand');
  });
});

// ── validateCommands — MoveCall target validation ──────────────────

describe('validateCommands — MoveCall target validation', () => {
  it('rejects wrong package', () => {
    const result = validateCommands([makeMoveCall(BAD_PACKAGE)], PACKAGE);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('package');
  });

  it('rejects wrong module', () => {
    const result = validateCommands(
      [makeMoveCall(PACKAGE, 'treasury')],
      PACKAGE,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('module');
  });

  it('rejects wrong function', () => {
    const result = validateCommands(
      [makeMoveCall(PACKAGE, ALLOWED_MODULE, 'steal_all')],
      PACKAGE,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('function');
  });

  it('rejects DEX router call alongside valid game call', () => {
    const cmds = [
      makeMoveCall(), // valid game call
      makeMoveCall(BAD_PACKAGE, 'router', 'swap_exact_input'), // DEX call
    ];
    const result = validateCommands(cmds, PACKAGE);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('package');
  });
});

// ── validateCommands — structural validation ───────────────────────

describe('validateCommands — structural validation', () => {
  it('rejects empty commands', () => {
    const result = validateCommands([], PACKAGE);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Empty');
  });

  it('rejects too many commands', () => {
    const cmds = Array.from({ length: MAX_COMMANDS + 1 }, () => makeMoveCall());
    const result = validateCommands(cmds, PACKAGE);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Too many');
  });

  it('rejects commands with no MoveCall', () => {
    const cmds = [makeSplitCoins(INPUT_0, [INPUT_1])];
    const result = validateCommands(cmds, PACKAGE);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('No MoveCall');
  });

  it('accepts exactly MAX_COMMANDS commands', () => {
    const cmds = Array.from({ length: MAX_COMMANDS }, () => makeMoveCall());
    const result = validateCommands(cmds, PACKAGE);
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
    const result = validateCommands(cmds, PACKAGE);
    expect(result.valid).toBe(false);
    // Should be caught at the first offending command
    expect(result.reason).toContain('GasCoin');
  });

  it('rejects pure SplitCoins(GasCoin) with no MoveCall decoy', () => {
    const cmds = [makeSplitCoins(GAS_COIN, [INPUT_0])];
    const result = validateCommands(cmds, PACKAGE);
    expect(result.valid).toBe(false);
  });

  it('rejects SplitCoins(GasCoin) hidden among many valid commands', () => {
    const cmds = [
      makeMoveCall(PACKAGE, ALLOWED_MODULE, 'start_run'),
      makeSplitCoins(INPUT_0, [INPUT_1]), // legitimate coin split
      makeSplitCoins(GAS_COIN, [INPUT_0]), // hidden attack
      makeMoveCall(PACKAGE, ALLOWED_MODULE, 'submit_score'),
    ];
    const result = validateCommands(cmds, PACKAGE);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('GasCoin');
  });
});
