# Security Review — Flappy Frontier

**Retention:** Carry-forward

**Date:** 2026-03-14
**Last reconciliation:** 2026-03-15
**Scope:** Move contracts, sponsor worker, frontend transaction flow, config/secrets/env, architecture
**Posture:** Hackathon / testnet — no real-money exposure
**Methodology:** Manual code review across all audit surfaces with sub-agent-assisted analysis

---

## Executive Summary

Flappy Frontier has a sound core architecture — the treasury is trustlessly distributed with no admin drain path, the shared object model is correct, and there are no hardcoded secrets in source.

**Original assessment (2026-03-14):** The ranked game flow had a critical gap — score submission required no proof-of-play and no entry fee gate. The sponsor worker was an open gas station. Together, an attacker could post fake scores and drain both the treasury and the sponsor wallet at zero cost.

**Current status (2026-03-15):** All three critical findings and both high-severity findings with direct exploit paths have been remediated. `RunReceipt` binding now enforces fee-gated, single-use score submission. The sponsor worker validates transaction intent (package/module/function allowlist) and requires API key auth. Leaderboard enforces one entry per player. Security headers are deployed. Lockfiles are committed. The remaining open items are lower-severity edge cases, UX gaps, and production-hardening items that are acceptable for hackathon/testnet posture.

**Findings by severity and current status:**

| Severity | Original Count | Resolved | Partially Resolved | Open |
|----------|---------------|----------|-------------------|------|
| Critical | 3 | 3 | 0 | 0 |
| High | 3 | 2 | 1 | 0 |
| Medium | 7 | 4 | 1 | 2 |
| Low | 8 | 3 | 0 | 5 |
| Informational | 8 | — | — | — |

---

## Finding Index

| ID | Severity | Title | Surface | Status |
|----|----------|-------|---------|--------|
| **C-1** | Critical | Score submission has zero validation — no fee-gate, no proof-of-play | Move | ✅ Resolved |
| **C-2** | Critical | No on-chain binding between start_run and submit_score | Move | ✅ Resolved |
| **C-3** | Critical | Sponsor worker signs arbitrary transactions without intent validation | Worker | ✅ Resolved |
| **H-1** | High | Same player can occupy all leaderboard slots | Move | ✅ Resolved |
| **H-2** | High | No caller authorization on sponsor service | Worker | ✅ Resolved (testnet) |
| **H-3** | High | No rate limiting or gas budget cap on sponsor service | Worker | ⚠️ Partial |
| **M-1** | Medium | Division by zero in payout with pathological share config | Move | Open |
| **M-2** | Medium | AdminCap is non-transferable — no rotation or recovery | Move | Open (accepted) |
| **M-3** | Medium | Admin can manipulate payout economics without constraint | Move | ⚠️ Partial |
| **M-4** | Medium | Sponsor error messages leak internal details | Worker | ✅ Resolved |
| **M-5** | Medium | Silent fallback from sponsored to player-paid gas | Frontend | Open |
| **M-6** | Medium | No security headers on Cloudflare Pages frontend | Config | ✅ Resolved |
| **M-7** | Medium | package-lock.json gitignored — non-deterministic builds | Config | ✅ Resolved |
| **L-1** | Low | CORS wildcard suffix + localhost in production allowlist | Worker | Open (improved) |
| **L-2** | Low | Sender address not verified (no ownership proof) | Worker | Open (accepted) |
| **L-3** | Low | No request body size limit on sponsor service | Worker | ✅ Resolved |
| **L-4** | Low | Entry fee hardcoded in frontend, may diverge from on-chain | Frontend | Open |
| **L-5** | Low | u64 overflow risk in payout math at extreme balances | Move | Open |
| **L-6** | Low | Score of 0 accepted on empty leaderboard | Move | Open |
| **L-7** | Low | Unlimited Treasury creation (no one-time witness) | Move | Open (low risk) |
| **L-8** | Low | parseInt without NaN guard on GAS_BUDGET env var | Worker | ✅ Resolved |
| **I-1** | Info | Treasury has no admin withdrawal — strong trustless design | Move | ✅ |
| **I-2** | Info | Epoch expiry prevents double-payout (atomic tx) | Move | ✅ |
| **I-3** | Info | No hardcoded secrets in any source file | Config | ✅ |
| **I-4** | Info | SSU wallet detection uses startsWith — correct | Frontend | ✅ |
| **I-5** | Info | No XSS vectors (no innerHTML, dangerouslySetInnerHTML, eval) | Frontend | ✅ |
| **I-6** | Info | UpgradeCap is unrestricted (testnet-acceptable) | Move | Open |
| **I-7** | Info | gameHash field exists but is never populated | Frontend | Open |
| **I-8** | Info | Seed truncated from u256 to 32 bits for PRNG | Frontend | Open |

