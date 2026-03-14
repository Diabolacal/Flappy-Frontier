/// Leaderboard module for Flappy Frontier.
/// Maintains a top-10 sorted leaderboard as a shared object.
/// Ties broken by earlier timestamp (lower timestamp_ms ranks higher).
module flappy_frontier::leaderboard;

// === Structs ===

/// A single leaderboard entry.
public struct LeaderboardEntry has store, copy, drop {
    player: address,
    score: u64,
    run_seed: u256,
    timestamp_ms: u64,
}

/// Shared leaderboard object holding the top N entries for the current epoch.
public struct Leaderboard has key {
    id: UID,
    entries: vector<LeaderboardEntry>,
    max_size: u64,
}

// === Init ===

/// Create a new shared Leaderboard. Called during package init.
public(package) fun create(max_size: u64, ctx: &mut TxContext) {
    let leaderboard = Leaderboard {
        id: object::new(ctx),
        entries: vector[],
        max_size,
    };
    transfer::share_object(leaderboard);
}

// === Public View ===

/// Returns a reference to the entries vector.
public fun entries(leaderboard: &Leaderboard): &vector<LeaderboardEntry> {
    &leaderboard.entries
}

/// Returns the number of current entries.
public fun entry_count(leaderboard: &Leaderboard): u64 {
    leaderboard.entries.length()
}

/// Returns the max leaderboard size.
public fun max_size(leaderboard: &Leaderboard): u64 {
    leaderboard.max_size
}

/// Returns the player address of an entry.
public fun entry_player(entry: &LeaderboardEntry): address {
    entry.player
}

/// Returns the score of an entry.
public fun entry_score(entry: &LeaderboardEntry): u64 {
    entry.score
}

/// Returns the run seed of an entry.
public fun entry_run_seed(entry: &LeaderboardEntry): u256 {
    entry.run_seed
}

/// Returns the timestamp of an entry.
public fun entry_timestamp_ms(entry: &LeaderboardEntry): u64 {
    entry.timestamp_ms
}

// === Score Submission ===

/// Check if a score qualifies for the leaderboard.
/// Returns true if the leaderboard isn't full, or if the score beats the lowest entry.
public fun qualifies(leaderboard: &Leaderboard, score: u64, timestamp_ms: u64): bool {
    let len = leaderboard.entries.length();
    if (len < leaderboard.max_size) {
        return true
    };
    // Compare against the last (lowest) entry
    let last = &leaderboard.entries[len - 1];
    if (score > last.score) {
        return true
    };
    // Tie-break: earlier timestamp wins
    if (score == last.score && timestamp_ms < last.timestamp_ms) {
        return true
    };
    false
}

/// Submit a score to the leaderboard with per-player deduplication.
/// Returns true if the entry was placed or updated, false if score didn't qualify
/// or wasn't an improvement over the player's existing entry.
///
/// Per-player rules:
/// - One entry per player per epoch.
/// - If the player already has an entry with a higher or equal score, returns false.
/// - If the player already has an entry with a lower score, replaces it.
/// - If the player has no existing entry, normal qualification logic applies.
public(package) fun submit_score(
    leaderboard: &mut Leaderboard,
    player: address,
    score: u64,
    run_seed: u256,
    timestamp_ms: u64,
): bool {
    // Check for existing entry by this player
    let len = leaderboard.entries.length();
    let mut existing_idx: u64 = len; // sentinel: no existing entry found
    let mut i = 0;
    while (i < len) {
        if (leaderboard.entries[i].player == player) {
            existing_idx = i;
            break
        };
        i = i + 1;
    };

    if (existing_idx < len) {
        // Player already has an entry — only replace if new score is strictly better
        let existing_score = leaderboard.entries[existing_idx].score;
        if (score <= existing_score) {
            return false
        };
        // Remove old entry before re-inserting at new position
        leaderboard.entries.remove(existing_idx);
    };

    // Check if score qualifies (after potentially removing old entry)
    if (!qualifies(leaderboard, score, timestamp_ms)) {
        return false
    };

    let entry = LeaderboardEntry {
        player,
        score,
        run_seed,
        timestamp_ms,
    };

    // Find insertion position (sorted descending by score, ties broken by earlier timestamp)
    let current_len = leaderboard.entries.length();
    let mut insert_pos = current_len; // default: end
    i = 0;
    while (i < current_len) {
        let existing = &leaderboard.entries[i];
        if (score > existing.score || (score == existing.score && timestamp_ms < existing.timestamp_ms)) {
            insert_pos = i;
            break
        };
        i = i + 1;
    };

    // Insert at position
    leaderboard.entries.insert(entry, insert_pos);

    // Trim to max size
    while (leaderboard.entries.length() > leaderboard.max_size) {
        leaderboard.entries.pop_back();
    };

    true
}

// === Payout Helpers ===

/// Extract winner addresses from the leaderboard, in ranked order.
/// Returns a vector of addresses for payout distribution.
public(package) fun winner_addresses(leaderboard: &Leaderboard): vector<address> {
    let mut winners: vector<address> = vector[];
    let mut i = 0;
    while (i < leaderboard.entries.length()) {
        winners.push_back(leaderboard.entries[i].player);
        i = i + 1;
    };
    winners
}

/// Reset the leaderboard (clear all entries). Called after payout.
public(package) fun reset(leaderboard: &mut Leaderboard) {
    leaderboard.entries = vector[];
}

// === Test Helpers ===

#[test_only]
public fun create_for_testing(max_size: u64, ctx: &mut TxContext): Leaderboard {
    Leaderboard {
        id: object::new(ctx),
        entries: vector[],
        max_size,
    }
}

#[test_only]
public fun destroy_for_testing(leaderboard: Leaderboard) {
    let Leaderboard { id, entries: _, max_size: _ } = leaderboard;
    id.delete();
}

#[test_only]
public fun submit_score_for_testing(
    leaderboard: &mut Leaderboard,
    player: address,
    score: u64,
    run_seed: u256,
    timestamp_ms: u64,
): bool {
    submit_score(leaderboard, player, score, run_seed, timestamp_ms)
}
