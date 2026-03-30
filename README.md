# Flappy Frontier

A ranked Flappy Bird-style minigame on [Sui](https://sui.io/), built for the [EVE Frontier](https://www.evefrontier.com/) hackathon. The gameplay is intentionally simple. The point is the infrastructure around it.

Players pay an entry fee in EVE tokens, receive a provably fair on-chain seed, fly through deterministic obstacles, and submit scores to a transparent leaderboard. Every week, the prize pool is distributed to the top 3 players automatically, with no admin key and no manual payout step.

**[Play now →](https://flappy-frontier.pages.dev/)**

---

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
| **Frontend** | Vite + React + Canvas 2D | [Cloudflare Pages](https://flappy-frontier.pages.dev/) |
| **Sponsor Service** | Cloudflare Worker | `flappy-frontier-sponsor.*.workers.dev` |
| **Smart Contracts** | Sui Move (4 modules, 30 tests) | Sui Testnet (Stillness), [package v6](https://suiscan.xyz/testnet/object/0xde1554bde721b2a256ea6b3b21ed08b174308a676216e11df8c651f34353e4eb) |

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
├── contracts/flappy_frontier/   # Sui Move: config, leaderboard, treasury, game
├── frontend/                    # Vite + React + Canvas 2D game
│   └── src/
│       ├── app/                 # App shell, providers, SSU detection
│       ├── features/            # auth (wallet), game (UI), score (leaderboard)
│       ├── game/                # Pure game engine (no React): physics, rendering, audio
│       └── lib/                 # Contract config, sponsorship, seed provider, RNG
├── workers/sponsor-service/     # Cloudflare Worker: gas sponsorship with PTB validation
├── docs/                        # Architecture, strategy, research, decision log
└── vendor/                      # Git submodules (read-only): EVE Frontier references
```

## Stillness Deployment (Sui Testnet)

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

EVE Frontier Builder Hackathon, March 2026. See [`docs/strategy/flappy-frontier-product-vision.md`](docs/strategy/flappy-frontier-product-vision.md) for the full product vision.

## License

MIT. See [LICENSE](LICENSE).
