# Decision Log — Flappy Frontier

**Retention:** Carry-forward

Newest entries first. See `docs/operations/DECISIONS_TEMPLATE.md` for format.

---
## 2026-03-14 — Fix weekly countdown to target Sunday 00:00 UTC

- **Goal:** Countdown was showing ~7 days (anchor + duration) instead of targeting the next Sunday 00:00 UTC (~20h away). Label showed misleading "Week #2".
- **Root cause — countdown:** `epochTimeState` computed `epoch_start_ms + epoch_duration_ms` (rolling window, no calendar alignment). epoch_start was set to Clock.timestamp_ms() at init_treasury time (arbitrary, not a Sunday).
- **Root cause — label:** `current_epoch` from on-chain Treasury is just a payout counter, unrelated to calendar weeks.
- **Fix — frontend:** Replaced `epochTimeState(epochStartMs, durationMs)` with `weekTimeState(epochStartMs)` that computes the first Sunday 00:00 UTC after the epoch anchor. Replaced "Week #N" with "This Week".
- **Fix — on-chain:** Admin tx `68xPpJD3FTvfEoX86uZKZxmwQqRbpPGBBhBcPSmWCqzd` set `epoch_duration_ms` to 72,722,071 ms so the on-chain epoch also expires at Sunday March 15 00:00 UTC (matches the frontend).
- **Files:** `frontend/src/features/score/components/LeaderboardPanel.tsx`
- **Diff:** ~20 LoC changed (function rewrite + label)
- **Risk:** Low (display logic + admin parameter, no contract schema change)
- **Gates:** typecheck ✅ build ✅
- **Follow-up:** After Sunday payout, admin must call `set_epoch_duration(604800000)` to restore 7-day duration for subsequent weeks.

---
## 2026-03-14 — Weekly epoch + player name resolution

- **Goal:** Change competition window from 10-minute to weekly (Sunday 00:00 UTC), implement EVE Frontier character name resolution for leaderboard and player badge UI.
- **Files:** `frontend/src/lib/contractConfig.ts`, `frontend/src/lib/playerNames.ts` (new), `frontend/src/features/auth/hooks/usePlayerName.ts` (new), `frontend/src/features/game/components/GamePage.tsx`, `frontend/src/features/game/components/StartScreen.tsx`, `frontend/src/features/score/components/LeaderboardPanel.tsx`
- **Diff:** ~200 LoC added, ~20 LoC removed
- **Risk:** Medium (new utility + hooks, UI wiring, no core game loop changes)
- **Gates:** typecheck ✅ build ✅ smoke ⬜ (pending live validation)
- **On-chain admin tx:** `9U9toi4i6XRZE7hsrCucCg1sLnJnbvaRnVBrkTyRtRM3` — set `epoch_duration_ms` to 604,800,000 (7 days)
- **Follow-ups:** Verify player name display with real Stillness characters, remove temporary sponsor diagnostics from useGameTransaction.ts

---
## 2026-03-14 — Stillness contract publish + frontend retarget

- **Goal:** Migrate Flappy Frontier from Utopia validation context to Stillness live-server context. Fresh publish of identical Move contracts, init_treasury with Stillness EVE type, retarget frontend config.
- **Files:** `frontend/src/lib/contractConfig.ts`, `contracts/flappy_frontier/Published.toml`, `docs/plans/stillness-and-player-names-plan.md`, `docs/plans/flappy-frontier-chain-integration-plan.md`
- **Diff:** ~20 LoC changed (config values only, no logic changes)
- **Risk:** Medium (config retarget + contract redeploy, no code changes)
- **Gates:** typecheck ✅ build ✅ move-build ✅ move-test ✅ (23/23) smoke ⬜ (pending live validation with Stillness EVE)
- **New Stillness IDs:** Package `0x355b6228...9175e6`, AdminCap `0xc633e5f3...e77f7`, GameConfig `0x96127c4d...5c57`, Leaderboard `0xeeda7b21...784d`, Treasury `0xad7f4936...2813`, UpgradeCap `0x2dd8d599...aa5a`
- **Publish tx:** `AoCPM4PTDzCnRGK1kAux9tQmg3mYgWobxpSpV73V4nNN`
- **Init treasury tx:** `7kwvmWFxCS8Qy7mwJyWnYowTEuvw5cAxcUxBZc5pPJ75`
- **Follow-ups:** Live Stillness validation (Step 4), player name resolution (Step 5), Cloudflare re-deploy with Stillness config

