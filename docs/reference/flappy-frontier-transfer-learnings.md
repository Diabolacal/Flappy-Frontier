# Flappy Frontier — Transfer Learnings (LLM-Oriented Reference)

**Retention:** Carry-forward

**Date:** 2026-03-14 (original); 2026-03-15 (§16–§19 added: security, sponsor hardening, package versioning, deploy/config)
**Status:** Canonical internal reference — tracked in `docs/reference/`
**Source repo:** `Diabolacal/Flappy-Frontier`
**Author:** Agent-generated from full repo inspection
**Primary audience:** Future LLM agents working on EVE Frontier / Sui hackathon projects
**Secondary audience:** Michael (operator)

---

## 1. Purpose

This document captures reusable technical and product learnings from the Flappy Frontier hackathon project. It is optimized for practical reuse by future LLM agents working in related repositories — particularly:

- **CivilizationControl** — EVE Frontier hackathon dApp (needs wallet auth, sponsorship, leaderboard, treasury, SSU rendering)
- **Shadow Broker Protocol** — EVE Frontier hackathon dApp (needs wallet auth, on-chain state, player identity, SSU integration)
- **Any EVE Frontier builder project** targeting Stillness or future tenants

This is NOT a retrospective narrative. It is a lookup reference organized by implementation surface.

---

## 2. Projects This Is Most Relevant To

| Project | Relevant Sections |
|---------|-------------------|
| CivilizationControl | §3–§12 (all) |
| Shadow Broker Protocol | §3–§12 (all) |
| Any EVE Frontier Sui dApp | §4, §5, §7, §8, §9 |
| Any Sui dApp with gas sponsorship | §5, §8 |
| Any Canvas 2D game on Sui | §3, §6, §9 |

---

## 3. Core Reusable Patterns

### 3.1 Generic Treasury (`Treasury<phantom T>`)

**What:** A Move struct `Treasury<phantom T> { id: UID, balance: Balance<T>, epoch_start_ms: u64, current_epoch: u64 }` that holds any `Coin<T>`. At runtime in EVE Frontier, `T = EVE::EVE` (the Stillness EVE coin type).

**Why generic:** The EVE coin is published by EVE Frontier, not by us. We can't import it as a compile-time dependency in Move.toml without adding a dep on the EVE assets package. Generic `phantom T` means zero compile-time dependency — the caller specifies `<EVE_TYPE>` at call sites. Tests use `Coin<SUI>` seamlessly.

**Source files:**
- `contracts/flappy_frontier/sources/treasury.move` — struct definition, `pay_entry_fee`, `distribute_payout`
- `contracts/flappy_frontier/sources/game.move` — `init_treasury<T>()`, `start_run<T>()`, `trigger_payout<T>()`
- `frontend/src/lib/contractConfig.ts` — `eveCoinType` string for PTB type args

**Reuse verdict:** Copy pattern as-is for any project needing a coin-holding shared object. Only change the type arg at call sites.

### 3.2 Trustless Public Settlement

**What:** The `trigger_payout()` function requires NO `AdminCap`. Anyone can call it. The contract enforces epoch expiry via `Clock` timestamp check.

**Why:** Eliminates the admin-as-bottleneck problem. If the operator disappears, any player can trigger settlement. This is a judging-friendly design ("fully trustless") and a good UX story.

**Design nuance:** `AdminCap` is narrowly scoped to `set_entry_fee`, `set_epoch_duration`, `set_payout_shares` — parameter adjustment only. There is NO `withdraw`, `admin_withdraw`, or `emergency_drain` function anywhere. This is deliberate — funds can only leave via rule-driven payout to leaderboard winners.

**Reuse verdict:** Strong pattern for any prize pool / treasury / escrow. Copy the capability isolation model directly.

### 3.3 Dual-Signature Gas Sponsorship via Cloudflare Worker

**What:** Player signs `TransactionKind` (no gas info). A Cloudflare Worker adds gas payment from a sponsor wallet and co-signs. Frontend combines both signatures.

**Why:** The `evefrontier:sponsoredTransaction` wallet capability is NOT usable for game transactions (see §5 for details). Custom sponsorship is the only path for gasless UX with arbitrary Move calls.

**Source files:**
- `workers/sponsor-service/src/index.ts` — Worker implementation (195 lines)
- `frontend/src/lib/sponsorship.ts` — Client library (119 lines)
- `frontend/src/features/auth/hooks/useGameTransaction.ts` — Orchestrator hook (97 lines)

**Reuse verdict:** Copy the entire `workers/sponsor-service/` directory and `frontend/src/lib/sponsorship.ts`. Adapt CORS origins and gas budget. The architecture is project-agnostic.

### 3.4 SSU Wallet Detection via Runtime Evidence

**What:** Detect the in-game browser by checking for the presence of a wallet named `"EVE Frontier Client Wallet"` in the Sui Wallet Standard wallet list — NOT by viewport dimensions.

**Why:** Viewport detection (787×1198 ±5px) is fragile and only useful for layout. The wallet runtime evidence is authoritative for "are we in the SSU?"

**Source file:** `frontend/src/features/auth/hooks/useSSUWallet.ts`

**Reuse verdict:** Copy `useSSUWallet.ts` as the canonical SSU detection pattern. It handles settling (1.5s grace period for async wallet registration), auto-connect, direct-connect fallback, and status state machine.

### 3.5 Player Name Resolution (2-Step RPC)

**What:** Resolve EVE Frontier character names from wallet addresses via:
1. `getOwnedObjects(owner=address, filter={StructType: "<worldPkg>::character::PlayerProfile"})` → get `character_id`
2. `getObject(id=character_id)` → read `metadata.fields.name`

**Source files:**
- `frontend/src/lib/playerNames.ts` — Core resolution + 5-min in-memory cache
- `frontend/src/features/auth/hooks/usePlayerName.ts` — React hooks

**Reuse verdict:** Copy directly. Update `worldPackageId` if targeting a different tenant.

---

## 4. Wallet + Auth Learnings

### 4.1 Provider Stack

```
QueryClientProvider (@tanstack/react-query)
  └─ SuiClientProvider (@mysten/dapp-kit)
       └─ WalletProvider (@mysten/dapp-kit)
            └─ App
```

**Key config:**
- `createNetworkConfig({ testnet: { url: rpcUrl, network: 'testnet' } })` — single-network setup
- `WalletProvider` props: `autoConnect` (reads localStorage for reconnection), `preferredWallets: ['EVE Vault', 'EVE Frontier Client Wallet']`
- `ConnectModal` (from dapp-kit) is used for browser wallet selection — bypassed entirely in SSU via `useSSUWallet`

**Source file:** `frontend/src/app/Providers.tsx`

### 4.2 SSU Wallet Name Has a Suffix