---

## Critical Findings

### C-1: Score submission has zero validation — no fee-gate, no proof-of-play

**Surface:** Move contracts — `game.move`
**Exploitability:** Trivial
**Status:** ✅ Mitigated (2026-03-14) — `submit_score` now requires a `RunReceipt` owned object that is created only by `start_run` (which collects the entry fee). The receipt is consumed (deleted) on submission. Score submission without fee payment is no longer possible. The score value itself is still player-reported — true proof-of-play would require server-side validation or deterministic replay, which is noted as a remaining architectural limitation.

`submit_score<T>` is a public `entry` function that accepts any `score: u64` and `run_seed: u256` without verifying:
- That the caller paid an entry fee via `start_run`
- That the `run_seed` was generated by on-chain randomness
- That the score corresponds to any actual game session
- Any game hash or proof-of-play

```move
entry fun submit_score<T>(
    leaderboard: &mut Leaderboard,
    treasury: &Treasury<T>,     // read-only — only used to read current_epoch
    score: u64,                 // user-controlled, no validation
    run_seed: u256,             // user-controlled, no validation
    clock: &Clock,
    ctx: &mut TxContext,
) {
    leaderboard.submit_score(ctx.sender(), score, run_seed, timestamp_ms);
}
```

**Attack:** `sui client call --function submit_score --args $LEADERBOARD $TREASURY 18446744073709551615 0 0x6` — maximum score, no game played, no fee paid. Then call `trigger_payout` to collect the entire treasury.

**Impact:** Complete compromise of the ranked game economy. Anyone can claim prize pool payouts without playing or paying.

**Recommendation:** Add a `RunReceipt` hot-potato or owned object returned by `start_run` that must be consumed by `submit_score`. This binds score submission to fee payment. For score integrity beyond that, consider a commit-reveal scheme or off-chain attestation.

---

### C-2: No on-chain binding between start_run and submit_score

**Surface:** Move contracts — `game.move`
**Exploitability:** Trivial (amplifies C-1)
**Status:** ✅ Mitigated (2026-03-14) — `start_run` now creates a `RunReceipt` owned object containing the player address, chain-generated seed, and epoch number, then transfers it to the player. `submit_score` requires this receipt by value, validates player + epoch, extracts the seed, and deletes the receipt. This creates a strict on-chain binding: fee payment → receipt creation → score submission → receipt consumption. The run_seed parameter has been removed from `submit_score` — the seed now comes from the receipt itself, preventing seed fabrication or reuse.

`start_run` emits a `RunStartedEvent` with a random seed but **does not record any on-chain state** (no receipt object, no table entry). `submit_score` accepts `run_seed` as a user-controlled parameter and never validates it against any registry. The two functions are completely independent.

This means:
- A player can submit scores for seeds they never started
- A player can reuse a "lucky" seed from a previous run
- A player can submit scores without ever calling `start_run`

The `ScoreSubmission` type in the frontend has a `gameHash` field, but it is **always passed as empty string** and the contract doesn't accept a game hash parameter.

**Recommendation:** Same as C-1 — introduce a `RunReceipt` object. Additionally, track active runs in a `Table<address, RunInfo>` or similar structure.

---

### C-3: Sponsor worker signs arbitrary transactions without intent validation

**Surface:** `workers/sponsor-service/src/index.ts` L155–176
**Exploitability:** Trivial
**Status:** ✅ Mitigated (2026-03-14) — Intent validation added: package ID allowlist, module restricted to `game`, function allowlist (`start_run`, `submit_score`, `trigger_payout`), max 6 commands, `Publish`/`Upgrade` denied, requires at least one MoveCall. Config: `ALLOWED_PACKAGE_ID` env var.

The sponsor worker accepts any `TransactionKind` bytes and sponsors them without inspecting:
- Target package ID
- Target module or function
- Number or type of commands
- Transaction structure

```typescript
const kindBytes = fromBase64(txKindB64);
const tx = Transaction.fromKind(kindBytes);  // accepts ANY transaction
tx.setSender(sender);
tx.setGasOwner(sponsorAddress);
```

