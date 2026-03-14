/// Configuration module for Flappy Frontier.
/// Defines AdminCap (narrowly scoped to parameter adjustment — no fund movement),
/// GameConfig shared object with epoch and fee parameters, and init logic.
module flappy_frontier::config;

// === Errors ===

#[error]
const EInvalidEntryFee: vector<u8> = b"Entry fee must be greater than zero";

#[error]
const EInvalidEpochDuration: vector<u8> = b"Epoch duration must be greater than zero";

#[error]
const EInvalidPayoutShares: vector<u8> = b"Payout shares must not be empty and must sum to 100";

// === Constants ===

/// Default entry fee: 100 EVE (9 decimals) = 100_000_000_000 base units
const DEFAULT_ENTRY_FEE: u64 = 100_000_000_000;

/// Default epoch duration: 10 minutes (600_000 ms) for testnet validation.
/// Production would use 604_800_000 ms (7 days).
const DEFAULT_EPOCH_DURATION_MS: u64 = 600_000;

/// Default payout shares: top 3 get 50/30/20
const DEFAULT_PAYOUT_SHARE_1: u64 = 50;
const DEFAULT_PAYOUT_SHARE_2: u64 = 30;
const DEFAULT_PAYOUT_SHARE_3: u64 = 20;

/// Maximum leaderboard size
const MAX_LEADERBOARD_SIZE: u64 = 10;

// === Structs ===

/// Capability for parameter adjustment only.
/// AdminCap grants NO ability to withdraw, redirect, or drain treasury funds.
/// Scoped exclusively to: adjusting entry_fee_amount, epoch_duration_ms, payout_shares.
public struct AdminCap has key {
    id: UID,
}

/// Shared configuration object holding game parameters.
public struct GameConfig has key {
    id: UID,
    entry_fee_amount: u64,
    epoch_duration_ms: u64,
    payout_shares: vector<u64>,
    max_leaderboard_size: u64,
}

// === Init ===

fun init(ctx: &mut TxContext) {
    let admin_cap = AdminCap { id: object::new(ctx) };
    transfer::transfer(admin_cap, ctx.sender());

    let config = GameConfig {
        id: object::new(ctx),
        entry_fee_amount: DEFAULT_ENTRY_FEE,
        epoch_duration_ms: DEFAULT_EPOCH_DURATION_MS,
        payout_shares: vector[DEFAULT_PAYOUT_SHARE_1, DEFAULT_PAYOUT_SHARE_2, DEFAULT_PAYOUT_SHARE_3],
        max_leaderboard_size: MAX_LEADERBOARD_SIZE,
    };
    transfer::share_object(config);

    // Create the leaderboard shared object
    flappy_frontier::leaderboard::create(MAX_LEADERBOARD_SIZE, ctx);
}

// === Public View ===

/// Returns the configured entry fee amount.
public fun entry_fee_amount(config: &GameConfig): u64 {
    config.entry_fee_amount
}

/// Returns the configured epoch duration in milliseconds.
public fun epoch_duration_ms(config: &GameConfig): u64 {
    config.epoch_duration_ms
}

/// Returns the payout shares vector.
public fun payout_shares(config: &GameConfig): &vector<u64> {
    &config.payout_shares
}

/// Returns the maximum leaderboard size.
public fun max_leaderboard_size(config: &GameConfig): u64 {
    config.max_leaderboard_size
}

// === Admin (parameter adjustment only — no fund movement) ===

/// Update the entry fee amount. AdminCap required.
/// This does NOT move any existing funds — it only changes the fee for future entries.
public fun set_entry_fee(_: &AdminCap, config: &mut GameConfig, new_fee: u64) {
    assert!(new_fee > 0, EInvalidEntryFee);
    config.entry_fee_amount = new_fee;
}

/// Update the epoch duration. AdminCap required.
/// This changes the duration for the NEXT epoch, not the current one.
public fun set_epoch_duration(_: &AdminCap, config: &mut GameConfig, new_duration_ms: u64) {
    assert!(new_duration_ms > 0, EInvalidEpochDuration);
    config.epoch_duration_ms = new_duration_ms;
}

/// Update payout shares. AdminCap required. Shares must sum to 100.
public fun set_payout_shares(_: &AdminCap, config: &mut GameConfig, new_shares: vector<u64>) {
    assert!(!new_shares.is_empty(), EInvalidPayoutShares);
    let mut sum = 0u64;
    let mut i = 0;
    while (i < new_shares.length()) {
        sum = sum + new_shares[i];
        i = i + 1;
    };
    assert!(sum == 100, EInvalidPayoutShares);
    config.payout_shares = new_shares;
}

// === Test Helpers ===

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(ctx);
}

#[test_only]
public fun default_entry_fee(): u64 {
    DEFAULT_ENTRY_FEE
}

#[test_only]
public fun default_epoch_duration_ms(): u64 {
    DEFAULT_EPOCH_DURATION_MS
}
