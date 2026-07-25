#[test_only]
/// Tests for the weekly board: sorted insert, per-player dedup, tie-break, trim,
/// week math and admin tuning setters.
module flappy_frontier_v2::board_tests;

use flappy_frontier_v2::board;

const ALICE: address = @0xA;
const BOB: address = @0xB;
const CAROL: address = @0xC;
const DAVE: address = @0xD;

const RS: u16 = 1;

// === Sorted Insert ===

#[test]
fun score_submission_inserts_and_sorts_correctly() {
    let mut ctx = tx_context::dummy();
    let mut b = board::create_for_testing(10, &mut ctx);

    assert!(b.insert_entry_for_testing(ALICE, 50, 0, 1000, RS));
    assert!(b.insert_entry_for_testing(BOB, 100, 0, 2000, RS));
    assert!(b.insert_entry_for_testing(CAROL, 75, 0, 3000, RS));

    let entries = b.entries();
    assert!(entries.length() == 3);

    // Sorted descending: BOB(100), CAROL(75), ALICE(50)
    assert!(entries[0].entry_score() == 100);
    assert!(entries[0].entry_player() == BOB);
    assert!(entries[1].entry_score() == 75);
    assert!(entries[1].entry_player() == CAROL);
    assert!(entries[2].entry_score() == 50);
    assert!(entries[2].entry_player() == ALICE);

    b.destroy_for_testing();
}

#[test]
fun full_board_rejects_low_score() {
    let mut ctx = tx_context::dummy();
    let mut b = board::create_for_testing(3, &mut ctx);

    assert!(b.insert_entry_for_testing(ALICE, 50, 0, 1000, RS));
    assert!(b.insert_entry_for_testing(BOB, 40, 0, 2000, RS));
    assert!(b.insert_entry_for_testing(CAROL, 30, 0, 3000, RS));

    assert!(!b.qualifies(20, 4000));

    b.destroy_for_testing();
}

#[test]
fun submit_below_threshold_returns_false() {
    let mut ctx = tx_context::dummy();
    let mut b = board::create_for_testing(3, &mut ctx);

    assert!(b.insert_entry_for_testing(ALICE, 50, 0, 1000, RS));
    assert!(b.insert_entry_for_testing(BOB, 40, 0, 2000, RS));
    assert!(b.insert_entry_for_testing(CAROL, 30, 0, 3000, RS));

    // Doesn't qualify — returns false without aborting
    assert!(!b.insert_entry_for_testing(DAVE, 20, 0, 4000, RS));
    assert!(b.entry_count() == 3);

    b.destroy_for_testing();
}

#[test]
fun full_board_accepts_higher_score_and_trims() {
    let mut ctx = tx_context::dummy();
    let mut b = board::create_for_testing(3, &mut ctx);

    assert!(b.insert_entry_for_testing(ALICE, 50, 0, 1000, RS));
    assert!(b.insert_entry_for_testing(BOB, 40, 0, 2000, RS));
    assert!(b.insert_entry_for_testing(CAROL, 30, 0, 3000, RS));

    // 45 qualifies and pushes CAROL (30) off the bottom
    assert!(b.insert_entry_for_testing(DAVE, 45, 0, 4000, RS));

    let entries = b.entries();
    assert!(entries.length() == 3);
    assert!(entries[0].entry_score() == 50); // ALICE
    assert!(entries[1].entry_score() == 45); // DAVE
    assert!(entries[2].entry_score() == 40); // BOB

    b.destroy_for_testing();
}

#[test]
fun fill_to_max_and_verify_size() {
    let mut ctx = tx_context::dummy();
    let mut b = board::create_for_testing(3, &mut ctx);

    assert!(b.insert_entry_for_testing(ALICE, 50, 0, 1000, RS));
    assert!(b.insert_entry_for_testing(BOB, 40, 0, 2000, RS));
    assert!(b.insert_entry_for_testing(CAROL, 30, 0, 3000, RS));

    assert!(b.entry_count() == 3);
    assert!(b.max_size() == 3);

    assert!(b.insert_entry_for_testing(DAVE, 45, 0, 4000, RS));
    assert!(b.entry_count() == 3);

    b.destroy_for_testing();
}

// === Tie-Breaking ===

#[test]
fun tie_breaking_prefers_earlier_timestamp() {
    let mut ctx = tx_context::dummy();
    let mut b = board::create_for_testing(10, &mut ctx);

    assert!(b.insert_entry_for_testing(BOB, 50, 0, 2000, RS));
    assert!(b.insert_entry_for_testing(ALICE, 50, 0, 1000, RS));

    let entries = b.entries();
    assert!(entries.length() == 2);
    assert!(entries[0].entry_player() == ALICE);
    assert!(entries[0].entry_timestamp_ms() == 1000);
    assert!(entries[1].entry_player() == BOB);
    assert!(entries[1].entry_timestamp_ms() == 2000);

    b.destroy_for_testing();
}

