# Flappy Frontier — Chain Integration Execution Plan

**Retention:** Carry-forward  
**Date:** 2026-03-13  
**Status:** Planning complete — ready for implementation  
**Author:** Planning agent  
**Risk class:** High (Move contracts + treasury logic + wallet integration + deployment)  
**Depends on:** Game-side MVP (complete), Sui testnet access, deployer wallet with SUI + EVE, EVE coin type ✅ confirmed on Utopia

---

## 1. Executive Summary

This document is the execution plan for Flappy Frontier's **ranked-mode chain integration** — the next phase after the game-side MVP. It covers Move contract implementation, frontend wallet/chain wiring, Cloudflare deployment, Utopia testnet validation, and payout lifecycle verification.

The plan is designed for sequential implementation across 5 work phases, optimized for manual verifiability at each step. The target outcome: a player can connect a wallet, pay an entry fee in EVE tokens, play a chain-seeded deterministic run, submit their score to an on-chain top-10 leaderboard, and trigger an automated payout — all verifiable on Sui testnet via the Utopia world deployment.

**Estimated scope:** ~1500–2000 LoC across ~20 files (Move + TypeScript), 5 phases.

---

## 2. Current State of the Repo

### What exists and works

| Component | Status | Key files |
|-----------|--------|-----------|
| Canvas 2D game loop | ✅ Complete | `frontend/src/game/gameLoop.ts`, `renderer.ts`, `physics.ts` |
| Ship asset (Frontier vessel PNG) | ✅ Complete | `frontend/public/assets/frontier-ship.png` |
| Pipe obstacles + collision | ✅ Complete | `obstacles.ts`, `collision.ts` |
| Scoring + local best-score persistence | ✅ Complete (human-confirmed) | `gameLoop.ts`, `scoreService.ts` |
| Difficulty progression | ✅ Complete | `progression.ts` |
| Frontier-orange theme + audio | ✅ Complete | `renderer.ts`, `audio.ts` |
| Seeded PRNG (Mulberry32) | ✅ Complete | `rng.ts`, `seedProvider.ts` |
| Mode selector (Practice active, Ranked locked) | ✅ Complete | `ModeSelector.tsx` |
| Future seams (auth, score, seed, mode config) | ✅ Stubbed | See §2a below |
| Move contracts | ❌ Not started | `contracts/flappy_frontier/sources/` is empty |
| Wallet integration | ❌ Not started | No Sui SDK deps installed |
| Cloudflare deployment | ❌ Not started | Templates exist, not configured |

### 2a. Existing Future Seams (implementation anchors)

The MVP was deliberately designed with clean extension points. These are the **exact integration anchors** for chain work — do not invent a different architecture.

| Seam | File(s) | Interface | What to wire |
|------|---------|-----------|-------------|
| **Seed provider** | `seedProvider.ts` | `SeedResult { seed, runId, source: 'local' \| 'chain' }` | Add async `getChainSeed()` that calls `start_run()` PTB |
| **Auth / identity** | `features/auth/hooks/usePlayerIdentity.ts` | `{ player, canPlayRanked, connect, disconnect }` | Wire to `@mysten/dapp-kit-react` wallet hooks |
| **Score submission** | `features/score/services/scoreService.ts` | `ScoreSubmission { score, runSeed, gameHash, runId }` → `SubmitResult { success, txDigest, target }` | Add chain path calling `submit_score()` PTB |
| **Mode config** | `features/game/types.ts` | `GameModeConfig { seedSource, scorePersistence, requiresEntryFee, leaderboardEligible }` | Already declares ranked config — just needs backing implementations |
| **Ranked gate** | `ModeSelector.tsx` | `disabled` prop when `!canPlayRanked` | Flips automatically when wallet connects |
| **Providers** | `App.tsx` | Bare shell, no providers | Wrap in `SuiClientProvider` + `WalletProvider` + `QueryClientProvider` |
| **Game loop seed** | `gameLoop.ts` → `createInitialState()` | Calls `getLocalSeed()` synchronously | For ranked: pre-fetch chain seed, pass to game start |
| **Game over → submit** | `GameOverScreen.tsx`, callbacks | `onGameOver(score, bestScore)` | Extend to pass seed + trigger chain submission flow |
| **Environment gate** | `environment.ts` | `isInGameBrowser` flag | Already gates in-game mode; add `hasWalletProvider` check |

---

## 3. Target State (derived from product vision)

The product vision (§3–4) defines the complete ranked flow:

```
View Leaderboard → Connect Wallet → Pay Entry Fee → Get Chain Seed →
Play Deterministic Run → Submit Score → Leaderboard Updates →
Weekly Auto-Payout (triggered by anyone)
```

### Minimum viable ranked path for hackathon

The thinnest slice that satisfies the product vision and is manually verifiable:

1. **Wallet connect** — Player connects EVE Vault or any Sui wallet via dapp-kit
2. **Pay + start run** — Single PTB: transfer entry fee (EVE token) to treasury + draw seed from `sui::random` → returns `RunStarted` event with seed
3. **Chain-seeded play** — Game uses on-chain seed for deterministic obstacle generation (same Mulberry32 PRNG, chain seed instead of local)
4. **Submit score** — PTB: call `submit_score(leaderboard, score, run_id)` → leaderboard updates if score qualifies for top 10
5. **Leaderboard display** — Frontend reads `Leaderboard` shared object via Sui RPC → shows top 10 with addresses, scores, timestamps
6. **Payout trigger** — Call `trigger_payout()` when epoch expires → treasury distributes to top N → leaderboard resets

