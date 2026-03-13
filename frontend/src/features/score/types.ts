export interface ScoreSubmission {
  score: number;
  runSeed: number;
  gameHash: string;
  runId: string | null;
}

export interface SubmitResult {
  success: boolean;
  txDigest: string | null;
  target: 'local' | 'chain';
}
