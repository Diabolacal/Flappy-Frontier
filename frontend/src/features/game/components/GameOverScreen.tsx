interface GameOverScreenProps {
  score: number;
  bestScore: number;
  onRestart: () => void;
  onMenu: () => void;
}

export function GameOverScreen({ score, bestScore, onRestart, onMenu }: GameOverScreenProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-10">
      <h2 className="text-3xl font-bold tracking-widest text-red-400 mb-6">
        GAME OVER
      </h2>

      <div className="bg-gray-900/80 rounded-lg p-6 mb-6 min-w-[200px] text-center border border-gray-700">
        <div className="text-gray-400 text-sm mb-1">Score</div>
        <div className="text-white text-4xl font-bold mb-4">{score}</div>
        <div className="text-gray-400 text-sm mb-1">Best</div>
        <div className="text-emerald-400 text-2xl font-bold">{bestScore}</div>
        {score >= bestScore && score > 0 && (
          <div className="text-yellow-400 text-xs mt-2">★ New Best!</div>
        )}
      </div>

      <div className="flex flex-col gap-3 w-48">
        <button
          onClick={onRestart}
          className="py-3 px-6 rounded-lg bg-emerald-600 hover:bg-emerald-500
                     text-white font-bold transition-colors"
        >
          RESTART
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
