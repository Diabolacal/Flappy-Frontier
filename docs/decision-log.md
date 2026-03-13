# Decision Log — Flappy Frontier

**Retention:** Carry-forward

Newest entries first. See `docs/operations/DECISIONS_TEMPLATE.md` for format.

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
