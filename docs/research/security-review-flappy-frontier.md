# Security Review — Flappy Frontier

**Retention:** Carry-forward

**Date:** 2026-03-14
**Scope:** Move contracts, sponsor worker, frontend transaction flow, config/secrets/env, architecture
**Posture:** Hackathon / testnet — no real-money exposure
**Methodology:** Manual code review across all audit surfaces with sub-agent-assisted analysis

---

## Executive Summary

Flappy Frontier has a sound core architecture — the treasury is trustlessly distributed with no admin drain path, the shared object model is correct, and there are no hardcoded secrets in source. However, **the ranked game flow has a critical gap: score submission requires no proof-of-play and no entry fee gate**, allowing anyone to post arbitrary scores and claim payouts without playing. The **sponsor worker is an open gas station** that will sign any Sui transaction for any caller. These two issues together mean an attacker could — at zero cost — post fake scores and drain both the treasury and the sponsor wallet.

For hackathon/testnet, the blast radius is limited to testnet tokens. For any broader deployment, both issues must be resolved.

**Findings by severity:**

| Severity | Count | Summary |
|----------|-------|---------|
| Critical | 3 | Score forgery + no run binding + open sponsor service |
| High | 3 | Duplicate leaderboard slots, no sponsor auth, no rate limiting |
| Medium | 7 | Payout division-by-zero, AdminCap non-transferable, admin manipulation, error leakage, silent gas fallback, missing security headers, lockfile not committed |
| Low | 8 | Minor config/hygiene issues |
| Informational | 8 | Positive design notes, architectural observations |

---

## Finding Index

| ID | Severity | Title | Surface |
|----|----------|-------|---------|
| **C-1** | Critical | Score submission has zero validation — no fee-gate, no proof-of-play | Move | ✅ Mitigated |
| **C-2** | Critical | No on-chain binding between start_run and submit_score | Move | ✅ Mitigated |
| **C-3** | Critical | Sponsor worker signs arbitrary transactions without intent validation | Worker | ✅ Mitigated |
| **H-1** | High | Same player can occupy all leaderboard slots | Move | ✅ Fixed |
| **H-2** | High | No caller authorization on sponsor service | Worker | ✅ Mitigated |
| **H-3** | High | No rate limiting or gas budget cap on sponsor service | Worker | ⚠️ Partial |
| **M-1** | Medium | Division by zero in payout with pathological share config | Move |
| **M-2** | Medium | AdminCap is non-transferable — no rotation or recovery | Move |
| **M-3** | Medium | Admin can manipulate payout economics without constraint | Move |
| **M-4** | Medium | Sponsor error messages leak internal details | Worker | ✅ Mitigated |
| **M-5** | Medium | Silent fallback from sponsored to player-paid gas | Frontend |
| **M-6** | Medium | No security headers on Cloudflare Pages frontend | Config |
| **M-7** | Medium | package-lock.json gitignored — non-deterministic builds | Config |
| **L-1** | Low | CORS wildcard suffix + localhost in production allowlist | Worker |
| **L-2** | Low | Sender address not verified (no ownership proof) | Worker |
| **L-3** | Low | No request body size limit on sponsor service | Worker | ✅ Fixed |
| **L-4** | Low | Entry fee hardcoded in frontend, may diverge from on-chain | Frontend |
| **L-5** | Low | u64 overflow risk in payout math at extreme balances | Move |
| **L-6** | Low | Score of 0 accepted on empty leaderboard | Move |
| **L-7** | Low | Unlimited Treasury creation (no one-time witness) | Move |
| **L-8** | Low | parseInt without NaN guard on GAS_BUDGET env var | Worker | ✅ Fixed |
| **I-1** | Info | Treasury has no admin withdrawal — strong trustless design | Move ✅ |
| **I-2** | Info | Epoch expiry prevents double-payout (atomic tx) | Move ✅ |
| **I-3** | Info | No hardcoded secrets in any source file | Config ✅ |
| **I-4** | Info | SSU wallet detection uses startsWith — correct | Frontend ✅ |
| **I-5** | Info | No XSS vectors (no innerHTML, dangerouslySetInnerHTML, eval) | Frontend ✅ |
| **I-6** | Info | UpgradeCap is unrestricted (testnet-acceptable) | Move |
| **I-7** | Info | gameHash field exists but is never populated | Frontend |
| **I-8** | Info | Seed truncated from u256 to 32 bits for PRNG | Frontend |

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
**Status:** ✅ Fixed (2026-03-14) — Leaderboard now enforces one entry per player per epoch. On submission, the module searches for an existing entry by the same player. If found with a lower score, the old entry is removed and replaced. If found with a higher or equal score, the new submission is silently rejected (no abort — receipt is still consumed). New tests verify: same player updates with better score, keeps higher score, cannot duplicate entries, multiple players each have one entry.

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
**Status:** ✅ Mitigated (2026-03-14) — Shared API key auth added via `Authorization: Bearer <key>` header checked against `SPONSOR_API_KEY` wrangler secret. Frontend sends key from `VITE_SPONSOR_API_KEY` env var.

