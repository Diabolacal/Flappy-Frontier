#[test_only]
/// Tests for the leaderboard module.
module flappy_frontier::leaderboard_tests;

use flappy_frontier::leaderboard;

const ALICE: address = @0xA;
const BOB: address = @0xB;
const CAROL: address = @0xC;
const DAVE: address = @0xD;

// === Score Submission & Sorting ===

#[test]
fun score_submission_inserts_and_sorts_correctly() {
    let mut ctx = tx_context::dummy();
    let mut lb = leaderboard::create_for_testing(10, &mut ctx);

    assert!(lb.submit_score_for_testing(ALICE, 50, 111, 1000));
    assert!(lb.submit_score_for_testing(BOB, 100, 222, 2000));
    assert!(lb.submit_score_for_testing(CAROL, 75, 333, 3000));

    let entries = lb.entries();
    assert!(entries.length() == 3);

    // Should be sorted descending: BOB(100), CAROL(75), ALICE(50)
    assert!(entries[0].entry_score() == 100);
    assert!(entries[0].entry_player() == BOB);
    assert!(entries[1].entry_score() == 75);
    assert!(entries[1].entry_player() == CAROL);
    assert!(entries[2].entry_score() == 50);
    assert!(entries[2].entry_player() == ALICE);

    lb.destroy_for_testing();
}

#[test]
fun full_leaderboard_rejects_low_score() {
    let mut ctx = tx_context::dummy();
    // Max size 3 for easier testing
    let mut lb = leaderboard::create_for_testing(3, &mut ctx);

    assert!(lb.submit_score_for_testing(ALICE, 50, 111, 1000));
    assert!(lb.submit_score_for_testing(BOB, 40, 222, 2000));
    assert!(lb.submit_score_for_testing(CAROL, 30, 333, 3000));

    // Score 20 should NOT qualify when leaderboard is full with minimum 30
    assert!(!lb.qualifies(20, 4000));

    lb.destroy_for_testing();
}

#[test]
fun submit_below_threshold_returns_false() {
    let mut ctx = tx_context::dummy();
    let mut lb = leaderboard::create_for_testing(3, &mut ctx);

    assert!(lb.submit_score_for_testing(ALICE, 50, 111, 1000));
    assert!(lb.submit_score_for_testing(BOB, 40, 222, 2000));
    assert!(lb.submit_score_for_testing(CAROL, 30, 333, 3000));

    // Score 20 doesn't qualify — returns false without aborting
    assert!(!lb.submit_score_for_testing(DAVE, 20, 444, 4000));

    // Leaderboard unchanged
    assert!(lb.entry_count() == 3);

    lb.destroy_for_testing();
}

#[test]
fun full_leaderboard_accepts_higher_score_and_trims() {
    let mut ctx = tx_context::dummy();
    let mut lb = leaderboard::create_for_testing(3, &mut ctx);

    assert!(lb.submit_score_for_testing(ALICE, 50, 111, 1000));
    assert!(lb.submit_score_for_testing(BOB, 40, 222, 2000));
    assert!(lb.submit_score_for_testing(CAROL, 30, 333, 3000));

    // Score 45 qualifies and pushes out CAROL (30)
    assert!(lb.submit_score_for_testing(DAVE, 45, 444, 4000));

    let entries = lb.entries();
    assert!(entries.length() == 3);
    assert!(entries[0].entry_score() == 50); // ALICE
    assert!(entries[1].entry_score() == 45); // DAVE
    assert!(entries[2].entry_score() == 40); // BOB
    // CAROL (30) was trimmed

    lb.destroy_for_testing();
}

// === Tie-Breaking ===

#[test]
fun tie_breaking_prefers_earlier_timestamp() {
    let mut ctx = tx_context::dummy();
    let mut lb = leaderboard::create_for_testing(10, &mut ctx);

    // BOB submits score 50 at time 2000
    assert!(lb.submit_score_for_testing(BOB, 50, 222, 2000));
    // ALICE submits same score 50 at time 1000 (earlier)
    assert!(lb.submit_score_for_testing(ALICE, 50, 111, 1000));

    let entries = lb.entries();
    assert!(entries.length() == 2);

    // ALICE should rank higher (earlier timestamp for same score)
    assert!(entries[0].entry_player() == ALICE);
    assert!(entries[0].entry_timestamp_ms() == 1000);
    assert!(entries[1].entry_player() == BOB);
    assert!(entries[1].entry_timestamp_ms() == 2000);

    lb.destroy_for_testing();
}

