---
description: "TypeScript, React, and Tailwind CSS conventions for hackathon repos"
applyTo: "**/*.{ts,tsx}"
---

# TypeScript / React / Tailwind — Workspace Conventions

> Apply these rules when writing or modifying TypeScript and React code.
> Full rationale and thresholds in `docs/core/hackathon-repo-conventions.md`.

## File Size Guardrails

- **Component file: ~150 lines max.** Split into sub-components at this threshold.
- **Page/route component: ~100 lines max.** Pages are orchestrators — fetch data, compose components, handle layout.
- **App.tsx: ~30 lines max.** Only providers + router. Zero business logic.
- **JSX return block: ~80 lines max.** Extract child components.
- **Custom hook: ~100 lines max.** Split or extract pure helpers.
- **No nested render functions.** Never define `function renderFoo()` inside a component — extract to a file.

## Pre-Planning / File Decomposition (Mandatory)

Before generating any new component, hook, or utility file, the agent **must** outline the file decomposition in its plan:

1. **Estimate scope first.** Before writing code, mentally estimate the line count of the feature. If a single component or hook is likely to exceed its size limit (~150 lines for components, ~100 for hooks/pages), design it as multiple files in the plan.
2. **Declare file boundaries upfront.** The plan must list every file to be created or modified, with a one-line purpose for each. Do not start writing code until the decomposition is explicit.
3. **Split proactively, not reactively.** Never write a file past its size limit and then split afterward. If mid-generation you realize a file will exceed its limit, stop, revise the plan to add sub-components/hooks, and restart from the revised plan.
4. **Common split points:** Extract `useFoo` hooks for state+effect combos, extract `FooItem` for `.map()` children, extract `FooForm`/`FooList`/`FooDetail` for multi-section UIs, extract utility functions to `utils/`.

## Component Rules

- One non-trivial component per file.
- **Split when:** >3 `useState` calls, >2 `useEffect` calls, JSX return >80 lines, `.map()` plus other significant markup.
- **Always name components.** No `export default () => ...`.
- **Destructure props** in the function signature.
- Props interface named `ComponentNameProps`, defined above or inline.

## Naming