---
## 2026-03-13 — Fix sponsor service SuiJsonRpcClient constructor

- **Goal:** Fix silent sponsor failure — worker was constructing `SuiJsonRpcClient(urlString)` instead of `SuiJsonRpcClient({ url: urlString })`. This caused "Invalid URL: undefined" on every request, which the frontend silently caught and fell back to player-paid gas.
- **Files:** `workers/sponsor-service/src/index.ts`
- **Diff:** 1 line changed
- **Risk:** Low (fixes existing broken path, no behavior change for fallback)
- **Gates:** worker-deploy ✅ sponsor-endpoint ✅ (returns 200 with valid dual-sig data)
- **Root cause:** SDK v2's `SuiJsonRpcClient` takes an options object `{ url }`, not a bare URL string. The constructor accepts anything without throwing, but the internal HTTP transport receives `undefined` for the URL, which only fails lazily when `tx.build()` makes its first RPC call.
- **Follow-ups:** Fund sponsor wallet with more SUI for sustained testing; verify end-to-end in browser.

---
## 2026-03-13 — Cloudflare deployment + gas sponsor service

- **Goal:** Deploy frontend to Cloudflare Pages and implement/deploy a lightweight gas sponsor service as a Cloudflare Worker for ranked mode transactions.
- **Files:** `workers/sponsor-service/` (new — `package.json`, `tsconfig.json`, `wrangler.toml`, `src/index.ts`), `frontend/wrangler.jsonc` (new), `frontend/.env.example` (new), `flappy-frontier-chain-integration-plan.md`, `decision-log.md`
- **Diff:** ~170 LoC added (worker), ~15 LoC config
- **Risk:** Medium (new deployment surface, sponsor wallet key management)
- **Gates:** typecheck ✅ build ✅ worker-build ✅ worker-deploy ✅ pages-deploy ✅ smoke ⬜ (pending sponsor secret + funding)
- **Architecture:**
  - Frontend: Cloudflare Pages project `flappy-frontier` → `flappy-frontier.pages.dev`
  - Sponsor: Cloudflare Worker `flappy-frontier-sponsor` → `flappy-frontier-sponsor.michael-davis-home.workers.dev`
  - API: `POST /sponsor { txKindB64, sender } → { txB64, sponsorSignature }` (Sui-native dual-sig)
  - Sponsor wallet: dedicated Ed25519 keypair `0x0d6fa6c31dba20dd18a828c08c46ca20f81d96bf24180fb64dfdceb474aca01f`
  - Secret handling: bech32 private key stored only as Cloudflare Worker secret (`SPONSOR_PRIVATE_KEY`)
- **Pending manual steps:** (1) `wrangler secret put SPONSOR_PRIVATE_KEY`, (2) fund sponsor wallet with testnet SUI, (3) custom domain CNAME for `flappyfrontier.com`
- **Follow-ups:** Set secret, fund wallet, end-to-end test sponsored ranked mode, custom domain

---
## 2026-03-13 — Sponsored transaction investigation + Sui-native gas sponsorship architecture

- **Goal:** Investigate `evefrontier:sponsoredTransaction` capability visible on both SSU and Eve Vault wallets. Determine if players can avoid needing SUI for gas. Implement sponsored path if feasible.
- **Files:** `sponsorship.ts` (new), `useGameTransaction.ts` (new), `GamePage.tsx`, `LeaderboardPanel.tsx`, `flappy-frontier-chain-integration-plan.md`, `decision-log.md`
- **Diff:** ~175 LoC added (2 new files), ~50 LoC changed across 2 existing components
- **Risk:** Medium (ranked transaction paths, but all existing behavior preserved as fallback)
- **Gates:** typecheck ✅ build ✅ move-build N/A move-test N/A smoke ⬜ (human retest pending)
- **Key findings:**
  - `evefrontier:sponsoredTransaction` is **assembly-scoped** — requires `assembly` (object ID), `assemblyType`, `txAction` params. Routed to EVE Frontier API at `https://api.{tier}.tech.evefrontier.com/transactions/sponsored/{assemblyType}/{action}`. The background handler validates assembly/assemblyType as required fields.
  - The capability CANNOT be used for game contract calls (`start_run`, `submit_score`, `trigger_payout`) — these are not assembly operations.
  - Both wallets (SSU: "EVE Frontier Client Wallet", browser: "Eve Vault") expose this capability identically.
