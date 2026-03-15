/// Treasury module for Flappy Frontier.
/// Generic `Treasury<phantom T>` holds entry fees as `Balance<T>`.
/// NO admin withdrawal path. Funds only leave via rule-driven payout.
module flappy_frontier::treasury;

use sui::balance::{Self, Balance};
use sui::coin::{Self, Coin};

// === Errors ===

#[error]
const EInsufficientPayment: vector<u8> = b"Payment coin has insufficient balance for entry fee";

#[error]
const EEpochNotExpired: vector<u8> = b"Cannot trigger payout before epoch has expired";

// === Structs ===

/// Shared treasury holding entry fees. Generic over coin type T.
/// At runtime, T = EVE coin type. No compile-time dependency on assets package.
///
/// TRUSTLESS GUARANTEES:
/// - No withdraw/drain function exists in this module or package.
/// - AdminCap cannot move funds from this treasury.
/// - Funds leave ONLY via trigger_payout() to leaderboard winners.
/// - Balance is publicly readable on-chain.
public struct Treasury<phantom T> has key {
    id: UID,
    balance: Balance<T>,
    epoch_start_ms: u64,
    current_epoch: u64,
}

// === Init ===

/// Create a new shared Treasury. Called during package init.
public(package) fun create<T>(epoch_start_ms: u64, ctx: &mut TxContext) {
    let treasury = Treasury<T> {
        id: object::new(ctx),
        balance: balance::zero<T>(),
        epoch_start_ms,
        current_epoch: 1,
    };
    transfer::share_object(treasury);
}

// === Public View ===

/// Returns the current treasury balance value.
public fun balance_value<T>(treasury: &Treasury<T>): u64 {
    treasury.balance.value()
}

/// Returns the epoch start timestamp in milliseconds.
public fun epoch_start_ms<T>(treasury: &Treasury<T>): u64 {
    treasury.epoch_start_ms
}

/// Returns the current epoch number.
public fun current_epoch<T>(treasury: &Treasury<T>): u64 {
    treasury.current_epoch
}

// === Entry Fee Collection ===

/// Collect entry fee from a player's coin. Splits exact fee amount,
/// deposits to treasury, and returns change coin to caller.
/// The change coin is returned (not self-transferred) for PTB composability.
public(package) fun pay_entry_fee<T>(
    treasury: &mut Treasury<T>,
    payment: &mut Coin<T>,
    fee_amount: u64,
) {
    assert!(payment.value() >= fee_amount, EInsufficientPayment);
    let fee_balance = payment.balance_mut().split(fee_amount);
    treasury.balance.join(fee_balance);
}

// === Payout Distribution ===

/// Distribute treasury funds to winners per payout_shares.
/// Anyone can call this once the epoch has expired.
/// Returns a vector of (address, coin) pairs for the PTB to transfer.
///
/// winners: addresses of leaderboard leaders, in ranked order
/// payout_shares: percentage shares (must sum to 100), from GameConfig
/// clock_ms: current timestamp from sui::clock::Clock
/// epoch_duration_ms: from GameConfig
///
/// TRUSTLESS: Package-internal function — only callable from game.move's trigger_payout.
public(package) fun distribute_payout<T>(
    treasury: &mut Treasury<T>,
    winners: &vector<address>,
    payout_shares: &vector<u64>,
    clock_ms: u64,
    epoch_duration_ms: u64,
    ctx: &mut TxContext,
): vector<Coin<T>> {
    // Verify epoch has expired
    let epoch_end_ms = treasury.epoch_start_ms + epoch_duration_ms;
    assert!(clock_ms >= epoch_end_ms, EEpochNotExpired);

    let num_winners = winners.length();

    // Zero entries: no payout, just advance epoch on the fixed grid
    if (num_winners == 0) {
        treasury.current_epoch = treasury.current_epoch + 1;
        treasury.epoch_start_ms = epoch_end_ms;
        return vector[]
    };

    let total_balance = treasury.balance.value();
    let shares_count = payout_shares.length();

    // Distribute to each winner up to min(num_winners, shares_count)
    let pay_count = if (num_winners < shares_count) { num_winners } else { shares_count };

    // Calculate active shares sum (shares allocated to actual winners)
    let mut active_shares_sum = 0u64;
    let mut i = 0;
    while (i < pay_count) {
        active_shares_sum = active_shares_sum + payout_shares[i];
        i = i + 1;
    };

    // Distribute proportionally to active winners based on their share of the active pool
    let mut payouts: vector<Coin<T>> = vector[];
    let mut distributed = 0u64;
    i = 0;
    while (i < pay_count) {
        let amount = if (i == pay_count - 1) {
            // Last winner gets remainder to avoid rounding dust
            total_balance - distributed
        } else {
            (total_balance * payout_shares[i]) / active_shares_sum
        };
        let payout_balance = treasury.balance.split(amount);
        payouts.push_back(coin::from_balance(payout_balance, ctx));
        distributed = distributed + amount;
        i = i + 1;
    };

    // When fewer winners than share slots exist, the full balance is distributed
    // proportionally among actual winners (not just their nominal share percentage).
    // The last winner receives the remainder to avoid rounding dust.

    // Advance epoch on fixed grid (no drift regardless of when payout is triggered)
    treasury.current_epoch = treasury.current_epoch + 1;
    treasury.epoch_start_ms = epoch_end_ms;

    payouts
}

// === Test Helpers ===

#[test_only]
public fun create_for_testing<T>(epoch_start_ms: u64, ctx: &mut TxContext): Treasury<T> {
    Treasury<T> {
        id: object::new(ctx),
        balance: balance::zero<T>(),
        epoch_start_ms,
        current_epoch: 1,
    }
}

#[test_only]
public fun destroy_for_testing<T>(treasury: Treasury<T>) {
    let Treasury { id, balance, epoch_start_ms: _, current_epoch: _ } = treasury;
    balance.destroy_zero();
    id.delete();
}

#[test_only]
public fun destroy_with_balance_for_testing<T>(treasury: Treasury<T>): Balance<T> {
    let Treasury { id, balance, epoch_start_ms: _, current_epoch: _ } = treasury;
    id.delete();
    balance
}
