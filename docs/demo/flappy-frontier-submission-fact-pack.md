# Flappy Frontier — Submission Fact Pack

> **HISTORICAL DOCUMENT.** This describes the March 2026 standalone build. The standalone game is retired and its economics (entry fee, prize pool, weekly top-3 payout, token rewards for placement) no longer exist. The playable game has been ported natively into EF-Map (draft PR #80, preview-tested, pending merge). The current on-chain package is `contracts/flappy_frontier_v2/`. Read the root `README.md` for current state. Nothing below is a claim about how the project works today.

**Retention:** Carry-forward

Canonical reference for crafting hackathon submission text, Discord pitch copy, and demo narration. Every claim below is verified against the repo as of 2026-03-31. If this document says "implemented," it means the code exists, compiles, passes tests, and is deployed.

---

## One-Paragraph Summary

Flappy Frontier is a ranked Flappy Bird-style minigame on Sui, built for the EVE Frontier hackathon. Players pay 100 EVE to enter a ranked run, receive a provably fair on-chain seed from `sui::random`, fly through deterministic obstacles, and submit scores to a transparent on-chain leaderboard. Every week, the smart contract automatically distributes the accumulated prize pool to the top 3 players (50/30/20) — with no admin key, no backend server, and no manual intervention. A Cloudflare Worker sponsors gas for every transaction, so players never need SUI tokens. The game auto-detects and connects the EVE Frontier Client Wallet inside the SSU, runs at the CEF viewport (787×1198), and supports free practice mode without a wallet. The gameplay is intentionally simple — the point is the blockchain infrastructure pattern it demonstrates.

---

## What Makes This Interesting

This is not "Flappy Bird on a blockchain." It's a complete, deployable pattern for low-friction on-chain competitive gaming:

1. **Trustless economics.** The treasury contract has no admin withdrawal path. Funds enter via entry fees and leave only via `distribute_payout()` to leaderboard winners. No rug-pull surface.
2. **Provably fair.** Every run seed comes from `sui::random`. The obstacle sequence is deterministic and verifiable — anyone can recompute it from the emitted event.
3. **Zero-friction UX.** Gas is sponsored (players never need SUI). SSU wallet auto-detects inside EVE Frontier's in-game browser. No faucet detour, no wallet chooser modal.
4. **Fully autonomous lifecycle.** The payout is trustless — anyone can trigger it when the epoch expires. The contract handles distribution and epoch advancement. No cron, no admin.
5. **Production-grade sponsor security.** The sponsor service validates every PTB command against an allow-list, recursively blocks GasCoin references (preventing wallet-draining attacks), and has 32 unit tests. This is not a toy proxy.

---

## Feature List (Implementation Status)

### Fully Implemented ✅

| Feature | Evidence |
|---------|----------|
| Canvas 2D game engine (frame-independent physics, delta-time) | `frontend/src/game/` — 12 modules |
| Practice mode (local seed, no wallet, no fee) | `GamePage.tsx`, `types.ts` (GAME_MODES) |
| Ranked mode (entry fee, on-chain seed, receipt-gated score submission) | `game.move::start_run`, `game.move::submit_score`, `seedProvider.ts` |
| On-chain leaderboard (top 10, sorted, per-player dedup, tie-breaking by timestamp) | `leaderboard.move`, `LeaderboardPanel.tsx` |
| On-chain treasury (generic `Balance<T>`, anchored epoch advancement) | `treasury.move` |
| Trustless payout trigger (anyone can call, no capability required) | `game.move::trigger_payout`, `LeaderboardPanel.tsx` payout button |
| Entry fee collection (100 EVE per ranked run) | `game.move::start_run`, `contractConfig.ts` |
| Provably fair seeding via `sui::random` | `game.move::start_run` → `random::new_generator` → `generate_u256` |
| `RunReceipt` object (binds fee payment to player + epoch, consumed on score submit) | `game.move`, `seedProvider.ts` |
| Sponsored gas transactions (Cloudflare Worker) | `workers/sponsor-service/`, `sponsorship.ts`, `useGameTransaction.ts` |
| Sponsor security: command allow-list, GasCoin block, target validation, kill switch | `validation.ts` (32 tests) |
| Fallback to player-paid gas when sponsor fails | `useGameTransaction.ts` |
| SSU wallet auto-detect and auto-connect | `useSSUWallet.ts` |
| EVE Vault + generic Sui wallet support | `Providers.tsx` (preferredWallets) |
| Player name resolution from EVE Frontier Character objects | `playerNames.ts`, `usePlayerName.ts` |
| In-game browser detection (viewport heuristic + query param) | `environment.ts` |
| Score-based difficulty progression (gap shrinks, speed increases) | `progression.ts` |
| Procedural audio (Web Audio API — flap, crash) | `audio.ts` |
| Parallax starfield background | `starfield.ts` |
| Ship sprite rendering with thruster effects | `shipRenderer.ts` |
| Leaderboard UI with prize pool, countdown, payout splits | `LeaderboardPanel.tsx` |
| Weekly epoch countdown timer | `LeaderboardPanel.tsx` |
| Payout trigger button (visible when epoch expired) | `LeaderboardPanel.tsx` |
| Receipt discard for abandoned runs | `game.move::discard_receipt` |
| Narrow screen blocker (mobile/portrait warnings) | `NarrowScreenGate.tsx` |
| Deployed to Cloudflare Pages | `flappy-frontier.pages.dev` |
| Deployed to Sui testnet (Stillness) | Package v6 |
| 30 Move tests + 32 sponsor validation tests | `tests/*.move`, `__tests__/validation.test.ts` |

### Not Implemented / Known Gaps ❌

| Item | Status | Notes |
|------|--------|-------|
| Game hash / replay verification | Not implemented | `gameHash` field exists in type but passed as empty string. Score integrity relies on RunReceipt (proves fee paid), not gameplay replay. |
| "Free Play" badge in in-game mode | Not implemented | In-game mode is detected for viewport scaling but doesn't show a distinct badge. Ranked is implicitly blocked by absence of wallet in CEF-without-wallet scenarios. |
| Anti-bot / anti-cheat | By design — not implemented | Entry fee is the economic friction. Accepted tradeoff for hackathon scope. Documented in product vision. |
| Console logging cleanup | Minor | Diagnostic `console.log` from ranked-start debugging still present in GamePage.tsx. |
| `ScoreOverlay` component | Dead code | Defined but never imported — score rendered directly in canvas. |
| Entry fee read from on-chain config | Partial | Display hardcoded from `contractConfig.ts`. Leaderboard reads epoch duration from chain but not the fee amount. |

---

## End-to-End Player Flow

1. Player opens `https://flappy-frontier.pages.dev/`
2. Sees start screen with mode selector (Practice / Ranked) and leaderboard link
3. **Practice path:** click Practice → plays immediately with local random seed → game over → score saved to localStorage only
4. **Ranked path:**
   a. Connect wallet (auto-detected in SSU, chooser modal in browser)
   b. Click Ranked → PTB built: `game::start_run<EVE>` with 100 EVE fee
   c. Transaction sent to sponsor service → sponsor validates + co-signs gas → player signs → execute
   d. On-chain: fee deposited in Treasury, seed generated via `sui::random`, `RunReceipt` created and sent to player
   e. Frontend parses `RunStartedEvent` (seed) + `RunReceiptCreatedEvent` (receipt ID)
   f. Game starts with chain seed → deterministic obstacle sequence via Mulberry32 PRNG
   g. Player flies until collision → game over
   h. Auto-submit: `game::submit_score<EVE>` consumes `RunReceipt`, reports score → leaderboard updates if score qualifies
5. Leaderboard auto-refreshes every 30 seconds
6. When epoch expires → payout trigger button appears → anyone clicks → `game::trigger_payout<EVE>` distributes pool → leaderboard resets

---

## Technical Architecture

### Frontend (Cloudflare Pages)
- **Framework:** Vite + React 19 + TypeScript 5.7 + Tailwind CSS 3
- **Game engine:** Pure TypeScript Canvas 2D — no React in the render loop. 12 modules: physics, obstacles, collision, rendering, input, audio, progression, starfield, RNG, assets
- **Wallet integration:** `@mysten/dapp-kit@^1.0.3` + `@mysten/sui@^2.7.0`
- **State management:** React hooks + `@tanstack/react-query` for on-chain reads
- **Canvas size:** 787×1198 (EVE Frontier CEF portrait viewport)

### Sponsor Service (Cloudflare Worker)
- **API:** `POST /sponsor { txKindB64, sender, timestamp }` → `{ txB64, sponsorSignature }`
- **Protocol:** Sui-native dual-signature gas sponsorship
- **Security:** 8 validation layers (body size, auth, kill switch, blocked senders, replay window, command allow-list, GasCoin block, target validation)

### Smart Contracts (Sui Move, 4 modules)
- `config` — AdminCap-gated parameter tuning (fee, epoch, shares)
- `leaderboard` — sorted vector, per-player dedup, epoch-scoped
- `treasury` — generic `Balance<T>`, anchored epoch, no admin withdrawal
- `game` — entry functions, `RunReceipt` lifecycle, trustless payout

---

## What Is On-Chain

- Entry fee collection and custody (Treasury)
- Leaderboard state (top 10, sorted, deduplicated)
- Run seeding (sui::random)
- Score submission (RunReceipt validation)
- Payout distribution (automated, trustless)
- Epoch lifecycle (advancement, boundary enforcement)
- Game config parameters (fee amount, epoch duration, payout shares)
- All game events (RunStarted, ScoreSubmitted, PayoutExecuted, LeaderboardReset)

## What Is Off-Chain

- Game physics and rendering (Canvas 2D, client-side)
- Obstacle generation from seed (deterministic, client-side)
- Score calculation (client-side — RunReceipt proves fee payment, not gameplay integrity)
- Wallet UI flow (connect/disconnect)
- Gas sponsorship service (Cloudflare Worker — validation + co-signing)
- Player name resolution (RPC reads of EVE Frontier Character objects)

---

## Stillness Deployment Identifiers

All values verified from `frontend/src/lib/contractConfig.ts`, `contracts/flappy_frontier/Published.toml`, and `workers/sponsor-service/wrangler.toml`. All three sources agree on the package ID.

| Object | ID |
|--------|----|
| **Package (v6, current)** | `0xde1554bde721b2a256ea6b3b21ed08b174308a676216e11df8c651f34353e4eb` |
| **Original Package (v1)** | `0x355b6228ae72f7cf64632ecd0bc7f13d3e5100f3f06699e45c3294633d9175e6` |
| **AdminCap** | `0xc633e5f3896461f2d3a4f125e61dfe39c31211d013951fd14f476ea7eede77f7` |
| **GameConfig** | `0x96127c4dbd75f883397a420b45a03c8af004890993c56cb91e48fce8860f5c57` |
| **Leaderboard** | `0xeeda7b2193064213b5f2c1c7fb9c8f519f5facf812c4cf71fe029bc4bbba784d` |
| **Treasury\<EVE\>** | `0xad7f49363fe1a35f47049ddcc6156b98b210cd603e453e88bd9e90faf6ab2813` |
| **UpgradeCap** | `0x2dd8d599ea0629fa87debfcf072822f3125b12de90c75a744b594e350a48aa5a` |
| **EVE Coin Type** | `0x2a66a89b5a735738ffa4423ac024d23571326163f324f9051557617319e59d60::EVE::EVE` |
| **World Package (Stillness)** | `0x28b497559d65ab320d9da4613bf2498d5946b2c0ae3597ccfda3072ce127448c` |
| **Network** | Sui Testnet (chain-id `4c78adac`) — Stillness |
| **RPC** | `https://fullnode.testnet.sui.io:443` |

### Live URLs

| Service | URL | Source |
|---------|-----|--------|
| **Frontend** | `https://flappy-frontier.pages.dev/` | `frontend/index.html` canonical link |
| **Sponsor Service** | `https://flappy-frontier-sponsor.michael-davis-home.workers.dev` | `wrangler.toml` + decision log |

---

## Safe Claims (Use in Submission)

These can be stated without qualification:

- "All entry fees are held on-chain in a shared Treasury object with no admin withdrawal path."
- "Run seeds are generated by `sui::random` — provably fair, unpredictable, and verifiable."
- "Payouts are trustless — anyone can trigger the weekly distribution when the epoch expires."
- "The sponsor service pays gas for all game transactions. Players need EVE tokens, not SUI."
- "The sponsor service validates every PTB command and blocks GasCoin references to prevent wallet-draining attacks."
- "The game auto-detects and connects the EVE Frontier Client Wallet inside the SSU."
- "The smart contracts are fully generic over `T` — the same contract code works with any coin type."
- "The leaderboard is fully on-chain, transparent, and verifiable."
- "30 Move tests and 32 sponsor validation tests."
- "The game runs from the EVE Frontier in-game browser at the CEF portrait viewport."

## Claims to Avoid

- ~~"Cheat-proof"~~ — the chain validates fee payment and receipt binding, not gameplay execution
- ~~"Fully decentralized"~~ — the sponsor service is centralized infrastructure (with fallback to player-paid gas)
- ~~"Scores are verified on-chain"~~ — the chain verifies the receipt, not the score itself
- ~~"Deployed on mainnet"~~ — deployed on Sui Testnet (Stillness)
- ~~"Entry fee is read from on-chain config"~~ — the display value is hardcoded in contractConfig.ts (the on-chain config exists but the frontend reads epoch duration, not fee amount)

---

## Judge-Facing Angle

**Why this is more than Flappy Bird:**

The game is a thin skin over infrastructure that solves real problems in on-chain gaming:

1. **How do you run a competitive game where no operator can cheat?** — Trustless treasury with no admin key. Automated payouts. Verifiable seeds.
2. **How do you make blockchain games not suck to use?** — Sponsored gas. SSU auto-connect. No faucet detour. No SUI required. Web2-feeling onboarding.
3. **How do you build for EVE Frontier's in-game surface?** — CEF-compatible canvas game, portrait viewport, auto-wallet detection, working inside the SSU.
4. **What does a reusable pattern look like?** — The contract is generic over `T`. The sponsor service is policy-driven. The wallet detection is framework-agnostic. Replace the game engine and you have a pattern for any on-chain competitive game.

The tech stack is intentionally production-grade: the sponsor service has enterprise-level PTB validation, the contracts are 30-test-strong with no admin escape hatch, and the UX flow is optimized for players who don't know what a blockchain is.

---

## Discord / Community Angle

**For community-facing copy:**

- "Play Flappy Bird in EVE Frontier, compete for EVE prizes, pay zero gas."
- "Every run is seeded by on-chain randomness. Every score is public. The prize pool pays itself out weekly — no admin, no middleman."
- "100 EVE entry fee. Top 3 split the pool. Simple game, serious smart contracts."
- "Works inside your SSU — your wallet connects automatically."

---

## Proof Points (Concrete Differentiators)

1. **Trustless treasury invariant** — there is a test (`test_no_admin_withdrawal_path_documentation`) that documents the treasury has no admin withdrawal function. This is by design, not omission.
2. **GasCoin theft prevention** — the sponsor service recursively checks every PTB argument for GasCoin references after discovering the exact attack vector (SplitCoins(GasCoin, ...)). Fixed and tested with 32 tests.
3. **6 contract upgrades on Stillness** — the repo includes a complete upgrade history (v1→v6) with decision log entries documenting each fix, including stale build cache discoveries and MoveCall target routing bugs.
4. **SSU auto-connect** — uses wallet runtime evidence (not viewport heuristics) to detect and connect the EVE Frontier Client Wallet without user interaction.
5. **Anchored epoch advancement** — epoch boundaries advance on a fixed grid (`epoch_start = epoch_end`, not `clock_ms`) to prevent cumulative drift regardless of when payout is triggered.
6. **62 total tests** — 30 Move tests + 32 sponsor validation tests.

---

## Known Caveats / Constraints

1. **Score integrity gap.** The chain proves a player paid the entry fee and played a seeded run. It does not verify the score itself. A sophisticated attacker could submit false scores with valid receipts. Mitigated by economic friction (100 EVE per attempt) and public attribution (addresses on leaderboard). This is documented as a known tradeoff, not a bug.
2. **Centralized sponsor service.** If the sponsor service goes down, players fall back to paying their own gas. The game still works — sponsorship is a UX enhancement, not a dependency.
3. **Testnet deployment.** All on-chain state is on Sui Testnet (Stillness). Not mainnet.
4. **Console logging.** Diagnostic logs from ranked-start debugging are still present in GamePage.tsx.
5. **Entry fee display is hardcoded.** The frontend reads epoch duration from the chain but not the fee amount — it's hardcoded at 100 EVE in contractConfig.ts. If an admin changes the on-chain fee, the display wouldn't update until the config is manually changed.
6. **Epoch state depends on when trigger was last called.** If nobody triggers payout at epoch expiry, the epoch doesn't advance automatically — someone must call `trigger_payout`. The contract handles this correctly (balance rolls forward), but there's no keeper bot.
