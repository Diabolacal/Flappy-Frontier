interface GameOverScreenProps {
  score: number;
  bestScore: number;
  isRanked: boolean;
  isSubmitting: boolean;
  submitResult: { success: boolean; txDigest: string | null } | null;
  submitError: string | null;
  onSubmitScore: () => void;
  onRestart: () => void;
  onMenu: () => void;
}

export function GameOverScreen({
  score,
  bestScore,
  isRanked,
  isSubmitting,
  submitResult,
  submitError,
  onSubmitScore,
  onRestart,
  onMenu,
}: GameOverScreenProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-10">
      <h2 className="text-3xl font-bold tracking-widest text-red-400 mb-6">
        GAME OVER
      </h2>

      <div className="bg-gray-900/80 rounded-lg p-6 mb-6 min-w-[200px] text-center border border-gray-700">
        <div className="text-gray-400 text-sm mb-1">Score</div>
        <div className="text-white text-4xl font-bold mb-4">{score}</div>
        <div className="text-gray-400 text-sm mb-1">Best</div>
        <div className="text-orange-400 text-2xl font-bold">{bestScore}</div>
        {score >= bestScore && score > 0 && (
          <div className="text-yellow-400 text-xs mt-2">★ New Best!</div>
        )}
      </div>

      {/* Ranked score submission - auto-triggered, shows status */}
      {isRanked && (
        <div className="mb-4 w-56 text-center">
          {/* Auto-submitting state */}
          {isSubmitting && !submitResult && !submitError && (
            <div className="text-orange-300 text-sm mb-1">
              <div className="font-bold mb-1">Submitting score on-chain…</div>
              <div className="text-gray-400 text-xs">Approve the transaction in your wallet</div>
            </div>
          )}

          {/* Success */}
          {submitResult?.success && (
            <div className="p-3 bg-green-900/30 border border-green-700/50 rounded-lg">
              <div className="text-green-400 text-sm font-bold">Score submitted!</div>
              <div className="text-gray-400 text-xs mt-1">
                Your score of {score} is now on the leaderboard.
              </div>
              {submitResult.txDigest && (
                <div className="text-xs text-green-500/60 mt-1 font-mono">
                  tx: {submitResult.txDigest.slice(0, 16)}…
                </div>
              )}
            </div>
          )}

          {/* Error with retry */}
          {submitError && (
            <div className="p-3 bg-red-900/30 border border-red-700/50 rounded-lg">
              <div className="text-red-300 text-sm mb-2">{submitError}</div>
              <button
                onClick={onSubmitScore}
                disabled={isSubmitting}
                className="py-2 px-4 rounded bg-orange-600 hover:bg-orange-500
                           text-white font-bold text-sm transition-colors
                           disabled:opacity-50 disabled:cursor-wait"
              >
                Retry Submit
              </button>
            </div>
          )}

          {/* Waiting for auto-submit to kick in (brief moment) */}
          {!isSubmitting && !submitResult && !submitError && (
            <div className="text-gray-400 text-xs">Preparing score submission…</div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3 w-48">
        <button
          onClick={onRestart}
          className="py-3 px-6 rounded-lg bg-orange-600 hover:bg-orange-500
                     text-white font-bold transition-colors"
        >
          {isRanked ? 'NEW RANKED RUN' : 'RESTART'}
        </button>
        <button
          onClick={onMenu}
          className="py-2 px-6 rounded-lg bg-gray-700 hover:bg-gray-600
                     text-gray-300 text-sm transition-colors"
        >
          MENU
        </button>
      </div>
    </div>
  );
}
