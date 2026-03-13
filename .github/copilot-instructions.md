# Copilot Project Instructions (Flappy Frontier — Hackathon Submission Repo)

Purpose: Authoritative source of truth for AI agent guardrails, interaction patterns, and workflow conventions in this VS Code project. GitHub Copilot loads this file automatically. Follow the patterns below when adding or modifying code. Optimized for a "vibe coding" workflow: the human provides intent (non‑coder friendly) and the AI agent converts intent into safe, minimal, verifiable changes.

## Beginner Defaulting
If the user doesn't know an answer yet, propose a sensible default and proceed. Do not block progress.

## Operator Quick Start (Non‑Coder)
1. Describe goal in plain language (what you want changed / added / fixed).
2. Assistant replies with: checklist, assumptions (≤2), risk class, plan.
3. You approve or adjust scope (optionally grant token if High risk).
4. Assistant patches code, runs typecheck/build, reports gates & follow-ups.
5. Non-trivial decisions appended to `docs/decision-log.md` (≤10 lines each).

If stuck: ask for "safer alternative" or "explain tradeoffs". Avoid giving line-by-line code; just describe desired outcome.

## Instruction Strategy & Scope
- Repo-wide mandates live here. `AGENTS.md` summarizes them; path- or persona-specific instructions belong in `.github/instructions/*.instructions.md`.
- Commands belong near the top of each relevant section. Provide exact flags so agents can run them verbatim.
- Use bullet lists over prose and include concrete "good vs bad" examples when reinforcing style or architecture conventions.
- When a rule applies only to a subset of the project, isolate it with a clear heading so other workflows scan past it quickly.

## Model Workflow Expectations
- Start every reply with a brief acknowledgement plus a high-level plan.
- Manage work through a todo list with exactly one item `in-progress`; update statuses as tasks start or finish.
- Report status as deltas — highlight what changed since the last message instead of repeating full plans.
- Run fast verification steps yourself when feasible and note any gates you couldn't execute.

## Operational Guardrails (Authoritative)
These rules have the highest precedence. `AGENTS.md` mirrors them in shortened form; if wording differs, this section wins.

1. **Execute commands yourself.** Run CLI/git/HTTP commands directly unless a secret prompt is needed, then launch the command and let the operator paste the secret locally. Summarize results instead of listing commands for the user to run.
2. **Deploy protocol.** Feature branches must deploy as previews via Cloudflare Pages and report the preview URL (never deploy to production from a feature branch). Production deploys only come from `main` after merge. **Deploy commands MUST be run from the `frontend/` directory** to pick up project bindings.
3. **Working memory discipline.** Consider a Working Memory file when: (a) a task spans multiple real-world sessions, (b) VS Code shows "summarizing conversation" or ≥70% context, or (c) operator explicitly asks. For most single-session work, proceed directly — Working Memory is optional, not blocking.
4. **Decision logging.** Any non-trivial behavior change, data migration, or platform action must be reflected in `docs/decision-log.md`.
5. **No regressions.** All persistence changes must target the project's current platform abstraction — do not reintroduce deprecated providers.

## Git Workflow & Commit Hygiene

> Full conventions: `docs/core/hackathon-repo-conventions.md`. This section is the enforced summary.

