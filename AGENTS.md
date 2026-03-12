# Agents Context — Flappy Frontier (Hackathon Submission Repo)

Purpose: Provide persistent, high-signal context and guardrails for agent mode in this repository. VS Code will automatically ingest this file (1.104+). Keep it short and link out for depth.

## Workflow primer

- Start every reply with a brief acknowledgement plus a high-level plan.
- Manage work through the todo list tool with exactly one item `in-progress`; update statuses as soon as tasks start or finish.
- Report status as deltas — highlight what changed since the last message instead of repeating full plans.
- Run fast verification steps yourself when feasible and note any gates you couldn't execute.

## Project quick facts

- **What:** Flappy Bird-style side-scrolling game for EVE Frontier hackathon, backed by Sui smart contracts
- **Frontend:** Vite + React + Canvas 2D game loop (deployed to Cloudflare Pages)
- **Contracts:** Sui Move — `contracts/flappy_frontier/` (Leaderboard, Treasury, game seeding via `sui::random`)
- **In-game:** Loadable in EVE Frontier CEF webview (787×1198px portrait, Chrome 122, no Sui wallet — free-play only)
- **Data flow:** Player → Canvas 2D → Sui wallet → Move contracts (entry fee, score submission, weekly payout)

> **Glossary note:** If you see "SWE" in voice notes or transcripts, it refers to **Sui** (the blockchain). Transcription tools frequently mishear it.

Useful entry points:
- **Documentation Index**: `docs/README.md` — central map for all project documentation
- **Guardrails**: `.github/copilot-instructions.md` (source of truth for patterns)
- **Decisions**: `docs/decision-log.md` (newest first)
- **Product Vision**: `docs/strategy/flappy-frontier-product-vision.md`
- **In-game Capabilities**: `docs/research/capabilities.json` (viewport 787×1198, DPR 1, Canvas 2D/WebGL supported, no Sui wallet)

## Three-tier boundaries

✅ **Always do (no permission needed):**
- Read any file for context gathering
- Run build, test, lint commands
- Update working memory documents (`docs/working_memory/`)
- Write to `docs/` (decision logs, working memory, guides)
- Execute automated test and verification steps

⚠️ **Ask first (coordinate before action):**
- Modifying game loop core (Canvas 2D rendering, physics, collision)
- Changes to Move contract public API signatures
- Changes to leaderboard/treasury data shapes
- Adding external dependencies
- Changes spanning >3 core files or >150 LoC delta

🚫 **Never do (hard boundaries):**
- Commit secrets, certificates, private keys
- Deploy to production from a feature branch
- Remove failing tests to make CI pass
- Store PII in analytics or telemetry

## Operational guardrails (summary)

Authoritative language for every mandate lives in `.github/copilot-instructions.md`. This section is a quick primer.

- **Run the commands yourself.** Execute CLI / git / HTTP checks directly unless a secret prompt is required.
- **Preview vs production deploys.** Feature branches deploy to Cloudflare Pages preview. Production deploys only from `main` after merge.
- **Working memory discipline.** Consider a Working Memory file when: (a) a task spans multiple sessions, (b) VS Code shows "summarizing conversation" or ≥70% context, or (c) operator explicitly asks.
- **Decision logging.** Any non-trivial behavior change must be reflected in `docs/decision-log.md`.

### Agent operating rules (must follow)

1. Prefer smallest safe change; don't refactor broadly without explicit approval.
2. Follow the workflow primer: purposeful preamble + plan, synchronized todo list, and delta-style progress updates.
3. CLI mandate: Run CLI commands yourself and summarize results. Prompt user only for secret inputs. Never commit secrets.
4. Sensitive edits: Treat game loop, Move contracts, and treasury logic as sensitive; ask before structural changes.
5. Feature branch deploys: Always use feature-branch-scoped preview deploys. Never deploy feature branches to production.
6. **Automated error recovery**: If a build, typecheck, or test fails after your patch, self-diagnose, explain the cause in plain English, apply a fix, and re-run the gate. Only escalate if a fix attempt also fails.

## Code & Repo Conventions

