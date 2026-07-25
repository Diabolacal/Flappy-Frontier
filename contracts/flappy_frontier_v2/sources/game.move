/// Game flow for Flappy Frontier (v2, cycle-agnostic).
///
/// Flow: `start_run` (draws the week seed, mints a RunTicket) → play off-chain →
/// `submit_score` (consumes the ticket, inserts into the weekly Board).
///
/// ECONOMICS: none. No entry fee, no prize pool, no payouts. `Coin`, `Balance`
/// and generic type parameters appear nowhere in this package, so it is immune to
/// EVE cycle rollovers (which reissue coin types) and never needs republishing.
/// Revives are purchased through a separate Frontier Commerce package; only the
/// resulting *count* is reported here, bounded by `Board.max_revives`.
///
/// The week rolls lazily: the first `start_run` of a new week finalises the
/// previous week (emitting the full table) and reseeds. No cron, no admin action.
module flappy_frontier_v2::game;

use sui::clock::Clock;
use sui::event;
use sui::random::{Random, new_generator};

use flappy_frontier_v2::board::{Self, Board, Entry};

// === Errors ===

#[error]
const ETicketPlayerMismatch: vector<u8> = b"RunTicket does not belong to the transaction sender";

#[error]
const ERulesetMismatch: vector<u8> = b"Ruleset version does not match the ticket and the board";

#[error]
const ETicketWeekMismatch: vector<u8> = b"RunTicket is from a previous week — start a new run";

#[error]
const EScoreAboveCeiling: vector<u8> = b"Score exceeds the board score ceiling";

#[error]
const ETooManyRevives: vector<u8> = b"Revive count exceeds the board revive cap";

#[error]
const EImplausibleDuration: vector<u8> = b"Run was too short for the reported score";

// === Structs ===

/// Proof that a player started a ranked run in a specific week, with the seed
/// that week's board was drawn with. Created by `start_run`, consumed by
/// `submit_score` or `discard_ticket`.
///
/// `key` only — no `store`, so it cannot be publicly transferred, wrapped or
/// traded. A ticket is worthless to anyone but the address it was minted to.
public struct RunTicket has key {
    id: UID,
    player: address,
    week_index: u64,
    seed: u256,
    started_at_ms: u64,
    ruleset_version: u16,
}

// === Events ===

/// Emitted when a new leaderboard week begins (lazy roll inside `start_run`).
public struct WeekStartedEvent has copy, drop {
    week_index: u64,
    seed: u256,
    started_at_ms: u64,
}

/// Emitted when the previous week is closed out, carrying the full final table
/// so indexers get an immutable record before the board is cleared.
public struct WeekFinalizedEvent has copy, drop {
    week_index: u64,
    entries: vector<Entry>,
    finalized_at_ms: u64,
}

/// Emitted when a ranked run starts. Frontend reads the week seed from here.
public struct RunStartedEvent has copy, drop {
    player: address,
    week_index: u64,
    seed: u256,
    started_at_ms: u64,
}

/// Emitted alongside `RunStartedEvent` carrying the ticket's object ID.
/// CRITICAL: the frontend cannot locate the freshly minted owned object without
/// this. The v1 package shipped `start_run` without it and lost days of
/// debugging to "RunTicketCreatedEvent not found in transaction events".
public struct RunTicketCreatedEvent has copy, drop {
    player: address,
    ticket_id: ID,
}

/// Emitted for every submission, qualifying or not.
public struct ScoreSubmittedEvent has copy, drop {
    player: address,
    score: u64,
    revive_count: u16,
    week_index: u64,
    week_seed: u256,
    timestamp_ms: u64,
    qualified: bool,
}

/// Emitted when a player throws away an unused ticket.
public struct RunDiscardedEvent has copy, drop {
    player: address,
    ticket_id: ID,
    week_index: u64,
}

// === Entry Points ===

