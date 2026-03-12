---
description: "Sui Move conventions for Flappy Frontier hackathon project"
applyTo: "**/*.move"
---

# Move Code — Workspace Conventions

> **Revalidate against latest world-contracts on hackathon test server (March 11+).**
> These are agent guardrails, not canonical truth. Authority hierarchy:
> `vendor/world-contracts` code > SUI docs > product vision > this file.

## Core Rules

- **Never assume function signatures.** Always verify against the current `vendor/world-contracts` commit before generating call sites. Signatures and auth requirements change between releases.
- **Dynamic fields: use typed key structs, not strings.** Define explicit `has copy, drop, store` key structs rather than raw `vector<u8>` or `String` keys.
- **Hot-potato discipline: borrow and return in the same PTB.** If world-contracts uses a borrow/return pattern for capabilities, the borrowed object must be returned in the same transaction.
- **MoveAbort emits no events.** Do not rely on events for proof-of-execution in flows that may abort. Use transaction digest + effects as the evidence path.
- **Prefer explicit error codes.** Define errors with `#[error(code = N)]` and descriptive `vector<u8>` messages. Keep codes sequential within each module.

## Pre-Planning / Module Decomposition (Mandatory)

Before generating any new Move module or making significant additions to an existing one, the agent **must** outline the module decomposition in its plan:

1. **Estimate scope first.** Before writing code, estimate the line count of the feature. If a single module is likely to exceed ~500 lines, design it as multiple modules in the plan.
2. **Declare module boundaries upfront.** The plan must list every module to be created or modified, with a one-line purpose for each.
3. **Split proactively, not reactively.** Never write a module past the ~500 line limit and then split afterward.
4. **Common split points:** Extract config structs + helpers into a `_config` module, extract event definitions into an `_events` module, extract view/getter functions into a `_queries` module.

## Structure & Style

- **Module organization:** Use `// === Section ===` headers. Order: Errors → Structs → Events → `init` → Public → View → Admin → Package → Private → Test.
- **One core object per module.** Shared primitives go in a `primitives/` subdirectory. If a module exceeds ~500 lines, extract helper logic.
- **Package naming:** `PascalCase` in `Move.toml` (`name = "FlappyFrontier"`), `snake_case` for named address (`flappy_frontier = "0x0"`).
- **Always commit `Move.lock`.** Ensures reproducible builds.
- **Include a `README.md`** in the package root explaining purpose, key objects, and deployment instructions.

### Naming

- **Modules:** `snake_case` (`leaderboard`, `treasury`)
- **Structs:** `PascalCase` (`Leaderboard`, `LeaderboardEntry`)
- **Capabilities:** `PascalCase` + `Cap` suffix (`AdminCap`)
- **Events:** `PascalCase` + `Event` suffix, prefer past tense (`ScoreSubmittedEvent`, `PayoutExecutedEvent`)
- **DF key structs:** `PascalCase` + `Key` suffix (`ConfigKey`)
- **Errors:** `EPascalCase` (`EInvalidScore`, `EEpochNotExpired`)
- **Constants:** `SCREAMING_SNAKE_CASE` (`MAX_LEADERBOARD_SIZE`)
- **Functions:** `snake_case` (`submit_score`, `trigger_payout`)
- **Getters:** field name directly — no `get_` prefix. Use `_mut` suffix for mutable variants.

### Abilities

- **Ability order:** always `key, copy, drop, store` (this canonical order).
- Event structs need `copy, drop`.
- Capability structs need `key` (owned objects) or `key` (shared objects).

### Comments

- Use `///` for doc comments on public functions and structs.
- Use `//` for internal implementation notes.
- Do NOT use JavaDoc-style `/** */` — Move tooling doesn't support it.
- Doc-comment every public function.

### Modern Move Idioms (Move 2024)

- Use struct method syntax: `ctx.sender()` not `tx_context::sender(ctx)`.
- Use `b"hello".to_string()` not `std::string::utf8(b"hello")`.
- Use `id.delete()` not `object::delete(id)`.
- Use vector literals `vector[1, 2, 3]` not `vector::empty()` + `push_back`.
- Use `public fun` (composable) or `entry fun` (non-composable) — **never `public entry fun`**.

## Composability

- **Return objects, don't self-transfer.** Let the PTB handle `transfer::transfer`.
- **Exact Coin arguments** — prefer `fun f(payment: Coin<SUI>)` over `fun f(payment: &mut Coin<SUI>, amount: u64)`.
- **Collection sizing:** `vector` for ≤1000 items. Beyond that, use `Table`, `Bag`, or `ObjectTable`.
- **Capability parameter position:** the primary object goes first, capability second.

## Tests

- Place tests in the `tests/` directory (not uploaded on-chain). Mirror source structure.
- Test module name: `<module>_tests` (e.g., `leaderboard_tests`).
- Use `#[test_only]` module annotation.
- **Do NOT prefix test functions with `test_`** in `_tests` modules — describe the behavior: `score_submission_updates_leaderboard()`.
- Merge test attributes: `#[test, expected_failure(abort_code = EInvalidScore)]`.
- Use `tx_context::dummy()` for simple tests; `test_scenario` only for multi-tx/multi-sender.
- Use `assert_eq!` (prints both values on failure).
- Use `sui::test_utils::destroy` as a cleanup sink.

## Flappy Frontier — Expected Package Layout

```
contracts/flappy_frontier/
├── Move.toml
├── Move.lock
├── README.md
└── sources/
    ├── leaderboard.move    # ~200 lines — Leaderboard shared object, entry submission, ranking
    ├── treasury.move       # ~150 lines — Treasury shared object, entry fees, payout distribution
    ├── game_seed.move      # ~100 lines — start_run() with sui::random, RunStarted event
    ├── events.move         # ~50 lines  — ScoreSubmittedEvent, PayoutExecutedEvent, etc.
    └── tests/
        ├── leaderboard_tests.move
        └── treasury_tests.move
```

Each source file stays well under 500 lines.

## Minimal Surface Area

- Prefer `public(package)` over `public` for state-mutating primitives.
- Add the smallest possible function surface.
- One responsibility per function. Split reads from writes.

## Common Code Smells

| Smell | Fix |
|-------|-----|
| `public entry fun` | Use `public fun` or `entry fun` separately |
| Self-transfers inside functions | Return the object; let PTB handle transfers |
| Unbounded `vector` from user input | Use `Table`/`Bag` for dynamic collections |
| Raw `vector<u8>` string keys for DFs | Use typed key structs with `copy, drop, store` |
| `assert!(condition, 0)` in tests | Use `assert!(condition)` or `assert_eq!` |
| `test_scenario` for single-tx tests | Use `tx_context::dummy()` instead |
