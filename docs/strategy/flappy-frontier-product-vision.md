# Flappy Frontier — Product Vision

**Retention:** Carry-forward (Flappy Frontier repo only — not part of CivilizationControl export)

> **Date:** 2026-03-02  
> **Status:** Pre-hackathon planning (code moratorium until March 11)  
> **Track:** E (Sprint — 1–2 day build)  
> **Target Prize:** Player Vote weapon (25% of Best Entry score) + Weirdest Idea backup  
> **Inputs:** Portfolio roadmap §6a, in-game DApp surface analysis, Sui randomness docs, atomic courier experiment (validated escrow patterns), hackathon rules digest

---

## 1. Executive Summary

Flappy Frontier is a Flappy Bird-style side-scrolling game themed for the EVE Frontier universe. Players fly through procedurally generated obstacles, submit scores to an on-chain leaderboard backed by Sui, and compete for weekly automated payouts funded by entry fees.

The game demonstrates four Sui primitives in a lightweight, immediately playable package: native randomness (`sui::random`), time-based automation (`Clock`), on-chain state management (leaderboard via `vector`), and token-gated participation (`Coin<SUI>`). It is not a governance tool — it is a player engagement weapon designed to drive player votes (25% of Best Entry score) while standing alone as a complete Sui integration showcase.

**Build budget:** 10–16 hours LLM-assisted.  
**Kill criteria:** Abandon if Canvas 2D game loop isn't playable within 6 hours.

---

## 2. Strategic Role in Hackathon Portfolio

Flappy Frontier exists for three reasons:

1. **Player vote amplifier.** Player vote constitutes 25% of the Best Entry weighted score. A fun, shareable mini-game drives more votes than any governance dashboard. If CivilizationControl reaches the top 3 on judge scores, Flappy Frontier's vote pull could be the margin.

2. **Prize category backup.** If Fortune Gate (Track C1) hits its kill criteria or is cut for time, Flappy Frontier absorbs the Weirdest Idea backup slot. A blockchain-verified Flappy Bird clone in a space MMO qualifies.

3. **Primitive diversity.** Flappy Frontier exercises `sui::random`, `Clock`, and on-chain leaderboard mechanics — primitives not used by CivilizationControl (dynamic fields, typed witnesses, Groth16) or by Track C entries. Judges seeing the full portfolio recognize breadth across the Sui surface area.

**Build priority within portfolio:** C3 (Corpse Toll) → C1 (Fortune Gate) → **E (Flappy Frontier)** → C2 (Salvage) → F (Atomic Courier) → D (Loot Crate). Flappy Frontier ranks above Salvage Protocol because player vote impact outweighs Most Creative category coverage.

**Hard dependency:** Flappy Frontier begins only after CivilizationControl produces a watchable 3-minute demo draft (Phase 1 gate). No exceptions.

---

## 3. Product Vision

A player opens their browser, sees a live leaderboard with the current week's top 10 scores and the prize pool accumulating in real time. Behind the leaderboard, a gameplay demo loops — space-themed, fast, immediately legible.

They connect their wallet. Pay 1 token. A seed is drawn from Sui's native randomness module. The game begins: procedurally generated obstacles, deterministic from that on-chain seed, constrained to guarantee no impossible layouts. The player flies until they hit something.

Score: 47.

The leaderboard shows the current #10 is 39. They click "Submit Score." The wallet signs. The chain verifies the entry fee was paid, the run was seeded by the correct randomness call, and the score qualifies. The leaderboard updates on-chain. Their address is now #8.

Sunday at 00:00 UTC, the week ends. The smart contract distributes the treasury to the top 3 (or top N). A new week begins. The leaderboard resets. The treasury starts accumulating again.

No admin. No manual payout. No maintenance. The game runs itself.

---

