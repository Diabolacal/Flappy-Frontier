/// Game module for Flappy Frontier.
/// Orchestrates the ranked game flow: pay entry fee → get chain seed → submit score → trigger payout.
/// Defines events for off-chain indexing: RunStarted, ScoreSubmitted, PayoutExecuted, LeaderboardReset.
module flappy_frontier::game;

use sui::clock::Clock;
use sui::coin::Coin;
use sui::event;
use sui::random::{Random, new_generator};

use flappy_frontier::config::{GameConfig, AdminCap};
use flappy_frontier::leaderboard::Leaderboard;
use flappy_frontier::treasury::Treasury;

// === Errors ===

#[error]
const EReceiptEpochMismatch: vector<u8> = b"RunReceipt is from a different epoch — start a new run";

#[error]
const EReceiptPlayerMismatch: vector<u8> = b"RunReceipt does not belong to the transaction sender";

// === Structs ===

/// Proof that a player paid the entry fee and started a ranked run.
/// Created by `start_run`, consumed by `submit_score` or `discard_receipt`.
/// Has `key` only — cannot be publicly transferred or wrapped.
public struct RunReceipt has key {
    id: UID,
    player: address,
    seed: u256,
    epoch: u64,
}

// === Events ===

/// Emitted when a ranked run starts. Frontend reads the seed from tx events.
public struct RunStartedEvent has copy, drop {
    player: address,
    seed: u256,
    epoch: u64,
    timestamp_ms: u64,
}

/// Emitted alongside RunStartedEvent to provide the receipt object ID.
/// Added in v2 (upgrade-compatible: new struct, original RunStartedEvent unchanged).
public struct RunReceiptCreatedEvent has copy, drop {
    player: address,
    receipt_id: ID,
}

/// Emitted when a score is submitted to the leaderboard.
public struct ScoreSubmittedEvent has copy, drop {
    player: address,
    score: u64,
    run_seed: u256,
    epoch: u64,
    qualified: bool,
}

/// Emitted when a payout is executed at epoch end.
public struct PayoutExecutedEvent has copy, drop {
    epoch: u64,
    num_winners: u64,
    total_distributed: u64,
    timestamp_ms: u64,
}

/// Emitted when the leaderboard is reset after payout.
public struct LeaderboardResetEvent has copy, drop {
    new_epoch: u64,
    timestamp_ms: u64,
}

// === Public Entry Functions ===

/// Start a ranked run: pay entry fee, draw seed from sui::random, issue RunReceipt.
/// The receipt must be consumed by `submit_score` or `discard_receipt`.
///
/// T = coin type (EVE at call site). No compile-time dependency on assets package.
entry fun start_run<T>(
    treasury: &mut Treasury<T>,
    config: &GameConfig,
    payment: &mut Coin<T>,
    rng: &Random,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // Collect entry fee
    let fee_amount = config.entry_fee_amount();
    treasury.pay_entry_fee(payment, fee_amount);

    // Draw seed from on-chain randomness
    let mut generator = new_generator(rng, ctx);
    let seed = generator.generate_u256();

    let timestamp_ms = clock.timestamp_ms();
    let epoch = treasury.current_epoch();
    let player = ctx.sender();

    // Create RunReceipt — proof of paid entry
    let receipt = RunReceipt {
        id: object::new(ctx),
        player,
        seed,
        epoch,
    };
    let receipt_id = object::id(&receipt);

    event::emit(RunStartedEvent {
        player,
        seed,
        epoch,
        timestamp_ms,
    });

    event::emit(RunReceiptCreatedEvent {
        player,
        receipt_id,
    });

    // Transfer receipt to player (owned object — only they can use it)
    transfer::transfer(receipt, player);
}

