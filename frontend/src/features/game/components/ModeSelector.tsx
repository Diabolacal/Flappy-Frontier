import type { GameMode } from '@/game/types';
import { GAME_MODES } from '@/features/game/types';

interface ModeSelectorProps {
  onSelectMode: (mode: GameMode) => void;
}

export function ModeSelector({ onSelectMode }: ModeSelectorProps) {
  return (
    <div className="flex gap-4 w-full max-w-sm">
      <button
        onClick={() => onSelectMode('practice')}
        className="flex-1 py-4 px-3 rounded-lg border-2 border-emerald-500/50 bg-emerald-950/40
                   hover:bg-emerald-900/50 hover:border-emerald-400 transition-colors text-left"
      >
        <div className="text-emerald-400 font-bold text-lg">{GAME_MODES.practice.label}</div>
        <div className="text-gray-400 text-sm mt-1">{GAME_MODES.practice.description}</div>
      </button>
      <button
        disabled
        className="flex-1 py-4 px-3 rounded-lg border-2 border-gray-700 bg-gray-900/40
                   opacity-50 cursor-not-allowed text-left relative"
        title="Requires wallet connection"
      >
        <div className="absolute top-2 right-2 text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded">
          🔒
        </div>
        <div className="text-gray-400 font-bold text-lg">{GAME_MODES.ranked.label}</div>
        <div className="text-gray-500 text-sm mt-1">{GAME_MODES.ranked.description}</div>
      </button>
    </div>
  );
}