#[test]
fun tie_at_threshold_prefers_earlier_timestamp() {
    let mut ctx = tx_context::dummy();
    let mut b = board::create_for_testing(3, &mut ctx);

    assert!(b.insert_entry_for_testing(ALICE, 100, 0, 1000, RS));
    assert!(b.insert_entry_for_testing(BOB, 50, 0, 2000, RS));
    assert!(b.insert_entry_for_testing(CAROL, 30, 0, 3000, RS));

    assert!(b.qualifies(30, 2500));
    assert!(b.insert_entry_for_testing(DAVE, 30, 0, 2500, RS));

    let entries = b.entries();
    assert!(entries.length() == 3);
    assert!(entries[2].entry_player() == DAVE);
    assert!(entries[2].entry_timestamp_ms() == 2500);

    b.destroy_for_testing();
}

#[test]
fun tie_at_threshold_rejects_later_timestamp() {
    let mut ctx = tx_context::dummy();
    let mut b = board::create_for_testing(3, &mut ctx);

    assert!(b.insert_entry_for_testing(ALICE, 100, 0, 1000, RS));
    assert!(b.insert_entry_for_testing(BOB, 50, 0, 2000, RS));
    assert!(b.insert_entry_for_testing(CAROL, 30, 0, 3000, RS));

    assert!(!b.qualifies(30, 4000));

    b.destroy_for_testing();
}

// === Edge: Empty Board ===

#[test]
fun empty_board_qualifies_any_score() {
    let mut ctx = tx_context::dummy();
    let b = board::create_for_testing(10, &mut ctx);

    assert!(b.qualifies(0, 1000));
    assert!(b.qualifies(1, 1000));
    assert!(b.qualifies(999999, 1000));

    b.destroy_for_testing();
}

// === Per-Player Deduplication ===

#[test]
fun same_player_updates_with_better_score() {
    let mut ctx = tx_context::dummy();
    let mut b = board::create_for_testing(10, &mut ctx);

    assert!(b.insert_entry_for_testing(ALICE, 50, 0, 1000, RS));
    assert!(b.entry_count() == 1);
    assert!(b.entries()[0].entry_score() == 50);

    assert!(b.insert_entry_for_testing(ALICE, 80, 0, 2000, RS));
    assert!(b.entry_count() == 1);
    assert!(b.entries()[0].entry_score() == 80);
    assert!(b.entries()[0].entry_player() == ALICE);

    b.destroy_for_testing();
}

#[test]
fun same_player_keeps_higher_score() {
    let mut ctx = tx_context::dummy();
    let mut b = board::create_for_testing(10, &mut ctx);

    assert!(b.insert_entry_for_testing(ALICE, 80, 0, 1000, RS));
    assert!(!b.insert_entry_for_testing(ALICE, 30, 0, 2000, RS));

    assert!(b.entry_count() == 1);
    assert!(b.entries()[0].entry_score() == 80);

    b.destroy_for_testing();
}

#[test]
fun same_player_cannot_duplicate_entries() {
    let mut ctx = tx_context::dummy();
    let mut b = board::create_for_testing(10, &mut ctx);

    assert!(b.insert_entry_for_testing(ALICE, 50, 0, 1000, RS));
    assert!(b.insert_entry_for_testing(ALICE, 80, 0, 2000, RS));
    assert!(!b.insert_entry_for_testing(ALICE, 60, 0, 3000, RS)); // 60 < 80

    assert!(b.entry_count() == 1);
    assert!(b.entries()[0].entry_score() == 80);

    b.destroy_for_testing();
}

#[test]
fun same_player_equal_score_returns_false() {
    let mut ctx = tx_context::dummy();
    let mut b = board::create_for_testing(10, &mut ctx);

    assert!(b.insert_entry_for_testing(ALICE, 50, 0, 1000, RS));
    assert!(!b.insert_entry_for_testing(ALICE, 50, 0, 2000, RS));
    assert!(b.entry_count() == 1);

    b.destroy_for_testing();
}

#[test]
fun multiple_players_each_have_one_entry() {
    let mut ctx = tx_context::dummy();
    let mut b = board::create_for_testing(10, &mut ctx);

    assert!(b.insert_entry_for_testing(ALICE, 50, 0, 1000, RS));
    assert!(b.insert_entry_for_testing(BOB, 60, 0, 2000, RS));
    assert!(b.insert_entry_for_testing(CAROL, 70, 0, 3000, RS));

    assert!(b.insert_entry_for_testing(ALICE, 55, 0, 4000, RS));
    assert!(b.insert_entry_for_testing(BOB, 65, 0, 5000, RS));
    assert!(b.insert_entry_for_testing(CAROL, 75, 0, 6000, RS));

    assert!(b.entry_count() == 3);
    assert!(b.entries()[0].entry_player() == CAROL);
    assert!(b.entries()[0].entry_score() == 75);
    assert!(b.entries()[1].entry_player() == BOB);
    assert!(b.entries()[1].entry_score() == 65);
    assert!(b.entries()[2].entry_player() == ALICE);
    assert!(b.entries()[2].entry_score() == 55);

    b.destroy_for_testing();
}