**Attack:** `curl -X POST https://<worker-url>/sponsor -d '{"txKindB64":"<arbitrary-transfer-tx>","sender":"0xattacker"}'` — the sponsor wallet pays gas for any Sui transaction on the entire network.

**Impact:** The sponsor wallet becomes an open gas station for anyone on the internet. Combined with H-2 and H-3 (no auth, no rate limiting), the sponsor wallet can be drained rapidly.

**Recommendation:** Deserialize the `TransactionKind`, iterate commands, enforce:
- Only `MoveCall` commands allowed
- Target package must match the Flappy Frontier `packageId`
- Target modules restricted to `game` (the game's public module)
- Reject transactions with >N commands

---

## High Findings

### H-1: Same player can occupy all leaderboard slots

**Surface:** Move contracts — `leaderboard.move`
**Exploitability:** Trivial (combined with C-1)
**Status:** ✅ Resolved (2026-03-14) — Leaderboard now enforces one entry per player per epoch. On submission, the module scans for an existing entry by the same player. If found with a lower score, the old entry is removed and replaced. If found with a higher or equal score, the new submission is silently rejected (no abort — receipt is still consumed). Test coverage: same player updates with better score, keeps higher score, cannot duplicate entries, multiple players each have one entry.

`submit_score` has no deduplication by player address. A single address can submit multiple high scores and occupy all 10 leaderboard positions, collecting 100% of payout shares (50%+30%+20% = 100% for top 3).

```move
public(package) fun submit_score(
    leaderboard: &mut Leaderboard,
    player: address,
    score: u64,
    // ... no check for existing entry by same player
) {
    let entry = LeaderboardEntry { player, score, run_seed, timestamp_ms };
    leaderboard.entries.insert(entry, insert_pos);
```

**Recommendation:** Enforce one entry per player (replace on higher score) or limit payouts to unique addresses in `winner_addresses()`.

---

### H-2: No caller authorization on sponsor service

**Surface:** `workers/sponsor-service/src/index.ts` L122–130
**Exploitability:** Trivial
**Status:** ✅ Resolved for testnet (2026-03-14) — Shared API key auth added via `Authorization: Bearer <key>` header checked against `SPONSOR_API_KEY` Wrangler secret. Frontend sends key from `VITE_SPONSOR_API_KEY` env var. **Residual caveat:** `VITE_SPONSOR_API_KEY` is baked into the client-side JS bundle, so a determined attacker reading the frontend source can extract it. Additionally, if `SPONSOR_API_KEY` is not set in the Worker env, auth is bypassed. Acceptable for hackathon/testnet; wallet-signature-based auth would be required for production.

**Original finding:** The worker had no authentication. CORS restricts browser-initiated cross-origin requests but provides zero server-side security.

**Recommendation (remaining):** For production, require a signature from the player’s wallet proving ownership of the `sender` address.

---

### H-3: No rate limiting or gas budget cap on sponsor service

**Surface:** `workers/sponsor-service/src/index.ts`
**Exploitability:** Trivial
**Status:** ⚠️ Partially mitigated (2026-03-14) — Body size limit (16 KB), command count cap (6), intent validation, and API key auth significantly raise the bar. True per-sender rate limiting not yet implemented (would require Durable Objects or KV). **Open gap:** An attacker with the client-exposed API key can still send unlimited valid Flappy Frontier transactions. Acceptable for hackathon/testnet where sponsor wallet holds only testnet SUI.

**Original finding:** No daily/hourly budget cap. Gas budget is a flat 50M MIST (0.05 SUI) per request.

**Recommendation (remaining):** Add Cloudflare Workers rate limiting (Durable Object counter or built-in). Per-sender cooldown (max 3 sponsored txs/minute per `sender`). Daily budget cap with early return when exhausted.

---

## Medium Findings

### M-1: Division by zero in payout with pathological share config

**Surface:** `treasury.move` L110–126
**Status:** Open (edge case) — Zero-winners path is correctly guarded (epoch advances, returns empty vector). However, `set_payout_shares` validates `sum == 100` and `!is_empty()` but does NOT validate individual elements > 0. A share vector like `[0, 0, 100]` with only 2 winners would yield `active_shares_sum = 0`, causing division by zero. Requires adversarial admin config; low probability but not eliminated.

**Impact:** Treasury becomes stuck for that epoch until admin changes shares.

**Recommendation:** Validate in `set_payout_shares` that no individual share is 0, or guard against zero `active_shares_sum`.

---

### M-2: AdminCap is non-transferable — no rotation or recovery

**Surface:** `config.move` L37–39
**Status:** Open (accepted for hackathon) — Still `key` only (no `store`). No transfer function exists. Known limitation; admin is the deployer wallet. For production, would need `store` ability or an explicit transfer function.

**Recommendation:** Add `store` ability or add an explicit `transfer_admin_cap` function.

---

### M-3: Admin can manipulate payout economics without constraint

**Surface:** `config.move` (set_entry_fee, set_epoch_duration, set_payout_shares)
**Status:** ⚠️ Partially addressed — Lower bounds now enforced: `entry_fee > 0`, `epoch_duration_ms > 0`, `payout_shares` non-empty and sums to 100. However, no upper bounds (fee could be set to `u64::MAX`, epoch to 1ms), no timelock, and **no events emitted on config changes** (off-chain indexers cannot detect parameter modifications). Acceptable for hackathon where admin is a known party.

**Recommendation (remaining):** Add upper bounds (minimum epoch duration, maximum fee). Emit events on all config changes. Consider timelock where changes take effect on next epoch.

---

### M-4: Sponsor error messages leak internal details

**Surface:** `workers/sponsor-service/src/index.ts` L172–176
**Status:** ✅ Resolved (2026-03-14) — Catch block now returns generic "Sponsorship failed. Please try again." to clients; full error logged server-side only via `console.error`. Input validation errors (400) are appropriately descriptive without leaking internals.

**Original finding:** Raw `err.message` was returned to clients, potentially leaking RPC URLs, object IDs, gas coin details, and balance information.

---

### M-5: Silent fallback from sponsored to player-paid gas

**Surface:** `frontend/src/features/auth/hooks/useGameTransaction.ts` L58–89
**Status:** Open — When sponsorship fails (other than user rejection), the code emits a `console.warn` and silently falls back to the standard player-paid path. No toast or UI notification is shown to the user. The UI tells the user "gas is sponsored" before execution, but if the sponsor is down, the player will be prompted to pay SUI without explanation.

**Recommendation:** Show a clear notification before falling back to player-paid, or prompt the user to confirm.

---

### M-6: No security headers on Cloudflare Pages frontend

**Surface:** Cloudflare Pages deployment — no `public/_headers` file
**Status:** ✅ Resolved (2026-03-15) — `frontend/public/_headers` now configures: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`, and a Content-Security-Policy with `default-src 'self'`, `frame-ancestors 'none'`, and a specific `connect-src` allowlist. **Minor residual:** `Strict-Transport-Security` (HSTS) header not included; Cloudflare handles TLS at the edge, but an explicit HSTS header would strengthen downgrade protection.

---

### M-7: package-lock.json gitignored — non-deterministic builds

**Surface:** `.gitignore`
**Status:** ✅ Resolved (2026-03-15) — Both `frontend/package-lock.json` and `workers/sponsor-service/package-lock.json` are now tracked in git. No gitignore rule blocks lockfiles. Deterministic dependency resolution is in effect.

---

## Low Findings

### L-1: CORS wildcard suffix + localhost in production allowlist

**Status:** Open (improved) — CORS now uses an exact-match allowlist for production domains plus `localhost:5173`. Wildcard suffix `*.flappy-frontier.pages.dev` remains for Cloudflare preview deploys with `https:` protocol check. Minor residual: any subdomain of `flappy-frontier.pages.dev` passes. Low risk — CORS is not authorization (H-2 is the real boundary).

### L-2: Sender address not verified (no ownership proof)

**Status:** Open (accepted) — The `sender` field is format-checked (`0x` prefix) but has no ownership proof. This is an inherent limitation of the dual-signature sponsorship model — the player proves ownership later by signing the full transaction client-side. The format check is adequate for this pattern.

### L-3: No request body size limit on sponsor service

**Status:** ✅ Resolved (2026-03-14) — `MAX_BODY_BYTES = 16_384` enforced via `Content-Length` header check, returning 413 if exceeded. Minor residual: defense is header-based only; a malicious client omitting the header could stream a larger body, but Cloudflare Workers enforce a 1MB platform limit.

### L-4: Entry fee hardcoded in frontend, may diverge from on-chain

**Status:** Open — `entryFeeAmount: 100_000_000_000` remains hardcoded in `contractConfig.ts`. If admin changes the fee on-chain, the UI shows stale info. Not exploitable (contract enforces the real fee), but violates the project convention "Never hardcode fee amounts in the frontend."

### L-5: u64 overflow risk in payout math

**Status:** Open — Still u64-only arithmetic. `total_balance * payout_shares[i]` overflows u64 when `total_balance > ~1.8 × 10^17`. With EVE’s 9 decimals, that’s ~184 million EVE. Sui Move aborts on overflow (fail-safe, not fail-graceful). Practically unreachable for hackathon testnet treasury balances.

### L-6: Score of 0 accepted on empty leaderboard

**Status:** Open — No `score > 0` check in `submit_score`. A zero-score entry occupies a leaderboard slot and could receive a payout. Design decision — if 0 represents "participated but scored nothing," it may be intentional.

### L-7: Unlimited Treasury creation

**Status:** Open (low risk) — `init_treasury` can still be called multiple times, creating duplicate shared Treasury objects. AdminCap-gated, so limited to admin error. A robust fix would be a `TreasuryCap<T>` one-time-use pattern or a flag on GameConfig.

### L-8: parseInt without NaN guard on GAS_BUDGET env var

**Status:** ✅ Resolved (2026-03-14) — `parseInt` result is now checked with `Number.isNaN()` and falls back to `DEFAULT_GAS_BUDGET` (50M MIST). Deployer-controlled config risk eliminated.

---

## Informational Findings

### Positive Design Aspects

| ID | Finding |
|----|---------|
| **I-1** | Treasury has **no admin withdrawal function**. Funds leave only through rule-driven `trigger_payout` to verified leaderboard winners. Strong trustless design. |
| **I-2** | Epoch expiry check prevents double-payout. `distribute_payout` advances `epoch_start_ms`, making consecutive calls fail on `EEpochNotExpired`. Sui txs are atomic — no interleaving. |
| **I-3** | No hardcoded secrets found in any source file. Sponsor key managed via Wrangler secrets. `.gitignore` properly excludes `.env*`. |
| **I-4** | SSU wallet detection uses `startsWith` — correctly handles the known suffix variation in the wallet name. |
| **I-5** | No XSS vectors: zero usage of `innerHTML`, `dangerouslySetInnerHTML`, `eval`, or `new Function` in the frontend. React JSX auto-escaping is in effect. |

### Architectural Notes

| ID | Finding |
|----|---------|
| **I-6** | UpgradeCap is unrestricted. The deployer can publish new package versions. For testnet this is acceptable; for production, restrict or destroy the UpgradeCap or move to multisig. |
| **I-7** | `gameHash` field exists in frontend types but is always empty. Appears to be a planned integrity feature. The on-chain contract doesn't accept a game hash. |
| **I-8** | Chain seed is truncated from u256 to 32 bits for the Mulberry32 PRNG. Fine for gameplay; reduces entropy available for any future replay verification. |

---

## Specific Answers

### Is the sponsor worker safe enough for current hackathon/testnet usage?

**Yes, for hackathon/testnet.** The sponsor worker now validates transaction intent (package ID, module, function allowlist), rejects Publish/Upgrade commands, enforces a body size limit and command count cap, requires API key auth, and returns generic error messages. The remaining gaps are: (1) no per-sender rate limiting, and (2) the API key is client-exposed in the frontend bundle, so it’s not a real authentication barrier against a determined attacker. For testnet, the blast radius is limited to testnet SUI in the sponsor wallet.

### What are the biggest risks in the Move contracts?

With RunReceipt binding and leaderboard deduplication now in place, the most impactful original risks (C-1, C-2, H-1) are resolved. The remaining contract risks are:

1. **Client-reported scores** — The score value itself is still player-reported via the frontend. RunReceipt ensures fee payment and single-use, but does not prove the score was earned through actual gameplay. True proof-of-play would require server-side validation, deterministic replay, or TEE attestation.
2. **Admin manipulation** (M-3) — Config setters have lower bounds but no upper bounds, no timelock, and no events. A compromised admin key can set epoch duration to 1ms and extract value quickly.
3. **Division-by-zero edge case** (M-1) — Pathological `payout_shares` config can trigger abort in payout logic.

### What would have to change before stronger production/mainnet confidence?

| Category | Required Change | Status | Effort |
|----------|----------------|--------|--------|
| **Score integrity** | RunReceipt hot-potato binding `start_run` to `submit_score` | ✅ Done | — |
| **Leaderboard fairness** | Enforce one entry per player per epoch | ✅ Done | — |
| **Sponsor worker** | Full transaction intent validation (package + module + function allowlist) | ✅ Done | — |
| **Sponsor worker** | Replace client-exposed API key with wallet-signature-based auth | Open | Medium |
| **Sponsor worker** | Rate limiting + daily budget cap | Open | Medium |
| **Error handling** | Sanitize sponsor service error messages | ✅ Done | — |
| **Supply chain** | Commit lockfiles | ✅ Done | — |
| **Headers** | Add security headers to Cloudflare Pages | ✅ Done | — |
| **Admin safety** | Add `store` to AdminCap or explicit transfer function | Open | Small |
| **Admin safety** | Add parameter bounds + timelock on config changes | Open | Medium |
| **Upgrade safety** | Restrict or destroy UpgradeCap, or move to multisig | Open | Small |
| **Score anti-fraud** | Game hash / commit-reveal / off-chain attestation | Open | Large |
| **Formal verification** | Move Prover for treasury arithmetic and payout logic | Open | Medium |

---

## Future Hardening

### Acceptable for hackathon/testnet

- ~~Open sponsor worker~~ → Now intent-validated and API-key-gated (testnet SUI only, low blast radius)
- AdminCap in single deployer wallet (known party)
- Hardcoded contract addresses and entry fees
- ~~No security headers~~ → Now deployed (CSP, X-Frame-Options, etc.)
- No rate limiting on sponsor service (testnet only, API-key-gated)
- Client-side score — inherent to any client-side game without server validation
- ~~Lockfiles not committed~~ → Now committed

### Should fix before broader live usage

- ~~Sponsor intent validation~~ → ✅ Resolved — package/module/function allowlist enforced
- ~~Sponsor authentication~~ → ✅ Resolved for testnet — API key minimum in place; wallet-signature-based auth still needed for production
- **Rate limiting** — Per-sender and global caps on the sponsor service (still open)
- ~~Leaderboard deduplication~~ → ✅ Resolved — one entry per player per epoch
- ~~RunReceipt~~ → ✅ Resolved — score submission bound to entry fee payment
- ~~Error message sanitization~~ → ✅ Resolved — generic errors to clients, full logs server-side
- ~~Commit lockfiles~~ → ✅ Resolved — deterministic dependency resolution
- ~~Security headers~~ → ✅ Resolved — CSP, X-Frame-Options, etc. deployed
- **Silent fallback UX** — Notify users before switching from sponsored to player-paid (still open)

### Mandatory before real-money / mainnet deployment

- **Score integrity system** — Client-side scores are inherently forgeable. Options: deterministic replay verifier, TEE-attested game execution, off-chain oracle with challenge window, server-side game validation. This is the hardest problem and fundamental to any on-chain competitive game.
- **Move Prover / formal verification** — `treasury.move` payout arithmetic and `leaderboard.move` sorting/insertion logic should be formally verified to prove no overflow, no stuck states, and correct distribution.
- **AdminCap multi-sig** — Move to a multi-signature address. Add timelock on parameter changes.
- **UpgradeCap governance** — Restrict upgrade policy or destroy the cap after stabilization.
- **Full sponsor worker hardening** — Transaction deserialization, function allowlist, wallet-signature auth, per-sender rate limiting with daily caps, KMS for key management (not env var).
- **Division-by-zero guard** — Validate payout shares (no zeros, must sum to 100).
- **u128 intermediate math** — Use u128 for payout multiplication to eliminate overflow edge case.
- **Parameter bounds** — Minimum epoch duration, maximum fee, share constraints enforced on-chain.
- **Security audit** — Professional third-party audit of Move contracts before any real value enters the treasury.

---

## Methodology

This review was conducted via manual source code analysis using sub-agent-assisted parallel review of:
1. All Move source files in `contracts/flappy_frontier/sources/` and `tests/`
2. All sponsor service source in `workers/sponsor-service/src/`
3. Frontend transaction flow in `frontend/src/features/auth/`, `frontend/src/features/score/`, `frontend/src/lib/`
4. Configuration files: `.gitignore`, `wrangler.toml`, `wrangler.jsonc`, `vite.config.ts`, `contractConfig.ts`, `environment.ts`
5. Package manifests and lockfile presence

No automated tooling (SAST, Move Prover, dependency scanning) was used. No runtime testing was performed.
