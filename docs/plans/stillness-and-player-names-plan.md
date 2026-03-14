# Stillness Migration + Player Name Resolution — Implementation Plan

**Retention:** Carry-forward  
**Date:** 2026-03-14  
**Branch:** `feat/stillness-and-player-names`  
**Status:** Steps 1–7 complete. Stillness live with weekly epochs and player name resolution.  
**Risk class:** Medium (config retarget + contract redeploy + new feature, but no core game loop changes)

---

## 0. Objective

Move Flappy Frontier from Utopia validation context to Stillness live-server context, and replace raw wallet addresses with player names (EVE Frontier character names) where possible.

---

## 1. What Is Currently Utopia-Specific

All Utopia-specific values are isolated in **one file**: `frontend/src/lib/contractConfig.ts`.

| Field | Current (Utopia) Value | Stillness Change |
|-------|----------------------|-----------------|
| `packageId` | `0xa23c94bd...` | New publish → new ID |
| `adminCapId` | `0x78d4b07d...` | New publish → new ID |
| `gameConfigId` | `0xb46195f1...` | New publish → new ID |
| `treasuryId` | `0xe9aa35d0...` | New `init_treasury<StillnessEVE>` → new ID |
| `leaderboardId` | `0xff84ea77...` | New publish → new ID |
| `upgradeCapId` | `0xfb8e9a60...` | New publish → new ID |
| `eveCoinType` | `0xf044...::EVE::EVE` | `0x2a66a89b5a735738ffa4423ac024d23571326163f324f9051557617319e59d60::EVE::EVE` |
| `epochDurationMs` | `600_000` (10 min) | Keep 10 min initially for live validation; extend later |
| `entryFeeAmount` | `100_000_000_000` (100 EVE) | Review — may want different for production |
| `network` | `testnet` | Same (both Utopia and Stillness are Sui testnet) |
| `rpcUrl` | `https://fullnode.testnet.sui.io:443` | Same |

**Other files with Utopia annotations (reference only, no functional coupling):**
- `docs/plans/flappy-frontier-chain-integration-plan.md` §9 — Utopia context section
- `contracts/flappy_frontier/Published.toml` — auto-generated, will be overwritten by publish

**No code changes are required** — the Move contracts are fully generic (`Treasury<phantom T>`), the frontend reads all IDs from `CONTRACT_CONFIG`, and the sponsor service is coin-type-agnostic.

---

## 2. Stillness Config: Resolved

| Item | Value | Source |
|------|-------|--------|
| **Stillness World Package** | `0x28b497559d65ab320d9da4613bf2498d5946b2c0ae3597ccfda3072ce127448c` | `vendor/world-contracts/contracts/world/Published.toml` |
| **Stillness Object Registry** | `0x454a9aa3d37e1d08d3c9181239c1b683781e4087fbbbd48c935d54b6736fd05c` | Previously recorded in chain integration plan §4 |
| **Stillness AdminACL** | `0x8ca0e61465f94e60f9c2daff9566edfe17aa272215d9c924793d2721b3477f93` | Previously recorded in chain integration plan §4 |
| **Stillness EVE Coin Type** | `0x2a66a89b5a735738ffa4423ac024d23571326163f324f9051557617319e59d60::EVE::EVE` | `@evefrontier/dapp-kit@0.1.7` `TENANT_CONFIG['stillness'].evePackageId` |
| **Stillness Datahub Host** | `world-api-stillness.live.tech.evefrontier.com` | `@evefrontier/dapp-kit@0.1.7` `TENANT_CONFIG['stillness'].datahubHost` |
| **Chain ID** | `4c78adac` (Sui Testnet) | Same as Utopia |
| **RPC URL** | `https://fullnode.testnet.sui.io:443` | Same as Utopia |

---

## 3. Contract Redeploy: Required but Trivial

**Yes, a contract redeploy on Stillness is required.** Here's why:

- The `Treasury<T>` shared object is parameterized by coin type at creation time. A `Treasury<UtopiaEVE>` cannot become a `Treasury<StillnessEVE>`.
- `GameConfig`, `Leaderboard`, and `AdminCap` are created at publish time — fresh publish means fresh objects.
- The Move source code does **not** change. It's an identical republish.

**Deploy sequence:**
```bash
# 1. Publish (from repo root)
sui client publish contracts/flappy_frontier
# → Record: PackageID, AdminCap, GameConfig, Leaderboard, UpgradeCap

# 2. Init Treasury with Stillness EVE type
sui client call --module game --function init_treasury \
  --type-args 0x2a66a89b5a735738ffa4423ac024d23571326163f324f9051557617319e59d60::EVE::EVE \
  --args <NEW_ADMIN_CAP_ID> 0x6
# → Record: TreasuryID
```