**TRAP:** The actual SSU wallet name is `"EVE Frontier Client Wallet (Eve Vault like)"` — not just `"EVE Frontier Client Wallet"`. Detection MUST use `startsWith()` or `includes()`, never exact match.

**Source:** Runtime observation in SSU. Hardcoded constant in `useSSUWallet.ts` uses `startsWith`.

### 4.3 SSU Wallet Capabilities

The SSU wallet advertises:
- `standard:connect`, `standard:disconnect`, `standard:events`
- `sui:signPersonalMessage`, `sui:signTransaction`, `sui:signAndExecuteTransaction`
- `evefrontier:sponsoredTransaction` (assembly-scoped — NOT usable for arbitrary game calls)

### 4.4 Two Auto-Connect Mechanisms

1. **dapp-kit's built-in `autoConnect`:** Reads `localStorage` for last-connected wallet. Works in browser for return visits.
2. **`useSSUWallet` fallback:** After dapp-kit's auto-connect completes with no stored session, programmatically connects the detected EVE Frontier Client Wallet if present.

Both are needed. dapp-kit handles return visits; the custom hook handles first-visit SSU auto-connect.

### 4.5 Wallet Detection Settling

Wallets register asynchronously via the Sui Wallet Standard. On page load, the wallet list may be empty for a few hundred milliseconds. `useSSUWallet` uses a 1500ms settling timer before declaring "no SSU wallet found." This prevents a flash of "Connect Wallet" UI that instantly resolves to auto-connected state.

### 4.6 Viewport Detection Is For Layout Only

`environment.ts` exports `detectEnvironment()` — checks viewport 787±5 × 1198±5 OR `?mode=ingame` query param. This flag drives layout/scaling decisions (CSS transform vs full-bleed), NOT wallet logic. SSU wallet detection is entirely separate.

**TRAP:** Early iterations incorrectly gated `canPlayRanked` on `!isInGameBrowser` — an assumption that the SSU has no wallet. This was wrong (SSU DOES have a wallet). Fixed by making ranked eligibility purely `!!account?.address`.

### 4.7 SDK Version + Package Name

- **Correct package:** `@mysten/dapp-kit` (v1.0.3) — NOT `dapp-kit-react` (that was an outdated plan reference)
- **Supporting packages:** `@mysten/sui` (v2.7.0), `@mysten/wallet-standard` (v0.20.1)
- `@evefrontier/dapp-kit` was deferred — EVE type resolved statically from `contractConfig.ts` instead

---

## 5. Sponsored Transaction Learnings

### 5.1 `evefrontier:sponsoredTransaction` Is Assembly-Scoped (NOT Generic)

**CRITICAL TRAP:** Both the SSU wallet and Eve Vault browser extension advertise `evefrontier:sponsoredTransaction`. This capability is NOT a generic gas sponsorship API.

**What it actually does:** Routes to `https://api.{tier}.tech.evefrontier.com/transactions/sponsored/{assemblyType}/{action}`. Requires `assembly` (object ID), `assemblyType`, and `txAction` parameters. It is designed for Smart Assembly operations (fueling, configuring SSUs), not for arbitrary game contract calls.

**Source evidence:** `vendor/evevault/apps/extension/src/lib/background/handlers/sponsoredTransactionHandler.ts` — validates `assembly` and `assemblyType` as required fields.

**Consequence:** For game-specific transactions (start_run, submit_score, trigger_payout), you MUST implement your own gas sponsorship. The `evefrontier:sponsoredTransaction` shortcut does not work.

### 5.2 Dual-Signature Sponsor Service Architecture

**Data flow:**
```
Player clicks "Play Ranked"
  └─ useGameTransaction.execute(tx, sender)
       ├─ [Sponsored path]
       │    1. tx.build({ client, onlyTransactionKind: true }) → kindBytes
       │    2. POST /sponsor { txKindB64, sender } → { txB64, sponsorSignature }
       │         └─ Worker: Transaction.fromKind() → setSender → setGasOwner → setGasBudget → build → keypair.sign
       │    3. Transaction.from(txB64) → player signs → playerSignature
       │    4. executeTransactionBlock(txBytes, [playerSig, sponsorSig])
       │
       └─ [Standard fallback — player pays gas]
            signAndExecuteTransaction(tx)
```

### 5.3 `SuiJsonRpcClient` Constructor Bug

**TRAP:** `SuiJsonRpcClient` from `@mysten/sui/jsonRpc` takes `{ url: string }`, NOT a plain string. Passing a plain string silently succeeds at construction but fails lazily with `'Invalid URL: undefined'` when the first RPC call fires (e.g., during `tx.build()`).

**This cost significant debugging time.** The error only appears when the sponsor service attempts to build the transaction, not at startup. The frontend silently falls back to player-paid gas, masking the bug.

**Correct pattern:**
```typescript
const client = new SuiJsonRpcClient({ url: rpcUrl });  // ✅
// NOT: new SuiJsonRpcClient(rpcUrl);                   // ❌ silently broken
```

### 5.4 Fallback Behavior

- If player **rejects** wallet popup → error propagates (no fallback)
- For **all other errors** (network, sponsor service down, sponsor out of gas) → `console.warn` + automatic fallback to standard (player-paid) gas
- This means the app gracefully degrades when the sponsor service is down — users just pay their own gas

### 5.5 CORS for Preview Deploys

**TRAP:** The `ALLOWED_ORIGINS` env var in `wrangler.toml` **overrides** the hardcoded defaults in the worker code. The code has logic for wildcard `*.flappy-frontier.pages.dev` (preview deploy URLs), but if `ALLOWED_ORIGINS` is set as an env var, that wildcard logic doesn't fire.

**Workaround:** The worker code checks for the `.flappy-frontier.pages.dev` suffix pattern in its CORS validation. But make sure the env var and code defaults are consistent.

### 5.6 Sponsor Service Has No Transaction Validation

**Known gap:** The worker sponsors ANY `TransactionKind` sent to it. There is no filtering by package ID, function name, or call target. A malicious user could craft arbitrary Move calls and have them gas-sponsored.

**Recommended fix for future projects:** Add allowlist validation in the worker — check that the transaction only calls functions from your own package ID.

### 5.7 Sponsor Wallet Key Management

- Secret stored via `wrangler secret put SPONSOR_PRIVATE_KEY` (bech32 `suiprivkey1...` format)
- Never committed to repo — only in Cloudflare's secret store
- Sponsor wallet needs SUI balance for gas — must be funded manually on testnet
- Sponsor wallet address: derived from the Ed25519 keypair at runtime

---

## 6. SSU / Browser Rendering & Layout Learnings

### 6.1 Canvas Sizing Strategy

All game logic uses a fixed 787×1198 coordinate space (constants in `frontend/src/game/constants.ts`). The canvas buffer is always 787×1198 pixels.

