# Flappy Frontier

**Status: the standalone game is retired. The playable game has moved into EF-Map. This repo is the history of the original project, and the home of the current on-chain leaderboard package.**

I built Flappy Frontier for the [EVE Frontier](https://www.evefrontier.com/) builder hackathon in March 2026, as a standalone site on [Sui](https://sui.io/) with its own wallet flow, its own entry fee and its own prize pool. That version is finished. The game itself was the part people actually liked, so it has been ported natively into EF-Map, and the economics that surrounded it have been dropped completely.

What is still current in this repo is the Move package. `contracts/flappy_frontier_v2/` is a fresh, coin-free weekly leaderboard package published to Sui testnet, and it is what the EF-Map build talks to. Everything else here, the standalone frontend, the old v1 package, the sponsor worker, is kept for reference and sits below the historical banner further down.

## Where the game is now

The game is live in production inside EF-Map, ported natively rather than embedded. Play it at [https://ef-map.com/?panel=flappy-frontier](https://ef-map.com/?panel=flappy-frontier). The integration merged via `Diabolacal/EF-Map` PR #80 (merge commit `2a76cfc9`) and deployed to production on 2026-07-26. Before merging I played a full sponsored ranked run against it with a real wallet, including a 100 EVE revive, and the score landed on the weekly board at 21 points with 1 revive. The old standalone domains (`flappyfrontier.com`, `flappy-frontier.pages.dev`) now permanently redirect there.

## The current on-chain package: flappy_frontier_v2

`contracts/flappy_frontier_v2/` is a two-module package, `board` and `game`, with no `Coin`, no `Balance` and no generic `<T>` anywhere in it. There is no entry fee, no prize pool and no payout function. It records scores on a weekly board that rolls over lazily on the first `start_run` of a new week, draws one shared `week_seed` per week from `sui::random` so runs are comparable, and stores `revive_count` as a plain bounded number. Nothing in it is parameterised by a coin type, so it doesn't need republishing when an EVE cycle rolls over. That was the whole reason for writing a new package rather than upgrading v1.

The AdminCap is tuning-only. It gates `set_max_size`, `set_ruleset_version`, `set_min_ms_per_point`, `set_max_score` and `set_max_revives`. It cannot write, reorder or delete entries, and there are no funds for it to touch.

| Object | ID |
|--------|----|
| Package (testnet) | `0x03150b4e0d68ae6a97a97fb47281d40c4f84aeb0182a769c3864ab104db85441` |
| Board (shared) | `0x9ec1e43310fc4553e33ff75117f361efc6d40cb8c3789f2121b6cb2860635e21` |
| AdminCap | `0xe7b9435696c6928cb76c9dad981437524ef2b1e0a880de3a5e1ffa18f5700788` |
| UpgradeCap | `0x45cb2496be4c291143a3fc288297f973e1696e40dd51bbbb619603e946d5633f` |

Full publish details, including digests and the week anchor, are in [`contracts/flappy_frontier_v2/DEPLOYMENT.testnet.json`](contracts/flappy_frontier_v2/DEPLOYMENT.testnet.json).

```bash
sui move build --path contracts/flappy_frontier_v2
sui move test  --path contracts/flappy_frontier_v2     # 39 tests
```

## What was retired

The old economics are gone, not paused. There is no entry fee to play a ranked run. There is no prize pool, so the `Treasury<EVE>` object and the whole `Coin<T>` / `Balance<T>` path are dead. There is no weekly top-3 payout, so `trigger_payout` and the 50/30/20 split are gone with it, and no tokens are handed out for placement at all. The leaderboard is now just a leaderboard.

The only money that changes hands is a revive. Those are 100 EVE each, charged at the moment you die, and they run through the separate Frontier Commerce platform's EF Arcade merchant. None of that payment code is in this repo.

The old standalone payment surface is retired too. The v1 package (`0x355b…` original, `0xde15…` v6), its Treasury, the old-cycle EVE type `0x2a66…::EVE::EVE`, and the standalone `flappy-frontier-sponsor` Cloudflare Worker are all deprecated. CivilizationControl moved off that worker to its own `civilizationcontrol-sponsor` on 2026-04-28 and nothing else depends on it. EF-Map's own sponsorship is a different service entirely (the VPS-hosted Frontier Commerce gas station), so retiring the standalone worker doesn't touch it. See `docs/decision-log.md` for exactly what was disabled and when.

The old standalone site at `flappy-frontier.pages.dev` is kept up but carries a retirement notice. Ranked play there is broken by design now, since it points at an old-cycle coin type and a sponsor worker that no longer signs.

## License

MIT. See [LICENSE](LICENSE).

---
---

# Historical (v1 standalone)

> **Everything below this line describes the original March 2026 hackathon build and is kept for history only. The entry fee, prize pool, weekly payout, sponsor worker and package IDs described below are all retired. Do not treat any of it as current. If you want the current state, read the top of this file.**

## Why This Matters

Flappy Frontier wraps a simple game around real blockchain infrastructure. It demonstrates a complete pattern for low-friction on-chain gaming that could apply to any competitive game on Sui:

- **Trustless prize pool.** Entry fees accumulate in a shared `Treasury<T>` object. No admin can withdraw. Funds leave only via `distribute_payout()` to leaderboard winners.
- **Provably fair seeding.** Every ranked run draws a seed from `sui::random` at transaction time. The obstacle sequence is deterministic from that seed and verifiable by anyone.
- **Automated weekly payouts.** Anyone can trigger the payout when the epoch expires. No cron job, no operator. The contract handles distribution (50/30/20 to top 3) and resets the leaderboard.
- **Sponsored transactions.** A Cloudflare Worker pays gas on behalf of players. Players only need EVE tokens, not SUI. The sponsor service validates every PTB command against an allow-list and blocks GasCoin references to prevent theft.
- **SSU wallet auto-detection.** Inside EVE Frontier's in-game browser (SSU), the game detects the EVE Frontier Client Wallet and connects without a chooser modal. In standalone browsers, EVE Vault and any Sui wallet work via `@mysten/dapp-kit`.
- **On-chain leaderboard.** Top 10 scores stored as on-chain state. Player names resolved from EVE Frontier Character objects. No off-chain database.

**What's on-chain:** entry fees, treasury custody, leaderboard state, run seeding (`sui::random`), score submission, payout distribution, epoch lifecycle, game config.
**What's client-side:** game physics and rendering (Canvas 2D), obstacle generation from seed, score calculation. The `RunReceipt` object proves a player paid the entry fee, but the chain does not independently verify gameplay execution.

## Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌────────────────────┐
│  Canvas 2D Game  │      │  Sponsor Service  │      │  Move Contracts    │
│  (React + Vite)  │─────►│  (CF Worker)      │─────►│  (Sui Testnet)     │
│                  │      │  validates + pays  │      │                    │
│  787×1198 CEF    │      │  gas for players   │      │  Leaderboard (top  │
│  compatible      │      │                    │      │  10, sorted, dedup)│
└────────┬─────────┘      └────────────────────┘      │                    │
         │                                            │  Treasury<EVE>     │
         │  Practice: local seed, no fee              │  (entry fees →     │
         │  Ranked:   on-chain seed + entry fee       │   weekly payout)   │
         │                                            │                    │
         └────────────────────────────────────────────│  Game (start_run,  │
                                                      │   submit_score,    │
                                                      │   trigger_payout)  │
                                                      └────────────────────┘
```

| Layer | Technology | Deployment |
|-------|-----------|------------|
| **Frontend** | Vite + React + Canvas 2D | Cloudflare Pages, `flappy-frontier.pages.dev` (RETIRED, now serves a notice) |
| **Sponsor Service** | Cloudflare Worker | `flappy-frontier-sponsor.*.workers.dev` (RETIRED, signing key removed) |
| **Smart Contracts** | Sui Move (4 modules, 30 tests) | Sui Testnet (Stillness), package v6 `0xde1554…` (DEPRECATED, superseded by `flappy_frontier_v2`) |

## Player Flow

1. **Land.** See the leaderboard, prize pool, and countdown timer.
2. **Practice (free).** Play instantly with a local random seed. No wallet needed.
3. **Connect wallet.** EVE Vault, EVE Frontier Client Wallet, or any Sui wallet.
4. **Ranked run.** Pay 100 EVE → on-chain seed drawn from `sui::random` → obstacles generated deterministically → play.
5. **Score submission.** Automatic on game over. The contract validates the `RunReceipt` (proves entry fee was paid) and updates the leaderboard if the score qualifies.
6. **Weekly payout.** When the epoch expires, anyone can trigger distribution. Top 3 receive 50/30/20% of the pool. Leaderboard resets. Balance rolls over if no entries.

## Sui Primitives Used

| Primitive | Usage |
|-----------|-------|
| `sui::random` | Provably fair seed per run: on-chain, verifiable, unpredictable |
| `Clock` | Weekly epoch boundaries, payout trigger timing |
| `Coin<T>` / `Balance<T>` | Generic entry fee → prize pool → payout loop (instantiated with EVE) |
| Shared objects | `Leaderboard`, `Treasury`, `GameConfig` for concurrent multi-player access |
| Events | `RunStartedEvent`, `ScoreSubmittedEvent`, `PayoutExecutedEvent`, `LeaderboardResetEvent` |
| Object ownership | `RunReceipt` (owned) binds a fee payment to a specific player and epoch |

## Smart Contract Modules

| Module | Purpose | Key functions |
|--------|---------|---------------|
| `config` | Tunable parameters (fee, epoch, shares) | `set_entry_fee`, `set_epoch_duration`, `set_payout_shares` (all AdminCap-gated) |
| `leaderboard` | Sorted top-10, per-player dedup, tie-breaking | `submit_score`, `qualifies`, `winner_addresses`, `reset` |
| `treasury` | Generic `Balance<T>` pool, anchored epoch advancement | `pay_entry_fee`, `distribute_payout` (no admin withdrawal path) |
| `game` | Entry functions orchestrating the flow | `start_run<T>`, `submit_score<T>`, `trigger_payout<T>`, `discard_receipt`, `init_treasury<T>` |

30 Move tests cover receipt binding, per-player dedup, payout distribution, epoch enforcement, and the no-admin-withdrawal invariant.

## Sponsor Service Security

The gas sponsor service validates every PTB before co-signing:

- **Command allow-list.** Only `MoveCall`, `SplitCoins`, `MergeCoins`, `MakeMoveVec`. `TransferObjects` and `Publish` are blocked.
- **GasCoin theft prevention.** Recursive check blocks any command referencing `GasCoin` in any argument position (prevents draining the sponsor wallet via `SplitCoins(GasCoin, ...)`).
- **Target validation.** Every `MoveCall` must match a whitelisted package + module + function.
- **Kill switch.** `SPONSOR_ENABLED` flag. `BLOCKED_SENDERS` deny-list. 60-second replay window.
- **Fail closed.** If policy config is missing, all requests are rejected.

32 unit tests cover the validation logic.

## Quick Start

```bash
# Frontend
cd frontend
npm install
npm run dev                              # Dev server at localhost:5173

# Contracts
sui move build --path contracts/flappy_frontier
sui move test --path contracts/flappy_frontier     # 30 tests

# Verify environment
sui client active-env                              # Should show testnet
```

## Project Structure

```
├── contracts/flappy_frontier_v2/ # CURRENT — Sui Move: board + game, no economics
├── contracts/flappy_frontier/   # DEPRECATED v1 — config, leaderboard, treasury, game
├── frontend/                    # RETIRED standalone Vite + React + Canvas 2D game
│   └── src/
│       ├── app/                 # App shell, providers, SSU detection
│       ├── features/            # auth (wallet), game (UI), score (leaderboard)
│       ├── game/                # Pure game engine (no React): physics, rendering, audio
│       └── lib/                 # Contract config, sponsorship, seed provider, RNG
├── workers/sponsor-service/     # Cloudflare Worker: gas sponsorship with PTB validation
├── docs/                        # Architecture, strategy, research, decision log
└── vendor/                      # Git submodules (read-only): EVE Frontier references
```

## Stillness Deployment (Sui Testnet) — DEPRECATED

These are the v1 objects. They are still on chain but nothing points at them any more, and the EVE coin type below is from an old cycle. The current objects are in the `flappy_frontier_v2` table near the top of this file.

| Object | ID |
|--------|----|
| Package (v6) | `0xde1554bde721b2a256ea6b3b21ed08b174308a676216e11df8c651f34353e4eb` |
| GameConfig | `0x96127c4dbd75f883397a420b45a03c8af004890993c56cb91e48fce8860f5c57` |
| Leaderboard | `0xeeda7b2193064213b5f2c1c7fb9c8f519f5facf812c4cf71fe029bc4bbba784d` |
| Treasury\<EVE\> | `0xad7f49363fe1a35f47049ddcc6156b98b210cd603e453e88bd9e90faf6ab2813` |
| EVE Coin Type | `0x2a66a89b5a735738ffa4423ac024d23571326163f324f9051557617319e59d60::EVE::EVE` |

## In-Game Browser Support

The game runs inside EVE Frontier's in-game CEF webview (787×1198px portrait, Chrome 122). The EVE Frontier Client Wallet is auto-detected and connected without a chooser modal. Both practice and ranked modes work in-game when a wallet is available.

## Hackathon

EVE Frontier Builder Hackathon, March 2026. See [`docs/strategy/flappy-frontier-product-vision.md`](docs/strategy/flappy-frontier-product-vision.md) for the full product vision, which is also a historical document.