#[test]
fun tie_at_threshold_prefers_earlier_timestamp() {
    let mut ctx = tx_context::dummy();
    let mut lb = leaderboard::create_for_testing(3, &mut ctx);

    assert!(lb.submit_score_for_testing(ALICE, 100, 111, 1000));
    assert!(lb.submit_score_for_testing(BOB, 50, 222, 2000));
    assert!(lb.submit_score_for_testing(CAROL, 30, 333, 3000)); // last place, score 30 at time 3000

    // DAVE scores 30 at time 2500 (earlier than CAROL) — should qualify via tie-break
    assert!(lb.qualifies(30, 2500));
    assert!(lb.submit_score_for_testing(DAVE, 30, 444, 2500));

    let entries = lb.entries();
    assert!(entries.length() == 3);
    // DAVE (30, 2500) should replace CAROL (30, 3000) since earlier timestamp
    assert!(entries[2].entry_player() == DAVE);
    assert!(entries[2].entry_timestamp_ms() == 2500);

    lb.destroy_for_testing();
}

#[test]
fun tie_at_threshold_rejects_later_timestamp() {
    let mut ctx = tx_context::dummy();
    let mut lb = leaderboard::create_for_testing(3, &mut ctx);

    assert!(lb.submit_score_for_testing(ALICE, 100, 111, 1000));
    assert!(lb.submit_score_for_testing(BOB, 50, 222, 2000));
    assert!(lb.submit_score_for_testing(CAROL, 30, 333, 3000));

    // DAVE scores 30 at time 4000 (later than CAROL) — should NOT qualify
    assert!(!lb.qualifies(30, 4000));

    lb.destroy_for_testing();
}

// === Winner Extraction & Reset ===

#[test]
fun winner_addresses_returns_ranked_order() {
    let mut ctx = tx_context::dummy();
    let mut lb = leaderboard::create_for_testing(10, &mut ctx);

    assert!(lb.submit_score_for_testing(ALICE, 50, 111, 1000));
    assert!(lb.submit_score_for_testing(BOB, 100, 222, 2000));
    assert!(lb.submit_score_for_testing(CAROL, 75, 333, 3000));

    let winners = lb.winner_addresses();
    assert!(winners.length() == 3);
    assert!(winners[0] == BOB);   // 100 - 1st
    assert!(winners[1] == CAROL); // 75  - 2nd
    assert!(winners[2] == ALICE); // 50  - 3rd

    lb.destroy_for_testing();
}

#[test]
fun reset_clears_all_entries() {
    let mut ctx = tx_context::dummy();
    let mut lb = leaderboard::create_for_testing(10, &mut ctx);

    assert!(lb.submit_score_for_testing(ALICE, 50, 111, 1000));
    assert!(lb.submit_score_for_testing(BOB, 100, 222, 2000));

    assert!(lb.entry_count() == 2);

    lb.reset();
    assert!(lb.entry_count() == 0);
    assert!(lb.entries().length() == 0);

    lb.destroy_for_testing();
}

// === Edge: Empty Leaderboard ===

#[test]
fun empty_leaderboard_qualifies_any_score() {
    let mut ctx = tx_context::dummy();
    let lb = leaderboard::create_for_testing(10, &mut ctx);

    assert!(lb.qualifies(0, 1000));
    assert!(lb.qualifies(1, 1000));
    assert!(lb.qualifies(999999, 1000));

    lb.destroy_for_testing();
}

#[test]
fun empty_leaderboard_winner_addresses_is_empty() {
    let mut ctx = tx_context::dummy();
    let lb = leaderboard::create_for_testing(10, &mut ctx);

    let winners = lb.winner_addresses();
    assert!(winners.length() == 0);

    lb.destroy_for_testing();
}

// === Fill to Max and Verify Trim ===