The worker has no authentication. CORS restricts browser-initiated cross-origin requests but provides zero server-side security — curl, Postman, and custom HTTP clients bypass CORS entirely. The `Origin` header is trivially spoofable.

**Recommendation:** Add a shared API key (`Authorization: Bearer <token>` checked against a Wrangler secret) as a minimum. For stronger security, require a signature from the player's wallet proving ownership of the `sender` address.

---

### H-3: No rate limiting or gas budget cap on sponsor service

**Surface:** `workers/sponsor-service/src/index.ts`
**Exploitability:** Trivial
**Status:** ⚠️ Partially mitigated (2026-03-14) — Body size limit (16 KB), command count cap (6), intent validation, and API key auth significantly raise the bar. True per-sender rate limiting not yet implemented (would require Durable Objects or KV). Acceptable for hackathon/testnet.

No daily/hourly budget cap. Gas budget is a flat 50M MIST (0.05 SUI) per request. With API key auth and intent validation, the attack surface is limited to holders of the API key sending valid Flappy Frontier transactions.

**Recommendation:** Add Cloudflare Workers rate limiting (built-in or Durable Object counter). Per-sender cooldown (max 3 sponsored txs/minute per `sender`). Daily budget cap with early return when exhausted.

---

## Medium Findings

### M-1: Division by zero in payout with pathological share config

**Surface:** `treasury.move` L110–126

If `payout_shares` has leading zeros (e.g., `[0, 0, 100]`) and fewer winners than shares, `active_shares_sum` can be 0, causing `(total_balance * 0) / 0` — Move aborts on integer division by zero.

**Impact:** Treasury becomes stuck for that epoch until admin changes shares.

**Recommendation:** Validate in `set_payout_shares` that no individual share is 0, or guard against zero `active_shares_sum`.

---

### M-2: AdminCap is non-transferable — no rotation or recovery

**Surface:** `config.move` L37–39

`AdminCap` has only `key` ability (no `store`). No transfer function exists. If the deployer wallet is compromised or lost, all admin functions are permanently inaccessible. If compromised, the attacker can manipulate all game parameters.

**Recommendation:** Add `store` ability or add an explicit `transfer_admin_cap` function.

---

### M-3: Admin can manipulate payout economics without constraint

**Surface:** `config.move` (set_entry_fee, set_epoch_duration, set_payout_shares)

No timelock, no minimum/maximum bounds, no event emission on changes. Admin can set `epoch_duration_ms = 1`, submit a top score (per C-1), and payout instantly. Repeat to drain treasury.

**Note:** This is socially enforced (admin is honest). Acceptable for hackathon, not for production.

**Recommendation:** Add bounds enforcement (minimum epoch duration, maximum fee). Emit events on all config changes. Consider timelock where changes take effect on next epoch.

---

### M-4: Sponsor error messages leak internal details

**Surface:** `workers/sponsor-service/src/index.ts` L172–176
**Status:** ✅ Mitigated (2026-03-14) — Catch block now returns generic "Sponsorship failed. Please try again." to clients; full error logged server-side only.

Raw `err.message` is returned to clients. Sui SDK errors can contain RPC URLs, object IDs, gas coin details, and balance information.

```typescript
const message = err instanceof Error ? err.message : 'Internal error';
return jsonResponse({ error: message }, 500, cors);
```

**Recommendation:** Return a generic error message to clients; log the full error server-side only.

---

### M-5: Silent fallback from sponsored to player-paid gas

**Surface:** `frontend/src/features/auth/hooks/useGameTransaction.ts` L58–89

When sponsorship fails, the code silently falls through to the standard path where the player pays gas. The UI in GamePage.tsx tells the user "gas is sponsored" before execution begins. If the sponsor service is down, the player sees "gas is sponsored" but will be prompted to pay SUI gas.

**Recommendation:** Show a clear notification before falling back to player-paid, or prompt the user to confirm.

---

### M-6: No security headers on Cloudflare Pages frontend

**Surface:** Cloudflare Pages deployment — no `public/_headers` file

No CSP, X-Frame-Options, X-Content-Type-Options, or Strict-Transport-Security configured. The app loads wallet adapters and external RPCs — a CSP would provide defense-in-depth.

**Recommendation:** Add a `public/_headers` file:
```
/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
```

---

### M-7: package-lock.json gitignored — non-deterministic builds

**Surface:** `.gitignore`

Both `frontend/package-lock.json` and `workers/sponsor-service/package-lock.json` exist locally but are gitignored. Other developers and CI/CD get non-deterministic dependency resolution. A supply chain attack could inject a malicious minor/patch version via caret ranges.

**Recommendation:** Remove `package-lock.json` from `.gitignore` and commit both lockfiles.

---

## Low Findings

### L-1: CORS wildcard suffix + localhost in production allowlist