- **SSU (in-game):** Canvas fills viewport via CSS `width: 100%; height: 100%`. Since SSU viewport = 787×1198 at DPR 1, buffer pixels map 1:1.
- **Standalone browser:** Canvas is centered and scaled via CSS `transform: scale(min(vw/787, vh/1198, 1.5))`. Max 1.5× upscale prevents excessive scaling on large monitors.

**No CSS breakpoints or media queries.** All responsive behavior is a single JS-calculated CSS transform.

### 6.2 DPR (Device Pixel Ratio) Handling

There is NO explicit DPR handling. The canvas buffer is always 787×1198 regardless of `window.devicePixelRatio`. This is fine for SSU (DPR=1) but means **canvas will be slightly blurry on Retina/HiDPI displays** in standalone mode. Acceptable tradeoff for a hackathon game.

**For future projects:** If sharp rendering on HiDPI matters, multiply canvas buffer dimensions by `window.devicePixelRatio` and scale the context accordingly.

### 6.3 SVG Asset Trap — Missing width/height Attributes

**TRAP:** SVGs loaded via `new Image()` and converted to `ImageBitmap` via `createImageBitmap()` render as fully transparent if the SVG lacks explicit `width` and `height` attributes — even if a `viewBox` is set. Setting `img.width` on the `Image` element does NOT fix it. The SVG file itself must have the attributes.

**This was the root cause of invisible game sprites** — no loading errors, no console warnings, just a transparent bitmap.

**Safety net:** `assets.ts` includes a bitmap validity check that samples pixels via `OffscreenCanvas` and falls back to placeholder rendering if the bitmap is blank.

**Source files:**
- `frontend/src/game/assets.ts` — Loading + validation
- `frontend/public/assets/*.svg` — All SVGs now have explicit width/height

### 6.4 In-Game vs Standalone Layout Fork

The only SSU-specific layout difference is in `GamePage.tsx`:
- **In-game:** `w-full h-full` container, no CSS transform, `fillParent={true}` on canvas
- **Standalone:** Fixed 787×1198 container with CSS `transform: scale(...)`, centered in viewport

All UI overlays (StartScreen, GameOverScreen, ScoreOverlay) use `absolute inset-0` positioning — works identically in both modes. No SSU-specific CSS classes or separate stylesheets.

### 6.5 Fonts Are Declared But Never Loaded

**BUG (unfixed):** Tailwind config declares `font-mono: "Share Tech Mono"` and `font-display: "Orbitron"`, but neither font is loaded via `<link>`, `@font-face`, or any CDN import. Everything falls back to system monospace.

**For future projects:** If you define custom fonts in Tailwind config, actually import them in `index.html` or CSS.

### 6.6 Canvas Rendering Best Practices

- `alpha: false` on canvas context creation — avoids compositing overhead
- `Math.round()` on all pixel positions — prevents sub-pixel blur
- Separate `update(dt)` and `render(ctx)` phases — frame-rate independent physics
- Delta-time for all movement calculations — never assume 60fps
- Pre-rasterize SVGs to `ImageBitmap` at load time — avoids per-frame SVG parsing

---

## 7. Player Identity / Name Resolution Learnings

### 7.1 Resolution Flow

```
Wallet Address
  ↓
getOwnedObjects(owner=address, filter={StructType: "<worldPkg>::character::PlayerProfile"})
  ↓
Extract character_id from PlayerProfile.fields.character_id
  ↓
getObject(id=character_id, options={showContent: true})
  ↓
Read metadata.fields.name → trim → return (or null if empty)
```

**Two RPC calls per address.** For a 10-entry leaderboard, worst case is 20 calls (parallelized via `Promise.all`).

### 7.2 The PlayerProfile Struct Type String

```
<worldPackageId>::character::PlayerProfile
```

For Stillness: `0x28b497559d65ab320d9da4613bf2498d5946b2c0ae3597ccfda3072ce127448c::character::PlayerProfile`

This is constructed at runtime from `CONTRACT_CONFIG.worldPackageId`. Different tenants have different worldPackageId values.

### 7.3 Not All Addresses Have Characters

Many wallet addresses will return no `PlayerProfile` objects — only players who created an EVE Frontier in-game character have one. Always have a fallback to shortened address (`0xabcd…ef12`).

### 7.4 Caching Strategy

- Module-level `Map<string, CacheEntry>` — singleton in-memory cache
- TTL: 5 minutes
- **Negative results are cached** — addresses with no character get `null` cached for 5 min
- No persistence (resets on page reload)
- No formal cache eviction — entries accumulate forever (acceptable for small leaderboards)

### 7.5 Error Handling Is Silent

Network failures and "no character" are indistinguishable — both cache `null` and return `null`. No retry logic. The UI just shows the shortened address.

### 7.6 PlayerProfile Is Marked "Temporary" in Upstream Code

The `PlayerProfile` struct in `vendor/world-contracts/contracts/world/sources/character/character.move` has a `TODO: Replace with Character OwnerCap-to-wallet flow` comment. If upstream changes this, the resolution flow will break. Monitor upstream changes.

---

## 8. Environment / Deploy / Config Learnings

### 8.1 Stillness vs Utopia

| | Utopia (superseded) | Stillness (active) |
|---|---|---|
| **EVE coin type** | `0xf044...::EVE::EVE` | `0x2a66...::EVE::EVE` |
| **World package ID** | (old, unknown) | `0x28b4...448c` |
| **Datahub API** | `world-api-utopia...` | `world-api-stillness.live.tech.evefrontier.com` |
| **Chain** | Sui testnet (`4c78adac`) | Sui testnet (`4c78adac`) — same chain! |

**Key insight:** Utopia and Stillness are on the same Sui testnet chain — they are **different EVE Frontier world deployments on the same blockchain**. Switching tenants means: fresh contract publish, new `init_treasury<NewEveType>()` call, update `contractConfig.ts` with new IDs.

**Move contracts need ZERO code changes** between tenants. The `Treasury<phantom T>` generic handles it. Only the type arg at call sites and the frontend config change.

### 8.2 Tenant Configuration Source

Canonical tenant config (EVE types, world package IDs, datahub URLs) comes from `@evefrontier/dapp-kit` → `TENANT_CONFIG` map in `utils/constants.ts`. For Flappy Frontier, these values were hardcoded into `contractConfig.ts` instead of importing the SDK.

**Decision rationale:** Avoided `@evefrontier/dapp-kit` dependency to keep the frontend lean. The trade-off is manual updates when the tenant config changes.

### 8.3 Contract Publish + Init Sequence

**Step 1 — Publish:**
```bash
sui client publish contracts/flappy_frontier
```
The `init()` function runs automatically, creating:
- `AdminCap` (owned by deployer)
- `GameConfig` (shared, default params)
- `Leaderboard` (shared, empty)