/// Submit a score to the on-chain leaderboard.
/// Requires a valid RunReceipt from `start_run` — binds submission to fee payment.
/// The receipt is consumed (deleted) regardless of whether the score qualifies.
/// Emits ScoreSubmittedEvent.
///
/// SECURITY: The receipt guarantees the caller paid an entry fee and received a chain seed.
/// The score itself is still player-reported — true proof-of-play is not enforced on-chain.
#[allow(unused_mut_parameter)]
entry fun submit_score<T>(
    leaderboard: &mut Leaderboard,
    treasury: &Treasury<T>,
    receipt: RunReceipt,
    score: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let sender = ctx.sender();
    let epoch = treasury.current_epoch();

    // Validate receipt
    assert!(receipt.player == sender, EReceiptPlayerMismatch);
    assert!(receipt.epoch == epoch, EReceiptEpochMismatch);

    let run_seed = receipt.seed;

    // Consume receipt (delete the owned object)
    let RunReceipt { id, player: _, seed: _, epoch: _ } = receipt;
    id.delete();

    let timestamp_ms = clock.timestamp_ms();

    // Submit to leaderboard (returns whether entry was placed/updated)
    let qualified = leaderboard.submit_score(sender, score, run_seed, timestamp_ms);

    event::emit(ScoreSubmittedEvent {
        player: sender,
        score,
        run_seed,
        epoch,
        qualified,
    });
}

/// Clean up a stale or unwanted RunReceipt without submitting a score.
/// Use this when a run was started but the player doesn't want to submit
/// (e.g., abandoned game, wrong epoch, etc.).
entry fun discard_receipt(receipt: RunReceipt) {
    let RunReceipt { id, player: _, seed: _, epoch: _ } = receipt;
    id.delete();
}

/// Trigger payout at epoch end. ANYONE can call this — no AdminCap needed.
/// Distributes treasury funds to leaderboard winners per payout_shares.
/// Resets leaderboard and advances epoch.
///
/// TRUSTLESS: Public entry function with on-chain rule enforcement.
entry fun trigger_payout<T>(
    treasury: &mut Treasury<T>,
    leaderboard: &mut Leaderboard,
    config: &GameConfig,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let clock_ms = clock.timestamp_ms();
    let epoch = treasury.current_epoch();
    let winners = leaderboard.winner_addresses();
    let num_winners = winners.length();

    // Distribute payout (enforces epoch expiry check internally)
    let mut payouts = treasury.distribute_payout(
        &winners,
        config.payout_shares(),
        clock_ms,
        config.epoch_duration_ms(),
        ctx,
    );

    // Calculate total distributed
    let mut total_distributed = 0u64;
    let mut i = 0;
    while (i < payouts.length()) {
        total_distributed = total_distributed + payouts[i].value();
        i = i + 1;
    };

    // Transfer payout coins to winners
    let num_payouts = payouts.length();
    i = 0;
    while (i < num_payouts) {
        // Remove from back to front to avoid index shifting
        let idx = num_payouts - 1 - i;
        let winner_addr = winners[idx];
        let payout_coin = payouts.swap_remove(idx);
        transfer::public_transfer(payout_coin, winner_addr);
        i = i + 1;
    };
    payouts.destroy_empty();

    event::emit(PayoutExecutedEvent {
        epoch,
        num_winners,
        total_distributed,
        timestamp_ms: clock_ms,
    });

    // Reset leaderboard
    leaderboard.reset();

    let new_epoch = treasury.current_epoch();
    event::emit(LeaderboardResetEvent {
        new_epoch,
        timestamp_ms: clock_ms,
    });
}

// === Package Init ===

/// Initialize the treasury for a specific coin type.
/// Must be called once after package publish to create the shared Treasury<T>.
/// Requires AdminCap to prevent spurious treasury creation.
/// Uses Clock for initial epoch start timestamp.
entry fun init_treasury<T>(_: &AdminCap, clock: &Clock, ctx: &mut TxContext) {
    let epoch_start_ms = clock.timestamp_ms();
    flappy_frontier::treasury::create<T>(epoch_start_ms, ctx);
}

// === Test Helpers ===

#[test_only]
public fun create_receipt_for_testing(
    player: address,
    seed: u256,
    epoch: u64,
    ctx: &mut TxContext,
): RunReceipt {
    RunReceipt {
        id: object::new(ctx),
        player,
        seed,
        epoch,
    }
}

#[test_only]
public fun destroy_receipt_for_testing(receipt: RunReceipt) {
    let RunReceipt { id, player: _, seed: _, epoch: _ } = receipt;
    id.delete();
}

#[test_only]
public fun submit_score_for_testing<T>(
    leaderboard: &mut Leaderboard,
    treasury: &Treasury<T>,
    receipt: RunReceipt,
    score: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    submit_score(leaderboard, treasury, receipt, score, clock, ctx);
}

#[test_only]
public fun discard_receipt_for_testing(receipt: RunReceipt) {
    discard_receipt(receipt);
}