- **Implementation:**
  - `sponsorship.ts`: Capability detection, sponsor service client (Sui-native dual-sig pattern), base64 helpers
  - `useGameTransaction.ts`: Hook wrapping all ranked transaction execution. When `VITE_SPONSOR_SERVICE_URL` is configured, builds TransactionKind → sends to sponsor service → player signs sponsored tx → dual-sig execution. Falls back to standard `signAndExecuteTransaction` otherwise.
  - `GamePage.tsx` + `LeaderboardPanel.tsx`: All ranked tx paths now use `useGameTransaction`. Gas messaging is sponsorship-aware.
- **To activate sponsorship:** Deploy a lightweight sponsor service implementing: `POST /sponsor { txKindB64, sender } → { txB64, sponsorSignature }`. Set `VITE_SPONSOR_SERVICE_URL` env var. No Move contract changes needed.
- **Fallback behavior:** Without sponsor service, all transactions use standard player-paid gas (current behavior, unchanged).
- **Follow-ups:** Deploy sponsor service (Cloudflare Worker or similar), fund sponsor wallet with testnet SUI, human retest in SSU + browser

---
## 2026-03-13 — SSU wallet UX: runtime detection, auto-connect, direct connect fallback

- **Goal:** Fix in-game wallet UX using authoritative EFMap Probe runtime evidence. The SSU injects exactly 1 Sui wallet ("EVE Frontier Client Wallet") with connect/sign/execute + sponsored tx capabilities. Prior auto-connect failed because it depended on viewport detection (`isInGameBrowser`), which is fragile. The generic ConnectModal chooser was unnecessary friction in SSU.
- **Files:** `useSSUWallet.ts` (new), `App.tsx`, `GamePage.tsx`, `StartScreen.tsx`, `Providers.tsx`, `decision-log.md`, `flappy-frontier-chain-integration-plan.md`
- **Diff:** ~90 LoC added (new hook), ~30 LoC changed across 4 existing files
- **Risk:** Medium (wallet connection flow, auth hooks, UI flow)
- **Gates:** typecheck ✅ build ✅ smoke ⬜ (requires human in-game retest)
- **Root cause of prior auto-connect failure:** `useInGameAutoConnect` depended on `isInGameBrowser` (viewport-based ±5px match) as its first gate. If SSU viewport didn't match 787×1198 exactly, the entire hook was a no-op. Viewport is a fragile heuristic; wallet runtime evidence is the authoritative signal.
- **Key changes:**
  - New `useSSUWallet` hook: detects SSU by wallet runtime evidence (presence of "EVE Frontier Client Wallet" in `useWallets()`), not viewport. Auto-connects when dapp-kit autoConnect passes with no stored wallet. Returns `{isSSU, status, connectDirectly}`.
  - `StartScreen`: in SSU, shows "Use Game Client Wallet" direct-connect button (no generic chooser). Shows tiny status indicator (`SSU: detecting/auto-connecting/ready/connected`).
  - `GamePage`: in SSU, `handleConnect` calls `connectDirectly()` instead of opening ConnectModal.
  - `Providers.tsx`: removed viewport dependency for `preferredWallets`. ConnectModal only appears in browser mode; EVE Vault listed first.
  - Viewport detection (`environment.ts`) preserved for layout scaling only — unchanged.
  - `useInGameAutoConnect.ts` is now dead code (replaced by `useSSUWallet`). Will be removed in follow-up.
  - SSU wallet reports `evefrontier:sponsoredTransaction` capability — noted for future implementation.
- **Browser behavior:** Fully preserved. `isSSU = false` in browser → generic "Connect Wallet" → ConnectModal → EVE Vault + any other wallets. No regression.
- **Follow-ups:** Human retest SSU (fresh state), remove dead `useInGameAutoConnect.ts`, investigate sponsored transactions

---
## 2026-03-13 — Fix in-game auto-connect: remove wallet count guard + add diagnostics

