import { Transaction } from '@mysten/sui/transactions';
import { CONTRACT_CONFIG } from '@/lib/contractConfig';
import type { ScoreSubmission, SubmitResult } from '../types';

const SCORES_KEY = 'flappy-frontier-scores';
const MAX_LOCAL_SCORES = 10;

interface StoredScore {
  score: number;
  seed: number;
  timestamp: number;
}

/**
 * Build a PTB for `game::submit_score<EVE>()`.
 * Requires a RunReceipt object ID from a prior `start_run` transaction.
 * The receipt is consumed (deleted) by the contract.
 */
export function buildSubmitScoreTransaction(
  score: number,
  receiptObjectId: string,
): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${CONTRACT_CONFIG.packageId}::game::submit_score`,
    typeArguments: [CONTRACT_CONFIG.eveCoinType],
    arguments: [
      tx.object(CONTRACT_CONFIG.leaderboardId),
      tx.object(CONTRACT_CONFIG.treasuryId),
      tx.object(receiptObjectId),
      tx.pure.u64(score),
      tx.object(CONTRACT_CONFIG.clockObjectId),
    ],
  });

  return tx;
}

/**
 * Build a PTB for `game::trigger_payout<EVE>()`.
 * Public-callable by anyone once the epoch has expired.
 * Distributes treasury funds to leaderboard winners and resets the epoch.
 */
export function buildTriggerPayoutTransaction(): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${CONTRACT_CONFIG.packageId}::game::trigger_payout`,
    typeArguments: [CONTRACT_CONFIG.eveCoinType],
    arguments: [
      tx.object(CONTRACT_CONFIG.treasuryId),
      tx.object(CONTRACT_CONFIG.leaderboardId),
      tx.object(CONTRACT_CONFIG.gameConfigId),
      tx.object(CONTRACT_CONFIG.clockObjectId),
    ],
  });

  return tx;
}

export async function submitScore(submission: ScoreSubmission): Promise<SubmitResult> {
  // Always save locally
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