- **Branch for all non-trivial work.** Naming: `feat/`, `fix/`, `docs/`, `chore/`, `spike/` + `kebab-case-description`.
- **Direct-to-main only for:** typo fixes, `.gitignore` tweaks, trivial doc corrections.
- **Squash merge all feature branches to `main`.** One clean commit per feature. PR title = commit message.
- **Commit message format:** `type: Imperative description` (≤72 chars). Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`.
- **`main` must always be demo-ready.** Never merge broken code.
- **Spike branches (`spike/`):** throwaway experiments — never merge to main.
- **PRs even when solo:** judges browse merged PRs. Minimal body: What / Why / Verified.
- **Never force-push to `main`.** Linear, append-only history.

## Code Organization & File Discipline

> Language-specific rules in `.github/instructions/`. This section covers cross-cutting rules.

- **No files >500 lines** without explicit justification. React components ~150 lines, page components ~100 lines, Move modules ~500 lines.
- **No "god files."** Split any file doing 3+ unrelated things.
- **No commented-out code** in the submission repo. Write it or delete it.
- **No duplicate utilities.** Grep the workspace before creating helpers.
- **Place files in the correct directory** per project conventions. No random one-off files at project root.
- **Name files consistently:** PascalCase for components, camelCase for utils/hooks, snake_case for Move, kebab-case for directories and scripts.
- **No generic names:** `utils2.ts`, `helper.ts`, `stuff.ts`, `Component3.tsx` are forbidden.
- **Check for existing files** before creating new ones — agent-generated duplicates are a common failure mode.
- **Respect file size limits proactively** — split at generation time, not after.

## Architecture Overview

- **Frontend:** Vite + React + Canvas 2D game loop, deployed to Cloudflare Pages
- **Contracts:** Sui Move smart contracts in `contracts/flappy_frontier/` (leaderboard, treasury, game seeding)
- **Data flow:** Player → Canvas 2D game → Sui wallet → Move contracts (Leaderboard + Treasury)
- **In-game mode:** Loadable in EVE Frontier's in-game browser (787×1198px portrait CEF webview, Chrome 122, no Sui wallet — free-play only)
- **Vendor submodules:** `vendor/world-contracts`, `vendor/builder-scaffold`, `vendor/evevault`, `vendor/builder-documentation` (read-only)

### In-Game Browser Constraints
- Viewport: 787×1198px portrait, DPR 1
- Canvas 2D and WebGL both supported
- Mouse/keyboard only (no touch events)
- No Sui wallet injected — in-game mode is free-play only (no entry fees, no leaderboard submissions)
- `prefers-color-scheme: dark`
- CEF Chrome 122 — verify CSS/JS feature compatibility before using bleeding-edge APIs

## Quick Command Reference

```bash
# Frontend (Vite + React)
cd frontend
npm install                              # Install dependencies
npm run dev                              # Start dev server
npm run build                            # Production build
npm run preview                          # Preview production build
npx tsc --noEmit                         # TypeScript typecheck (no output)
npx wrangler pages deploy dist           # Deploy to Cloudflare Pages

# Sui Move (contracts)
sui move build --path contracts/flappy_frontier     # Build Move package
sui move test --path contracts/flappy_frontier      # Run Move tests
sui client publish --path contracts/flappy_frontier  # Publish to active network
sui client active-env                                # Verify active Sui environment

# Submodule management
git submodule update --init --recursive   # Initialize all vendor submodules