#[test]
fun fill_to_max_and_verify_size() {
    let mut ctx = tx_context::dummy();
    let mut lb = leaderboard::create_for_testing(3, &mut ctx);

    assert!(lb.submit_score_for_testing(ALICE, 50, 111, 1000));
    assert!(lb.submit_score_for_testing(BOB, 40, 222, 2000));
    assert!(lb.submit_score_for_testing(CAROL, 30, 333, 3000));

    assert!(lb.entry_count() == 3);
    assert!(lb.max_size() == 3);

    // Adding a higher score should keep max size
    assert!(lb.submit_score_for_testing(DAVE, 45, 444, 4000));
    assert!(lb.entry_count() == 3);

    lb.destroy_for_testing();
}

// === Per-Player Deduplication ===

#[test]
fun same_player_updates_with_better_score() {
    let mut ctx = tx_context::dummy();
    let mut lb = leaderboard::create_for_testing(10, &mut ctx);

    // ALICE submits score 50
    assert!(lb.submit_score_for_testing(ALICE, 50, 111, 1000));
    assert!(lb.entry_count() == 1);
    assert!(lb.entries()[0].entry_score() == 50);

    // ALICE submits better score 80 — should replace, not duplicate
    assert!(lb.submit_score_for_testing(ALICE, 80, 222, 2000));
    assert!(lb.entry_count() == 1);
    assert!(lb.entries()[0].entry_score() == 80);
    assert!(lb.entries()[0].entry_player() == ALICE);

    lb.destroy_for_testing();
}

#[test]
fun same_player_keeps_higher_score() {
    let mut ctx = tx_context::dummy();
    let mut lb = leaderboard::create_for_testing(10, &mut ctx);

    // ALICE submits score 80
    assert!(lb.submit_score_for_testing(ALICE, 80, 111, 1000));
    assert!(lb.entry_count() == 1);

    // ALICE submits lower score 30 — should keep 80
    assert!(!lb.submit_score_for_testing(ALICE, 30, 222, 2000));
    assert!(lb.entry_count() == 1);
    assert!(lb.entries()[0].entry_score() == 80);

    lb.destroy_for_testing();
}

#[test]
fun same_player_cannot_duplicate_entries() {
    let mut ctx = tx_context::dummy();
    let mut lb = leaderboard::create_for_testing(10, &mut ctx);

    // ALICE submits 3 times — only best should remain
    assert!(lb.submit_score_for_testing(ALICE, 50, 111, 1000));
    assert!(lb.submit_score_for_testing(ALICE, 80, 222, 2000));
    assert!(!lb.submit_score_for_testing(ALICE, 60, 333, 3000)); // 60 < 80

    assert!(lb.entry_count() == 1);
    assert!(lb.entries()[0].entry_score() == 80);

    lb.destroy_for_testing();
}

#[test]
fun same_player_equal_score_returns_false() {
    let mut ctx = tx_context::dummy();
    let mut lb = leaderboard::create_for_testing(10, &mut ctx);

    assert!(lb.submit_score_for_testing(ALICE, 50, 111, 1000));
    // Same score — not strictly better, returns false
    assert!(!lb.submit_score_for_testing(ALICE, 50, 222, 2000));
    assert!(lb.entry_count() == 1);

    lb.destroy_for_testing();
}

#[test]
fun multiple_players_each_have_one_entry() {
    let mut ctx = tx_context::dummy();
    let mut lb = leaderboard::create_for_testing(10, &mut ctx);

    // Three players each submit twice — leaderboard should have 3 entries total
    assert!(lb.submit_score_for_testing(ALICE, 50, 111, 1000));
    assert!(lb.submit_score_for_testing(BOB, 60, 222, 2000));
    assert!(lb.submit_score_for_testing(CAROL, 70, 333, 3000));

    // Each player improves
    assert!(lb.submit_score_for_testing(ALICE, 55, 444, 4000));
    assert!(lb.submit_score_for_testing(BOB, 65, 555, 5000));
    assert!(lb.submit_score_for_testing(CAROL, 75, 666, 6000));

    // Still exactly 3 entries, sorted: CAROL(75), BOB(65), ALICE(55)
    assert!(lb.entry_count() == 3);
    assert!(lb.entries()[0].entry_player() == CAROL);
    assert!(lb.entries()[0].entry_score() == 75);
    assert!(lb.entries()[1].entry_player() == BOB);
    assert!(lb.entries()[1].entry_score() == 65);
    assert!(lb.entries()[2].entry_player() == ALICE);
    assert!(lb.entries()[2].entry_score() == 55);

    lb.destroy_for_testing();
}