**Step 2 — Init Treasury (separate post-publish call):**
```bash
sui client call \
  --package <PACKAGE_ID> \
  --module game \
  --function init_treasury \
  --type-args <EVE_COIN_TYPE> \
  --args <ADMIN_CAP_ID> 0x6
```

**Why two steps:** Treasury is generic over `T`. The `init()` function can't specify a type parameter — it takes no arguments. Treasury creation requires an explicit type arg, so it must be a separate transaction.

**Important:** `Published.toml` is auto-generated by the Sui CLI and should be committed. It contains the package ID and chain ID.

### 8.4 Only One Frontend Env Var

| Variable | Purpose | Default |
|---|---|---|
| `VITE_SPONSOR_SERVICE_URL` | Sponsor service endpoint | Empty (disabled) |

All other config (object IDs, RPC URL, network, coin types) is hardcoded in `contractConfig.ts`. This is a deliberate hackathon simplification — no runtime environment switching.

### 8.5 Cloudflare Pages Deployment

**Frontend:**
```bash
cd frontend
npm run build
npx wrangler pages deploy dist                   # production (from main)
npx wrangler pages deploy dist --branch <branch> # preview
```

Config: `frontend/wrangler.jsonc` — minimal, just `name`, `compatibility_date`, `pages_build_output_dir`.

**Sponsor service:**
```bash
cd workers/sponsor-service
npm install
npx wrangler deploy
wrangler secret put SPONSOR_PRIVATE_KEY
# Then fund the sponsor wallet with testnet SUI
```

### 8.6 Localhost vs Preview vs Production

| Aspect | Localhost | Preview Deploy | Production |
|---|---|---|---|
| URL | `http://localhost:5173` | `https://<branch>.flappy-frontier.pages.dev` | `https://flappy-frontier.pages.dev` |
| Sponsor service | `http://localhost:8787` (Wrangler dev) | Same production worker | Same production worker |
| CORS | Hardcoded in worker defaults | Wildcard `*.flappy-frontier.pages.dev` pattern in code | Explicit in `ALLOWED_ORIGINS` |
| Wallet | Browser wallet (Eve Vault) | Browser wallet (Eve Vault) | Browser wallet + SSU |
| Env vars | `.env.local` (gitignored) | Cloudflare Pages env settings | Cloudflare Pages env settings |

**TRAP:** The `ALLOWED_ORIGINS` wrangler.toml var overrides the code's wildcard logic. If you set the env var, preview deploys may fail CORS unless the env var includes the wildcard pattern.

### 8.7 Epoch Duration Mismatch (By Design)

On-chain default: 600,000 ms (10 minutes) — set during publish for testnet convenience.
Frontend display: 604,800,000 ms (7 days) — aspirational/production value.

The actual on-chain value governs behavior — the frontend display is informational. Admin can change epoch duration via `set_epoch_duration()`.

---

## 9. On-Chain Design Learnings

### 9.1 Object Ownership Model

| Object | Ownership | Access Pattern |
|---|---|---|
| `AdminCap` | Owned (deployer) | Witness for config changes |
| `GameConfig` | Shared | Read by all functions |
| `Leaderboard` | Shared | Mutated by `submit_score`, `trigger_payout` |
| `Treasury<T>` | Shared | Mutated by `start_run` (deposit), `trigger_payout` (withdrawal) |

Shared objects incur consensus latency on every mutation. For a hackathon with low throughput, this is fine. For a high-throughput game, consider owned objects + PTB batching.

### 9.2 Capability Isolation Pattern

`AdminCap` is available as the first argument to config-adjustment functions:
```move
public fun set_entry_fee(_: &AdminCap, config: &mut GameConfig, new_fee: u64)
```

**The underscore-name `_: &AdminCap` pattern** means the cap is required as a witness but never read from. This is the standard Sui capability-gate pattern.

AdminCap has NO fund-movement powers. No function accepting AdminCap can touch the Treasury balance.

### 9.3 Epoch + Time-Window Enforcement

```move
fun distribute_payout<T>(treasury, leaderboard, config, clock):
    assert!(clock_ms >= epoch_start_ms + epoch_duration_ms, EEpochNotExpired);
    // ... distribute
    treasury.epoch_start_ms = clock_ms;  // reset to NOW
    treasury.current_epoch += 1;
```

**Trap: Calendar alignment.** The raw epoch model is a rolling window (anchor + duration), not calendar-aligned. Flappy Frontier wanted Sunday 00:00 UTC payouts, so the frontend computes the target independently and the admin manually adjusts `epoch_duration_ms` to reach the next Sunday boundary. This is a pragmatic hack — a production system would want an on-chain calendar module.

### 9.4 Payout Distribution — Fewer Winners Than Slots

If 3 payout slots (50/30/20) but only 2 leaderboard entries:
- `active_shares_sum = 50 + 30 = 80`
- Winner 1: `total * 50/80 = 62.5%`
- Winner 2: remainder = `37.5%`

Full treasury balance is always distributed. No "house take." Rounding dust goes to the last winner.

### 9.5 Zero-Entry Epochs

If nobody plays during an epoch, `trigger_payout()` still advances the epoch counter and resets `epoch_start_ms`. The balance rolls over to the next epoch. No funds are lost or stuck.

### 9.6 Score Integrity Gap

**Known limitation:** There is no on-chain replay/verification of the game. The contract trusts the client-reported score. The `run_seed` is stored on the leaderboard entry for off-chain auditing but is not enforced on-chain(i.e., nobody verifies that the claimed score is achievable with the given seed).

For a hackathon, this is acceptable. For production, consider: ZK proof of gameplay, server-side replay, or a challenge/dispute system.

### 9.7 Entry Fee Collection Pattern

```move
entry fun start_run<T>(treasury, config, payment: &mut Coin<T>, rng, clock, ctx)
```

`payment` is `&mut Coin<T>` — the function splits the exact fee amount from the player's coin and leaves the change IN the player's original coin object. No orphaned coin objects, no full-spend-and-refund pattern.

### 9.8 On-Chain Randomness via `sui::random`

```move
let mut gen = random::new_generator(rng, ctx);
let seed = gen.generate_u256();
```