# Verification gates (run after ANY code change)
cd frontend && npx tsc --noEmit          # Must pass — no TS errors
cd frontend && npm run build             # Must succeed — production build
sui move build --path contracts/flappy_frontier    # Must compile
sui move test --path contracts/flappy_frontier     # Must pass
```

## Key Folders / Files

- `contracts/flappy_frontier/` — Sui Move package (leaderboard, treasury, game seeding)
- `frontend/` — Vite + React + Canvas 2D game
- `docs/` — Structured documentation (see `docs/README.md` for index)
- `docs/core/` — Essential project docs (conventions, spec)
- `docs/architecture/` — Technical design documents
- `docs/operations/` — Process guides, checklists
- `docs/demo/` — Demo scripts, screenshots, video notes
- `docs/research/` — Research and reference material
- `docs/working_memory/` — Ephemeral agent task tracking (gitignored)
- `templates/cloudflare/` — Cloudflare deployment templates
- `vendor/` — Git submodules (read-only)

## Assistant Interaction Protocol (Strict Sequence)
1. **Intent Echo:** Restate user goal as bullet checklist (features, constraints, data touched).
2. **Assumptions:** Call out at most 2 inferred assumptions (or ask if blocking).
3. **Risk Class:** Label change Low / Medium / High (see below) + required tokens if any.
4. **Plan:** List files to read/edit, expected diff size, verification steps.
5. **Patch:** Apply minimal diff; avoid unrelated formatting.
6. **Verify:** Typecheck + build + (describe smoke steps). If unable to run, output exact commands.
7. **Summarize:** What changed, gates status, follow-ups.

## Risk Classes & Escalation Triggers
- **Low:** Pure docs, styling (CSS), isolated panel UI, copy tweaks.
- **Medium:** New game mechanic, new API endpoint, minor algorithm tweak, new utility function.
- **High:** Core game loop / rendering, Move contract schema changes, leaderboard logic, treasury/payout flow, entry fee handling.

Escalate / request token if: touching the game loop, >3 core files, >150 LoC delta, adds dependency, alters on-chain data format, or modifies treasury/payout logic.

## Vibe Coding (Non‑Coder Operator) Guidance
When the user (non‑coder) asks for a change:
1. Restate goal as a concise checklist (what will change, files likely touched).
2. Identify risk level: core game loop / Move contracts / treasury / simple UI.
3. If risky token required (e.g., `CORE CHANGE OK`, `CONTRACT CHANGE OK`) and not provided: propose safer alternative or request token.
4. Propose minimal patch; avoid refactors unless solving an explicit pain point.
5. After patch: ensure typecheck + build succeed and note any manual smoke steps.
6. Update or create docs only if behavior, metrics, or public API changed — otherwise skip doc churn.
7. Offer a brief rationale when choosing between multiple implementations so the operator can approve.
8. **Automated error recovery (mandatory).** If a typecheck, build, or test command fails after your patch, you MUST NOT present the raw error to the user and ask how to proceed. Instead: (a) read and diagnose the error yourself, (b) explain the cause in one plain-English sentence, (c) immediately propose and apply a fix, and (d) re-run the failing gate. Only escalate to the user if you have attempted a fix and it also fails, or if the fix requires a design decision you cannot make alone.

Language: prefer plain language over jargon when explaining tradeoffs; surface 1–2 alternative approaches only if materially different in complexity or performance.

## Minimal Patch Contract
Each change must include: reason, scope (files), diff size estimate, success criteria, rollback (revert commit). Avoid speculative refactors.

## Task Decomposition & Subagent Execution
Subagents are the **primary mechanism** for complex work. Use them by default for:
- Multi-file changes (≥3 files) or cross-surface edits (frontend + contracts)
- Research-heavy tasks (audits, schema analysis, migration planning)
- Any step that might consume >20% of context budget

**Subagent output requirements:** (1) short summary, (2) concrete deliverables (files, diffs, commands), (3) risks/follow-ups.

**Failure handling:** Retry failing subagent once with tighter prompt/context. On second failure, fall back to manual decomposition and report failure cause.

## Safer Alternative Rule
If user asks for broad refactor, first propose smallest path to accomplish user-visible benefit; proceed only after confirmation or token granting scope.

## Quality Gates (Always)

### Frontend (TypeScript / React)
- TypeScript typecheck passes (`npx tsc --noEmit` — no new errors).
- Production build succeeds (`npm run build`).
- Game loads in browser without console errors.
- Canvas renders at correct viewport (787×1198 portrait for in-game, responsive for standalone).

### Contracts (Sui Move)
- `sui move build --path contracts/flappy_frontier` — must compile.
- `sui move test --path contracts/flappy_frontier` — must pass.

### Cross-Cutting
- **Error recovery:** If any gate fails, the agent must self-diagnose and attempt a fix before reporting to the user. See Vibe Coding rule 8 for the full protocol. Never present raw compiler output to a non-coder without a plain-English explanation and proposed fix.
- Run the relevant checks yourself whenever tooling is available. If a gate cannot be executed (e.g., missing dependency, platform constraint), call it out explicitly with the command you would have run and any fallback validation performed.
- **Plan/status documentation update (mandatory).** After any meaningful implementation pass (feature, fix, or repair), the agent must update the project plan/status document (`docs/plans/flappy-frontier-game-mvp-plan.md`) before considering the task complete. Implementation summaries in chat are **not** a substitute for repo documentation. If the repo will be continued in future chats, status and next steps must be written into the repo — not left only in conversation history.

## Decision Log Template
```
## YYYY-MM-DD – <Title>
- Goal:
- Files:
- Diff: (added/removed LoC)
- Risk: low/med/high
- Gates: typecheck ✅|❌ build ✅|❌ move-build ✅|❌ move-test ✅|❌ smoke ✅|❌
- Follow-ups: (optional)
```

## Conventions & Patterns

### Canvas 2D Game Loop
- The game loop runs in a `requestAnimationFrame` cycle. Keep the update and render phases cleanly separated: `update(dt)` for physics/logic, `render(ctx)` for drawing.
- Use delta-time (`dt`) for all movement calculations to ensure frame-rate independence.
- Keep the game state in a single, serializable object. This enables pause/resume, replay, and easy score extraction.
- Throttle collision detection to the physics tick rate, not the render frame rate.
- Target 60fps minimum. Profile with `performance.now()` if frame budget is exceeded.

### Leaderboard Integration
- Score submission is a Sui transaction. The frontend signs and submits via the connected wallet.
- In free-play mode (no wallet / in-game browser), scores are local only — do not attempt on-chain submission.
- Validate that the game state hash matches before submitting scores to prevent trivial score manipulation.
- Leaderboard reads use Sui RPC (`getObject` / `getDynamicFields`) — no backend server needed.

### Entry Fee & Treasury Flow
- Entry fees are collected as `Coin<SUI>` in the Move contract.
- Treasury payouts happen on a weekly cadence via an admin/automated call.
- Never hardcode fee amounts in the frontend — read them from on-chain config.
- All treasury operations require capability-gated access (AdminCap).

### In-Game vs Standalone Mode
- Detect in-game mode via viewport size or a query parameter (`?mode=ingame`).
- In-game mode: hide wallet connection UI, disable entry fee flows, show "Free Play" badge.
- Standalone mode: full wallet integration, entry fees, leaderboard submission.
- Both modes share the same game loop and rendering code — only the wrapper/chrome differs.

## Code Style Examples

### TypeScript/React Patterns
```typescript
// ✅ GOOD – Typed props, error handling, descriptive names
interface LeaderboardEntryProps {
  playerAddress: string;
  score: number;
  rank: number;
}

