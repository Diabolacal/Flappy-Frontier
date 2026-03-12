# GITHUB-COPILOT.md — How We Work in This Repo

> **Authoritative source:** `.github/copilot-instructions.md`
> **Agent quick-load:** `AGENTS.md`
> **Documentation index:** `docs/README.md`

This file is a short orientation for Copilot agents. It does **not** override the files above — if anything here conflicts, `copilot-instructions.md` wins.

## What this repo is

Flappy Frontier — a Flappy Bird-style side-scrolling game for the EVE Frontier hackathon. Canvas 2D game with on-chain leaderboard, entry fees, and weekly automated payouts via Sui Move smart contracts.

## Verification commands

```bash
# Move contracts
sui move build --path contracts/flappy_frontier   # Must compile
sui move test --path contracts/flappy_frontier     # Must pass
sui client active-env                              # Verify network before any tx

# Frontend (when created)
cd frontend && npm run build                       # Must compile
cd frontend && npm run typecheck                   # Must pass
```

## Do

- Verify function signatures against current `vendor/world-contracts` before generating call sites.
- Keep Canvas 2D game loop frame-rate-independent (use delta time, not frame count).
- Use `docs/research/capabilities.json` for in-game browser constraints (787×1198px portrait, no wallet).
- Append non-trivial decisions to `docs/decision-log.md`.
- Make the smallest safe change.

## Don't

- Edit anything inside `vendor/`. Read-only always.
- Push to production from a feature branch.
- Commit secrets, keys, mnemonics, or `.env` files.
- Trust client-side score without documenting the tradeoff.
- Skip Move tests before committing contract changes.

## Safe edit checklist

- [ ] Plan: summary, files to touch, risk class (Low/Medium/High).
- [ ] Move: `sui move build` passes, `sui move test` passes.
- [ ] TS: `npm run build` passes, `npm run typecheck` passes (when applicable).
- [ ] Smoke: `sui client active-env` confirms expected network.
- [ ] Decision log: entry appended if non-trivial.
