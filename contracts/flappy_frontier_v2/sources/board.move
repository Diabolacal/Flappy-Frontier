/// Weekly leaderboard board for Flappy Frontier (v2, cycle-agnostic).
///
/// This module holds the shared `Board` object: a sorted, per-player-deduplicated
/// top-N table of scores for the *current* week, plus the week's shared seed.
///
/// ECONOMICS: none. This package never touches `Coin`, `Balance`, or any generic
/// asset type. There is no entry fee, no prize pool and no payout path anywhere in
/// it. Revive payments are handled by a separate Frontier Commerce package, which
/// this package has no dependency on. Because nothing here is parameterised by a
/// coin type, the package never needs republishing at an EVE cycle rollover.
///
/// The `AdminCap` minted here gates tuning parameters ONLY (board size, ruleset
/// version, anti-cheat bounds). It grants no ability to move funds, because there
/// are no funds, and no ability to write, reorder or delete leaderboard entries.
module flappy_frontier_v2::board;

// === Errors ===

#[error]
const EInvalidMaxSize: vector<u8> = b"Board max_size must be greater than zero";

#[error]
const EInvalidRulesetVersion: vector<u8> = b"Ruleset version must be greater than zero";

#[error]
const EInvalidMaxScore: vector<u8> = b"max_score must be greater than zero";

// === Constants ===

/// Length of a leaderboard week in milliseconds (7 days).
const WEEK_MS: u64 = 604_800_000;

/// Unix ms of 1970-01-04T00:00:00Z — the first Sunday of the epoch.
/// Weeks therefore run Sunday 00:00:00 UTC → Saturday 23:59:59.999 UTC.
const WEEK_ANCHOR_MS: u64 = 259_200_000;

/// Default number of ranked entries retained per week.
const DEFAULT_MAX_SIZE: u64 = 100;

/// Default gameplay ruleset version. Bumped (via AdminCap) whenever the
/// frontend engine's physics/progression constants change in a way that makes
/// old scores incomparable — submissions must match the board's version.
const DEFAULT_RULESET_VERSION: u16 = 1;

/// Default score ceiling. Anything above this is rejected as implausible.
const DEFAULT_MAX_SCORE: u64 = 5_000;

/// Default cap on revives purchased within a single run.
const DEFAULT_MAX_REVIVES: u16 = 50;

/// Default minimum wall-clock milliseconds a run must last per point scored.
///
/// DERIVATION (from `frontend/src/game/constants.ts` + `progression.ts`):
///   PIPE_SPACING       = 280 px   (horizontal, centre-to-centre)
///   ENDLESS_SPEED_MAX  = 340 px/s (hard speed cap; the game never scrolls faster)
///   theoretical fastest = 280 / 340 = 0.8235 s per point = 823.5 ms/point
/// A perfect player at the hard speed cap for an entire run can therefore never
/// average better than ~823 ms/point, and real runs are far slower because speed
/// ramps from 140 px/s and only reaches the cap around score ~120.
/// We take ~42.5% of the theoretical minimum for generous headroom against clock
/// skew, laggy submissions and future speed retuning:
///   823.5 ms * 0.425 ~= 350 ms  ->  350 (clean round number)
/// A run claiming N points must therefore have lasted at least N * 350 ms.
const DEFAULT_MIN_MS_PER_POINT: u64 = 350;

// === Structs ===

/// A single ranked entry. `copy`/`drop`/`store` so the whole table can be
/// snapshotted into the week-finalised event.
public struct Entry has store, copy, drop {
    player: address,
    score: u64,
    revive_count: u16,
    timestamp_ms: u64,
    ruleset_version: u16,
}

/// The shared weekly leaderboard.
///
/// `week_index` / `week_seed` are rolled lazily by `game::start_run` — the first
/// run of a new week finalises the previous week and reseeds. Init state is
/// `week_index: 0`, which `week_index_at` only ever returns for timestamps inside
/// the first week of 1970; any real clock reading forces the very first
/// `start_run` to perform a roll and draw a real seed.
public struct Board has key {
    id: UID,
    week_index: u64,
    week_seed: u256,
    entries: vector<Entry>,
    max_size: u64,
    ruleset_version: u16,
    min_ms_per_point: u64,
    max_score: u64,
    max_revives: u16,
}