| Element | Convention | Example |
|---------|-----------|---------|
| Component files | `PascalCase.tsx` | `PolicyEditor.tsx` |
| Hook files | `use` prefix, camelCase | `useWalletStatus.ts` |
| Utility files | `camelCase.ts` | `formatAddress.ts` |
| Directories | `kebab-case` | `game-ui/`, `leaderboard/` |
| Types/interfaces | `PascalCase`, no `I` prefix | `PolicyConfig` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_RETRY_COUNT` |
| Boolean vars | `is/has/should/can` prefix | `isLoading` |
| Handler props | `on` prefix | `onSubmit` |
| Handler functions | `handle` prefix | `handleSubmit` |

## Imports

Order: (1) React/framework → (2) third-party → (3) shared internal (`@/`) → (4) feature-relative (`./`).
Blank line between groups. Use `import type` for type-only imports. No circular imports.

## State Management

- **Component state:** `useState`, `useReducer` (max 3 `useState` before extracting a hook).
- **Server state:** TanStack Query. Never put server data in global state.
- **Global state:** Zustand or Context. Max 3 stores.
- **Derive, don't duplicate.** If computable from existing state, use `useMemo`.

## TypeScript

- **`strict: true`** always.
- **No `any`.** Use `unknown` + narrowing.
- **No `as` assertions** unless narrowing from `unknown` after a runtime check.
- **No unused imports.**

## Tailwind CSS

- Utility classes inline in JSX. No separate CSS files unless forced.
- Use `cn()` / `clsx` for conditional classes — never string concatenation with ternaries.
- Extract repeated class combos into React components, not `@apply`.
- Install `prettier-plugin-tailwindcss` for auto-sorted classes.

## Hooks

- Extract to a hook when: `useState` + `useEffect` together, same pattern in 2+ components, or >20 lines of logic before the JSX return.
- Hooks must start with `use`. Hooks don't return JSX (that's a component).
- Pure functions (no React state/effects) go in `utils/`, not in hooks.

## Folder Structure

```
src/
├── app/              # Router, providers, layout
├── components/       # Shared UI
│   ├── ui/           # Primitives (Button, Input)
│   └── layouts/      # Layout shells
├── features/         # Self-contained feature modules
│   └── <feature>/
│       ├── components/
│       ├── hooks/
│       ├── api/
│       ├── types.ts
│       └── utils.ts
├── hooks/            # Shared hooks
├── lib/              # Third-party wrappers
├── types/            # Shared types
├── utils/            # Shared pure functions
└── constants.ts
```

Group by feature, not by type. Feature-specific code stays in the feature folder. Promote to shared when used by 2+ features. No cross-feature imports.

## Sui TypeScript SDK — Mandatory Packages & Banned Imports

> **Context:** The Sui SDK was overhauled from a monolithic `@mysten/sui.js` to modular `@mysten/sui/*` subpath packages. LLMs trained before mid-2025 will hallucinate the old API. This section is the authoritative guardrail.

### Banned Packages (NEVER import)

| Banned Import | Reason | Correct Replacement |
|---------------|--------|---------------------|
| `@mysten/sui.js` | Monolithic package, fully deprecated | `@mysten/sui/*` subpath imports |
| `@mysten/sui.js/client` | Old subpath of dead package | `@mysten/sui/jsonRpc` |
| `SuiClient` from `@mysten/sui/client` | Deprecated Feb 28 2026 | `SuiJsonRpcClient` from `@mysten/sui/jsonRpc` |
| `JsonRpcProvider` | Ancient pre-v1 class | `SuiJsonRpcClient` from `@mysten/sui/jsonRpc` |
| `TransactionBlock` | Renamed class from old SDK | `Transaction` from `@mysten/sui/transactions` |
| `useSponsoredTransaction` | Removed from dapp-kit | `useDAppKit()` from `@mysten/dapp-kit-react` |

If an agent generates any banned import, it **must** self-correct immediately before continuing.

### Required Packages (March 2026 Standard)

**TS Scripts / Backend (non-React):**
```typescript
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { bcs } from "@mysten/sui/bcs";
```

**React dApp:**
```typescript
import { useDAppKit } from "@mysten/dapp-kit-react";
import { Transaction } from "@mysten/sui/transactions";
import { useSmartObject, useConnection } from "@evefrontier/dapp-kit";
```

**package.json dependencies (minimum versions):**
```json
{
  "@mysten/sui": "^2.0.0",
  "@mysten/dapp-kit-react": "^1.0.2",
  "@evefrontier/dapp-kit": "^0.1.2",
  "@tanstack/react-query": "^5.0.0"
}
```

### PTB Construction — Known-Good Patterns

**Client setup (scripts / backend):**
```typescript
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

const client = new SuiJsonRpcClient({ url: "http://127.0.0.1:9000", network: "localnet" });
const keypair = Ed25519Keypair.fromSecretKey(secretKey);
```

**Basic PTB with coin splitting (entry fee pattern):**
```typescript
const tx = new Transaction();

// Split toll amount from the player's gas coin
const tollAmount = 1_000_000; // in MIST (1 SUI = 1e9 MIST)
const [tollCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(tollAmount)]);

// Pay the toll via a Move call (extension-defined function)
tx.moveCall({
  target: `${packageId}::gate_control::pay_toll`,
  arguments: [
    tx.object(gateId),       // &mut Gate
    tollCoin,                // Coin<SUI> split above
    tx.object(configId),     // &TollConfig
  ],
});

// Sign and execute
const result = await client.signAndExecuteTransaction({
  transaction: tx,
  signer: keypair,
  options: { showEffects: true, showEvents: true },
});
```

**Borrow-Use-Return hot-potato PTB (OwnerCap pattern):**
```typescript
const tx = new Transaction();

// 1. Borrow OwnerCap from character (returns hot-potato receipt)
const [ownerCap, receipt] = tx.moveCall({
  target: `${worldPackageId}::character::borrow_owner_cap`,
  typeArguments: [`${worldPackageId}::gate::Gate`],
  arguments: [tx.object(characterId), tx.receivingRef(ownerCapTicket)],
});

// 2. Use the OwnerCap (e.g., bring gate online)
tx.moveCall({
  target: `${worldPackageId}::gate::online`,
  arguments: [
    tx.object(gateId),
    tx.object(networkNodeId),
    tx.object(energyConfigId),
    ownerCap,
  ],
});

// 3. Return OwnerCap — MANDATORY (receipt has no `drop` ability)
tx.moveCall({
  target: `${worldPackageId}::character::return_owner_cap`,
  typeArguments: [`${worldPackageId}::gate::Gate`],
  arguments: [tx.object(characterId), ownerCap, receipt],
});
```

**Sponsored transaction pattern:**
```typescript
import { SuiJsonRpcClient, ExecuteTransactionBlockParams } from "@mysten/sui/jsonRpc";

// Build transaction-kind bytes (no sender/gas info yet)
const kindBytes = await tx.build({ client, onlyTransactionKind: true });

// Reconstruct with sponsorship
const sponsoredTx = Transaction.fromKind(kindBytes);
sponsoredTx.setSender(playerAddress);
sponsoredTx.setGasOwner(adminAddress);
sponsoredTx.setGasPayment(gasPayment); // admin's gas coins

const txBytes = await sponsoredTx.build({ client });

// Both parties sign
const playerSig = await playerKeypair.signTransaction(txBytes);
const adminSig = await adminKeypair.signTransaction(txBytes);

const result = await client.executeTransactionBlock({
  transactionBlock: txBytes,
  signature: [playerSig.signature, adminSig.signature],
  options: { showEffects: true, showEvents: true },
});
```

### SDK Field Renames (Breaking Changes)

- `decodeSuiPrivateKey()` return field: `schema` → **`scheme`**
- Client class: `SuiClient` → **`SuiJsonRpcClient`**
- Transaction class: `TransactionBlock` → **`Transaction`**
- Execute method: `signAndExecuteTransactionBlock` → **`signAndExecuteTransaction`** (on new client)

## world-contracts v0.0.15 Breaking Changes (LLM Hallucination Guards)

> **CRITICAL:** LLM training data does NOT include these March 2026 changes. Agents MUST use
> the exact signatures below. Any deviation means a runtime abort on-chain.

### `withdraw_item<Auth>` — CHANGED Signature

v0.0.15 added a mandatory `quantity: u32` parameter and `ctx: &mut TxContext`. The old
call `withdraw_item<Auth>(ssu, character, auth, type_id, ctx)` **will not compile**.

```typescript
// ❌ BAD — pre-v0.0.15 call (WILL NOT COMPILE)
tx.moveCall({
  target: `${worldPkg}::storage_unit::withdraw_item`,
  typeArguments: [authType],
  arguments: [
    tx.object(ssuId),
    tx.object(characterId),
    authWitness,
    tx.pure.u64(typeId),
    // MISSING: quantity
  ],
});

// ✅ GOOD — v0.0.15 call
const [item] = tx.moveCall({
  target: `${worldPkg}::storage_unit::withdraw_item`,
  typeArguments: [authType],
  arguments: [
    tx.object(ssuId),       // &mut StorageUnit
    tx.object(characterId), // &Character
    authWitness,            // Auth (drop witness)
    tx.pure.u64(typeId),    // type_id: u64
    tx.pure.u32(quantity),  // quantity: u32  ← NEW in v0.0.15
  ],
});
```

### `deposit_item<Auth>` — parent_id Validation (BREAKING)

v0.0.15 asserts `parent_id(&item) == storage_unit_id`. Items withdrawn from SSU-A **cannot**
be deposited into SSU-B. For cross-SSU delivery, use `deposit_to_owned<Auth>` or
`transfer::public_transfer`.

```typescript
// ❌ BAD — depositing into a DIFFERENT SSU than the item's origin
tx.moveCall({
  target: `${worldPkg}::storage_unit::deposit_item`,
  typeArguments: [authType],
  arguments: [tx.object(buyerSsuId), tx.object(buyerCharId), item, authWitness],
});
// Runtime abort: EItemParentMismatch

// ✅ GOOD — deposit_to_owned for cross-player delivery (same SSU)
tx.moveCall({
  target: `${worldPkg}::storage_unit::deposit_to_owned`,
  typeArguments: [authType],
  arguments: [
    tx.object(sellerSsuId), // &mut StorageUnit — SAME SSU the item came from
    tx.object(buyerCharId), // &Character — buyer (does NOT need to be tx sender)
    item,                   // Item returned by withdraw_item
    authWitness,            // Auth (drop witness)
  ],
});
```

### Atomic TradePost Buy PTB (v0.0.15 Reference Pattern)

This is the complete, correct atomic buy transaction. Copy this pattern exactly.

```typescript
const tx = new Transaction();

// 1. Borrow seller's OwnerCap (needed for withdraw)
const [sellerCap, sellerReceipt] = tx.moveCall({
  target: `${worldPkg}::character::borrow_owner_cap`,
  typeArguments: [`${worldPkg}::storage_unit::StorageUnit`],
  arguments: [tx.object(sellerCharId), tx.object(sellerOwnerCapTicket)],
});

// 2. Withdraw item from seller's SSU (v0.0.15: requires quantity)
const [item] = tx.moveCall({
  target: `${worldPkg}::storage_unit::withdraw_item`,
  typeArguments: [`${ccPkg}::config::TradeAuth`],
  arguments: [
    tx.object(ssuId),
    tx.object(sellerCharId),
    tx.moveCall({ target: `${ccPkg}::config::trade_auth` }), // mint witness
    tx.pure.u64(itemTypeId),
    tx.pure.u32(quantity),  // ← v0.0.15 mandatory
  ],
});

// 3. Deposit item into buyer's owned inventory on the SAME SSU
tx.moveCall({
  target: `${worldPkg}::storage_unit::deposit_to_owned`,
  typeArguments: [`${ccPkg}::config::TradeAuth`],
  arguments: [
    tx.object(ssuId),      // same SSU (parent_id must match)
    tx.object(buyerCharId),
    item,
    tx.moveCall({ target: `${ccPkg}::config::trade_auth` }),
  ],
});

// 4. Split payment from buyer's gas coin and transfer to seller
const [payment] = tx.splitCoins(tx.gas, [tx.pure.u64(priceInMist)]);
tx.transferObjects([payment], tx.pure.address(sellerAddress));

// 5. Return seller's OwnerCap (hot-potato — MUST happen)
tx.moveCall({
  target: `${worldPkg}::character::return_owner_cap`,
  typeArguments: [`${worldPkg}::storage_unit::StorageUnit`],
  arguments: [tx.object(sellerCharId), sellerCap, sellerReceipt],
});

const result = await client.signAndExecuteTransaction({
  transaction: tx,
  signer: keypair,
  options: { showEffects: true, showEvents: true },
});
```

## Move Call Tuple Destructuring (LLM Failure Point)

> **CRITICAL:** Sui Move functions that return tuples (e.g., `(OwnerCap<T>, ReturnReceipt)`)
> return an **array of `TransactionResult` objects** in the TS SDK. Agents MUST destructure
> the result with array syntax. Treating the result as a single value or calling `.result[0]`
> will silently produce an invalid transaction argument.

### The Correct Pattern

```typescript
// ✅ CORRECT — array destructuring on moveCall result
const [ownerCap, returnReceipt] = tx.moveCall({
  target: `${worldPkg}::character::borrow_owner_cap`,
  typeArguments: [`${worldPkg}::gate::Gate`],
  arguments: [tx.object(characterId), tx.object(ownerCapTicket)],
});
// ownerCap and returnReceipt are each a TransactionResult
// Use them directly as arguments in subsequent moveCall calls
```

### Common Hallucinated Patterns (ALL WRONG)

```typescript
// ❌ WRONG — treating result as a single value
const borrowResult = tx.moveCall({ ... });
tx.moveCall({ arguments: [borrowResult] }); // passes the TUPLE, not element 0

// ❌ WRONG — using .result accessor (does not exist)
const res = tx.moveCall({ ... });
const cap = res.result[0]; // TypeError at runtime

// ❌ WRONG — using nestedResult (old SDK pattern, removed)
const cap = tx.moveCall({ ... }).nestedResult(0); // does not exist

// ❌ WRONG — wrapping in tx.object() after destructuring
const [cap, receipt] = tx.moveCall({ ... });
tx.moveCall({ arguments: [tx.object(cap)] }); // cap is already a tx argument
```

### Hot-Potato Rule

If a Move function returns a receipt/token with **no `drop` ability** (hot-potato), the
transaction **will abort** unless that value is consumed by another Move call in the same PTB.
Always plan the full borrow → use → return chain before writing any PTB code.

```typescript
// MANDATORY pattern: borrow → use → return (ALL in same PTB)
const [cap, receipt] = tx.moveCall({ target: "...::borrow_owner_cap", ... });
tx.moveCall({ target: "...::authorize_extension", arguments: [..., cap] });
tx.moveCall({ target: "...::return_owner_cap", arguments: [..., cap, receipt] });
// If you forget the return_owner_cap call, the tx aborts on-chain.
```