async function submitScore(score: number, gameHash: string): Promise<TransactionResult> {
  if (score <= 0 || !gameHash) {
    throw new Error('Valid score and game hash are required');
  }
  // ... implementation
}

// ❌ BAD – Any types, vague names, no validation
async function submit(s: any, h: any) {
  return await doSubmit(s, h);
}
```

### State Management
```typescript
// ✅ GOOD – Extract to custom hook
function useGameState() {
  const [score, setScore] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const startGame = useCallback(() => {
    setScore(0);
    setIsPlaying(true);
  }, []);

  return { score, isPlaying, setScore, startGame };
}

// ❌ BAD – Inline in component body, scattered state
function GameScreen() {
  const [s, setS] = useState(0);
  const [p, setP] = useState(false);
  // ... 200 more lines of logic mixed with JSX
}
```

### Canvas 2D Rendering
```typescript
// ✅ GOOD – Separated update and render, delta-time based
function update(state: GameState, dt: number): GameState {
  return {
    ...state,
    birdY: state.birdY + state.velocity * dt,
    velocity: state.velocity + GRAVITY * dt,
    pipes: state.pipes.map(p => ({ ...p, x: p.x - SCROLL_SPEED * dt })),
  };
}

function render(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  drawBackground(ctx, state);
  drawPipes(ctx, state.pipes);
  drawBird(ctx, state.birdY);
  drawScore(ctx, state.score);
}