**Prerequisite:** Deployer wallet must have testnet SUI for gas. Same deployer wallet works (Utopia and Stillness share Sui testnet).

---

## 4. Player Name Resolution: Recommended Approach

### Source of Truth

Player names are **on-chain** in the EVE Frontier `Character` object:

```move
// vendor/world-contracts/contracts/world/sources/character/character.move
public struct Character has key {
    id: UID,
    key: TenantItemId,
    tribe_id: u32,
    character_address: address,
    metadata: Option<Metadata>,  // ← contains name
    owner_cap_id: ID,
}

public struct PlayerProfile has key {
    id: UID,
    character_id: ID,  // → points to Character
}
```

The name lives in `Character.metadata.name` (a `String` field in the `Metadata` struct).

### Resolution Flow (wallet address → character name)

**Two RPC calls per address:**

1. **Find `PlayerProfile` owned by address:**
   ```typescript
   suiClient.getOwnedObjects({
     owner: walletAddress,
     filter: { StructType: `${WORLD_PACKAGE_ID}::character::PlayerProfile` },
     options: { showContent: true },
   });
   // → extract character_id from first result
   ```

2. **Fetch `Character` object by ID:**
   ```typescript
   suiClient.getObject({
     id: characterId,
     options: { showContent: true },
   });
   // → extract metadata.fields.name
   ```

The `WORLD_PACKAGE_ID` for Stillness is `0x28b497559d65ab320d9da4613bf2498d5946b2c0ae3597ccfda3072ce127448c`.

### Why This Is the Right Path

- **No off-chain API exists** for player names — no indexer endpoint, no GraphQL query specifically for names.
- **`@evefrontier/dapp-kit`** has `getAssemblyWithOwner()` but it's assembly-focused, not leaderboard-usable.
- **SuiNS** is not integrated in EVE Frontier.
- Direct RPC is the only reliable path, and it's 2 calls per address.

### Caching Strategy

- **In-memory `Map<string, { name: string | null; fetchedAt: number }>`** in a React context or module-level cache.
- **TTL: 5 minutes** — character names rarely change (requires on-chain tx with OwnerCap).
- **Batch resolution** — when loading leaderboard, resolve all unique player addresses in parallel (max 10 entries × 2 calls = 20 RPC calls, parallelizable).
- **Lazy loading** — render shortened addresses immediately, replace with names once resolved. Avoids blocking the leaderboard render.

### Fallback

```
Priority:
1. Character.metadata.name → "frontier-pilot-7"
2. Shortened address → "0x1234…abcd"
```

**Not all addresses will have a `Character`.** Only players who have created an EVE Frontier in-game character will have one. Players who connect via Eve Vault or a standard Sui wallet (without playing EVE Frontier itself) will not. The fallback to shortened address is essential and must be the default rendering state.

### Where Names Should Appear

| Location | Current | After |
|----------|---------|-------|
| **Leaderboard rows** | `shortenAddress(entry.player)` in `LeaderboardPanel.tsx` | Character name with address fallback |
| **Connected player badge** | `playerAddress.slice(0, 6)…slice(-4)` in `StartScreen.tsx` | Character name with address fallback |
| **`usePlayerIdentity` hook** | `displayName` = shortened address | Resolve character name on mount |

There are exactly 3 locations, all using the same `slice(0,6)…slice(-4)` pattern (duplicated, not shared).

### Implementation Shape

1. **New utility:** `frontend/src/lib/playerNames.ts` — cache + `resolvePlayerName()` function
2. **New hook:** `frontend/src/features/auth/hooks/usePlayerName.ts` — wrapper for React components
3. **Update:** `usePlayerIdentity.ts` — integrate name resolution for connected player
4. **Update:** `LeaderboardPanel.tsx` — resolve names for all leaderboard entries
5. **Update:** `StartScreen.tsx` — use resolved name from `usePlayerIdentity`

---

## 5. Recommended Implementation Order

### Step 1: Stillness Config Preparation (Low risk)
- Add `worldPackageId` to `contractConfig.ts` (needed for name resolution)
- Document Stillness EVE coin type and world package ID
- Validate deployer wallet has testnet SUI

### Step 2: Contract Publish on Stillness (Medium risk)
- `sui client publish contracts/flappy_frontier`
- `init_treasury<StillnessEVE>`
- Record all new object IDs

### Step 3: Frontend Config Retarget (Low risk)
- Update `contractConfig.ts` with all Stillness object IDs and EVE type
- Keep `epochDurationMs: 600_000` (10 min) for initial validation