## 4. Core Gameplay Loop

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│  View        │     │  Pay Entry   │     │  Play Game    │
│  Leaderboard │────►│  Fee (1 SUI) │────►│  (Canvas 2D)  │
│  + Prize Pool│     │  + Get Seed  │     │  Deterministic │
└─────────────┘     └──────────────┘     └───────┬───────┘
                                                  │
                                                  ▼
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│  Weekly      │     │  Leaderboard │     │  Submit Score  │
│  Auto-Payout │◄───│  Updates     │◄───│  On-Chain      │
│  (Top N)     │     │  (Top 10)    │     │               │
└─────────────┘     └──────────────┘     └───────────────┘
```

**Session flow:**

1. **View** — Landing page shows leaderboard (top 10 with addresses, scores, timestamps) and current prize pool balance. Gameplay demo loops in background.
2. **Authenticate** — Player connects Sui wallet (EVE Vault or any `@mysten/wallet-standard` compatible wallet in external browser).
3. **Pay + Seed** — Player pays entry fee via `Coin<SUI>`. The transaction calls `start_run()`, which draws a seed from `sui::random` and returns it. Fee goes into treasury `Balance<SUI>`.
4. **Play** — Canvas 2D game uses the on-chain seed to deterministically generate obstacles. Constrained randomness ensures no impossible layouts. Run has a maximum time limit (e.g., 120 seconds) to prevent infinite games.
5. **Submit** — Player calls `submit_score()` with their score and run ID. The leaderboard updates if the score qualifies for top 10.
6. **Repeat or wait** — Play again (new fee, new seed) or wait for weekly payout.

**Free-play mode:** Anyone can play without a wallet (random client-side seed, no leaderboard submission). This enables in-game CEF webview usage where no wallet is available.

---

## 5. Sui Primitives Leveraged

| Primitive | Usage | Novelty |
|-----------|-------|---------|
| **`sui::random`** | Seed generation for each run — on-chain, verifiable, unpredictable | Provably fair game seeding; no server-side RNG needed |
| **`Clock`** | Weekly epoch boundaries (payout trigger), run expiry enforcement | Autonomous lifecycle — no admin cron job |
| **`Coin<SUI>` / `Balance<SUI>`** | Entry fees paid into shared treasury; payouts disbursed from treasury | Self-sustaining economic loop |
| **On-chain leaderboard (`vector`)** | Top 10 stored as a sorted vector inside a shared `Leaderboard` object | Fully transparent ranking — anyone can verify |
| **Shared objects** | `Leaderboard` and `Treasury` are shared, enabling concurrent multi-player interaction | Standard Sui shared-object consensus |
| **Events** | `RunStarted`, `ScoreSubmitted`, `PayoutExecuted`, `LeaderboardReset` | Off-chain indexing for UI reactivity |

### Architecture Sketch

```move
// Core types (conceptual — not final signatures)
public struct Leaderboard has key {
    id: UID,
    entries: vector<LeaderboardEntry>,  // sorted, max 10
    current_epoch: u64,
    epoch_start_ms: u64,
}

public struct LeaderboardEntry has store, copy, drop {
    player: address,
    score: u64,
    run_seed: u256,
    timestamp_ms: u64,
}

public struct Treasury has key {
    id: UID,
    balance: Balance<SUI>,
    entry_fee_mist: u64,
    payout_shares: vector<u64>,  // e.g., [50, 30, 20] for top 3
}
```

**Key design decisions:**

- **Vector, not dynamic fields** for leaderboard — 10 entries is well within Sui's object size limit. Simple, readable, no DF overhead.
- **Shared objects** — Both `Leaderboard` and `Treasury` are shared to allow concurrent submissions from different players without ownership constraints.
- **Epoch as u64** — Monotonically increasing. Weekly boundary calculated from `epoch_start_ms + 604_800_000` (7 days in ms). Anyone can trigger payout when `Clock.timestamp_ms >= epoch_end`.

---

## 6. Fairness & Integrity Model

### What the chain guarantees

| Property | Mechanism | Strength |
|----------|-----------|----------|
| **Run seed is unpredictable** | `sui::random` produces seed at transaction time; cannot be front-run by player within same PTB | Strong |
| **Seed is verifiable** | Seed stored in `RunStarted` event; anyone can regenerate the obstacle layout | Strong |
| **No impossible layouts** | Constrained randomness algorithm: pipe gaps bounded between min/max, vertical deltas capped, minimum horizontal spacing | Strong (deterministic from seed) |
| **Entry fees are locked** | `Balance<SUI>` inside shared `Treasury` object — no unilateral withdrawal | Strong |
| **Payouts are automated** | Anyone can call `trigger_payout()` when epoch expires; no admin key required | Strong |
| **Leaderboard is transparent** | All entries on-chain with player address, score, and seed | Strong |

### What the chain does NOT guarantee

| Gap | Impact | Mitigation |
|-----|--------|------------|
| **Score authenticity** | Client reports score; chain cannot independently verify gameplay execution | Accepted risk — see tradeoff analysis below |
| **Bot play** | Automated players could achieve perfect scores | Entry fee creates economic friction; not worth over-engineering for hackathon |
| **Seed inspection** | Player could inspect seed before playing and pre-compute obstacle layout | Real-time reaction game — knowing layout provides marginal advantage (you still need to tap correctly); time limit constrains exploitation window |

### Tradeoff: Score Verification

**The honest answer:** Flappy Frontier trusts the client to report truthful scores. The chain verifies that a valid run was started (seed drawn, fee paid) and that the score was submitted within the run's time window, but it cannot independently replay client-side game physics.

**Why this is acceptable:**

1. **Hackathon scope.** Building a verifiable game execution engine (ZK proof of gameplay, or on-chain game loop) is a multi-month project, not a 1–2 day sprint. Over-engineering cheat prevention would consume the entire build budget.
2. **Economic friction.** Every submission costs an entry fee. Submitting fraudulent scores costs real tokens.
3. **Social accountability.** Player addresses are public on the leaderboard. In a community game within EVE Frontier, reputation has weight.
4. **Deterrence, not prevention.** The time-limited run window, verifiable seed, and public leaderboard create enough deterrence for a hackathon demo. Production hardening (replay verification, anomaly detection, challenge mechanisms) is a documented future enhancement, not an MVP requirement.

**What we do NOT claim:** "Flappy Frontier is cheat-proof." We claim: "Every run is seeded by on-chain randomness, every score is publicly attributed, and the economic loop requires no trust in any operator."

---

## 7. Economic Model

### Fee Flow

```
Player ──[1 SUI entry fee]──► Treasury (Balance<SUI>)
                                    │
                         ┌──────────┴──────────┐
                         │  Weekly epoch ends    │
                         │  (Sunday 00:00 UTC)   │
                         └──────────┬──────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              1st Place        2nd Place        3rd Place
              (50%)            (30%)            (20%)