`ALLOWED_ORIGIN_SUFFIXES` allows all `*.flappy-frontier.pages.dev`. `localhost:5173` is in the default origins. Minor hygiene — CORS is not authorization (H-2 is the real issue).

### L-2: Sender address not verified (no ownership proof)

The `sender` field is only format-checked (`0x` prefix). Anyone can create sponsored transactions on behalf of any address, wasting RPC resources.

### L-3: No request body size limit on sponsor service

No explicit Content-Length check. Cloudflare Workers has a 128MB limit, but parsing a huge base64 string allocates significant memory.

### L-4: Entry fee hardcoded in frontend, may diverge from on-chain

`entryFeeAmount: 100_000_000_000` in `contractConfig.ts`. If admin changes the fee on-chain, the UI shows stale info. Not exploitable (contract enforces the real fee).

### L-5: u64 overflow risk in payout math

`total_balance * payout_shares[i]` overflows if treasury balance approaches u64::MAX. Requires ~18.4 billion EVE — practically unreachable but would permanently lock funds.

### L-6: Score of 0 accepted on empty leaderboard

A zero-score entry occupies a leaderboard slot and could receive a payout. Logically unexpected but low economic impact.

### L-7: Unlimited Treasury creation

`init_treasury` can be called multiple times, creating duplicate shared Treasury objects. Could confuse frontends about the authoritative treasury.

### L-8: parseInt without NaN guard on GAS_BUDGET env var

`parseInt(env.GAS_BUDGET, 10)` returns NaN for non-numeric strings. Deployer-controlled config risk only.

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

**Marginally.** The blast radius is limited to testnet SUI (no real money). However, an attacker who discovers the worker URL could drain the sponsor wallet's testnet SUI, disrupting demos. Two minimal hardening steps would make it hackathon-safe:

1. **Add a package ID check** (~20 lines): Deserialize the `TransactionKind`, verify all `MoveCall` commands target the Flappy Frontier package. This prevents arbitrary transaction sponsorship.
2. **Add a simple API key** (~10 lines): Shared secret via `wrangler secret put`, checked via `Authorization: Bearer <token>`. The frontend embeds it as a `VITE_` env var (acceptable for testnet since the key only controls testnet gas spending).

Without these, the worker is an open gas station for anyone who finds the URL.

### What are the biggest risks in the Move contracts?

The single biggest risk is **C-1 + C-2 + H-1 combined**: anyone can submit arbitrary scores without paying an entry fee, and a single player can occupy all leaderboard slots. This means the entire treasury can be drained by a bot at each epoch boundary with zero cost.

The treasury design itself is strong — no admin drain path, trustless distribution, correct epoch enforcement. The weakness is entirely at the score submission boundary.

### What would have to change before stronger production/mainnet confidence?

| Category | Required Change | Effort |
|----------|----------------|--------|
| **Score integrity** | Introduce `RunReceipt` hot-potato binding `start_run` to `submit_score` | Medium |
| **Leaderboard fairness** | Enforce one entry per player per epoch | Small |
| **Sponsor worker** | Full transaction intent validation (package + module + function allowlist) | Small |
| **Sponsor worker** | Replace API key with wallet-signature-based auth | Medium |
| **Sponsor worker** | Rate limiting + daily budget cap | Medium |
| **Admin safety** | Add `store` to AdminCap or explicit transfer function | Small |
| **Admin safety** | Add parameter bounds + timelock on config changes | Medium |
| **Upgrade safety** | Restrict or destroy UpgradeCap, or move to multisig | Small |
| **Score anti-fraud** | Game hash / commit-reveal / off-chain attestation | Large |
| **Error handling** | Sanitize sponsor service error messages | Small |
| **Supply chain** | Commit lockfiles | Trivial |
| **Headers** | Add security headers to Cloudflare Pages | Trivial |
| **Formal verification** | Move Prover for treasury arithmetic and payout logic | Medium |

---

## Future Hardening

### Acceptable for hackathon/testnet

- Open sponsor worker (testnet SUI only, low blast radius)
- AdminCap in single deployer wallet (known party)
- Hardcoded contract addresses and entry fees
- No security headers (testnet dApp, no real assets)
- No rate limiting (testnet only)
- Client-side score — inherent to any client-side game without server validation

### Should fix before broader live usage

- **Sponsor intent validation** — Must restrict to Flappy Frontier package calls. An open gas station is not acceptable beyond testnet.
- **Sponsor authentication** — API key minimum; wallet-signature-based auth preferred.
- **Rate limiting** — Per-sender and global caps on the sponsor service.
- **Leaderboard deduplication** — One entry per player per epoch.
- **RunReceipt** — Bind score submission to entry fee payment.
- **Error message sanitization** — Generic errors to clients, full logs server-side.
- **Commit lockfiles** — Deterministic dependency resolution.
- **Security headers** — CSP, X-Frame-Options, etc.
- **Silent fallback UX** — Notify users before switching from sponsored to player-paid.

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