/// Tuning capability. Gates the setters below and NOTHING else.
/// No fund powers exist in this package for it to hold.
public struct AdminCap has key {
    id: UID,
}

// === Init ===

fun init(ctx: &mut TxContext) {
    transfer::transfer(AdminCap { id: object::new(ctx) }, ctx.sender());

    transfer::share_object(Board {
        id: object::new(ctx),
        week_index: 0,
        week_seed: 0,
        entries: vector[],
        max_size: DEFAULT_MAX_SIZE,
        ruleset_version: DEFAULT_RULESET_VERSION,
        min_ms_per_point: DEFAULT_MIN_MS_PER_POINT,
        max_score: DEFAULT_MAX_SCORE,
        max_revives: DEFAULT_MAX_REVIVES,
    });
}

// === Week Math ===

/// Milliseconds per leaderboard week.
public fun week_ms(): u64 { WEEK_MS }

/// Unix ms of the week-0 boundary (1970-01-04T00:00:00Z, a Sunday).
public fun week_anchor_ms(): u64 { WEEK_ANCHOR_MS }

/// The leaderboard week index containing `timestamp_ms`.
/// Aborts on timestamps before the anchor (pre-1970-01-04); the on-chain Clock
/// is always far past it.
public fun week_index_at(timestamp_ms: u64): u64 {
    (timestamp_ms - WEEK_ANCHOR_MS) / WEEK_MS
}

/// Unix ms at which `week_index` begins.
public fun week_start_ms(week_index: u64): u64 {
    WEEK_ANCHOR_MS + week_index * WEEK_MS
}

// === Views ===

public fun week_index(board: &Board): u64 { board.week_index }

public fun week_seed(board: &Board): u256 { board.week_seed }

public fun entries(board: &Board): &vector<Entry> { &board.entries }

public fun entry_count(board: &Board): u64 { board.entries.length() }

public fun max_size(board: &Board): u64 { board.max_size }

public fun ruleset_version(board: &Board): u16 { board.ruleset_version }

public fun min_ms_per_point(board: &Board): u64 { board.min_ms_per_point }

public fun max_score(board: &Board): u64 { board.max_score }

public fun max_revives(board: &Board): u16 { board.max_revives }

public fun entry_player(entry: &Entry): address { entry.player }

public fun entry_score(entry: &Entry): u64 { entry.score }

public fun entry_revive_count(entry: &Entry): u16 { entry.revive_count }

public fun entry_timestamp_ms(entry: &Entry): u64 { entry.timestamp_ms }

public fun entry_ruleset_version(entry: &Entry): u16 { entry.ruleset_version }

// === Qualification & Insertion ===

/// True if `score` would land on the board: either the board isn't full, or the
/// score beats the current last place (ties broken by earlier timestamp).
public fun qualifies(board: &Board, score: u64, timestamp_ms: u64): bool {
    let len = board.entries.length();
    if (len < board.max_size) {
        return true
    };
    // Compare against the last (lowest) entry
    let last = &board.entries[len - 1];
    if (score > last.score) {
        return true
    };
    // Tie-break: earlier timestamp wins
    if (score == last.score && timestamp_ms < last.timestamp_ms) {
        return true
    };
    false
}

/// Insert a score with per-player deduplication.
/// Returns true if the entry was placed or updated, false if the score didn't
/// qualify or wasn't an improvement over the player's existing entry.
///
/// Rules (ported verbatim from the v1 `leaderboard::submit_score`):
/// - One entry per player per week.
/// - Existing entry with a higher or equal score wins — returns false.
/// - Existing entry with a lower score is replaced.
/// - Otherwise normal qualification applies.
/// - Sorted descending by score; ties broken by earlier `timestamp_ms`.
/// - Trimmed to `max_size`.
public(package) fun insert_entry(
    board: &mut Board,
    player: address,
    score: u64,
    revive_count: u16,
    timestamp_ms: u64,
    ruleset_version: u16,
): bool {
    // Check for existing entry by this player
    let len = board.entries.length();
    let mut existing_idx: u64 = len; // sentinel: no existing entry found
    let mut i = 0;
    while (i < len) {
        if (board.entries[i].player == player) {
            existing_idx = i;
            break
        };
        i = i + 1;
    };

    if (existing_idx < len) {
        // Player already has an entry — only replace if new score is strictly better
        let existing_score = board.entries[existing_idx].score;
        if (score <= existing_score) {
            return false
        };
        // Remove old entry before re-inserting at new position
        board.entries.remove(existing_idx);
    };

    // Check if score qualifies (after potentially removing old entry)
    if (!qualifies(board, score, timestamp_ms)) {
        return false
    };

    let entry = Entry {
        player,
        score,
        revive_count,
        timestamp_ms,
        ruleset_version,
    };

    // Find insertion position (sorted descending by score, ties broken by earlier timestamp)
    let current_len = board.entries.length();
    let mut insert_pos = current_len; // default: end
    i = 0;
    while (i < current_len) {
        let existing = &board.entries[i];
        if (score > existing.score || (score == existing.score && timestamp_ms < existing.timestamp_ms)) {
            insert_pos = i;
            break
        };
        i = i + 1;
    };

    // Insert at position
    board.entries.insert(entry, insert_pos);

    // Trim to max size
    while (board.entries.length() > board.max_size) {
        board.entries.pop_back();
    };

    true
}