- **Goal:** Auto-connect hook from prior entry didn't fire in real SSU runtime. Diagnosed: the `wallets.length !== 1` guard was too strict — the SSU likely registers multiple wallet entries (e.g. duplicates or dev wallets). Manual connect worked, confirming the wallet itself is fine.
- **Files:** `useInGameAutoConnect.ts`
- **Diff:** ~30 LoC changed (rewrite of guard logic + diagnostic logging)
- **Risk:** Low (in-game-only, no-op in browser, single file change)
- **Gates:** typecheck ✅ build ✅ smoke ⬜ (requires human in-game retest with console open)
- **Key changes:**
  - Removed `wallets.length !== 1` guard — was blocking auto-connect when SSU registers >1 wallet
  - Now uses `wallets.find(w => w.name === EVE_FRONTIER_WALLET)` to locate target wallet by name regardless of total count
  - Added comprehensive `console.log('[InGameAutoConnect]')` diagnostics at every decision point — logs viewport, wallet count, wallet names, autoConnect status, connection state
  - Diagnostics are temporary — will be removed after successful in-game validation
- **Follow-ups:** Human retest in SSU with F12 console open; capture `[InGameAutoConnect]` logs; confirm auto-connect fires; then strip diagnostic logging

---
## 2026-03-13 — In-game auto-connect for EVE Frontier Client Wallet

- **Goal:** Eliminate the manual "Connect Wallet" click in the in-game browser when only the EVE Frontier Client Wallet is present. dapp-kit's built-in `autoConnect` only reconnects from localStorage (useless on first visit).
- **Files:** `useInGameAutoConnect.ts` (new), `App.tsx`
- **Diff:** ~50 LoC added (new hook), ~10 LoC changed (App.tsx wrapper)
- **Risk:** Low (in-game-only, no-op in browser, strongly guarded)
- **Gates:** typecheck ✅ build ✅ smoke ⬜ (requires human in-game retest)
- **Key changes:**
  - New `useInGameAutoConnect` hook: after dapp-kit autoConnect completes with no stored wallet, if in-game + exactly 1 wallet + it's EVE Frontier Client Wallet → programmatically connect
  - `App.tsx` restructured to add `AppContent` wrapper inside Providers tree so hook can use wallet context
  - Browser mode: hook is a complete no-op (first guard is `!isInGameBrowser`)
  - On second+ visits, dapp-kit's built-in autoConnect handles reconnection via localStorage (this hook exits early)
- **Follow-ups:** Human retest in-game first load — wallet should auto-connect, ranked should unlock without clicks

---
## 2026-03-13 — Fix in-game wallet ranked gating (EVE Frontier Client Wallet support)

- **Goal:** Ranked mode stays locked in the in-game browser even after the EVE Frontier Client Wallet connects successfully. Root cause: `canPlayRanked` in `usePlayerIdentity.ts` included a hard `!isInGameBrowser` gate — an assumption from early planning that the in-game CEF browser has no wallet. Real testing proved the EVE Frontier Client Wallet IS available and functional in-game.
- **Files:** `usePlayerIdentity.ts`, `Providers.tsx`, `flappy-frontier-chain-integration-plan.md`, `decision-log.md`
- **Diff:** ~15 LoC changed across 2 source files, ~10 lines updated in docs
- **Risk:** Medium (wallet gating logic + provider config)
- **Gates:** typecheck ✅ build ✅ smoke ⬜ (requires human in-game retest)
- **Key changes:**
  - Removed `&& !isInGameBrowser` from `canPlayRanked` — ranked eligibility is now purely `!!account?.address`
  - Added `preferredWallets` to `WalletProvider` — prioritizes EVE Frontier Client Wallet in-game, EVE Vault in browser
  - `isInGameBrowser` retained for layout/scaling only (not ranked gating)
  - Chain integration plan updated: in-game CEF now listed as wallet-capable with Practice + Ranked support
  - Stale assumptions corrected throughout plan doc
- **Follow-ups:** Human retest ranked flow in-game browser; verify EVE Frontier Client Wallet auto-preference

---
## 2026-03-15 — Ranked lifecycle UX fixes (payout trigger, auto-submit, messaging)