### Two-mode runtime

| Mode | Seed | Score storage | Entry fee | Leaderboard | Wallet required |
|------|------|--------------|-----------|-------------|----------------|
| **Practice** | Local (random) | localStorage only | No | Not eligible | No |
| **Ranked** | Chain (`sui::random`) | On-chain leaderboard | Yes (EVE) | Top 10, on-chain | Yes |

### In-game vs external browser

| Context | Wallet available | Mode available | Leaderboard visible |
|---------|-----------------|----------------|-------------------|
| External browser (desktop) | Yes (EVE Vault / any Sui wallet) | Practice + Ranked | Yes (read from chain) |
| In-game CEF browser | No | Practice only | Yes (read-only, no submission) |

---

## 4. Required Environment & Config Inputs

### Provided (from operator) ✅

| Item | Value |
|------|-------|
| **Sui network** | Testnet |
| **RPC URL** | `https://fullnode.testnet.sui.io:443` |
| **Utopia World Package** | `0xd12a70c74c1e759445d6f209b01d43d860e97fcf2ef72ccbbd00afd828043f75` |
| **Utopia Object Registry** | `0xc2b969a72046c47e24991d69472afb2216af9e91caf802684514f39706d7dc57` |
| **Utopia Killmail Registry** | `0xa92de75fde403a6ccfcb1d5a380f79befaed9f1a2210e10f1c5867a4cd82b84e` |
| **Utopia Server Address Registry** | `0x9a9f2f7d1b8cf100feb532223aa6c38451edb05406323af5054f9d974555708b` |
| **Utopia Location Registry** | `0x62e6ec4caea639e21e4b8c3cf0104bace244b3f1760abed340cc3285905651cf` |
| **Utopia Energy Config** | `0x9285364e8104c04380d9cc4a001bbdfc81a554aad441c2909c2d3bd52a0c9c62` |
| **Utopia Fuel Config** | `0x0f354c803af170ac0d1ac9068625c6321996b3013dc67bdaf14d06f93fa1671f` |
| **Utopia Gate Config** | `0x69a392c514c4ca6d771d8aa8bf296d4d7a021e244e792eb6cd7a0c61047fc62b` |
| **Utopia AdminACL** | `0xa8655c6721967e631d8fd157bc88f7943c5e1263335c4ab553247cd3177d4e86` |
| **Stillness World Package** | `0x28b497559d65ab320d9da4613bf2498d5946b2c0ae3597ccfda3072ce127448c` |
| **Stillness Object Registry** | `0x454a9aa3d37e1d08d3c9181239c1b683781e4087fbbbd48c935d54b6736fd05c` |
| **Stillness AdminACL** | `0x8ca0e61465f94e60f9c2daff9566edfe17aa272215d9c924793d2721b3477f93` |
| **Token for entry fees** | EVE (on-chain token from world-contracts `assets` package) |
| **EVE:LUX rate** | 1 EVE = 100 LUX (display conversion for in-game context) |
| **Domain target** | `flappyfrontier.com` |

### Derived at publish time (created during Phase 1)

| Item | When available | How obtained |
|------|---------------|-------------|
| **Flappy Frontier Package ID** | After `sui client publish` | From publish tx effects |
| **Leaderboard Object ID** | After `init()` runs | From publish tx created objects |
| **Treasury Object ID** | After `init()` runs | From publish tx created objects |

### Still needed before implementation

| Item | Blocker for | How to obtain | Fallback |
|------|-------------|---------------|----------|
| **EVE coin type for Utopia** | Treasury and entry-fee contract types | ✅ **Resolved:** `0xf0446b93345c1118f21239d7ac58fb82d005219b2016e100f074e4d17162a465::EVE::EVE` (9 decimals, same as SUI) | Resolved — no longer a blocker |
| **EVE coin type for Stillness** (`<pkg>::EVE::EVE`) | Stillness deployment (post-validation) | Call `getEveCoinType('stillness')` from `@evefrontier/dapp-kit/utils` | Not needed until Stillness deployment |
| **Deployer wallet** with testnet SUI | Publishing contracts, testing | `sui client active-address` + testnet faucet | Must have — no fallback |
| **Deployer wallet with testnet EVE** | Testing ranked entry flow | ✅ Operator has a Utopia test wallet with EVE available for manual validation | Resolved — operator-funded validation wallet available |
| **Cloudflare account + API token** | Deployment to Pages | Operator provides or uses local `.env.local` + `npx wrangler login` | localhost-only for initial validation |
| **DNS for `flappyfrontier.com`** | Custom domain on Cloudflare Pages | Operator configures DNS CNAME | Use `*.pages.dev` preview URL instead |

### Token Decision: EVE from day one

**Decision: Ranked entry fees use `Coin<EVE>` from the start of chain implementation.**