// === Entry Payload ===

#[test]
fun entry_records_revives_and_ruleset() {
    let mut ctx = tx_context::dummy();
    let mut b = board::create_for_testing(10, &mut ctx);

    assert!(b.insert_entry_for_testing(ALICE, 42, 7, 1234, 3));

    let e = &b.entries()[0];
    assert!(e.entry_player() == ALICE);
    assert!(e.entry_score() == 42);
    assert!(e.entry_revive_count() == 7);
    assert!(e.entry_timestamp_ms() == 1234);
    assert!(e.entry_ruleset_version() == 3);

    b.destroy_for_testing();
}

// === Week Math ===

#[test]
fun week_anchor_is_week_zero() {
    assert!(board::week_anchor_ms() == 259_200_000);
    assert!(board::week_ms() == 604_800_000);

    // Anchor itself is week 0, and so is the last ms of that week.
    assert!(board::week_index_at(259_200_000) == 0);
    assert!(board::week_index_at(259_200_000 + 604_800_000 - 1) == 0);
    // First ms of week 1.
    assert!(board::week_index_at(259_200_000 + 604_800_000) == 1);
    assert!(board::week_index_at(259_200_000 + 2 * 604_800_000) == 2);
}

#[test]
fun week_start_round_trips() {
    let mut i = 0u64;
    while (i < 5) {
        assert!(board::week_index_at(board::week_start_ms(i)) == i);
        assert!(board::week_index_at(board::week_start_ms(i) + 604_800_000 - 1) == i);
        i = i + 1;
    };
}

#[test]
fun realistic_clock_is_never_week_zero() {
    // 2026-07-25T00:00:00Z — any modern clock forces the first start_run to roll.
    let now_ms: u64 = 1_785_024_000_000;
    assert!(board::week_index_at(now_ms) > 0);
}

// === Defaults ===

#[test]
fun init_defaults_are_as_specified() {
    let mut ctx = tx_context::dummy();
    board::init_for_testing(&mut ctx);

    assert!(board::default_max_size() == 100);
    assert!(board::default_ruleset_version() == 1);
    assert!(board::default_max_score() == 5000);
    assert!(board::default_max_revives() == 50);
    // 280 px spacing / 340 px/s cap = 823.5 ms/point theoretical minimum;
    // 350 ms is ~42.5% of that.
    assert!(board::default_min_ms_per_point() == 350);
}

// === Admin Setters ===

#[test]
fun admin_setters_tune_the_board() {
    use sui::test_scenario;

    let admin = @0xAD;
    let mut sc = test_scenario::begin(admin);
    board::init_for_testing(sc.ctx());

    sc.next_tx(admin);
    let cap = sc.take_from_sender<board::AdminCap>();
    let mut b = sc.take_shared<board::Board>();

    assert!(b.max_size() == 100);
    board::set_max_size(&cap, &mut b, 5);
    assert!(b.max_size() == 5);

    board::set_ruleset_version(&cap, &mut b, 9);
    assert!(b.ruleset_version() == 9);

    board::set_min_ms_per_point(&cap, &mut b, 1);
    assert!(b.min_ms_per_point() == 1);

    board::set_max_score(&cap, &mut b, 12_345);
    assert!(b.max_score() == 12_345);

    board::set_max_revives(&cap, &mut b, 3);
    assert!(b.max_revives() == 3);

    test_scenario::return_shared(b);
    sc.return_to_sender(cap);
    sc.end();
}

#[test]
fun shrinking_max_size_trims_existing_entries() {
    use sui::test_scenario;

    let admin = @0xAD;
    let mut sc = test_scenario::begin(admin);
    board::init_for_testing(sc.ctx());

    sc.next_tx(admin);
    let cap = sc.take_from_sender<board::AdminCap>();
    let mut b = sc.take_shared<board::Board>();

    assert!(b.insert_entry_for_testing(ALICE, 50, 0, 1000, RS));
    assert!(b.insert_entry_for_testing(BOB, 40, 0, 2000, RS));
    assert!(b.insert_entry_for_testing(CAROL, 30, 0, 3000, RS));
    assert!(b.entry_count() == 3);

    board::set_max_size(&cap, &mut b, 2);
    assert!(b.entry_count() == 2);
    assert!(b.entries()[0].entry_player() == ALICE);
    assert!(b.entries()[1].entry_player() == BOB);

    test_scenario::return_shared(b);
    sc.return_to_sender(cap);
    sc.end();
}
