# Flappy Frontier — Documentation Index

Central map for all project documentation. Agents: start here for orientation.

> **Read this before anything else in `docs/`.** The standalone game is retired. The playable game has been ported natively into EF-Map (`Diabolacal/EF-Map`, branch `feat/flappy-frontier-games`, draft PR #80: preview-tested with a real wallet, not merged, not in production). The old economics are gone: no entry fee, no prize pool, no weekly top-3 payout, no token rewards for placement. The current on-chain piece from this repo is `contracts/flappy_frontier_v2/`, a coin-free, cycle-agnostic weekly leaderboard package. Revive purchases (100 EVE, taken at death) go through the separate Frontier Commerce EF Arcade merchant, not through anything in this repo.
>
> Most documents listed below were written in March 2026 and describe the entry-fee, prize-pool and payout model as if it were current. It is not. Treat anything marked HISTORICAL as archive material, and take current state from the root `README.md` and `docs/decision-log.md` only.

---

## Critical Entry Points

| Document | Purpose |
|----------|---------|
| `README.md` (repo root) | Current state: what is live, what is retired (START HERE) |
| `docs/decision-log.md` | Technical decisions log (newest first) — operational truth |
| `.github/copilot-instructions.md` | Repo-wide AI guardrails (MUST READ) |
| `AGENTS.md` | Agent context and project quick facts (MUST READ; quick facts partly historical) |

---

## Current On-Chain Package

| Item | Value |
|------|-------|
| Source | `contracts/flappy_frontier_v2/` (modules `board`, `game`) |
| Testnet package | `0x03150b4e0d68ae6a97a97fb47281d40c4f84aeb0182a769c3864ab104db85441` |
| Board (shared) | `0x9ec1e43310fc4553e33ff75117f361efc6d40cb8c3789f2121b6cb2860635e21` |
| Publish record | `contracts/flappy_frontier_v2/DEPLOYMENT.testnet.json` |

---

## Strategy

| Document | Description |
|----------|-------------|
| `docs/strategy/flappy-frontier-product-vision.md` | HISTORICAL (March 2026 planning). Full product vision, architecture sketch, economic model, scope boundaries |

## Research

| Document | Description |
|----------|-------------|
| `docs/research/capabilities.json` | EVE Frontier in-game browser capabilities (viewport, runtime, input, wallet, CSS) |

## Core

| Document | Description |
|----------|-------------|
| `docs/core/hackathon-repo-conventions.md` | Git workflow, file discipline, naming conventions, repo structure |

## Operations

| Document | Description |
|----------|-------------|
| `docs/operations/DECISIONS_TEMPLATE.md` | Template for decision log entries |

## Plans

| Document | Description |
|----------|-------------|
| `docs/plans/flappy-frontier-game-mvp-plan.md` | HISTORICAL. Game-side MVP implementation plan — rendering, physics, state model, assets, build phases |
| `docs/plans/flappy-frontier-chain-integration-plan.md` | HISTORICAL (v1 economics). Chain integration execution plan — Move contracts, wallet wiring, Cloudflare deployment, Utopia validation |
| `docs/plans/stillness-and-player-names-plan.md` | HISTORICAL (old cycle). Stillness migration + player name resolution — config retarget, contract redeploy, character name lookup |

## Reference

| Document | Description |
|----------|-------------|
| `docs/reference/flappy-frontier-transfer-learnings.md` | Cross-project transfer learnings — reusable patterns, traps, and checklists from Flappy Frontier for future EVE Frontier / Sui hackathon projects |

## Architecture

| Document | Description |
|----------|-------------|
| `docs/architecture/sponsor-handoff-civilizationcontrol.md` | HISTORICAL (untracked local file). Sponsor-pattern handoff to CivilizationControl. CivilizationControl has since deployed its own `civilizationcontrol-sponsor` worker and no longer uses this repo's worker. |

## Demo

| Document | Description |
|----------|-------------|
| `docs/demo/flappy-frontier-submission-fact-pack.md` | HISTORICAL (hackathon submission, v1 economics). Submission-ready fact pack — verified feature list, deployment IDs, safe claims, caveats |
| `docs/demo/flappy-frontier-demo-script.md` | HISTORICAL. Demo video script — 80s full version + 55s tighter cut, shot list, recording notes |