Rationale:
- Operator intent is clear — EVE is the game's token, not SUI. Players earn Lux in-game, convert to EVE, and spend EVE to enter ranked.
- EVE is a standard `Coin<EVE>` on Sui (registered via `coin_registry`, but consumed as normal `Coin<T>` / `Balance<T>` in user contracts).
- EVE has 9 decimals — same as SUI. All balance math is identical.
- The Move contract should be **generic over coin type** (`Balance<T>`, `Coin<T>`) so it works with any token at the call site. The frontend passes the EVE type string when constructing PTBs. This avoids a compile-time dependency on the `assets` package.
- EVE is available on both Utopia and Stillness testnet deployments (per-tenant package IDs via `getEveCoinType(tenantId)` from `@evefrontier/dapp-kit/utils`).

**EVE coin type for Utopia (resolved):**
```
0xf0446b93345c1118f21239d7ac58fb82d005219b2016e100f074e4d17162a465::EVE::EVE
```
This is the exact type string to pass as the `T` type argument in PTBs targeting Utopia (Sui testnet). The Stillness EVE type is a separate config item — resolve it when Stillness deployment is needed.

**Entry fee amount:** ~100 EVE (≈10,000 Lux equivalent). Fee is configurable at deploy time — do not hardcode a final public-facing value.

**Frontend display:** Show both EVE amount and Lux equivalent (1 EVE = 100 LUX) in the entry fee prompt.

**Gas handling** is a separate runtime/wallet concern. Gas may be user-paid (SUI) or sponsored depending on the wallet and runtime flow. Sponsored transactions are not a blocker for Phase 1 Move contract work, and the contracts themselves are agnostic to how gas is funded. The ranked entry fee — the economic participation token — is EVE.

**Generic contract approach:**
```move
// Treasury stores Balance<T> where T is the entry-fee coin type
// At call site: start_run<EVE::EVE>(...) specifies the token
// This avoids compile-time dependency on the assets package
public struct Treasury<phantom T> has key {
    id: UID,
    balance: Balance<T>,
    entry_fee_amount: u64,
    payout_shares: vector<u64>,
}
```

### Treasury Custody & Trust Model

**Hard constraint:** The treasury is non-custodial from the player's perspective. This is a non-negotiable implementation requirement.

| Property | Guarantee | Mechanism |
|----------|-----------|----------|
| **No operator custody** | Entry-fee EVE tokens never route to, rest in, or are recoverable by the operator's personal wallet during normal operation | `Balance<T>` held inside a shared `Treasury<T>` object; no `transfer` to deployer address |
| **No admin withdrawal** | No function exists that allows any holder (including `AdminCap`) to withdraw treasury funds arbitrarily | Contract exposes no `withdraw()`, `drain()`, or equivalent — only `trigger_payout()` distributes funds, and only to leaderboard winners per `payout_shares` |
| **Public-callable payout** | Payout execution follows on-chain rules, not operator discretion | `trigger_payout<T>()` is a public `entry` function — anyone can call it once the epoch has expired |
| **Rule-driven distribution** | Funds go to top-N players per the `payout_shares` vector | Distribution logic is deterministic from on-chain state; no off-chain input needed |
| **Transparent prize pool** | Players can inspect the treasury balance at any time | `Treasury<T>` is a shared object readable via `suiClient.getObject()` — balance is a public field |

**AdminCap scope (narrow):** `AdminCap` exists solely for non-fund operations:
- Adjusting `epoch_duration_ms` (for testnet short-epoch validation)
- Adjusting `entry_fee_amount` (parameter tuning — does not move existing funds)
- **`AdminCap` must NOT grant any ability to withdraw, redirect, or drain treasury balance.** This is a hard implementation constraint.

**Score authenticity vs. custody:** Score authenticity remains an accepted hackathon-scope limitation (see product vision §6). Treasury custody is a separate, stronger guarantee — even if a fraudulent score is submitted, the funds flow is still trustless and rule-driven. These two concerns are independent.

---

## 5. Recommended Implementation Order

### Phase 1: Move Contracts (foundation — no frontend changes)

**Goal:** Publishable Move package with leaderboard, treasury, and game seeding.  
**Risk:** High (on-chain data structures, economic logic)  
**Token required:** `CONTRACT CHANGE OK`

#### Deliverables

1. **`contracts/flappy_frontier/Move.toml`** — Package config targeting Sui testnet
   - Edition: `2024`
   - Sui framework dependency pinned to testnet rev (match `vendor/world-contracts/contracts/assets/Move.toml`)

2. **`contracts/flappy_frontier/sources/leaderboard.move`** (~150–200 lines)
   - `Leaderboard` shared object: `entries: vector<LeaderboardEntry>`, `current_epoch: u64`, `epoch_start_ms: u64`, `epoch_duration_ms: u64`
   - `LeaderboardEntry`: `player: address`, `score: u64`, `run_seed: u256`, `timestamp_ms: u64`
   - `submit_score()` — public entry, checks score qualifies for top 10, inserts sorted, emits `ScoreSubmitted` event
   - `get_entries()` — public read (returns vector reference)
   - `reset_leaderboard()` — internal (called by payout), clears entries, increments epoch
   - Max 10 entries, sorted descending by score, ties broken by earlier timestamp