```

### Parameters (MVP defaults — configurable at deploy)

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| **Entry fee** | 0.1 SUI (~$0.05 at current rates) | Low enough for casual play; high enough to discourage spam submissions. Display Lux equivalent if exchange rate is available. |
| **Payout split** | 50 / 30 / 20 (top 3) | Standard competitive distribution. Stored as `payout_shares` vector — trivially adjustable. |
| **Epoch duration** | 7 days (604,800,000 ms) | Weekly reset gives enough time for competition to develop and enough freshness to sustain engagement. |
| **Max leaderboard size** | 10 | Enough for competitive tension; small enough for a single `vector` without DF overhead. |
| **Run time limit** | 120 seconds | Prevents infinite runs. Client enforces; chain verifies submission timestamp vs. run start. |

### Treasury Safety

- `Treasury` is a shared object. No admin withdrawal function exists.
- `trigger_payout()` is callable by anyone when the epoch has expired. This means no admin key is needed and no maintenance is required.
- If no scores are submitted in an epoch, the treasury rolls over to the next epoch.
- The deployer has no special privileges after `init()`. This is a credibly neutral game.

### Edge Cases

| Scenario | Handling |
|----------|----------|
| Fewer than 3 scores in an epoch | Payout distributed among existing top N only; unclaimed shares roll over |
| Tied scores | Earlier submission (lower timestamp) ranks higher |
| Zero submissions | No payout; treasury accumulates; epoch resets |
| Treasury depleted (impossible — entry fees fund payouts) | N/A — payouts are funded by entries, creating a perpetual loop |

---

## 8. Weekly Lifecycle

```
Mon    Tue    Wed    Thu    Fri    Sat    Sun 00:00 UTC
 │      │      │      │      │      │      │
 ├──────┴──────┴──────┴──────┴──────┴──────┤
 │         Active Competition Epoch         │
 │  Players pay, play, submit scores        │
 │  Leaderboard updates in real-time        │
 │  Prize pool grows with each entry        │
 └──────────────────────────────────────────┘
                                            │
                                            ▼
                                    trigger_payout()
                                    (callable by anyone)
                                            │
                                    ┌───────┴───────┐
                                    │ Distribute     │
                                    │ treasury to    │
                                    │ top 3          │
                                    ├────────────────┤
                                    │ Reset          │
                                    │ leaderboard    │
                                    ├────────────────┤
                                    │ Increment      │
                                    │ epoch counter  │
                                    └────────────────┘
                                            │
                                            ▼
                                    New epoch begins