- **Goal:** Fix ranked-mode lifecycle frictions surfaced during manual testnet testing
- **Files:** `LeaderboardPanel.tsx`, `GameOverScreen.tsx`, `GamePage.tsx`, `scoreService.ts`
- **Diff:** ~100 LoC changed across 4 files
- **Risk:** Medium (game over flow + new on-chain payout trigger)
- **Gates:** typecheck ✅ build ✅ smoke ⬜ (requires human wallet re-test)
- **Key changes:**
  - Added `buildTriggerPayoutTransaction()` in `scoreService.ts` — calls `game::trigger_payout<EVE>()`
  - `LeaderboardPanel` now shows "Trigger Epoch Payout" button when epoch expired + prize pool > 0
  - Score submission auto-triggers on ranked game over (no manual Submit button needed)
  - `GameOverScreen` shows submission progress/success/failure with retry on error
  - Error messages now distinguish EVE balance vs SUI gas vs wallet rejection
  - Payout trigger preserves trustless model — public-callable, explained in UI copy
- **Follow-ups:** Human re-test full ranked lifecycle, then Phase 4 Cloudflare deployment

---
## 2026-03-15 — Phase 3 complete: Frontend wired to Sui testnet contracts

- **Goal:** Wire frontend to live testnet contracts so ranked mode works end-to-end on localhost
- **Files:** 13 files modified/created — `Providers.tsx` (new), `LeaderboardPanel.tsx` (new), `GamePage.tsx` (major rewrite), `usePlayerIdentity.ts`, `seedProvider.ts`, `scoreService.ts`, `ModeSelector.tsx`, `GameOverScreen.tsx`, `StartScreen.tsx`, `GameCanvas.tsx`, `gameLoop.ts`, `App.tsx`, `package.json`
- **Diff:** ~800 LoC added/modified across 13 files
- **Risk:** High (wallet SDK, PTB construction, async game flow)
- **Gates:** typecheck ✅ build ✅ smoke ⬜ (requires human wallet test)
- **Key facts:**
  - SDK: `@mysten/dapp-kit` v1.0.3 (not `dapp-kit-react` as plan originally named)
  - `@evefrontier/dapp-kit` deferred — EVE type resolved statically from contractConfig
  - `ConnectModal` used for wallet selection (dapp-kit v1.x modal pattern)
  - Ranked flow: wallet connect → pay EVE entry fee → chain seed → play → submit score
  - Practice mode unchanged (no wallet needed, local seed)
  - Leaderboard reads from chain: top 10, prize pool, epoch countdown
- **Branch:** `feat/phase1-move-contracts`
- **Follow-ups:** Manual wallet test with EVE Vault, Phase 4 Cloudflare deployment

---
## 2026-03-14 — Phase 2 complete: Move package published to Sui testnet

- **Goal:** Publish Phase 1 Move contracts to Sui testnet, initialize all shared objects, record IDs for frontend
- **Files:** `frontend/src/lib/contractConfig.ts` (new), `docs/plans/flappy-frontier-chain-integration-plan.md` (updated)
- **Diff:** +65 LoC new, ~80 LoC plan updates
- **Risk:** Medium (testnet publish + on-chain init)
- **Gates:** move-build ✅ typecheck ✅ objects-verified ✅ admin-smoke ✅
- **Key facts:**
  - Package ID: `0xa23c94bd1ec5dc6516573fccd3af0f756057fb83170bc4d0d37082007ee49867`
  - Publish created AdminCap + GameConfig + Leaderboard in `config::init()`
  - Treasury<EVE> required explicit post-publish `game::init_treasury<EVE>()` call (generic T cannot bind at publish time)
  - All 5 objects verified on-chain: correct types, correct ownership (shared vs owned), correct default values
  - Admin mutation smoke test passed (`set_entry_fee` via AdminCap)
  - Full `start_run<EVE>` smoke test deferred — wallet has no EVE tokens; will test in Phase 3
- **Branch:** `feat/phase1-move-contracts`
- **Follow-ups:** Phase 3 (frontend wallet + chain wiring), acquire EVE tokens for end-to-end test

---
## 2026-03-14 – Phase 1 Move contracts implemented

