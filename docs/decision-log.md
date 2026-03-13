# Decision Log — Flappy Frontier

**Retention:** Carry-forward

Newest entries first. See `docs/operations/DECISIONS_TEMPLATE.md` for format.

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
