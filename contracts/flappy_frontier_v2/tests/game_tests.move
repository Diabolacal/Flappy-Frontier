#[test_only]
/// Tests for the game flow: start_run / submit_score / discard_ticket,
/// every rejection path, and the lazy week rollover.
module flappy_frontier_v2::game_tests;

use sui::clock::{Self, Clock};
use sui::event;
use sui::random::{Self, Random};
use sui::test_scenario::{Self, Scenario};

use flappy_frontier_v2::board::{Self, Board};
use flappy_frontier_v2::game::{Self, RunTicket};

const PLAYER: address = @0xA11CE;
const OTHER: address = @0xB0B;

/// 2026-07-25T00:00:00Z — exactly the start of leaderboard week 2951.
const T0: u64 = 1_785_024_000_000;
const WEEK_2951: u64 = 2951;
const WEEK_MS: u64 = 604_800_000;

const RS: u16 = 1;

// === Fixtures ===

/// Publish the board, share the Random object and seed it, then hand the
/// scenario over with `sender` active.
fun setup(sender: address): Scenario {
    let mut sc = test_scenario::begin(@0x0);
    random::create_for_testing(sc.ctx());
    board::init_for_testing(sc.ctx());

    sc.next_tx(@0x0);
    {
        let mut rs = sc.take_shared<Random>();
        rs.update_randomness_state_for_testing(
            0,
            x"5f1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f9",
            sc.ctx(),
        );
        test_scenario::return_shared(rs);
    };

    sc.next_tx(sender);
    sc
}

fun new_clock(sc: &mut Scenario, ms: u64): Clock {
    let mut c = clock::create_for_testing(sc.ctx());
    c.set_for_testing(ms);
    c
}

/// Run `start_run` as the current sender and return the minted ticket.
fun do_start_run(sc: &mut Scenario, player: address, clock: &Clock): RunTicket {
    {
        let mut b = sc.take_shared<Board>();
        let rs = sc.take_shared<Random>();
        game::start_run_for_testing(&mut b, &rs, clock, sc.ctx());
        test_scenario::return_shared(rs);
        test_scenario::return_shared(b);
    };
    sc.next_tx(player);
    sc.take_from_sender<RunTicket>()
}

// === Happy Path ===

#[test]
fun start_run_rolls_week_and_mints_ticket() {
    let mut sc = setup(PLAYER);
    let clock = new_clock(&mut sc, T0);

    let mut b = sc.take_shared<Board>();
    let rs = sc.take_shared<Random>();

    // Init state: week 0, seed 0, empty.
    assert!(b.week_index() == 0);
    assert!(b.week_seed() == 0);

    game::start_run_for_testing(&mut b, &rs, &clock, sc.ctx());

    // The roll happened: real week index, non-zero seed drawn from Random.
    assert!(b.week_index() == WEEK_2951);
    assert!(b.week_seed() != 0);

    // Both week events fired, plus the two run events.
    assert!(event::events_by_type<game::WeekFinalizedEvent>().length() == 1);
    assert!(event::events_by_type<game::WeekStartedEvent>().length() == 1);
    assert!(event::events_by_type<game::RunStartedEvent>().length() == 1);
    // The object-id event is the one the frontend cannot live without.
    assert!(event::events_by_type<game::RunTicketCreatedEvent>().length() == 1);

    let seed = b.week_seed();
    test_scenario::return_shared(rs);
    test_scenario::return_shared(b);

    sc.next_tx(PLAYER);
    let ticket = sc.take_from_sender<RunTicket>();
    assert!(ticket.ticket_player() == PLAYER);
    assert!(ticket.ticket_week_index() == WEEK_2951);
    assert!(ticket.ticket_seed() == seed);
    assert!(ticket.ticket_started_at_ms() == T0);
    assert!(ticket.ticket_ruleset_version() == RS);

    game::discard_ticket_for_testing(ticket);
    clock.destroy_for_testing();
    sc.end();
}

#[test]
fun happy_path_start_then_submit() {
    let mut sc = setup(PLAYER);
    let mut clock = new_clock(&mut sc, T0);

    let ticket = do_start_run(&mut sc, PLAYER, &clock);

    // 10 points needs at least 10 * 350 = 3500 ms; give it a full minute.
    clock.set_for_testing(T0 + 60_000);

    let mut b = sc.take_shared<Board>();
    game::submit_score(&mut b, ticket, 10, 0, RS, &clock, sc.ctx());

    assert!(b.entry_count() == 1);
    let e = &b.entries()[0];
    assert!(e.entry_player() == PLAYER);
    assert!(e.entry_score() == 10);
    assert!(e.entry_revive_count() == 0);
    assert!(e.entry_timestamp_ms() == T0 + 60_000);
    assert!(e.entry_ruleset_version() == RS);

    let submitted = event::events_by_type<game::ScoreSubmittedEvent>();
    assert!(submitted.length() == 1);

    test_scenario::return_shared(b);
    clock.destroy_for_testing();
    sc.end();
}

