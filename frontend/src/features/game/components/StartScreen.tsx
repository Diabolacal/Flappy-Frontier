import type { GameMode } from '@/game/types';
import { ModeSelector } from './ModeSelector';

interface StartScreenProps {
  bestScore: number;
  onStart: (mode: GameMode) => void;
}

export function StartScreen({ bestScore, onStart }: StartScreenProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-10">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold tracking-widest text-white mb-1">
          FLAPPY
        </h1>
        <h1 className="text-4xl font-bold tracking-widest text-emerald-400">
          FRONTIER
        </h1>
      </div>

      <ModeSelector onSelectMode={onStart} />

      {bestScore > 0 && (
        <div className="mt-6 text-gray-400 text-sm">
          Best Score: <span className="text-white font-bold">{bestScore}</span>
        </div>
      )}

      <div className="mt-8 text-gray-600 text-xs">
        Click or press Space to flap
      </div>
    </div>
  );
}
