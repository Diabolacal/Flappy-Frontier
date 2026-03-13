import type { ScoreSubmission, SubmitResult } from '../types';

const SCORES_KEY = 'flappy-frontier-scores';
const MAX_LOCAL_SCORES = 10;

interface StoredScore {
  score: number;
  seed: number;
  timestamp: number;
}

export async function submitScore(submission: ScoreSubmission): Promise<SubmitResult> {
  try {
    const scores = getLocalScores();
    scores.push({
      score: submission.score,
      seed: submission.runSeed,
      timestamp: Date.now(),
    });
    scores.sort((a, b) => b.score - a.score);
    if (scores.length > MAX_LOCAL_SCORES) scores.length = MAX_LOCAL_SCORES;
    localStorage.setItem(SCORES_KEY, JSON.stringify(scores));
  } catch {
    // localStorage unavailable
  }

  return { success: true, txDigest: null, target: 'local' };
}

export function getLocalScores(): StoredScore[] {
  try {
    const raw = localStorage.getItem(SCORES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StoredScore[];
  } catch {
    return [];
  }
}