3. **`contracts/flappy_frontier/sources/treasury.move`** (~150–200 lines)
   - `Treasury<phantom T>` shared object: `balance: Balance<T>`, `entry_fee_amount: u64`, `payout_shares: vector<u64>`
   - Generic over coin type `T` — instantiated with EVE at publish/call time, but contract has no compile-time dependency on the `assets` package
   - `pay_entry_fee<T>()` — takes `Coin<T>`, splits exact fee amount, deposits to treasury balance, returns change
   - `trigger_payout<T>()` — public entry, anyone can call when epoch expired, distributes balance per `payout_shares` to top N players from leaderboard, emits `PayoutExecuted` event, calls leaderboard reset
   - `AdminCap` — created at init, transferred to deployer. Scoped to parameter adjustment only (epoch duration, entry fee amount). **Must NOT grant any ability to withdraw, redirect, or drain treasury balance.** Not used in normal payout flow.

4. **`contracts/flappy_frontier/sources/game.move`** (~100–150 lines)
   - `start_run<T>()` — public entry, calls treasury `pay_entry_fee<T>()`, draws seed from `sui::random::Random`, emits `RunStarted { player, seed, run_id, timestamp_ms }` event
   - `RunStarted` event carries the seed for frontend consumption
   - Run ID derived from transaction digest or UID
   - At call site, `T` = EVE coin type (e.g., `<utopia_assets_pkg>::EVE::EVE`)

5. **`contracts/flappy_frontier/sources/config.move`** (~50–80 lines)
   - Constants: default entry fee, default epoch duration, default payout shares
   - `AdminCap` definition and init logic — scoped to parameter adjustment (epoch duration, entry fee amount); no fund-movement capability
   - Shared object creation in `init()`

#### Verification

```bash
sui move build --path contracts/flappy_frontier     # Must compile
sui move test --path contracts/flappy_frontier      # Must pass — write unit tests for:
  # - submit_score inserts correctly
  # - submit_score rejects score below #10
  # - trigger_payout distributes correctly
  # - trigger_payout fails before epoch expires
  # - pay_entry_fee collects correct amount
```

#### Testing strategy for short-epoch validation

For testnet validation, use a **configurable epoch duration**:
- Production default: 604,800,000 ms (7 days)
- Test default: 600,000 ms (10 minutes)
- Set at init time or via `AdminCap`-gated parameter adjustment (no fund-movement capability)

This allows manual observation of the full lifecycle (play → submit → wait → payout → reset) within a single test session.

---

### Phase 2: Publish to Testnet + Record Object IDs

**Goal:** Contracts live on Sui testnet, object IDs recorded for frontend.  
**Risk:** Medium (network interaction, publish transaction costs)  
**Depends on:** Phase 1 complete, deployer wallet funded

#### Steps

1. Verify active environment: `sui client active-env` → must be testnet
2. Ensure deployer has SUI: `sui client gas` → sufficient for publish
3. Publish: `sui client publish --path contracts/flappy_frontier`
4. Record from tx effects:
   - Package ID
   - Leaderboard object ID (shared)
   - Treasury object ID (shared)
   - AdminCap object ID (owned by deployer)
5. Store IDs in `frontend/src/lib/contractConfig.ts` (new file):

```typescript
export const CONTRACT_CONFIG = {
  packageId: '0x...',
  leaderboardId: '0x...',
  treasuryId: '0x...',
  network: 'testnet',
  rpcUrl: 'https://fullnode.testnet.sui.io:443',
  eveCoinType: '0xf0446b93345c1118f21239d7ac58fb82d005219b2016e100f074e4d17162a465::EVE::EVE',
  entryFeeAmount: 100_000_000_000, // 100 EVE (9 decimals) — configurable
  epochDurationMs: 600_000,  // 10 min for testing
} as const;
```

6. Test basic interaction via CLI:
   ```bash
   # Start a run (pay fee + get seed)
   sui client call --package <pkg> --module game --function start_run ...
   # Submit a score
   sui client call --package <pkg> --module leaderboard --function submit_score ...
   # Check leaderboard state
   sui client object <leaderboard_id>
   ```

#### Verification

- Package published successfully
- All shared objects created
- CLI smoke test: start_run → submit_score → leaderboard shows entry
- Object IDs recorded in `contractConfig.ts`

---

### Phase 3: Frontend Wallet + Chain Wiring (localhost validation)

**Goal:** Ranked mode works end-to-end on localhost against testnet contracts.  
**Risk:** High (wallet SDK integration, PTB construction, async game flow)  
**Token required:** `CORE CHANGE OK` (touches game start flow for async seed)

#### 3a. Install SDK dependencies

```bash
cd frontend
npm install @mysten/sui @mysten/dapp-kit-react @mysten/wallet-standard @tanstack/react-query @evefrontier/dapp-kit
```

Note: Install both `@mysten/dapp-kit-react` (Mysten standard wallet hooks) and `@evefrontier/dapp-kit` (EVE-specific utilities including `getEveCoinType()` for resolving the EVE coin type per tenant). Core transaction flow works with any Sui wallet; `@evefrontier/dapp-kit` is needed specifically for EVE type resolution and may be needed for EVE Vault wallet discovery.

#### 3b. Provider setup (`App.tsx`)

Wrap app in:
```
QueryClientProvider → SuiClientProvider → WalletProvider → <GamePage />
```

Keep `App.tsx` under 30 lines — providers in a separate `Providers.tsx` if needed.

#### 3c. Wire `usePlayerIdentity` to real wallet

