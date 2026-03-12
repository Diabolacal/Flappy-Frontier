# Decision Log Template

**Retention:** Carry-forward

Use this template for recording non-trivial technical decisions. Append entries to a `docs/decision-log.md` file in your project (newest first).

---

## YYYY-MM-DD – Title of Decision

- **Goal:** What problem or objective drove this decision
- **Context:** Brief background (1-2 sentences)
- **Decision:** What was chosen and why
- **Alternatives considered:** Other options evaluated (if any)
- **Files:** List of files created/modified
- **Diff:** +X / -Y lines (approximate)
- **Risk:** Low | Medium | High
- **Gates:** typecheck ✅|❌  build ✅|❌  smoke ✅|❌
- **Follow-ups:** Any deferred work or monitoring needed

---

## Tips

- **One entry per decision** — don't batch unrelated choices
- **Keep entries short** (≤10 lines of content)
- **Newest first** — prepend, don't append
- **When to log:** Non-trivial behavior changes, new dependencies, schema/storage changes, platform decisions, security changes, performance choices
- **When to skip:** Pure formatting, documentation-only updates, routine dependency bumps