// ❌ BAD – Mixed update/render, no delta-time
function gameLoop(ctx: CanvasRenderingContext2D) {
  birdY += velocity; // Frame-rate dependent!
  velocity += 0.5;
  ctx.clearRect(0, 0, 800, 600);
  ctx.fillRect(birdX, birdY, 30, 30);
  // ... rendering mixed with state updates
}
```

## CLI Execution Policy (Generic)

### Core Mandate
The assistant MUST directly run every CLI command that does not require pasting or revealing a secret value. The operator will manually paste any secret when prompted. Do NOT ask the operator to run a command the assistant can execute. Do NOT instruct use of web UI when an equivalent CLI command exists unless:
- The CLI genuinely lacks required functionality, AND
- The limitation is stated clearly with a short justification.

### Quick Checklist
- Can I execute the command myself? → Run it and summarize the result.
- Does it require a secret? → Start the command and prompt the operator to paste the value locally.
- After 3–5 related commands, provide a concise outcome summary (IDs, URLs, counts) before moving on.
- If a failure occurs, retry once when transient and document the stderr plus next options if it persists.

### Operational Rules
1. Default to executing (not just printing) non-secret commands: deployments, listings, key reads/writes, migrations, inspections.
2. **Secret Entry Boundary:** For commands that prompt for a secret, the assistant initiates the command; the operator pastes the secret at the prompt locally.
3. **No UI Deferral:** Avoid telling user to click in a dashboard unless CLI route is missing. Provide citation if so.
4. **Batch & Verify:** After running 3–5 related CLI actions, summarize outcomes before proceeding.
5. **Idempotence First:** For potentially destructive commands, first run a dry-run/listing variant and show planned impact.
6. **Error Handling:** On command failure, attempt one focused retry if transient. If still failing, surface exact stderr + next options.
7. **Logging Hygiene:** Never log or store secret tokens; redact if accidentally echoed.

### Prohibited Patterns (require immediate self-correction)
- "Please run …" followed by a command the assistant could execute.
- Providing only a list of commands without executing them when execution is possible.
- Asking the operator to copy/paste output that can be fetched programmatically.

### Required Patterns
- Execute commands, then summarize concise results (status, IDs, counts, URLs) — not raw verbose dumps unless troubleshooting.
- For HTTP endpoint verification: use `Invoke-WebRequest` or `curl` capturing status + first bytes.
- When a secret is required: start the command, note "Operator: paste secret now (input hidden)", then continue.

## Context & Memory Protocols

### Working Memory Documents
When working on multi-step tasks (>30 minutes or >50 messages), maintain a working memory document:

**Location:** `docs/working_memory/<YYYY-MM-DD>_<task_name>.md`

**Required structure:**
```markdown
# Task: [Brief title]
Started: YYYY-MM-DD HH:MM
Status: [In Progress / Paused / Completed]

## Objective
[1–2 sentence goal]

## Progress
- [x] Step completed – key result
- [ ] Step in progress – blockers/notes

## Key Decisions
- Decision: [What was chosen]
  Rationale: [Why]
  Files: [Affected files]

## Current State
- Last file touched: …
- Next action: …
- Open questions: …
```

### When to Create / Update
- **Create:** At task start if expected duration >30 min.
- **Update:** Every 10–15 messages OR when approaching context budget limit.
- **Critical update:** IMMEDIATELY before context compaction (if VS Code warns "summarizing conversation").

### Post-Compaction Recovery
1. Read `docs/working_memory/<current_task>.md`.
2. Verify current state (git status, running processes).
3. Resume from "Next action" in working memory.
4. Continue updating working memory as work progresses.

### Cleanup
Upon task completion, move Working Memory files to `docs/archive/working_memory/` (or delete if trivial) and note the move in the decision log when relevant.

## Hackathon Rules Compliance Policy

Official hackathon event rules are captured in `docs/research/hackathon-event-rules-source.md` with a practical digest at `docs/research/hackathon-event-rules-digest.md`.

**Agent rules:**
1. **Before generating Entry code**, verify the hackathon has started — entries must be developed on or after the start date (Section 5).
2. **Before creating token/financial mechanics**, verify no security/equity characteristics — entries must not be securities, commodities, or confer ownership/revenue-share rights (Section 5).
3. **Before submission**, cross-check repo hygiene: original work, GitHub-hosted, Deepsurge-registered, within deadline (31 March 2026 23:59 UTC).
4. **Consult the digest** when evaluating idea feasibility, judging criteria alignment, or bonus prize strategy.
5. An eligible Entry may win **max 1 prize**. Player vote = 25% of Best Entry score. Stillness deployment bonus window = 14 days post-close.
6. **Multiple submissions allowed** — each project must be unique (confirmed via Deep Surge FAQ, 2026-03-02).
7. **No vote manipulation** — do not automate vote solicitation, trading, or purchasing.

## Official Documentation Reference Policy

EVE Frontier maintains official builder documentation at https://docs.evefrontier.com/ (GitBook). These docs are actively being rewritten for the Sui blockchain transition — many pages contain `//TODO` placeholders.