#[test]
fun second_run_in_same_week_does_not_roll() {
    let mut sc = setup(PLAYER);
    let clock = new_clock(&mut sc, T0);

    let t1 = do_start_run(&mut sc, PLAYER, &clock);
    game::discard_ticket_for_testing(t1);

    sc.next_tx(PLAYER);
    let mut b = sc.take_shared<Board>();
    let seed_before = b.week_seed();
    let rs = sc.take_shared<Random>();
    game::start_run_for_testing(&mut b, &rs, &clock, sc.ctx());

    // Same week, same seed — no finalize event this time.
    assert!(b.week_index() == WEEK_2951);
    assert!(b.week_seed() == seed_before);
    assert!(event::events_by_type<game::WeekStartedEvent>().length() == 0);
    assert!(event::events_by_type<game::WeekFinalizedEvent>().length() == 0);

    test_scenario::return_shared(rs);
    test_scenario::return_shared(b);

    sc.next_tx(PLAYER);
    let t2 = sc.take_from_sender<RunTicket>();
    game::discard_ticket_for_testing(t2);

    clock.destroy_for_testing();
    sc.end();
}

// === Rejections ===

#[test, expected_failure(abort_code = game::ETicketPlayerMismatch)]
fun submit_with_someone_elses_ticket_aborts() {
    let mut sc = setup(PLAYER);
    let clock = new_clock(&mut sc, T0 + 60_000);

    // Ticket belongs to OTHER; sender is PLAYER.
    let ticket = game::create_ticket_for_testing(OTHER, 0, 7, T0, RS, sc.ctx());
    let mut b = sc.take_shared<Board>();
    game::submit_score(&mut b, ticket, 1, 0, RS, &clock, sc.ctx());

    test_scenario::return_shared(b);
    clock.destroy_for_testing();
    sc.end();
}

#[test, expected_failure(abort_code = game::ERulesetMismatch)]
fun submit_with_wrong_ruleset_aborts() {
    let mut sc = setup(PLAYER);
    let clock = new_clock(&mut sc, T0 + 60_000);

    let ticket = game::create_ticket_for_testing(PLAYER, 0, 7, T0, RS, sc.ctx());
    let mut b = sc.take_shared<Board>();
    // Board and ticket are both ruleset 1; the client claims 2.
    game::submit_score(&mut b, ticket, 1, 0, 2, &clock, sc.ctx());

    test_scenario::return_shared(b);
    clock.destroy_for_testing();
    sc.end();
}

#[test, expected_failure(abort_code = game::ERulesetMismatch)]
fun submit_with_stale_ticket_ruleset_aborts() {
    let mut sc = setup(PLAYER);
    let clock = new_clock(&mut sc, T0 + 60_000);

    // Ticket was minted under an older ruleset than the board now runs.
    let ticket = game::create_ticket_for_testing(PLAYER, 0, 7, T0, 2, sc.ctx());
    let mut b = sc.take_shared<Board>();
    game::submit_score(&mut b, ticket, 1, 0, 2, &clock, sc.ctx());

    test_scenario::return_shared(b);
    clock.destroy_for_testing();
    sc.end();
}

#[test, expected_failure(abort_code = game::ETicketWeekMismatch)]
fun stale_week_ticket_rejected_after_roll() {
    let mut sc = setup(PLAYER);
    let mut clock = new_clock(&mut sc, T0);

    // PLAYER starts a run in week 2951.
    let ticket = do_start_run(&mut sc, PLAYER, &clock);

    // A week passes and OTHER starts a run, rolling the board to 2952.
    clock.set_for_testing(T0 + WEEK_MS + 1_000);
    sc.next_tx(OTHER);
    {
        let mut b = sc.take_shared<Board>();
        let rs = sc.take_shared<Random>();
        game::start_run_for_testing(&mut b, &rs, &clock, sc.ctx());
        assert!(b.week_index() == WEEK_2951 + 1);
        test_scenario::return_shared(rs);
        test_scenario::return_shared(b);
    };

    // PLAYER's week-2951 ticket is now stale.
    sc.next_tx(PLAYER);
    let mut b = sc.take_shared<Board>();
    game::submit_score(&mut b, ticket, 1, 0, RS, &clock, sc.ctx());

    test_scenario::return_shared(b);
    clock.destroy_for_testing();
    sc.end();
}