- `rng` is the well-known `Random` shared object at `0x8`
- Seed is emitted via event, not returned (Move entry functions can't return values)
- Frontend extracts seed from `RunStartedEvent.parsedJson.seed` via `waitForTransaction()`
- Seed is truncated from u256 to u32 (`BigInt & 0xFFFFFFFF`) for the Mulberry32 PRNG

### 9.9 Move Package Structure

```
contracts/flappy_frontier/
  Move.toml          # No dependencies section — only stdlib/sui framework
  Published.toml     # Auto-generated by sui CLI
  sources/
    config.move      # AdminCap, GameConfig, init()
    game.move        # Entry functions (start_run, submit_score, trigger_payout, init_treasury)
    leaderboard.move # Leaderboard + LeaderboardEntry structs, sorted insert
    treasury.move    # Treasury<phantom T>, pay_entry_fee, distribute_payout
  tests/
    leaderboard_tests.move
    treasury_tests.move
```

All mutating functions on Treasury and Leaderboard are `public(package)` — only callable from the `game` module. This prevents external callers from directly manipulating the leaderboard or treasury.

---

## 10. UI / Branding / Presentation Learnings

### 10.1 Brand Color

Primary accent: `#ff4c26` (EFMap orange). Used everywhere as inline styles — NOT as a Tailwind token.

**For future projects:** Define this as a Tailwind `accent` color token instead of hardcoding in 20+ inline styles.

### 10.2 Tailwind Theme

Custom `gray` scale (zero blue-cast charcoal) and `space` namespace defined in `tailwind.config.ts`. The `space.*` tokens (bg, hull, panel, ground, pipe, pipeCap) are defined but largely unused in components — Canvas rendering uses its own `COLORS` constant from `constants.ts`.

### 10.3 LogoBadge Pattern

A glassmorphism badge component positioned in the bottom-right corner. Based on the EFMap LogoBadge pattern.

- **Reference implementation:** `frontend/_reference/efmap-logo-badge/LogoBadge.tsx` (CSS modules, design tokens, full parameterization)
- **Simplified implementation:** `frontend/src/features/game/components/LogoBadge.tsx` (Tailwind + inline styles, fixed positioning)

**Reuse verdict:** Copy the reference implementation for a more polished starting point, then adapt.

### 10.4 Mode Selector UX

Two-card layout: Practice (free, always available) and Ranked (requires wallet + EVE). Ranked card shows a lock icon when wallet is disconnected. Clean separation of concerns.

**Source:** `frontend/src/features/game/components/ModeSelector.tsx`

### 10.5 Dead Assets

`ship-hull.svg` and `frontier-ship-reference.png` are unused — superseded by `frontier-ship.png`. Clean up dead assets before submission.

---

## 11. Demo / Pitch Learnings

### 11.1 No Demo Materials Exist

`docs/demo/` is empty. No demo scripts, screenshots, or video notes were created.

**Recommendation for future projects:** Create demo materials early. Judges browse the repo — a `docs/demo/` folder with screenshots, a 30-second video script, and a demo walkthrough adds significant polish.

### 11.2 What Makes a Good Hackathon Demo Story

Based on Flappy Frontier's strengths:
- **Trustless treasury:** "No one — not even the admin — can withdraw player funds. Payouts are rule-driven and publicly triggerable."
- **Seamless SSU integration:** "The game loads inside EVE Frontier's in-game browser and auto-connects the wallet — zero clicks needed."
- **Gas sponsorship:** "Players never need SUI for gas. A sponsor service transparently pays gas on their behalf."
- **On-chain fairness:** "The game seed comes from Sui's on-chain random beacon — no server, no admin can influence it."

---

## 12. Known Traps / Failure Modes

### 12.1 Traps That Cost Significant Time

| Trap | Impact | Root Cause | Prevention |
|------|--------|------------|------------|
| SVG without width/height → invisible bitmap | 2+ hours debugging | `createImageBitmap()` silently produces transparent bitmap | Always include width/height on SVGs; add bitmap validation |
| `SuiJsonRpcClient(url)` vs `SuiJsonRpcClient({url})` | Hours of "why is sponsorship failing" | SDK accepts plain string at construction, fails lazily on first RPC call | Always use options object `{ url: ... }` |
| SSU wallet name has suffix `(Eve Vault like)` | Failed wallet detection in production | Exact string match on `"EVE Frontier Client Wallet"` | Use `startsWith()` or `includes()` |
| `canPlayRanked` gated on `!isInGameBrowser` | Ranked mode locked in SSU even with wallet connected | Assumption SSU has no wallet (wrong) | Gate ranked on wallet connection status only |
| `evefrontier:sponsoredTransaction` looks generic but isn't | Wasted investigation time | Assembly-scoped requires specific params | Read source code; don't assume from capability name |
| Wallet count guard `wallets.length !== 1` | Auto-connect failed in SSU | SSU may register multiple wallet entries | Find target wallet by name, not by count |
| `ALLOWED_ORIGINS` env var overrides wildcard logic | Preview deploys fail CORS | wrangler.toml var takes precedence over code defaults | Keep env var and code defaults synchronized |
| MoveCall target points to original (v1) package after upgrade | New contract code never executes; old behavior persists silently | Sui doesn't auto-resolve MoveCall to latest upgrade | After EVERY upgrade: update packageId in contractConfig.ts + ALLOWED_PACKAGE_ID in sponsor wrangler.toml |
| Stale frontend bundle has old package ID baked in | Deployed frontend calls old contract version | `npm run build` was not re-run after config change or build cache was stale | Always grep built bundle for expected package ID before deploying |
| CORS origin check treated as security boundary | Sponsor service sponsors arbitrary transactions from curl/scripts | CORS only stops browsers, not direct HTTP | Validate transaction contents: package/module/function allowlist |

### 12.2 False Assumptions Corrected

| Assumption | Reality |
|---|---|
| "The SSU in-game browser has no wallet" | SSU injects `EVE Frontier Client Wallet` with full sign/execute capabilities |
| "Viewport detection = SSU detection" | Viewport detection is for layout; wallet runtime evidence is for SSU detection |
| "`evefrontier:sponsoredTransaction` can sponsor any transaction" | It is assembly-scoped — requires assembly ID and type |
| "dapp-kit `autoConnect` handles first-visit SSU" | `autoConnect` reads localStorage — useless on first visit; need custom hook |
| "SUI is the entry fee token" | EVE is the correct token from day one (per EVE Frontier economy) |
| "Treasury<T> can be initialized at publish time" | Generic `init()` can't bind type params — requires separate post-publish call |
| "Epoch is calendar-aligned by default" | Epoch is rolling window (anchor + duration) — calendar alignment requires manual admin adjustment |
| "Sui auto-resolves MoveCall targets to the latest upgrade version" | Each upgrade creates a new immutable package; MoveCall must target the exact address whose bytecode you want |
| "Event types carry the emitting package's address" | Event types carry the original (v1) package address regardless of which upgrade version emitted them |
| "CORS protects my sponsor service from abuse" | CORS is browser-only; direct HTTP calls bypass it entirely |

### 12.3 Things That Were Unexpectedly Difficult

1. **Sponsor transaction architecture.** Expected to use `evefrontier:sponsoredTransaction`. Discovered it's assembly-scoped. Had to design and build a custom dual-signature Cloudflare Worker from scratch.
2. **SVG-to-bitmap rendering.** No error signals when SVGs render transparently. Required creative debugging (OffscreenCanvas pixel sampling).
3. **SSU wallet detection timing.** Wallets register asynchronously; a naive check on page load sees zero wallets. Required a settling mechanism.
4. **Calendar-aligned epochs.** The on-chain epoch model is a rolling window, not aligned to calendar boundaries. Alignment requires manual admin intervention or a more complex on-chain module.
5. **Package upgrade versioning.** Discovering that MoveCall targets don't auto-resolve took 5+ hours across multiple sessions. The feedback is silent — old code executes successfully with partial behavior.
6. **Diagnosing deployed vs local code mismatch.** Without explicit bundle verification, it's impossible to tell from the UI whether you're running old or new code.

### 12.4 Things That Were Unexpectedly Easy

1. **Generic `Treasury<phantom T>`.** Works seamlessly across coin types. Tests use SUI, production uses EVE, zero code changes.
2. **Trustless public settlement.** Just removing `AdminCap` from `trigger_payout`'s arguments. Conceptually simple, very high demo value.
3. **Player name resolution.** Two RPC calls, simple caching, works reliably.
4. **Stillness retargeting.** Zero Move code changes. Fresh publish + new config IDs.
5. **Cloudflare Pages deployment.** Minimal config, just `wrangler.jsonc` with name and output dir.

---

## 13. Recommended Carry-Forward Patterns

These patterns from Flappy Frontier are reusable as-is or with minimal adaptation:

| Pattern | Source Files | Adaptation Needed |
|---------|-------------|-------------------|
| `Treasury<phantom T>` generic custody | `contracts/*/treasury.move` | Change payout logic per game |
| `AdminCap` narrowly scoped to config | `contracts/*/config.move` | Adjust config params per game |
| Trustless public settlement | `contracts/*/game.move` (`trigger_payout`) | Adjust winner selection logic |
| `public(package)` visibility pattern | All contract modules | Direct reuse |
| Dual-sig sponsor service (CF Worker) | `workers/sponsor-service/` | Copy entire directory, update CORS |
| Sponsorship client library | `frontend/src/lib/sponsorship.ts` | Copy as-is |
| `useGameTransaction` hook | `frontend/src/features/auth/hooks/useGameTransaction.ts` | Copy as-is |
| SSU wallet detection | `frontend/src/features/auth/hooks/useSSUWallet.ts` | Copy as-is |
| Player name resolution | `frontend/src/lib/playerNames.ts` + `usePlayerName.ts` | Update worldPackageId |
| Provider stack setup | `frontend/src/app/Providers.tsx` | Update network config |
| Contract config pattern | `frontend/src/lib/contractConfig.ts` | Replace IDs per deployment |
| Environment detection | `frontend/src/lib/environment.ts` | Copy as-is |
| Canvas 787×1198 coordinate space | `frontend/src/game/constants.ts` | If targeting SSU viewport |
| SVG bitmap validation | `frontend/src/game/assets.ts` | Copy if using SVG assets |

---

## 14. Recommended "Do This First" Checklist for Future Projects

### Day 1 — Foundation

- [ ] Set up repo with `.github/copilot-instructions.md` and `AGENTS.md` (copy from Flappy Frontier, adapt)
- [ ] Create `frontend/` with Vite + React + Tailwind + `@mysten/dapp-kit` + `@mysten/sui`
- [ ] Create `contracts/<project>/` with Move.toml (no dependencies needed for pure Sui framework)
- [ ] Create `workers/sponsor-service/` (copy from Flappy Frontier, update CORS origins)
- [ ] Create `frontend/src/lib/contractConfig.ts` with placeholder IDs
- [ ] Create `frontend/src/app/Providers.tsx` with dapp-kit provider stack
- [ ] Set up `.env.example` with `VITE_SPONSOR_SERVICE_URL`
- [ ] Copy `useSSUWallet.ts` for SSU detection
- [ ] Copy `useGameTransaction.ts` for sponsored execution
- [ ] Copy `sponsorship.ts` for sponsor client
- [ ] Copy `playerNames.ts` + `usePlayerName.ts` for name resolution
- [ ] Copy `environment.ts` for viewport/mode detection

### Day 2 — Contracts + Publish

- [ ] Write Move contracts (use `public(package)` on all mutating functions)
- [ ] Use `Treasury<phantom T>` for any coin-holding
- [ ] Run `sui move build` + `sui move test` locally
- [ ] Verify `sui client active-env` before publishing (avoid mainnet!)
- [ ] Publish: `sui client publish contracts/<project>`
- [ ] Post-publish init: `sui client call --module <module> --function init_treasury --type-args <EVE_TYPE> --args <ADMIN_CAP> 0x6`
- [ ] Record all object IDs in `contractConfig.ts`
- [ ] Commit `Published.toml`

### Day 3 — Deployment + Integration

- [ ] Deploy frontend: `cd frontend && npm run build && npx wrangler pages deploy dist`
- [ ] Deploy sponsor service: `cd workers/sponsor-service && npx wrangler deploy`
- [ ] Set sponsor secret: `wrangler secret put SPONSOR_PRIVATE_KEY`
- [ ] Fund sponsor wallet with testnet SUI
- [ ] Set `VITE_SPONSOR_SERVICE_URL` in Cloudflare Pages env settings
- [ ] Test full flow: connect wallet → transaction → sponsored gas → on-chain state change

### Ongoing

- [ ] Always verify `sui client active-env` before any on-chain operation
- [ ] Never commit secrets, `.env.local`, private keys, mnemonics
- [ ] Use `startsWith()` for SSU wallet name matching (not exact)
- [ ] Add explicit width/height to all SVG assets
- [ ] Use `{ url: rpcUrl }` for `SuiJsonRpcClient` constructor

---

## 15. Recommended "Avoid This" Checklist

- [ ] Do NOT assume `evefrontier:sponsoredTransaction` can sponsor arbitrary transactions — it's assembly-scoped
- [ ] Do NOT use viewport detection for wallet/auth decisions — only for layout
- [ ] Do NOT use exact string match for SSU wallet name — the name has a suffix
- [ ] Do NOT gate ranked/premium features on `isInGameBrowser` — gate on wallet connection status
- [ ] Do NOT pass a plain string to `SuiJsonRpcClient` — always use `{ url: string }` options object
- [ ] Do NOT expect `Treasury<T>` to initialize at publish time — it needs a separate post-publish call with type arg
- [ ] Do NOT assume epoch = calendar period — the on-chain model is a rolling window
- [ ] Do NOT rely on `dapp-kit autoConnect` for first-visit SSU — it reads localStorage (empty on first visit)
- [ ] Do NOT assume wallet count = 1 in SSU — find the target wallet by name, not by count
- [ ] Do NOT use `ALLOWED_ORIGINS` env var without accounting for preview deploy wildcard needs
- [ ] Do NOT omit width/height attributes from SVG files used as canvas assets
- [ ] Do NOT define custom fonts in Tailwind without actually importing them
- [ ] Do NOT build a "backend" for leaderboard reads — use Sui RPC (`getObject` / `getDynamicFields`) directly
- [ ] Do NOT add `@evefrontier/dapp-kit` unless you actually need its SDK utilities — EVE type can be hardcoded as a string
- [ ] Do NOT assume MoveCall targets auto-resolve to the latest upgrade — they DON'T (see §17)
- [ ] Do NOT reason from local source code about what a deployed contract does — read on-chain transactions and events (see §18)
- [ ] Do NOT deploy without verifying the exact package ID in the built bundle — stale bundles are silent killers (see §19)

---

## 16. Security Review & Sponsor Hardening Learnings (Added 2026-03-15)

### 16.1 CORS/Origin Checks ≠ Authorization

**CRITICAL TRAP:** CORS origin checks prevent browsers from sending cross-origin requests, but they do NOT prevent direct HTTP calls from `curl`, scripts, or server-side code. Treat CORS as a browser convenience, not a security boundary.

**Flappy Frontier learning:** The sponsor service initially had NO transaction validation — it would sponsor ANY `TransactionKind` from any allowed origin. A malicious user could craft arbitrary Move calls using the sponsor wallet's gas budget.

**Fix applied:** Added allowlist validation in the sponsor worker:
- `ALLOWED_PACKAGE_ID` — only sponsors calls to our package
- `ALLOWED_MODULE` — only `game` module
- `ALLOWED_FUNCTIONS` — only `start_run`, `submit_score`, `trigger_payout`
- Command whitelist — blocks `TransferObjects`, `SplitCoins`, `MergeCoins`, `Publish`, `Upgrade`

**Reuse verdict:** Every sponsor service must validate the transaction contents. CORS alone is not sufficient. Add package/module/function allowlists from day one.

### 16.2 RunReceipt Pattern for Score Integrity

**What:** A `RunReceipt` is a `key`-only (non-transferable) object created by `start_run` and consumed (deleted) by `submit_score`. It binds a fee payment to exactly one score submission.

**Why it matters:**
- Without it: a player could pay once and submit unlimited scores
- `key` only (no `store`) means the receipt can't be wrapped, traded, or transferred to another address
- Receipt includes `player`, `seed`, `epoch` — `submit_score` validates all three

**Security properties:**
- One fee → one receipt → one score submission (receipt is destroyed on use)
- Receipt is player-bound (address checked at submission)
- Receipt is epoch-bound (can't reuse across epochs)
- `discard_receipt()` lets players abandon a run without losing the receipt object

**Source files:** `contracts/flappy_frontier/sources/game.move` (RunReceipt struct + start_run + submit_score)

**Reuse verdict:** Use this pattern for any pay-to-play or one-time-use ticket system on Sui.

### 16.3 Entry Fee Split Pattern — `&mut Coin<T>` Not Transfer

The `start_run` function takes `payment: &mut Coin<T>` (mutable reference), not ownership. It splits the exact fee amount from the player's coin, leaving the remainder in *the same coin object*. This avoids creating orphaned coin fragments.

**Contrast with bad pattern:** Transfer full coin → refund difference = creates 2 extra objects per play session (bad for gas, bad for UX).

---

## 17. Sui Package Upgrade & Versioning Learnings (Added 2026-03-15)

### 17.1 MoveCall Targets Do NOT Auto-Resolve — THE Critical Learning

**This was the single most expensive debugging lesson in the project.**

**Wrong mental model (cost 5+ hours across multiple sessions):** "Sui automatically redirects MoveCall targets from the original package to the latest upgrade version."

**Correct model:** Each `sui client upgrade` creates a **new immutable package object** with a new address. The original package address retains its v1 bytecode **forever**. When a PTB specifies `package: 0x355b...::game::start_run`, the Sui VM executes the bytecode stored at `0x355b...` — which is always v1.

**Evidence:** After publishing v6, the frontend still called `0x355b...::game::start_run`. The on-chain transaction emitted only `RunStartedEvent` (v1 behavior). The v6 code (which also emits `RunReceiptCreatedEvent` and creates a `RunReceipt`) was never reached.

**Fix:** Update `contractConfig.ts` to target the v6 package ID. The MoveCall target must be the **exact package address** whose bytecode you want to execute.

**Important nuance — Event type identity:** Events emitted by upgraded packages still carry the **original** package address in their type string (e.g., `0x355b...::game::RunStartedEvent` even when emitted by v6 code). This is correct Sui behavior — the type identity is anchored to the original package. Event parsing should use `.includes('::game::RunStartedEvent')` (substring match), not exact package prefix match.

**Important nuance — Shared object identity:** Shared objects (GameConfig, Treasury, Leaderboard) retain their object IDs across upgrades. Only the package address in MoveCall targets needs updating.

**Reuse verdict:** After EVERY contract upgrade, update:
1. `contractConfig.ts` → `packageId` to the new package address
2. `workers/sponsor-service/wrangler.toml` → `ALLOWED_PACKAGE_ID` to the new package address
3. Redeploy the sponsor service (`npx wrangler deploy`)
4. Rebuild and redeploy the frontend

### 17.2 `--force` Flag for Clean Upgrades

During the debugging process, several upgrades (v2, v4) appeared to publish successfully but the on-chain bytecode didn't change behavior. Using `sui client upgrade ... --force` forces a full recompilation, bypassing any build cache.

**Recommendation:** Always use `--force` for upgrades until you're confident the build cache is not stale.

### 17.3 `Published.toml` Is Auto-Managed

The Sui CLI auto-updates `Published.toml` on `publish` and `upgrade`. Always commit this file — it tracks the chain-id, original-id, and current `published-at` version. It's required for subsequent upgrades.

### 17.4 UpgradeCap Policy Levels

| Policy | Value | Meaning |
|--------|-------|---------|
| Compatible | 0 | Can add functions/structs, change function bodies. Most permissive. |
| Additive | 128 | Can add new items, cannot change existing signatures. |
| DepOnly | 192 | Can only change dependencies. |
| Immutable | — | UpgradeCap is destroyed. No further upgrades. |

For iterative hackathon development, `Compatible` (0) is correct. Before production, consider restricting to `Additive`.

---

## 18. Debugging From On-Chain Evidence (Added 2026-03-15)

### 18.1 Always Inspect Real Transactions, Not Local Code

**Learning:** Multiple debugging sessions were spent reading local Move source code and reasoning "this should emit two events." The actual on-chain behavior was different because the **deployed bytecode** was from an earlier version.

**Rule:** When debugging on-chain behavior, start with the actual transaction:
1. Get the transaction digest (from console logs, explorer, or RPC)
2. Query `sui_getTransactionBlock` with `showEvents: true, showEffects: true, showInput: true`
3. Check `events[]` — what events were actually emitted?
4. Check `effects.created[]` — what objects were actually created?
5. Check `transaction.data.transaction.transactions[].MoveCall.package` — what package was actually called?

### 18.2 Event Count Is a Fast Diagnostic

If you expect 2 events but get 1, the first question is: "Am I calling the right package version?" Check the MoveCall package in the transaction input, not in the event type (event types always use the original package address).

### 18.3 Diagnostic Logging Pattern

Add temporary `console.log` before event parsing in the frontend:
```typescript
console.log('[ranked-start] tx digest:', result.digest);
console.log('[ranked-start] events count:', result.events?.length);
console.log('[ranked-start] events:', JSON.stringify(result.events, null, 2));
```

This turns a 100 EVE blind test into an informative diagnostic. Always add this for new on-chain features until they're confirmed working.

### 18.4 `suix_queryEvents` for Historical Audit

```
POST https://fullnode.testnet.sui.io:443
{ "method": "suix_queryEvents", "params": [{ "MoveEventType": "<pkg>::<module>::<EventType>" }, null, 5, true] }
```

Returns all historical events of that type. If the result is empty, the event was **never emitted** — strong evidence the code path was never reached.

---

## 19. Deploy & Config Mismatch Learnings (Added 2026-03-15)

### 19.1 Verify Package ID in Built Bundle Before Deploying

**Rule:** After every build, grep the output bundle for the expected package ID:
```bash
Select-String -Path "frontend/dist/assets/index-*.js" -Pattern "<expected_package_id>"
```

Also verify the **old** package ID is NOT present:
```bash
Select-String -Path "frontend/dist/assets/index-*.js" -Pattern "<old_package_id>"
```

Both checks should be run before every deployment. One match for the new ID, zero matches for the old.

### 19.2 Preview vs Production URL Confusion

| URL Pattern | What It Is |
|-------------|-----------|
| `https://<hash>.flappy-frontier.pages.dev` | Specific deployment (immutable, hash-identified) |
| `https://<branch>.flappy-frontier.pages.dev` | Branch alias (mutable, updates on redeploy to that branch) |
| `https://flappy-frontier.pages.dev` | Production (points to latest `main` deploy) |
| `https://flappyfrontier.com` | Custom domain (CNAME to Cloudflare Pages production) |

**Trap:** Deploying to a preview branch URL does NOT update production. You must explicitly deploy with `--branch main` or no `--branch` flag for production.

### 19.3 Sponsor Service Must Match Frontend Package ID

When you change `contractConfig.ts` `packageId`, you must ALSO:
1. Update `ALLOWED_PACKAGE_ID` in `workers/sponsor-service/wrangler.toml`
2. Redeploy the sponsor service: `cd workers/sponsor-service && npx wrangler deploy`

If these are out of sync, the sponsor service will reject valid transactions with "Disallowed package" and the frontend will silently fall back to player-paid gas.

### 19.4 Stale Bundles Are Silent Killers

A stale frontend bundle will successfully execute transactions against the **old** package, getting old behavior without any errors. The user sees "transaction succeeded" but the expected new behavior (new events, new objects) is missing. This is extremely confusing because everything looks correct locally.

**Prevention checklist after any contract upgrade:**
1. Update `contractConfig.ts` packageId to new version
2. Update `ALLOWED_PACKAGE_ID` in sponsor service
3. `npm run build` in frontend
4. Verify new package ID in built bundle (grep)
5. Deploy sponsor service
6. Deploy frontend to production
7. Hard-refresh browser (Ctrl+Shift+R) to invalidate cache

---

## 20. File/Path References Inside This Repo (Useful Exemplars)

### Move Contracts
| File | What It Exemplifies |
|------|-------------------|
| `contracts/flappy_frontier/sources/config.move` | AdminCap + shared config + narrowly scoped init() |
| `contracts/flappy_frontier/sources/treasury.move` | Generic `Treasury<phantom T>`, trustless payout distribution |
| `contracts/flappy_frontier/sources/game.move` | Entry functions, on-chain randomness, public settlement |
| `contracts/flappy_frontier/sources/leaderboard.move` | Sorted vector leaderboard with insert+trim |
| `contracts/flappy_frontier/tests/treasury_tests.move` | Testing treasury with `Coin<SUI>` (generic) |

### Frontend — Auth & Wallet
| File | What It Exemplifies |
|------|-------------------|
| `frontend/src/app/Providers.tsx` | dapp-kit provider stack setup |
| `frontend/src/features/auth/hooks/useSSUWallet.ts` | SSU runtime detection + auto-connect + settling |
| `frontend/src/features/auth/hooks/useGameTransaction.ts` | Sponsored + fallback transaction execution |
| `frontend/src/features/auth/hooks/usePlayerIdentity.ts` | Identity + mode detection |

### Frontend — Sponsorship
| File | What It Exemplifies |
|------|-------------------|
| `frontend/src/lib/sponsorship.ts` | Sponsor client library + capability detection |
| `workers/sponsor-service/src/index.ts` | Cloudflare Worker dual-sig sponsor |
| `workers/sponsor-service/wrangler.toml` | Worker config with env vars |

### Frontend — Player Names
| File | What It Exemplifies |
|------|-------------------|
| `frontend/src/lib/playerNames.ts` | 2-step RPC resolution + caching |
| `frontend/src/features/auth/hooks/usePlayerName.ts` | React hooks for name resolution |

### Frontend — Game + Rendering
| File | What It Exemplifies |
|------|-------------------|
| `frontend/src/lib/contractConfig.ts` | Centralized on-chain config |
| `frontend/src/lib/environment.ts` | Viewport/mode detection |
| `frontend/src/game/constants.ts` | Fixed coordinate space + game tuning |
| `frontend/src/game/assets.ts` | SVG→ImageBitmap loading + validation |
| `frontend/src/game/gameLoop.ts` | Canvas game loop with delta-time |

### Config & Deploy
| File | What It Exemplifies |
|------|-------------------|
| `frontend/wrangler.jsonc` | Minimal Cloudflare Pages config |
| `frontend/.env.example` | Environment variable documentation |
| `contracts/flappy_frontier/Published.toml` | Post-publish artifact |

### Documentation
| File | What It Exemplifies |
|------|-------------------|
| `docs/decision-log.md` | Structured decision logging |
| `docs/plans/flappy-frontier-chain-integration-plan.md` | Phased execution plan |
| `.github/copilot-instructions.md` | Comprehensive LLM agent guardrails |
| `AGENTS.md` | Concise agent context summary |

---

*End of transfer document.*