**Reading hierarchy:** (1) `vendor/builder-documentation` for local content reads, (2) GitBook URLs (`docs.evefrontier.com`) for public citation, (3) `llms.txt` for structural change detection.

**Agent rules:**
1. When generating chain interaction flows, sponsorship patterns, or deployment steps, consult official docs pages.
2. Code in `vendor/world-contracts` is canonical; GitBook is explanatory. If behavior described in docs contradicts Move code, the code wins — flag the discrepancy.
3. If official docs show a "Last updated" date newer than the last internal review, re-check before finalizing logic.
4. Do not copy GitBook content into internal docs — summarize insights and link to the official page.
5. Key pages to always consult: "Interfacing with the EVE Frontier World" (sponsored transactions, read/write paths), "EVE Frontier World Explainer" (three-layer architecture), "Introduction to Smart Contracts" (capability, witness, hot-potato patterns), "Object Model" (Sui object types), "Ownership Model" (cap-based access hierarchy), "@evefrontier/dapp-kit" (SDK for builder dApps).
6. Freshness: Always re-check before hackathon submission freeze.

## SUI Documentation Policy

Sui chain-level documentation at https://docs.sui.io is canonical for all blockchain-level mechanics (object model, gas, PTBs, abilities, events, storage, coins, cryptographic primitives).

**Agent rules:**
1. When reasoning about object model, gas mechanics, PTB composition, coin/token standards, dynamic field behavior, events, on-chain randomness, package upgrades, or storage — consult SUI docs.
2. Use `https://docs.sui.io/llms.txt` as the machine-readable entry point for locating canonical pages.
3. **Canonical hierarchy:** `vendor/world-contracts` code > SUI docs (docs.sui.io) > EVE Frontier GitBook (docs.evefrontier.com) > internal docs. If ambiguity exists between GitBook and SUI docs, SUI docs override.
4. Do not copy SUI documentation content into this repository — summarize insights and link to the canonical page.
5. Key constraints to always verify against SUI docs: 250 KB object size limit, 1000 PTB command limit, 1024 dynamic fields per tx, 32 struct field limit, shared object consensus latency.
6. Freshness: Always re-check before hackathon submission freeze.

## Documentation Rules

1. All new markdown documents must be placed inside a categorized subfolder under `docs/`.
2. Do NOT create markdown files directly under `docs/` root (only `docs/README.md` lives at root).
3. Every new document must be categorized as one of: `core`, `architecture`, `research`, `operations`, `demo`, `archive`.
4. When creating a new doc, update `docs/README.md` index.
5. **Retention classification is mandatory.** All docs must begin with a header block:
   ```
   # Document Title

   **Retention:** [Carry-forward | Archive]
   ```
   Classifications: **Carry-forward** (active project documentation), **Archive** (superseded, kept for traceability).
6. Agents must classify retention before committing any new document. If uncertain, default to **Carry-forward**.

## Submodule & Vendor Policy

`vendor/*` directories contain **third-party upstream repos** added as git submodules. The following rules have the same precedence as Operational Guardrails:

1. **Never commit inside submodules.** Do not run `git add`, `git commit`, or `git push` from within any `vendor/` directory. The agent must verify its `cwd` is the parent repo root before any git write operation.
2. **Submodule updates via parent only.** To update a submodule's pinned commit, run `git submodule update --remote vendor/<name>` from the parent repo root, then commit the updated gitlink in the parent.
3. **No tracked modifications.** Never modify, delete, or create tracked files inside `vendor/*`. Reading for context is always allowed.
4. **Local-only ignores.** Transient/generated files (Docker volumes, build artifacts, `.env.*`, `workspace-data/`) must be excluded via `vendor/<name>/.git/info/exclude` — a local-only mechanism that is never committed to the submodule.
5. **No secrets in vendor.** Never commit `.env` files, private keys, mnemonics, or wallet configs inside submodules or anywhere in the repo.