Full conventions in `docs/core/hackathon-repo-conventions.md`. Language-specific rules in `.github/instructions/`.

### Git Workflow
- **Branch for all non-trivial work.** Pattern: `feat/`, `fix/`, `docs/`, `chore/`, `spike/`.
- **Squash merge to `main`.** One clean commit per feature. PR title = commit message.
- **Commit message format:** `type: Imperative description` (≤72 chars).
- **`main` must always be demo-ready.** Never merge broken code.
- **Spike branches** (`spike/`) are throwaway — never merge them.

### File Discipline
- **No files >500 lines** (Move) or >150 lines (React components).
- **No "god files."** Split any file doing 3+ unrelated things.
- **No commented-out code.** Write it or delete it.
- **No duplicate utilities.** Grep the workspace before creating helpers.
- **Check for existing files** before creating new ones.

### Naming
- **React components:** `PascalCase.tsx`. Hooks: `useCamelCase.ts`. Utils: `camelCase.ts`.
- **Move:** modules `snake_case`, structs `PascalCase`, caps `PascalCaseCap`, events `PascalCaseEvent`, errors `EPascalCase`.
- **Directories:** `kebab-case`. Scripts: `verb-noun.ts`.

## Submodule & Vendor Policy

`vendor/*` directories contain third-party upstream repos as git submodules.

🚫 **Never do:**
- Create commits inside any `vendor/` submodule
- Modify, delete, or add tracked files within `vendor/*`
- Commit local Docker state, caches, or generated files from submodules

✅ **Correct patterns:**
- **Update submodule pin:** `git submodule update --remote vendor/<name>` from parent root, then commit the new gitlink
- **Local-only ignores:** Use `vendor/<name>/.git/info/exclude` for transient files
- **Read freely:** Reading submodule source for context/reference is always allowed

## High-risk surfaces (coordinate before changing)

- **Game loop** — Canvas 2D rendering, physics, collision detection, frame-rate-independent timing
- **Move contracts** — Leaderboard, Treasury, score validation, payout logic
- **Treasury/economic model** — Entry fees, payout splits, epoch lifecycle
- **Score integrity** — Client-to-chain score submission path
- **Sui key material** — private keys, mnemonics, wallet configs
- **Submodule boundaries** — never commit inside `vendor/*`

## Hackathon Rules Compliance Policy

- **Before generating Entry code**, verify the hackathon has started.
- **Before creating token/financial mechanics**, verify no security/equity characteristics.
- **Before submission**, cross-check repo hygiene: original work, GitHub-hosted, Deepsurge-registered, within deadline (31 March 2026 23:59 UTC).
- An eligible Entry may win **max 1 prize**. Player vote = 25% of Best Entry score.
- **Multiple submissions allowed** — each project must be unique.

## SUI Documentation Policy

Sui docs at https://docs.sui.io are canonical for all chain mechanics. Use `https://docs.sui.io/llms.txt` as the machine-readable index.

- **Canonical hierarchy:** `vendor/world-contracts` code > SUI docs > EVE Frontier GitBook > internal docs.
- **Key areas:** object model, `sui::random` calling conventions, `Clock` access patterns, `Coin<SUI>` mechanics, shared object consensus.

## Documentation Rules

1. All new markdown documents must be placed inside a categorized subfolder under `docs/`.
2. Do NOT create markdown files directly under `docs/` root (only `docs/README.md` lives at root).
3. When creating a new doc, update `docs/README.md` index.

## VS Code 1.110 – Agent Tooling Notes

- **Built-in browser tools** (`workbench.browser.enableChatTools`) are enabled. Prefer them over external MCP tooling for routine verification.
- **Context compaction** happens automatically. Manual compaction: `/compact` in chat.

## Fast context to load on start

- Read `.github/copilot-instructions.md` (source of truth)
- Read `AGENTS.md` (this file)
- Skim last ~20 lines of `docs/decision-log.md`
- Review `docs/README.md` for documentation map
- For game implementation: read `docs/strategy/flappy-frontier-product-vision.md`
- For in-game constraints: read `docs/research/capabilities.json`

— Keep this file concise. Update when operating rules or architecture materially change.