/// Start a ranked run.
///
/// Private `entry` — required by Sui: functions taking `&Random` must not be
/// callable from other Move code (composition would let an attacker observe the
/// draw and abort the transaction).
///
/// Rolls the week first if the clock has moved past `board.week_index`, then
/// mints a `RunTicket` bound to the sender, the current week and the week seed.
entry fun start_run(board: &mut Board, r: &Random, clock: &Clock, ctx: &mut TxContext) {
    let now = clock.timestamp_ms();

    // --- Lazy week roll ---
    let w = board::week_index_at(now);
    if (w != board.week_index()) {
        event::emit(WeekFinalizedEvent {
            week_index: board.week_index(),
            entries: board.snapshot_entries(),
            finalized_at_ms: now,
        });

        let mut generator = new_generator(r, ctx);
        let seed = generator.generate_u256();
        board.roll_week(w, seed);

        event::emit(WeekStartedEvent {
            week_index: w,
            seed,
            started_at_ms: now,
        });
    };

    // --- Mint ticket ---
    let player = ctx.sender();
    let ticket = RunTicket {
        id: object::new(ctx),
        player,
        week_index: board.week_index(),
        seed: board.week_seed(),
        started_at_ms: now,
        ruleset_version: board.ruleset_version(),
    };
    let ticket_id = object::id(&ticket);

    event::emit(RunStartedEvent {
        player,
        week_index: ticket.week_index,
        seed: ticket.seed,
        started_at_ms: now,
    });

    event::emit(RunTicketCreatedEvent { player, ticket_id });

    transfer::transfer(ticket, player);
}

/// Submit a score against the ticket's week.
///
/// The ticket is consumed either way; the board is only written if the score
/// qualifies. Every rejection reason has its own error code so the frontend can
/// tell the player exactly what happened.
public fun submit_score(
    board: &mut Board,
    ticket: RunTicket,
    score: u64,
    revive_count: u16,
    ruleset_version: u16,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let now = clock.timestamp_ms();
    let sender = ctx.sender();

    // (1) The ticket must belong to the caller.
    assert!(ticket.player == sender, ETicketPlayerMismatch);

    // (2) Client, ticket and board must all agree on the gameplay ruleset.
    assert!(
        ruleset_version == ticket.ruleset_version && ruleset_version == board.ruleset_version(),
        ERulesetMismatch,
    );

    // (3) The ticket must be for the week the board is currently on. A submission
    //     arriving after someone else rolled the board is rejected; one arriving
    //     before the roll correctly lands on the ticket's own week.
    assert!(ticket.week_index == board.week_index(), ETicketWeekMismatch);

    // (4) Score ceiling.
    assert!(score <= board.max_score(), EScoreAboveCeiling);

    // (5) Revive cap.
    assert!(revive_count <= board.max_revives(), ETooManyRevives);

    // (6) Duration plausibility: the run cannot have been faster than the game
    //     engine physically allows for the claimed score.
    assert!(
        now - ticket.started_at_ms >= score * board.min_ms_per_point(),
        EImplausibleDuration,
    );

    let week_index = ticket.week_index;
    let week_seed = ticket.seed;

    // Consume the ticket.
    let RunTicket {
        id,
        player: _,
        week_index: _,
        seed: _,
        started_at_ms: _,
        ruleset_version: _,
    } = ticket;
    id.delete();

    let qualified = board.insert_entry(sender, score, revive_count, now, ruleset_version);

    event::emit(ScoreSubmittedEvent {
        player: sender,
        score,
        revive_count,
        week_index,
        week_seed,
        timestamp_ms: now,
        qualified,
    });
}

/// Throw away an unused ticket (abandoned run, stale week, wrong ruleset).
entry fun discard_ticket(ticket: RunTicket) {
    let ticket_id = object::id(&ticket);
    let RunTicket {
        id,
        player,
        week_index,
        seed: _,
        started_at_ms: _,
        ruleset_version: _,
    } = ticket;
    id.delete();

    event::emit(RunDiscardedEvent { player, ticket_id, week_index });
}

// === Views ===

public fun ticket_player(ticket: &RunTicket): address { ticket.player }

public fun ticket_week_index(ticket: &RunTicket): u64 { ticket.week_index }

public fun ticket_seed(ticket: &RunTicket): u256 { ticket.seed }

public fun ticket_started_at_ms(ticket: &RunTicket): u64 { ticket.started_at_ms }

public fun ticket_ruleset_version(ticket: &RunTicket): u16 { ticket.ruleset_version }

// === Test Helpers ===

#[test_only]
public fun start_run_for_testing(
    board: &mut Board,
    r: &Random,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    start_run(board, r, clock, ctx);
}

#[test_only]
public fun discard_ticket_for_testing(ticket: RunTicket) {
    discard_ticket(ticket);
}

#[test_only]
public fun create_ticket_for_testing(
    player: address,
    week_index: u64,
    seed: u256,
    started_at_ms: u64,
    ruleset_version: u16,
    ctx: &mut TxContext,
): RunTicket {
    RunTicket {
        id: object::new(ctx),
        player,
        week_index,
        seed,
        started_at_ms,
        ruleset_version,
    }
}