### Hackathon Submission Repo Rules
- This repo (`Flappy-Frontier`) **is the hackathon submission**. Keep it clean, judge-ready, and demo-friendly at all times.
- **`main` must always be deployable.** Broken code never lands on main.
- **Sui keys & wallet config:** Treat `~/.sui/`, `sui.keystore`, and any env var containing mnemonics as secrets — never log, commit, or echo.
- **Environment switching:** Always verify `sui client active-env` before running transactions to avoid accidental mainnet/testnet operations.
- **Cloudflare secrets:** API tokens, account IDs, and Wrangler auth must never appear in committed files. Use `.env.local` (gitignored) or Wrangler CLI prompts.

## High-Risk Surfaces

- **Submodule boundaries** — never commit inside `vendor/*`; see Submodule & Vendor Policy above
- **Sui key material** — private keys, mnemonics, wallet configs
- **Core game loop** — `requestAnimationFrame` cycle, physics, collision detection
- **Move contract logic** — leaderboard scoring, treasury payouts, entry fee handling
- **Treasury / payout flow** — any change to how funds move on-chain
- **Cloudflare deployment config** — `wrangler.toml`, Pages bindings, environment variables
- **Score validation** — any change to how scores are verified before on-chain submission

## Prompt Patterns (Examples)
**Good feature prompt:** "Add a pipe obstacle that moves vertically. Speed should increase as score goes up. Success: visible in-game, no collision detection regression, frame rate stays above 60fps."

**Good contract prompt:** "Add a function to read the top 10 leaderboard entries. Return player address and score. Must not require any capability — public read."

**Weak prompt → Rewrite:** "Make the game harder" → "Increase pipe scroll speed by 15% after score reaches 10. Reduce gap between pipes from 150px to 130px after score 20. Same collision detection."

## VS Code 1.110 – Agent Tooling Notes

- **Built-in browser tools** (`workbench.browser.enableChatTools`) are enabled in `.vscode/settings.json`. Prefer them over external browser MCP tooling (e.g., chrome-devtools MCP) for routine web-app verification unless a specific gap is found. Tools include: `openBrowserPage`, `navigatePage`, `readPage`, `screenshotPage`, `clickElement`, `hoverElement`, `dragElement`, `typeInPage`, `handleDialog`, `runPlaywrightCode`.
- **Agent Debug panel** is opened manually — not a persistent setting. Access via Command Palette → `Developer: Open Agent Debug Panel`, or Chat gear menu → `View Agent Logs`. Only available for local sessions; log data is not persisted across VS Code restarts.
- **Context compaction** does not require a setting; it happens automatically when the context window fills. Manual compaction: type `/compact` in the chat input, optionally with focus instructions (e.g., `/compact focus on game loop and leaderboard integration`). Also available via the context-window control → "Compact Conversation".

## Response Framing
- Start with a purposeful plan; reserve redundant labels only when they aid scanning.
- Keep follow-up updates focused on what changed since the prior message (delta reporting).
- Reference filenames and symbols with backticks for clarity.
- Keep answers concise — don't over-explain completed file operations.

## Common Failure Modes & Preventers
- **Frame-rate dependent physics** → always use `dt` (delta-time) for movement. Never assume 60fps.
- **Score manipulation** → validate game state hash on-chain before accepting submitted scores.
- **Treasury drain** → capability-gate all payout functions. Never allow unchecked withdrawals.
- **In-game mode wallet errors** → detect in-game mode early and disable all wallet-dependent UI paths.
- **Speculative refactors** → apply safer alternative rule; smallest safe change first.
- **Canvas sizing issues** → always read canvas dimensions from the container, not hardcoded values. Support both in-game (787×1198) and standalone viewports.
- **Agent-generated duplicate files** → grep before creating utilities or components.

## When Unsure
- Search existing patterns first (grep for similar feature names).
- Mirror existing game loop patterns when adding new gameplay mechanics.
- Keep canvas rendering logic separate from React state management.
- Keep Move modules under ~500 lines; split at generation time, not after.
- Verify wallet connection status before any on-chain operation in the frontend.

<!-- End – Provide feedback if additional sections should be documented. -->