- **Goal:** Implement all Phase 1 Move contracts per chain integration plan
- **Files:** `contracts/flappy_frontier/sources/{config,treasury,leaderboard,game}.move`, `contracts/flappy_frontier/tests/{leaderboard_tests,treasury_tests}.move`, `contracts/flappy_frontier/{Move.toml,README.md}`
- **Diff:** +1273 LoC (9 new files)
- **Risk:** High (Move contracts, treasury logic, leaderboard logic)
- **Gates:** move-build ✅ move-test ✅ (23/23 pass)
- **Key decisions:** Generic `Treasury<phantom T>` (no EVE compile dep), `public(package)` visibility for all mutating fns, AdminCap scoped to GameConfig params only (no treasury access), security audit found & fixed critical `distribute_payout` public visibility drain vector
- **Branch:** `feat/phase1-move-contracts` (commit `0107254`)
- **Follow-ups:** Phase 2 (testnet publish + record object IDs), Phase 3 (frontend wallet wiring)

---

## 2026-03-13 – Trustless treasury custody (hard constraint)

- **Goal:** Make non-custodial treasury handling an explicit, non-negotiable implementation constraint before Phase 1
- **Context:** Treasury design already leaned non-custodial (product vision said "no admin withdrawal"), but `AdminCap` scope was underspecified and docs lacked an explicit custody trust model. Operator confirmed: trustless custody is a hard requirement.
- **Decision:** Added "Treasury Custody & Trust Model" subsection to chain integration plan. Narrowed `AdminCap` scope to parameter adjustment only (epoch duration, entry fee amount) — explicitly no fund-movement capability. Expanded product vision Treasury Safety into "Treasury Safety & Custody Trust Model." Clarified that score authenticity and treasury custody are independent concerns.
- **Files:** `docs/plans/flappy-frontier-chain-integration-plan.md`, `docs/strategy/flappy-frontier-product-vision.md`, `docs/decision-log.md`
- **Diff:** ~+40 / -10
- **Risk:** Low (documentation-only; narrows implementation latitude)
- **Gates:** N/A (docs-only)
- **Follow-ups:** Phase 1 implementer must treat "no AdminCap fund access" as a hard constraint — verify in code review

---

## 2026-03-13 – Documentation normalization (implementation-ready pass)

- **Goal:** Make chain integration docs implementation-ready: insert exact EVE type string, correct gas wording, update test EVE availability
- **Context:** EVE token reconciliation was complete but three operational gaps remained: (1) gas wording implied players definitely pay own gas, when gas handling is actually a wallet/runtime concern; (2) testnet EVE acquisition was described as unresolved, but operator already has a test wallet with EVE; (3) exact Utopia EVE coin type string was still listed as TBD.
- **Decision:** Inserted exact Utopia EVE coin type (`0xf0446b93345c1118f21239d7ac58fb82d005219b2016e100f074e4d17162a465::EVE::EVE`) into all relevant config/input sections. Softened gas wording to "wallet/runtime concern — may be user-paid or sponsored." Marked test EVE as resolved via operator-funded validation wallet. Stillness EVE type remains a separate future config item.
- **Files:** `docs/plans/flappy-frontier-chain-integration-plan.md`, `docs/strategy/flappy-frontier-product-vision.md`, `docs/decision-log.md`
- **Diff:** ~+25 / -25 (replacement pass)
- **Risk:** Low (documentation-only normalization)
- **Gates:** N/A (docs-only)
- **Follow-ups:** None — Phase 1 implementation is now unblocked

---

## 2026-03-13 – EVE token reconciliation (documentation correction)

- **Goal:** Correct chain integration plan and product vision so that EVE is the entry-fee token from day one — not SUI-first with EVE deferred
- **Context:** Initial chain integration plan recommended `Coin<SUI>` for Phase 1 with `Coin<EVE>` as a follow-up. Operator clarified: EVE is the intended token from the start. EVE has 9 decimals (same as SUI), uses standard `Coin<T>` / `Balance<T>` patterns, and is resolved per-tenant via `getEveCoinType(tenantId)` from `@evefrontier/dapp-kit/utils`.
- **Decision:** Use generic `Treasury<phantom T>` with `Balance<T>` — caller specifies `<EVE::EVE>` at call site. No compile-time dependency on `assets` package. Entry fee default: 100 EVE (= 100_000_000_000 base units). Tests use `Coin<SUI>` since EVE type isn't available in test env, but generic approach means any `Coin<T>` works. Install `@evefrontier/dapp-kit` alongside `@mysten/dapp-kit-react` for EVE type resolution.
- **Files:** `docs/plans/flappy-frontier-chain-integration-plan.md`, `docs/strategy/flappy-frontier-product-vision.md`, `docs/decision-log.md`
- **Diff:** ~+60 / -60 (net zero — replacements, not additions)
- **Risk:** Low (documentation-only correction)
- **Gates:** N/A (docs-only)
- **Follow-ups:** Resolve exact EVE coin type string for Utopia testnet before Phase 1 implementation

