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
  return {
    pipeGap: lerp(EARLY_GAP, LATE_GAP, progression(score, GAP_SCORE_CEIL)),
    pipeSpeed: lerp(EARLY_SPEED, LATE_SPEED, progression(score, SPEED_SCORE_CEIL)),
    gapYMinPct: lerp(EARLY_GAP_Y_MIN, LATE_GAP_Y_MIN, progression(score, RANGE_SCORE_CEIL)),
    gapYMaxPct: lerp(EARLY_GAP_Y_MAX, LATE_GAP_Y_MAX, progression(score, RANGE_SCORE_CEIL)),
    gapDeltaCap: lerp(EARLY_DELTA_CAP, LATE_DELTA_CAP, progression(score, DELTA_SCORE_CEIL)),
  };
}