#[test, expected_failure(abort_code = game::EScoreAboveCeiling)]
fun score_above_ceiling_aborts() {
    let mut sc = setup(PLAYER);
    // Plenty of elapsed time so only the ceiling can trip.
    let clock = new_clock(&mut sc, T0 + 100_000_000);

    let ticket = game::create_ticket_for_testing(PLAYER, 0, 7, T0, RS, sc.ctx());
    let mut b = sc.take_shared<Board>();
    assert!(b.max_score() == 5_000);
    game::submit_score(&mut b, ticket, 5_001, 0, RS, &clock, sc.ctx());

    test_scenario::return_shared(b);
    clock.destroy_for_testing();
    sc.end();
}

#[test]
fun score_at_ceiling_is_accepted() {
    let mut sc = setup(PLAYER);
    let clock = new_clock(&mut sc, T0 + 100_000_000);

    let ticket = game::create_ticket_for_testing(PLAYER, 0, 7, T0, RS, sc.ctx());
    let mut b = sc.take_shared<Board>();
    game::submit_score(&mut b, ticket, 5_000, 0, RS, &clock, sc.ctx());
    assert!(b.entry_count() == 1);
    assert!(b.entries()[0].entry_score() == 5_000);

    test_scenario::return_shared(b);
    clock.destroy_for_testing();
    sc.end();
}

#[test, expected_failure(abort_code = game::ETooManyRevives)]
fun revive_count_above_cap_aborts() {
    let mut sc = setup(PLAYER);
    let clock = new_clock(&mut sc, T0 + 100_000_000);

    let ticket = game::create_ticket_for_testing(PLAYER, 0, 7, T0, RS, sc.ctx());
    let mut b = sc.take_shared<Board>();
    assert!(b.max_revives() == 50);
    game::submit_score(&mut b, ticket, 10, 51, RS, &clock, sc.ctx());

    test_scenario::return_shared(b);
    clock.destroy_for_testing();
    sc.end();
}

#[test, expected_failure(abort_code = game::EImplausibleDuration)]
fun implausibly_fast_high_score_aborts() {
    let mut sc = setup(PLAYER);
    let mut clock = new_clock(&mut sc, T0);

    let ticket = do_start_run(&mut sc, PLAYER, &clock);

    // 100 points needs >= 35_000 ms; claim it after 1 second.
    clock.set_for_testing(T0 + 1_000);

    let mut b = sc.take_shared<Board>();
    game::submit_score(&mut b, ticket, 100, 0, RS, &clock, sc.ctx());

    test_scenario::return_shared(b);
    clock.destroy_for_testing();
    sc.end();
}

#[test]
fun plausible_duration_at_exact_boundary_is_accepted() {
    let mut sc = setup(PLAYER);
    let mut clock = new_clock(&mut sc, T0);

    let ticket = do_start_run(&mut sc, PLAYER, &clock);

    // Exactly 100 * 350 ms — the boundary is inclusive.
    clock.set_for_testing(T0 + 35_000);

    let mut b = sc.take_shared<Board>();
    assert!(b.min_ms_per_point() == 350);
    game::submit_score(&mut b, ticket, 100, 0, RS, &clock, sc.ctx());

    assert!(b.entry_count() == 1);
    assert!(b.entries()[0].entry_score() == 100);

    test_scenario::return_shared(b);
    clock.destroy_for_testing();
    sc.end();
}

#[test, expected_failure(abort_code = game::EImplausibleDuration)]
fun plausible_duration_one_ms_short_aborts() {
    let mut sc = setup(PLAYER);
    let mut clock = new_clock(&mut sc, T0);

    let ticket = do_start_run(&mut sc, PLAYER, &clock);
    clock.set_for_testing(T0 + 34_999);

    let mut b = sc.take_shared<Board>();
    game::submit_score(&mut b, ticket, 100, 0, RS, &clock, sc.ctx());

    test_scenario::return_shared(b);
    clock.destroy_for_testing();
    sc.end();
}

// === Weekly Rollover ===

