/**
 * Score-based difficulty progression.
 * Returns interpolated gameplay parameters that ramp from
 * forgiving (early) to challenging (late) as score increases.
 */

// Progression curve anchors
const EARLY_GAP = 160;       // px — forgiving vertical gap at score 0
const LATE_GAP = 115;        // px — tight gap at score ceiling
const GAP_SCORE_CEIL = 30;   // score at which gap reaches minimum

const EARLY_SPEED = 140;     // px/s — gentle scroll at score 0
const LATE_SPEED = 185;      // px/s — brisk scroll at score ceiling
const SPEED_SCORE_CEIL = 35; // score at which speed maxes out

// Endless scaling beyond the authored ceiling — prevents indefinitely long runs.
// Every 5 score past the ceiling, speed jumps +12 px/s.  Hard cap at 340 px/s
// (2.4× starting speed). At cap the time between pipes is ~0.82 s — extremely
// fast but still technically human-possible with perfect play.
const ENDLESS_SPEED_INTERVAL = 5;   // every N score beyond ceiling, speed bumps
const ENDLESS_SPEED_BUMP = 12;      // px/s added per interval
const ENDLESS_SPEED_MAX = 340;      // hard cap — game remains technically beatable

const EARLY_GAP_Y_MIN = 0.25;  // gap center won't be above 25% of play area
const LATE_GAP_Y_MIN = 0.13;   // widens to 13% at ceiling
const EARLY_GAP_Y_MAX = 0.75;  // gap center won't be below 75%
const LATE_GAP_Y_MAX = 0.87;   // widens to 87%
const RANGE_SCORE_CEIL = 20;   // score at which Y range fully widens

const EARLY_DELTA_CAP = 0.40;  // fraction of gap — gentle adjacent shifts
const LATE_DELTA_CAP = 0.75;   // allows larger vertical jumps between pipes
const DELTA_SCORE_CEIL = 25;

export interface DifficultyParams {
  pipeGap: number;
  pipeSpeed: number;
  gapYMinPct: number;
  gapYMaxPct: number;
  gapDeltaCap: number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function progression(score: number, ceiling: number): number {
  return Math.min(score / ceiling, 1);
}

export function getDifficulty(score: number): DifficultyParams {
  // Base authored curve (0 → ceiling)
  let pipeSpeed = lerp(EARLY_SPEED, LATE_SPEED, progression(score, SPEED_SCORE_CEIL));

  // Endless scaling: after the authored ceiling, bump speed every N points
  if (score > SPEED_SCORE_CEIL) {
    const intervals = Math.floor((score - SPEED_SCORE_CEIL) / ENDLESS_SPEED_INTERVAL);
    pipeSpeed = Math.min(pipeSpeed + intervals * ENDLESS_SPEED_BUMP, ENDLESS_SPEED_MAX);
  }

  return {
    pipeGap: lerp(EARLY_GAP, LATE_GAP, progression(score, GAP_SCORE_CEIL)),
    pipeSpeed,
    gapYMinPct: lerp(EARLY_GAP_Y_MIN, LATE_GAP_Y_MIN, progression(score, RANGE_SCORE_CEIL)),
    gapYMaxPct: lerp(EARLY_GAP_Y_MAX, LATE_GAP_Y_MAX, progression(score, RANGE_SCORE_CEIL)),
    gapDeltaCap: lerp(EARLY_DELTA_CAP, LATE_DELTA_CAP, progression(score, DELTA_SCORE_CEIL)),
  };
}
