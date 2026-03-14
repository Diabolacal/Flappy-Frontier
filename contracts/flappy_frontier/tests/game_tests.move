#[test_only]
/// Tests for the game module — RunReceipt binding and score submission integrity.
module flappy_frontier::game_tests;

use sui::clock;
use sui::sui::SUI;
use flappy_frontier::game;
use flappy_frontier::leaderboard;
use flappy_frontier::treasury;

const PLAYER: address = @0x0; // matches tx_context::dummy() sender

// === Valid Submissions ===

#[test]
fun submit_score_with_valid_receipt() {
    let mut ctx = tx_context::dummy();
    let mut lb = leaderboard::create_for_testing(10, &mut ctx);
    let treasury = treasury::create_for_testing<SUI>(0, &mut ctx);
    let mut clock = clock::create_for_testing(&mut ctx);
    clock.set_for_testing(1000);

    let receipt = game::create_receipt_for_testing(PLAYER, 12345, 1, &mut ctx);
    game::submit_score_for_testing(&mut lb, &treasury, receipt, 50, &clock, &mut ctx);

    // Verify score was placed
    assert!(lb.entry_count() == 1);
    let entries = lb.entries();
    assert!(entries[0].entry_score() == 50);
    assert!(entries[0].entry_player() == PLAYER);
    assert!(entries[0].entry_run_seed() == 12345);

    clock.destroy_for_testing();
    lb.destroy_for_testing();
    treasury.destroy_for_testing();
}

// === Receipt Validation ===

#[test, expected_failure(abort_code = game::EReceiptEpochMismatch)]
fun submit_score_wrong_epoch_aborts() {
    let mut ctx = tx_context::dummy();
    let mut lb = leaderboard::create_for_testing(10, &mut ctx);
    let treasury = treasury::create_for_testing<SUI>(0, &mut ctx); // epoch = 1
    let mut clock = clock::create_for_testing(&mut ctx);
    clock.set_for_testing(1000);

    // Receipt from epoch 99, but treasury is at epoch 1
    let receipt = game::create_receipt_for_testing(PLAYER, 12345, 99, &mut ctx);
    game::submit_score_for_testing(&mut lb, &treasury, receipt, 50, &clock, &mut ctx);

    clock.destroy_for_testing();
    lb.destroy_for_testing();
    treasury.destroy_for_testing();
}

#[test, expected_failure(abort_code = game::EReceiptPlayerMismatch)]
fun submit_score_wrong_player_aborts() {
    let mut ctx = tx_context::dummy(); // sender = @0x0
    let mut lb = leaderboard::create_for_testing(10, &mut ctx);
    let treasury = treasury::create_for_testing<SUI>(0, &mut ctx);
    let mut clock = clock::create_for_testing(&mut ctx);
    clock.set_for_testing(1000);

    // Receipt for a different player (@0xBEEF), but sender is @0x0
    let receipt = game::create_receipt_for_testing(@0xBEEF, 12345, 1, &mut ctx);
    game::submit_score_for_testing(&mut lb, &treasury, receipt, 50, &clock, &mut ctx);

    clock.destroy_for_testing();
    lb.destroy_for_testing();
    treasury.destroy_for_testing();
}

// === Receipt Consumption ===

#[test]
fun discard_receipt_destroys_receipt() {
    let mut ctx = tx_context::dummy();
    let receipt = game::create_receipt_for_testing(PLAYER, 12345, 1, &mut ctx);
    // Discard should succeed without abort — receipt is properly destroyed
    game::discard_receipt_for_testing(receipt);
}

// === Per-Player Dedup via Game Module ===

#[test]
fun same_player_replaces_with_better_score_via_game() {
    let mut ctx = tx_context::dummy();
    let mut lb = leaderboard::create_for_testing(10, &mut ctx);
    let treasury = treasury::create_for_testing<SUI>(0, &mut ctx);
    let mut clock = clock::create_for_testing(&mut ctx);
    clock.set_for_testing(1000);

    // Submit score 50
    let receipt1 = game::create_receipt_for_testing(PLAYER, 111, 1, &mut ctx);
    game::submit_score_for_testing(&mut lb, &treasury, receipt1, 50, &clock, &mut ctx);
    assert!(lb.entry_count() == 1);
    assert!(lb.entries()[0].entry_score() == 50);

    // Submit better score 80
    clock.set_for_testing(2000);
    let receipt2 = game::create_receipt_for_testing(PLAYER, 222, 1, &mut ctx);
    game::submit_score_for_testing(&mut lb, &treasury, receipt2, 80, &clock, &mut ctx);

    // Should still be 1 entry, updated to score 80
    assert!(lb.entry_count() == 1);
    assert!(lb.entries()[0].entry_score() == 80);

    clock.destroy_for_testing();
    lb.destroy_for_testing();
    treasury.destroy_for_testing();
}

#[test]
fun same_player_keeps_higher_score_via_game() {
    let mut ctx = tx_context::dummy();
    let mut lb = leaderboard::create_for_testing(10, &mut ctx);
    let treasury = treasury::create_for_testing<SUI>(0, &mut ctx);
    let mut clock = clock::create_for_testing(&mut ctx);
    clock.set_for_testing(1000);

    // Submit score 80
    let receipt1 = game::create_receipt_for_testing(PLAYER, 111, 1, &mut ctx);
    game::submit_score_for_testing(&mut lb, &treasury, receipt1, 80, &clock, &mut ctx);
    assert!(lb.entry_count() == 1);
    assert!(lb.entries()[0].entry_score() == 80);

    // Submit lower score 30 — receipt is consumed but leaderboard unchanged
    clock.set_for_testing(2000);
    let receipt2 = game::create_receipt_for_testing(PLAYER, 222, 1, &mut ctx);
    game::submit_score_for_testing(&mut lb, &treasury, receipt2, 30, &clock, &mut ctx);

    // Score 80 should be preserved
    assert!(lb.entry_count() == 1);
    assert!(lb.entries()[0].entry_score() == 80);

    clock.destroy_for_testing();
    lb.destroy_for_testing();
    treasury.destroy_for_testing();
}

#[test]
fun receipt_seed_is_recorded_on_leaderboard() {
    let mut ctx = tx_context::dummy();
    let mut lb = leaderboard::create_for_testing(10, &mut ctx);
    let treasury = treasury::create_for_testing<SUI>(0, &mut ctx);
    let mut clock = clock::create_for_testing(&mut ctx);
    clock.set_for_testing(1000);

    // The receipt's seed (99999) should appear on the leaderboard entry
    let receipt = game::create_receipt_for_testing(PLAYER, 99999, 1, &mut ctx);
    game::submit_score_for_testing(&mut lb, &treasury, receipt, 42, &clock, &mut ctx);

    assert!(lb.entries()[0].entry_run_seed() == 99999);

    clock.destroy_for_testing();
    lb.destroy_for_testing();
    treasury.destroy_for_testing();
}