#[test]
fun week_rollover_clears_entries_and_advances() {
    let mut sc = setup(PLAYER);
    let mut clock = new_clock(&mut sc, T0);

    // Week 2951: PLAYER scores 10.
    let ticket = do_start_run(&mut sc, PLAYER, &clock);
    clock.set_for_testing(T0 + 60_000);
    {
        let mut b = sc.take_shared<Board>();
        game::submit_score(&mut b, ticket, 10, 0, RS, &clock, sc.ctx());
        assert!(b.entry_count() == 1);
        test_scenario::return_shared(b);
    };

    // A week later OTHER starts a run — the lazy roll fires.
    clock.set_for_testing(T0 + WEEK_MS);
    sc.next_tx(OTHER);
    let mut b = sc.take_shared<Board>();
    let rs = sc.take_shared<Random>();
    let seed_before = b.week_seed();

    game::start_run_for_testing(&mut b, &rs, &clock, sc.ctx());

    assert!(b.week_index() == WEEK_2951 + 1);
    assert!(b.entry_count() == 0);
    assert!(b.week_seed() != seed_before);

    // The finalize event carried the closing table for week 2951.
    let finalized = event::events_by_type<game::WeekFinalizedEvent>();
    assert!(finalized.length() == 1);
    let started = event::events_by_type<game::WeekStartedEvent>();
    assert!(started.length() == 1);

    test_scenario::return_shared(rs);
    test_scenario::return_shared(b);

    sc.next_tx(OTHER);
    let t = sc.take_from_sender<RunTicket>();
    assert!(t.ticket_week_index() == WEEK_2951 + 1);
    game::discard_ticket_for_testing(t);

    clock.destroy_for_testing();
    sc.end();
}

#[test]
fun late_submit_before_roll_lands_on_old_week() {
    let mut sc = setup(PLAYER);
    let mut clock = new_clock(&mut sc, T0);

    let ticket = do_start_run(&mut sc, PLAYER, &clock);

    // The wall clock is now inside week 2952, but nobody has called start_run,
    // so the board is still on 2951 and the submission is accepted there.
    clock.set_for_testing(T0 + WEEK_MS + 5_000);

    let mut b = sc.take_shared<Board>();
    assert!(b.week_index() == WEEK_2951);
    game::submit_score(&mut b, ticket, 10, 0, RS, &clock, sc.ctx());

    assert!(b.week_index() == WEEK_2951);
    assert!(b.entry_count() == 1);
    assert!(b.entries()[0].entry_score() == 10);

    test_scenario::return_shared(b);
    clock.destroy_for_testing();
    sc.end();
}

// === Ticket Disposal ===

#[test]
fun discard_ticket_destroys_it() {
    let mut sc = setup(PLAYER);
    let clock = new_clock(&mut sc, T0);

    let ticket = do_start_run(&mut sc, PLAYER, &clock);
    game::discard_ticket_for_testing(ticket);

    assert!(event::events_by_type<game::RunDiscardedEvent>().length() == 1);

    // No RunTicket remains in the player's inventory.
    sc.next_tx(PLAYER);
    assert!(!sc.has_most_recent_for_sender<RunTicket>());

    clock.destroy_for_testing();
    sc.end();
}

// === Dedup Through The Game Module ===

#[test]
fun better_score_replaces_previous_entry_same_week() {
    let mut sc = setup(PLAYER);
    let mut clock = new_clock(&mut sc, T0);

    let t1 = do_start_run(&mut sc, PLAYER, &clock);
    clock.set_for_testing(T0 + 60_000);
    {
        let mut b = sc.take_shared<Board>();
        game::submit_score(&mut b, t1, 10, 0, RS, &clock, sc.ctx());
        test_scenario::return_shared(b);
    };

    sc.next_tx(PLAYER);
    let t2 = do_start_run(&mut sc, PLAYER, &clock);
    clock.set_for_testing(T0 + 200_000);
    {
        let mut b = sc.take_shared<Board>();
        game::submit_score(&mut b, t2, 25, 2, RS, &clock, sc.ctx());
        assert!(b.entry_count() == 1);
        assert!(b.entries()[0].entry_score() == 25);
        assert!(b.entries()[0].entry_revive_count() == 2);
        test_scenario::return_shared(b);
    };

    clock.destroy_for_testing();
    sc.end();
}

#[test]
fun worse_score_is_recorded_as_not_qualified() {
    let mut sc = setup(PLAYER);
    let mut clock = new_clock(&mut sc, T0);

    let t1 = do_start_run(&mut sc, PLAYER, &clock);
    clock.set_for_testing(T0 + 200_000);
    {
        let mut b = sc.take_shared<Board>();
        game::submit_score(&mut b, t1, 25, 0, RS, &clock, sc.ctx());
        test_scenario::return_shared(b);
    };

    sc.next_tx(PLAYER);
    let t2 = do_start_run(&mut sc, PLAYER, &clock);
    clock.set_for_testing(T0 + 400_000);
    {
        let mut b = sc.take_shared<Board>();
        game::submit_score(&mut b, t2, 5, 0, RS, &clock, sc.ctx());
        // Ticket consumed, board keeps the better score.
        assert!(b.entry_count() == 1);
        assert!(b.entries()[0].entry_score() == 25);
        test_scenario::return_shared(b);
    };

    clock.destroy_for_testing();
    sc.end();
}
