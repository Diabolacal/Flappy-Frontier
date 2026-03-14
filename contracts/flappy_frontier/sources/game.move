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

// === Events ===

/// Emitted when a ranked run starts. Frontend reads the seed from tx events.
public struct RunStartedEvent has copy, drop {
    player: address,
    seed: u256,
    epoch: u64,
    timestamp_ms: u64,
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

/// Start a ranked run: pay entry fee, draw seed from sui::random.
/// Returns change coin via PTB. Emits RunStartedEvent with the seed.
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

    event::emit(RunStartedEvent {
        player: ctx.sender(),
        seed,
        epoch,
        timestamp_ms,
    });
}

/// Submit a score to the on-chain leaderboard.
/// Emits ScoreSubmittedEvent. Aborts if score doesn't qualify (checked by leaderboard module).
#[allow(unused_mut_parameter)]
entry fun submit_score<T>(
    leaderboard: &mut Leaderboard,
    treasury: &Treasury<T>,
    score: u64,
    run_seed: u256,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let timestamp_ms = clock.timestamp_ms();
    let epoch = treasury.current_epoch();
    let qualified = leaderboard.qualifies(score, timestamp_ms);

    leaderboard.submit_score(ctx.sender(), score, run_seed, timestamp_ms);

    event::emit(ScoreSubmittedEvent {
        player: ctx.sender(),
        score,
        run_seed,
        epoch,
        qualified,
    });
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