### Step 4: Live Validation with Short Epoch (Medium risk)
- Deploy to Cloudflare Pages preview
- End-to-end test: connect wallet → practice → ranked entry (with Stillness EVE) → score submission → leaderboard → epoch expiry → payout
- Confirm sponsor service works against Stillness context

### Step 5: Player Name Resolution (Medium risk) — ✅ DONE
- Implemented `playerNames.ts` cache + resolver (`SuiJsonRpcClient` → PlayerProfile → Character → metadata.name, 5-min cache TTL)
- Implemented `usePlayerName` / `usePlayerNames` hooks
- Wired into `GamePage` (connected player), `StartScreen` (player badge), `LeaderboardPanel` (all entries)
- Replaced duplicate `shortenAddress` in LeaderboardPanel with shared `formatPlayerDisplay` from `playerNames.ts`

### Step 6: Shared Address Utility Cleanup (Low risk) — ✅ DONE
- `shortenAddress` and `formatPlayerDisplay` live in `frontend/src/lib/playerNames.ts`
- LeaderboardPanel imports from shared utility; duplicate removed

### Step 7: Extend Epoch Duration (Low risk) — ✅ DONE
- On-chain: admin tx `9U9toi4i6XRZE7hsrCucCg1sLnJnbvaRnVBrkTyRtRM3` set `epoch_duration_ms` to 604,800,000 (7 days) on GameConfig
- Frontend: `contractConfig.ts` `epochDurationMs` updated to `604_800_000`
- LeaderboardPanel `epochTimeState()` updated to display days/hours/minutes for weekly scale

### Why This Order

- Steps 1–4 get Stillness working with **no new features** — pure retarget + validation.
- Step 5 adds name resolution only after the chain context is confirmed working on Stillness. Name resolution queries the Stillness world package, so it must correspond to the right tenant.
- Step 6 is cleanup.
- Step 7 is parameter tuning after validation.

---

## 6. Blockers and Unknowns

| Item | Status | Resolution |
|------|--------|------------|
| **Stillness EVE coin type** | ✅ Resolved | `0x2a66a89b5a735738ffa4423ac024d23571326163f324f9051557617319e59d60::EVE::EVE` |
| **Stillness world package ID** | ✅ Resolved | `0x28b497559d65ab320d9da4613bf2498d5946b2c0ae3597ccfda3072ce127448c` |
| **Deployer has testnet SUI** | ✅ Verified | ~1.22 SUI remaining after publish+init |
| **Deployer has Stillness EVE** | ⬜ Verify | Needed for ranked testing on Stillness; may need to acquire via gameplay or transfer |
| **Character struct field access** | ✅ Confirmed | `metadata` is `Option<Metadata>`, accessed via `getObject()` with `showContent: true` |
| **PlayerProfile type string** | ✅ Resolved | `0x28b497...::character::PlayerProfile` |
| **Name resolution performance** | Low risk | 20 RPC calls for full leaderboard (10 entries × 2 calls), all parallelizable. Cache mitigates repeat loads. |
| **Entry fee amount for Stillness** | ⬜ Decision needed | Keep 100 EVE or adjust? Can be changed post-deploy via AdminCap. |

### No Blockers for Starting Steps 1–3

The only blocker before Step 4 (live validation) is confirming the deployer wallet has testnet SUI and Stillness EVE for testing. Steps 1–3 are pure config + publish operations.

---

## 7. What Docs Are Stale

| Doc | Issue | Action |
|-----|-------|--------|
| `chain-integration-plan.md` §9 | Says "Do not publish contracts to Stillness during development" | Update after Stillness publish |
| `chain-integration-plan.md` §7 | Lists Stillness deployment as "deferred" | Promote to "active" |
| `chain-integration-plan.md` §4 | Stillness EVE type listed as "Not needed until Stillness deployment" | Update with resolved type |
| `decision-log.md` | No entry for Stillness migration | Add entry after deploy |
| `game-mvp-plan.md` | No mention of Stillness | Not needed — game code unchanged |

---

## 8. Appendix: Stillness Reference Constants

```
# Stillness (live server) — Sui Testnet
World Package:   0x28b497559d65ab320d9da4613bf2498d5946b2c0ae3597ccfda3072ce127448c
Object Registry: 0x454a9aa3d37e1d08d3c9181239c1b683781e4087fbbbd48c935d54b6736fd05c
AdminACL:        0x8ca0e61465f94e60f9c2daff9566edfe17aa272215d9c924793d2721b3477f93
EVE Coin Type:   0x2a66a89b5a735738ffa4423ac024d23571326163f324f9051557617319e59d60::EVE::EVE
Datahub Host:    world-api-stillness.live.tech.evefrontier.com
Chain ID:        4c78adac (Sui Testnet)
RPC URL:         https://fullnode.testnet.sui.io:443
```
