# Flappy Frontier — Sui Move Contracts

On-chain backend for prize-pool ranked play in Flappy Frontier (EVE Frontier hackathon).

## Modules

| Module | Purpose |
|---|---|
| `config` | `AdminCap` (parameter-only — no fund access), `GameConfig` shared object, `init` |
| `treasury` | Generic `Treasury<T>` with entry-fee collection and epoch-gated payout distribution |
| `leaderboard` | Top-N `Leaderboard` shared object with score submission and ranking |
| `game` | Orchestrator entry functions, event definitions |

## Key Design Decisions

- **Generic treasury** — `Treasury<phantom T>` accepts any coin type. EVE (`0xf04…::EVE::EVE`) is specified at the PTB call site, not compiled in.
- **Trustless custody** — No admin withdrawal function exists. Funds leave only via `distribute_payout`, which requires epoch expiry and distributes proportionally to leaderboard winners.
- **AdminCap scope** — Limited to `set_entry_fee`, `set_epoch_duration`, `set_payout_shares` on `GameConfig`. Cannot touch `Treasury` or `Leaderboard`.
- **Package visibility** — Mutating functions on `Treasury` and `Leaderboard` are `public(package)` only. External access is through `game` module entry functions.

## Build & Test

```bash
sui move build --path contracts/flappy_frontier
sui move test  --path contracts/flappy_frontier
```

## Publish

```bash
sui client active-env          # Verify target network first
sui client publish --path contracts/flappy_frontier
```

After publishing, record the package ID and shared object IDs (`GameConfig`, `Treasury`, `Leaderboard`, `AdminCap`) for frontend integration.

## Default Parameters (set in `config::init`)

| Parameter | Default | Notes |
|---|---|---|
| Entry fee | 100 EVE (100_000_000_000 base units) | 9-decimal EVE |
| Epoch duration | 600,000 ms (10 min) | For testing; increase for production |
| Max leaderboard | 10 entries | Top-10 per epoch |
| Payout shares | [50, 30, 20] | 1st/2nd/3rd percentage split |