---

## 2026-03-13 – Chain integration execution plan

- **Goal:** Create concrete execution plan for ranked-mode chain integration, Utopia testing, and deployment sequencing
- **Context:** Game-side MVP complete and merged. Next phase is chain-facing: Move contracts, wallet connect, on-chain seed, score submission, leaderboard, payout lifecycle.
- **Decision:** 5-phase sequence: (1) Move contracts with generic `Treasury<phantom T>` using `Coin<EVE>` at call site, (2) Publish to testnet, (3) Frontend wallet + chain wiring on localhost, (4) Cloudflare deployment, (5) Utopia validation with 10-min short epoch. Cloudflare deploys AFTER localhost chain wiring is stable. Use `@mysten/dapp-kit-react` + `@evefrontier/dapp-kit` for wallet integration and EVE type resolution. Local practice leaderboard deprioritized in favor of on-chain ranked leaderboard.
- **Files:** `docs/plans/flappy-frontier-chain-integration-plan.md` (new), `docs/README.md`, `docs/decision-log.md`
- **Diff:** +450 lines (new plan doc)
- **Risk:** Low (planning/documentation only)
- **Gates:** N/A (docs-only)
- **Follow-ups:** Phase 1 implementation prompt — Move contracts

---

## 2026-03-13 – SVG rendering repair pass + visibility fixes

- **Goal:** Fix invisible ship/pipe/ground rendering discovered during manual localhost testing
- **Context:** Post-implementation manual test revealed all SVG assets rendered as transparent bitmaps. Root cause: missing `width`/`height` attributes on `<svg>` elements. Secondary: colors too dark for `#0A0A0F` background.
- **Decision:** Added width/height to all SVGs, brightened colors ~50%, added bitmap validity check, increased ship size 72×36 → 100×50, added shadowBlur glow effects
- **Files:** `ship-hull.svg`, `pipe-body.svg`, `pipe-cap.svg`, `ground-tile.svg`, `assets.ts`, `constants.ts`, `renderer.ts`, `shipRenderer.ts`, `physics.ts`
- **Diff:** ~+80 / -40 across 9 files
- **Risk:** Medium (rendering pipeline + asset loading)
- **Gates:** typecheck ✅ build ✅ browser-render ✅ (ship/pipes/ground visible) scoring ⚠️ (unconfirmed by human)
- **Follow-ups:** Ship asset not recognisable as Frontier vessel — needs replacement with faithful reference-based asset. Scoring needs human play-test confirmation.

---

## 2026-03-13 – Documentation status sync

- **Goal:** Correct plan/status drift — MVP plan was not updated after repair pass
- **Context:** Implementation summaries existed only in chat, not in repo documentation. This created continuity loss across new sessions.
- **Decision:** Updated `flappy-frontier-game-mvp-plan.md` in place with accurate post-repair status, repair history, next steps. Added enforcement rule to instruction files.
- **Files:** `flappy-frontier-game-mvp-plan.md`, `AGENTS.md`, `.github/copilot-instructions.md`, `docs/decision-log.md`
- **Diff:** ~+100 / -80 (plan update) + ~10 lines (instruction files)
- **Risk:** Low (documentation only)
- **Gates:** N/A (docs-only change)
- **Follow-ups:** None — rule now enforced via instruction files

---

## 2026-03-12 – Repository creation and starter scaffold

- **Goal:** Establish Flappy Frontier hackathon submission repo
- **Context:** Carried forward shared-starter scaffold from sui-playground planning workspace, adapted for Flappy Frontier project identity
- **Decision:** Fresh repo with reusable scaffold + Flappy Frontier product vision + in-game browser capabilities data
- **Files:** Full repo scaffold (~30 files)
- **Diff:** +N / -0 (initial commit)
- **Risk:** Low
- **Gates:** typecheck N/A (no code yet)  build N/A  smoke ✅ (submodules resolve, docs present)
- **Follow-ups:** Implement Move contracts, set up frontend, begin Canvas 2D game loop