// === Week Roll (package-internal, driven by `game::start_run`) ===

/// Snapshot the current entries (used by the week-finalised event).
public(package) fun snapshot_entries(board: &Board): vector<Entry> {
    board.entries
}

/// Clear the table and move the board onto a new week with a fresh seed.
public(package) fun roll_week(board: &mut Board, week_index: u64, week_seed: u256) {
    board.entries = vector[];
    board.week_index = week_index;
    board.week_seed = week_seed;
}

// === Admin (tuning only — no fund powers, no entry writes) ===

public fun set_max_size(_: &AdminCap, board: &mut Board, new_max_size: u64) {
    assert!(new_max_size > 0, EInvalidMaxSize);
    board.max_size = new_max_size;
    while (board.entries.length() > board.max_size) {
        board.entries.pop_back();
    };
}

public fun set_ruleset_version(_: &AdminCap, board: &mut Board, new_version: u16) {
    assert!(new_version > 0, EInvalidRulesetVersion);
    board.ruleset_version = new_version;
}

public fun set_min_ms_per_point(_: &AdminCap, board: &mut Board, new_min_ms_per_point: u64) {
    board.min_ms_per_point = new_min_ms_per_point;
}

public fun set_max_score(_: &AdminCap, board: &mut Board, new_max_score: u64) {
    assert!(new_max_score > 0, EInvalidMaxScore);
    board.max_score = new_max_score;
}

public fun set_max_revives(_: &AdminCap, board: &mut Board, new_max_revives: u16) {
    board.max_revives = new_max_revives;
}

// === Test Helpers ===

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(ctx);
}

#[test_only]
public fun create_for_testing(max_size: u64, ctx: &mut TxContext): Board {
    Board {
        id: object::new(ctx),
        week_index: 0,
        week_seed: 0,
        entries: vector[],
        max_size,
        ruleset_version: DEFAULT_RULESET_VERSION,
        min_ms_per_point: DEFAULT_MIN_MS_PER_POINT,
        max_score: DEFAULT_MAX_SCORE,
        max_revives: DEFAULT_MAX_REVIVES,
    }
}

#[test_only]
public fun destroy_for_testing(board: Board) {
    let Board {
        id,
        week_index: _,
        week_seed: _,
        entries: _,
        max_size: _,
        ruleset_version: _,
        min_ms_per_point: _,
        max_score: _,
        max_revives: _,
    } = board;
    id.delete();
}

#[test_only]
public fun insert_entry_for_testing(
    board: &mut Board,
    player: address,
    score: u64,
    revive_count: u16,
    timestamp_ms: u64,
    ruleset_version: u16,
): bool {
    insert_entry(board, player, score, revive_count, timestamp_ms, ruleset_version)
}

#[test_only]
public fun default_min_ms_per_point(): u64 { DEFAULT_MIN_MS_PER_POINT }

#[test_only]
public fun default_max_size(): u64 { DEFAULT_MAX_SIZE }

#[test_only]
public fun default_ruleset_version(): u16 { DEFAULT_RULESET_VERSION }

#[test_only]
public fun default_max_score(): u64 { DEFAULT_MAX_SCORE }

#[test_only]
public fun default_max_revives(): u16 { DEFAULT_MAX_REVIVES }