Replace stubs in `features/auth/hooks/usePlayerIdentity.ts`:
- `player.address` → `useCurrentAccount()?.address`
- `canPlayRanked` → `!!account?.address && !isInGameBrowser`
- `connect` → `useConnectWallet()` modal trigger
- `disconnect` → `useDisconnectWallet()`

#### 3d. Add chain seed fetch (`seedProvider.ts`)

New async function `getChainSeed(wallet)`:
1. Build PTB: call `game::start_run()` with entry fee coin
2. Sign and execute via `signAndExecuteTransaction`
3. Parse `RunStarted` event from tx effects → extract seed
4. Return `{ seed: <parsed>, runId: <txDigest>, source: 'chain' }`

#### 3e. Wire ranked game start flow

Update `GamePage.tsx` / `gameLoop.ts`:
- When mode is `ranked`: show "Starting Run..." overlay, call `getChainSeed()`, then start game with chain seed
- When mode is `practice`: existing synchronous local seed (no change)
- `createInitialState` stays synchronous — the async seed fetch happens *before* calling it

#### 3f. Wire score submission (`scoreService.ts`)

Add chain path in `submitScore()`:
- If `submission.runId` exists (chain run): build PTB calling `leaderboard::submit_score()`, sign and execute
- Else: existing localStorage path

#### 3g. Add leaderboard display

New component `features/score/components/LeaderboardPanel.tsx`:
- Reads `Leaderboard` object via `suiClient.getObject(leaderboardId)`
- Parses `entries` vector → displays top 10
- Shows current epoch, prize pool (treasury balance), time remaining
- Refreshes on interval or after score submission
- Visible in both practice and ranked mode (ranked shows "Submit to compete")

#### 3h. Entry fee flow

Before ranked game start:
1. Show entry fee amount in EVE (read from treasury config or `CONTRACT_CONFIG`)
2. Show Lux equivalent (1 EVE = 100 LUX → 100 EVE = 10,000 LUX)
3. Player confirms → `start_run<0xf0446b93345c1118f21239d7ac58fb82d005219b2016e100f074e4d17162a465::EVE::EVE>()` PTB includes EVE coin payment
4. If wallet has insufficient EVE balance → show error explaining how to obtain EVE (Lux conversion in-game), suggest practice mode

#### Verification (all on localhost against testnet)

```bash
cd frontend && npx tsc --noEmit    # Must pass
cd frontend && npm run build       # Must succeed
```

Manual localhost smoke test:
- [ ] Wallet connect button appears (not in in-game mode)
- [ ] Connecting wallet populates player address
- [ ] Ranked mode unlocks after wallet connect
- [ ] Starting ranked run → wallet approval prompt
- [ ] After approval → game starts with chain seed
- [ ] Game over → "Submit Score" button appears
- [ ] Submitting score → wallet approval → leaderboard updates
- [ ] Leaderboard panel shows top 10 from chain
- [ ] Practice mode still works without wallet (no regression)
- [ ] In-game mode detection still hides wallet UI

---

### Phase 4: Cloudflare Deployment

**Goal:** Game accessible at a public URL for external browser and in-game testing.  
**Risk:** Low–Medium (deployment config, DNS)  
**Depends on:** Phase 3 basic flow working on localhost

#### Steps

1. Configure `wrangler.toml` from template (`templates/cloudflare/wrangler.example.jsonc`)
2. Set environment variables for contract config (or bake into build)
3. Build: `cd frontend && npm run build`
4. Deploy preview: `cd frontend && npx wrangler pages deploy dist`
5. Record preview URL (e.g., `flappy-frontier-xxx.pages.dev`)
6. Configure custom domain `flappyfrontier.com` when DNS is ready

#### Why Cloudflare happens AFTER chain wiring (not before)

**Decision: Deploy after Phase 3, before Phase 5 validation.**

Rationale:
- Localhost is faster for iterating on chain integration (hot reload, instant feedback)
- Cloudflare adds deployment latency to every iteration cycle
- Chain wiring talks to testnet RPC regardless of where the frontend runs — localhost works fine
- Cloudflare is needed for: (a) in-game CEF browser testing, (b) public demo URL, (c) cross-browser wallet testing
- Preview deploys on feature branches give progressive URLs — no need to block on production domain

The correct sequence is: **build chain flow on localhost → deploy to Cloudflare → validate on deployed URL → test in-game.**

#### Verification

- [ ] Preview URL loads game
- [ ] Wallet connect works on deployed URL
- [ ] Ranked flow works end-to-end on deployed URL
- [ ] In-game mode detected when loaded in 787×1198 viewport / `?mode=ingame`

---

### Phase 5: Utopia Validation + Payout Lifecycle

**Goal:** Full ranked lifecycle verified on Utopia testnet with short epoch.  
**Risk:** Medium (real chain state, timing, payout math)  
**Depends on:** Phase 3–4 complete

#### 5a. Short-epoch payout validation

**Strategy:** Deploy contracts with 10-minute epoch duration. Execute full lifecycle manually:

1. **T+0:00** — Publish contracts (or use existing deployment from Phase 2)
2. **T+0:30** — Player A: connect wallet, start ranked run, play, submit score (e.g., 25)
3. **T+2:00** — Player B: start ranked run, play, submit score (e.g., 42)
4. **T+3:00** — Verify leaderboard shows both entries sorted correctly
5. **T+5:00** — Player A: start another run, submit higher score (e.g., 38)
6. **T+5:30** — Verify leaderboard updated (Player B #1, Player A #2)
7. **T+10:00** — Epoch expires
8. **T+10:30** — Call `trigger_payout()` (via CLI or frontend button)
9. **T+11:00** — Verify:
   - Treasury balance distributed per payout_shares
   - Player B received 50%, Player A received 30% (or 20% if 3rd entry exists)
   - Remaining 20% rolled over or distributed per fewer-than-3 logic
   - Leaderboard reset to empty
   - New epoch started (epoch counter incremented)
10. **T+12:00** — Start new runs in the fresh epoch, verify clean slate

#### 5b. Edge case validation

- [ ] Submit score that doesn't qualify for top 10 (if leaderboard is full)
- [ ] Submit score with insufficient entry fee → tx fails gracefully
- [ ] Call `trigger_payout()` before epoch expires → tx fails (expected)
- [ ] Epoch with only 1 entry → payout goes to single player
- [ ] Epoch with 0 entries → no payout, treasury rolls over

#### 5c. In-game browser validation

1. Load `flappyfrontier.com` (or preview URL) in EVE Frontier in-game browser
2. Verify: game loads, practice mode works, no wallet UI shown
3. Verify: leaderboard panel shows on-chain data (read-only)
4. Verify: "Open in Browser to submit score" CTA displayed
5. Verify: no JavaScript errors in CEF console

#### 5d. Cross-browser external validation

1. Load in Chrome (primary), Firefox, Edge
2. Verify: EVE Vault wallet connects
3. Verify: full ranked flow works
4. Verify: leaderboard updates reflect on-chain state

---

## 6. Testing Matrix: Localhost vs Deployed vs In-Game

| Validation item | Localhost | Deployed (Cloudflare) | In-game (CEF) |
|----------------|-----------|----------------------|---------------|
| Practice mode gameplay | ✅ Primary | ✅ Verify once | ✅ Verify once |
| Wallet connect/disconnect | ✅ Primary | ✅ Must verify (extension context differs) | ❌ N/A (no wallet) |
| Ranked mode: pay + seed + play | ✅ Primary | ✅ Must verify | ❌ N/A |
| Score submission to chain | ✅ Primary | ✅ Must verify | ❌ N/A |
| Leaderboard read from chain | ✅ Primary | ✅ Must verify | ✅ Must verify (read-only) |
| Payout trigger | ✅ CLI primary | ✅ Frontend button | ❌ N/A |
| In-game mode detection | ⚠️ Via `?mode=ingame` | ⚠️ Via `?mode=ingame` | ✅ Must verify (viewport detection) |
| Viewport scaling (787×1198) | ⚠️ Approximate | ⚠️ Approximate | ✅ Must verify (real CEF) |
| Cross-browser wallet | ❌ (single browser) | ✅ Must verify | ❌ N/A |

**Efficiency guidance:**
- Do 80% of iteration on localhost. It's faster.
- Deploy to Cloudflare only when localhost flow is stable.
- In-game testing is the final validation — don't iterate there.

---

## 7. What Can Be Deferred Safely

These items are explicitly **not part of this phase** and should wait until the ranked path is working end-to-end:

| Item | Reason for deferral | When to revisit |
|------|-------------------|-----------------|
| **In-game wallet/identity integration** | CEF has no Sui wallet; in-game is free-play only per architecture | Only if EVE Frontier adds CEF wallet injection |
| **Sponsored transactions** | Gas handling is a wallet/runtime concern, not a Move contract concern; Phase 1 contracts are agnostic to gas funding | Revisit during frontend wiring if wallet supports sponsorship, or post-hackathon |
| **Game hash computation** | `ScoreSubmission.gameHash` field exists but isn't validated on-chain | Post-hackathon (requires on-chain replay or ZK proof) |
| **Replay/verification system** | Seeds are stored, but replay is not MVP | Post-hackathon |
| **Local practice leaderboard (Phase 6 from MVP plan)** | The ranked on-chain leaderboard is the real leaderboard; local leaderboard adds no hackathon value | Deprioritized indefinitely — ranked leaderboard replaces it |
| **Medal system** | Visual polish, not functional | Post-ranked-flow |
| **Multiple difficulty levels / power-ups** | Out of scope per product vision | Post-hackathon |
| **Production domain setup** | Preview URL is sufficient for hackathon | Before submission deadline if DNS is ready |
| **Admin fund operations (withdraw, drain, pause)** | Treasury is non-custodial by design; `AdminCap` is scoped to parameter tuning (epoch duration, fee amount) only — no fund-movement capability | Not planned — this is a hard constraint, not a deferral |
| **Stillness deployment** | Utopia is the test environment; Stillness is for production | After full Utopia validation, before hackathon submission if needed |

---

## 8. Risks, Blockers, and Assumptions

### Assumptions

1. **`sui::random` is available on testnet** and follows the documented calling convention (`Random` shared object, `new_generator` + `generate_u256`)
2. **Deployer wallet has sufficient testnet SUI** for publishing and **testnet EVE** for entry-fee testing (✅ operator has validation wallet with EVE)
3. **EVE Vault wallet registers via `@mysten/wallet-standard`** and is discoverable by `@mysten/dapp-kit-react`; `@evefrontier/dapp-kit` provides `getEveCoinType(tenantId)` for resolving the EVE type string
4. **Cloudflare Pages account is available** (operator has or can create)
5. **Testnet is stable** during implementation window
6. **EVE token is deployed on Sui testnet** (✅ confirmed — Utopia `assets` package includes EVE; type string resolved)

### Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| `sui::random` calling convention differs | Medium — game seeding fails | Test within first hour of Phase 1. Fallback: tx digest-derived pseudo-random seed |
| EVE coin type string not resolvable on Utopia testnet | ~~Medium~~ ✅ Resolved | Type confirmed: `0xf0446b93345c1118f21239d7ac58fb82d005219b2016e100f074e4d17162a465::EVE::EVE`. Stillness type is a separate future config item. |
| Deployer wallet lacks testnet EVE for testing | Very Low — operator has validation wallet | ✅ Operator-funded Utopia test wallet with EVE is available. If additional EVE is needed, acquire via Utopia gameplay or peer transfer. |
| Shared object contention on Leaderboard | Very Low | Top-10 vector is small; hackathon scale is negligible |
| Cloudflare DNS for `flappyfrontier.com` not configured in time | Low | Use `*.pages.dev` preview URL; custom domain is cosmetic |
| CEF Chrome 122 compatibility with wallet-standard | Very Low — in-game is free-play only | No wallet operations in CEF; only practice mode + read-only leaderboard |

### Blockers (resolve before Phase 1)

1. **Deployer wallet** — Confirm `sui client active-address` and `sui client active-env` → testnet
2. **Testnet SUI balance** — Faucet if needed: `sui client faucet` (for gas)
3. **EVE coin type string** — ✅ Resolved: `0xf0446b93345c1118f21239d7ac58fb82d005219b2016e100f074e4d17162a465::EVE::EVE`
4. **Testnet EVE balance** — ✅ Operator has a Utopia test wallet with EVE available for end-to-end validation

---

## 9. Utopia-Specific Context

### What Utopia addresses are used for

Flappy Frontier is a **standalone game** — it does not depend on world-contracts directly. The Utopia world package, registries, and configs are part of the EVE Frontier world infrastructure, not Flappy Frontier's contracts.

However, the Utopia context matters for:
- **Network confirmation** — Utopia is on Sui testnet. Our contracts publish to the same network.
- **EVE token type (runtime dependency)** — Entry fees use `Coin<EVE>`. The Utopia EVE coin type is: `0xf0446b93345c1118f21239d7ac58fb82d005219b2016e100f074e4d17162a465::EVE::EVE`. Our contracts use generic `Coin<T>` / `Balance<T>` (no compile-time dependency on `assets`), but the EVE type string must be known at transaction construction time. The Stillness EVE type is a separate config item to resolve when needed.
- **In-game browser testing** — The in-game browser loads URLs within the Utopia game client. Our game at `flappyfrontier.com` would be loaded via SSU DApp URL field.
- **Wallet context** — Players interacting with Utopia have testnet wallets with SUI and EVE. Gas handling (user-paid or sponsored) depends on the wallet and runtime flow. These same wallets interact with our contracts.

### Stillness (live server) context

Stillness is the production server. **Do not publish contracts to Stillness during development.** Stillness addresses are stored here for reference — production deployment happens only after full Utopia validation and only from `main` branch.

---

## 10. Recommended Next Implementation Prompt Scope

### First implementation prompt: Phase 1 — Move Contracts

**Scope:** Create complete Move package with unit tests.  
**Files to create:**
- `contracts/flappy_frontier/Move.toml`
- `contracts/flappy_frontier/sources/config.move`
- `contracts/flappy_frontier/sources/leaderboard.move`
- `contracts/flappy_frontier/sources/treasury.move`
- `contracts/flappy_frontier/sources/game.move`

**Prompt guidance:**
> Implement the Flappy Frontier Move contracts per the chain integration plan (docs/plans/flappy-frontier-chain-integration-plan.md §5 Phase 1). The product vision (docs/strategy/flappy-frontier-product-vision.md §5) defines the data structures and functions. Use a generic coin type `Treasury<phantom T>` with `Balance<T>` so that the caller specifies `<EVE::EVE>` at the call site — no compile-time dependency on the `assets` package. The entry fee default is 100 EVE (= 100_000_000_000 base units, 9 decimals), but this must be configurable via `Config`. Include unit tests for all public functions using `sui::sui::SUI` as the test coin type (since the EVE type isn't available in the test environment, but the generic approach means any `Coin<T>` works). Use 10-minute epoch duration as default for testing. Follow Move conventions from `.github/instructions/move.instructions.md`. Verify: `sui move build` and `sui move test` must pass.
>
> CONTRACT CHANGE OK

**Success criteria:**
- `sui move build --path contracts/flappy_frontier` passes
- `sui move test --path contracts/flappy_frontier` passes (5+ test cases)
- All public functions match product vision signatures
- Events defined for indexing: `RunStarted`, `ScoreSubmitted`, `PayoutExecuted`, `LeaderboardReset`

### Second implementation prompt: Phase 2 — Publish + Phase 3 — Frontend Wiring

Once contracts compile and tests pass, the next prompt covers publishing to testnet and wiring the frontend. This will be a larger prompt touching ~10 frontend files.

### Third implementation prompt: Phase 4 + 5 — Deploy + Validate

Cloudflare deployment and full lifecycle validation.

---

## 11. Phase Summary Table

| Phase | Title | Depends on | Risk | Est. files | Key decision |
|-------|-------|-----------|------|------------|-------------|
| **1** | Move Contracts | Deployer wallet, EVE type string | High | 5 new | Generic `Treasury<phantom T>` — `Coin<EVE>` at call site |
| **2** | Publish to Testnet | Phase 1 | Medium | 1 new (contractConfig.ts) | Record object IDs, store EVE type |
| **3** | Frontend Wallet + Chain Wiring | Phase 2 | High | ~10 modified | `@mysten/dapp-kit-react` + `@evefrontier/dapp-kit` for EVE type resolution |
| **4** | Cloudflare Deployment | Phase 3 | Low | 1–2 config | After localhost validation, before in-game test |
| **5** | Utopia Validation + Payout | Phase 3–4 | Medium | 0 (testing only) | 10-min epoch for manual observation |

---

## Appendix A: Reference — Utopia Deployed World Contract Addresses

Stored here for cross-reference. Flappy Frontier contracts have **no compile-time dependency** on these packages. However, the EVE token type (`<assets_package>::EVE::EVE`) is a **runtime dependency** — it must be specified when constructing entry-fee transactions.

```
# Utopia (test server) — Sui Testnet
World Package:           0xd12a70c74c1e759445d6f209b01d43d860e97fcf2ef72ccbbd00afd828043f75
Object Registry:         0xc2b969a72046c47e24991d69472afb2216af9e91caf802684514f39706d7dc57
Killmail Registry:       0xa92de75fde403a6ccfcb1d5a380f79befaed9f1a2210e10f1c5867a4cd82b84e
Server Address Registry: 0x9a9f2f7d1b8cf100feb532223aa6c38451edb05406323af5054f9d974555708b
Location Registry:       0x62e6ec4caea639e21e4b8c3cf0104bace244b3f1760abed340cc3285905651cf
Energy Config:           0x9285364e8104c04380d9cc4a001bbdfc81a554aad441c2909c2d3bd52a0c9c62
Fuel Config:             0x0f354c803af170ac0d1ac9068625c6321996b3013dc67bdaf14d06f93fa1671f
Gate Config:             0x69a392c514c4ca6d771d8aa8bf296d4d7a021e244e792eb6cd7a0c61047fc62b
AdminACL:                0xa8655c6721967e631d8fd157bc88f7943c5e1263335c4ab553247cd3177d4e86

# Stillness (live server) — Sui Testnet
World Package:           0x28b497559d65ab320d9da4613bf2498d5946b2c0ae3597ccfda3072ce127448c
Object Registry:         0x454a9aa3d37e1d08d3c9181239c1b683781e4087fbbbd48c935d54b6736fd05c
Killmail Registry:       0x7fd9a32d0bbe7b1cfbb7140b1dd4312f54897de946c399edb21c3a12e52ce283
Server Address Registry: 0xeb97b81668699672b1147c28dacb3d595534c48f4e177d3d80337dbde464f05f
Location Registry:       0xc87dca9c6b2c95e4a0cbe1f8f9eeff50171123f176fbfdc7b49eef4824fc596b
Energy Config:           0xd77693d0df5656d68b1b833e2a23cc81eb3875d8d767e7bd249adde82bdbc952
Fuel Config:             0x4fcf28a9be750d242bc5d2f324429e31176faecb5b84f0af7dff3a2a6e243550
Gate Config:             0xd6d9230faec0230c839a534843396e97f5f79bdbd884d6d5103d0125dc135827
AdminACL:                0x8ca0e61465f94e60f9c2daff9566edfe17aa272215d9c924793d2721b3477f93

# Both on Sui Testnet RPC: https://fullnode.testnet.sui.io:443
# EVE:LUX rate: 1 EVE = 100 LUX (display conversion)
```

---

## Appendix B: Frontend File Change Map

Predicted file touches for Phase 3 (frontend wiring):

| File | Action | Change type |
|------|--------|-------------|
| `frontend/package.json` | Modify | Add Sui SDK dependencies |
| `frontend/src/app/App.tsx` | Modify | Wrap in SDK providers |
| `frontend/src/app/Providers.tsx` | **Create** | Provider composition (SuiClient + Wallet + QueryClient) |
| `frontend/src/lib/contractConfig.ts` | **Create** | Package/object IDs, RPC URL |
| `frontend/src/lib/seedProvider.ts` | Modify | Add `getChainSeed()` |
| `frontend/src/features/auth/hooks/usePlayerIdentity.ts` | Modify | Wire to real wallet SDK |
| `frontend/src/features/score/services/scoreService.ts` | Modify | Add chain submission path |
| `frontend/src/features/score/components/LeaderboardPanel.tsx` | **Create** | On-chain leaderboard display |
| `frontend/src/features/game/components/GamePage.tsx` | Modify | Async ranked start flow, leaderboard integration |
| `frontend/src/features/game/components/GameOverScreen.tsx` | Modify | "Submit to Leaderboard" button for ranked |
| `frontend/src/features/game/components/ModeSelector.tsx` | Modify (minor) | Remove hardcoded disabled, use `canPlayRanked` |
| `frontend/src/game/gameLoop.ts` | Modify (minor) | Accept pre-fetched seed for ranked mode |