```

**Automation note:** `trigger_payout()` is a public `entry` function. Anyone — a player, a bot, a scheduled external service — can call it after the epoch expires. The game does not depend on any operator to execute the weekly cycle. Zero manual maintenance.

---

## 9. MVP Scope Boundaries

### In Scope (Must Ship)

| Component | Description | Est. Hours |
|-----------|-------------|------------|
| **Move package** | `Leaderboard` + `Treasury` + `start_run()` + `submit_score()` + `trigger_payout()` | 3–4h |
| **Canvas 2D game** | Flappy Bird clone: bird, pipes, score counter, collision detection, space theme | 4–6h |
| **Wallet integration** | `@evefrontier/dapp-kit` connect flow (`EveFrontierProvider` + `useConnection()`), entry fee payment, score submission signing | 2–3h |
| **Leaderboard UI** | Top 10 display (addresses, scores, timestamps), current prize pool, epoch countdown | 1–2h |
| **Demo video** | 30–60 seconds: play → submit → leaderboard updates → show payout mechanism | 1h |

**Total: 11–16 hours.**

### Out of Scope (Documented Non-Goals)

| Feature | Reason for Exclusion |
|---------|---------------------|
| **Cheat-proof score verification** | Multi-month engineering effort; accepted tradeoff (see §6) |
| **In-game wallet integration** | CEF webview does not support Sui wallet extensions; in-game = free-play only |
| **`Coin<EVE>` entry fees** | `Coin<EVE>` availability on hackathon test server is unvalidated; SUI is safe default |
| **Multiple game modes** | Single mode. No difficulty levels, no power-ups, no cosmetics. |
| **Mobile-optimized UI** | External browser desktop is primary; portrait layout for CEF compatibility is a bonus, not a requirement |
| **Replay system** | No recording/replay of runs; scores are fire-and-forget |
| **Admin functions** | No admin key, no pause, no fee adjustment post-deployment. Redeploy if parameters need changing. |
| **Sponsored transactions** | Players pay their own gas. Entry fee is the primary cost; gas is marginal. |
| **SSU/gate integration** | Flappy Frontier is standalone — no world-contracts dependencies |

### In-Game Viability

Per the [in-game DApp surface analysis](../../architecture/in-game-dapp-surface.md):

- Canvas 2D / WebGL is supported in the CEF webview (787×1198px portrait)
- Mouse/keyboard input works
- Portrait orientation is natural for Flappy-style gameplay
- DApp URL loadable from any SSU's DApp URL field

**Constraint:** No Sui wallet in CEF. In-game = free-play only. Score submission requires external browser with wallet. The UI displays a "Open in Browser to submit score" CTA when wallet is unavailable.

**Domain:** `flappyfrontier.com` (or equivalent) — players can type the URL into any SSU's DApp URL field to load it in-game.

---

## 10. Risks & Tradeoffs

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| 1 | **`sui::random` calling convention differs from docs** | Low | Medium — game seeding fails | Test within first 2 hours on hackathon test server. Fallback: tx digest-derived pseudo-random seed (weaker but functional). |
| 2 | **Canvas 2D game loop too slow / buggy** | Low | High — no playable game | Kill criteria: abandon if not playable within 6 hours. Fallback: static leaderboard-only page (score submission via CLI, web leaderboard display). |
| 3 | **Shared object contention on leaderboard** | Very Low | Low — occasional tx retry | Top 10 vector is small. Contention only matters if many players submit simultaneously. At hackathon scale, this is negligible. |
| 4 | **Score fraud undermines leaderboard** | Medium | Low for hackathon — demo integrity is controlled | Economic friction (entry fee) + public attribution + time window. Acceptable for demo. Document as known limitation. |
| 5 | **Client-side time manipulation** | Low | Low — run expiry bypass | Chain verifies `submit_score()` timestamp vs. `start_run()` timestamp. Client manipulation doesn't affect chain-side enforcement. |
| 6 | **Entry fee too high / too low** | Low | Low — parameter tuning | Configurable at deploy. Default 0.1 SUI. Adjust based on hackathon test server token economics. |
| 7 | **Weekly payout never triggered** | Very Low | Medium — prizes stuck | `trigger_payout()` is public — any external caller can trigger it. The demo explicitly shows this call. Worst case: deployer triggers it manually. |
| 8 | **CivilizationControl not demo-stable by Day 7** | Medium | Critical — Flappy Frontier never gets built | Hard gate: no sprint entries until CC produces watchable demo. If CC consumes all time, Flappy is cut. Portfolio strategy accounts for this. |

### Honest Limitations Statement

Flappy Frontier is a **1–2 day hackathon sprint**. It is not a production game. It demonstrates that Sui primitives can power a self-sustaining competitive game loop with zero operational overhead. The score integrity model trusts the client — this is a known, documented, and accepted tradeoff within the hackathon scope.

What it proves: on-chain randomness → deterministic generation → economic participation → automated payout — all without an admin key or a backend server. That is the technical story.

---

## Appendix: Naming Convention

| Context | Name | Usage |
|---------|------|-------|
| Player-facing, demo, submission | **Flappy Frontier** | Game title, UI header, demo video, Deepsurge entry |
| Move package name | `flappy_frontier` | `module flappy_frontier::leaderboard`, `module flappy_frontier::treasury` |
| Repository | `flappy-frontier` | Standalone hackathon submission repo (created March 11+) |
| Domain | `flappyfrontier` | URL for in-game loading and external access |

No dual-identity naming model (unlike Cargo Bond / Atomic Courier). Flappy Frontier is the same name internally and externally.
