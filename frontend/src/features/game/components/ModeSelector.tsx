import type { GameMode } from '@/game/types';
import { GAME_MODES } from '@/features/game/types';

interface ModeSelectorProps {
  onSelectMode: (mode: GameMode) => void;
  canPlayRanked: boolean;
  entryFeeDisplay: string;
}

export function ModeSelector({ onSelectMode, canPlayRanked, entryFeeDisplay }: ModeSelectorProps) {
  return (
    <div className="flex gap-4 w-full max-w-sm">
      <button
        onClick={() => onSelectMode('practice')}
        className="flex-1 py-4 px-3 rounded-lg border-2 border-orange-500/50 bg-orange-950/40
                   hover:bg-orange-900/50 hover:border-orange-400 transition-colors text-left"
      >
        <div className="text-orange-400 font-bold text-lg">{GAME_MODES.practice.label}</div>
        <div className="text-gray-400 text-sm mt-1">{GAME_MODES.practice.description}</div>
      </button>
      <button
        disabled={!canPlayRanked}
        onClick={() => onSelectMode('ranked')}
        className={`flex-1 py-4 px-3 rounded-lg border-2 text-left relative transition-colors ${
          canPlayRanked
            ? 'border-orange-500/50 bg-orange-950/40 hover:bg-orange-900/50 hover:border-orange-400 cursor-pointer'
            : 'border-gray-700 bg-gray-900/40 opacity-50 cursor-not-allowed'
        }`}
        title={canPlayRanked ? `Entry fee: ${entryFeeDisplay}` : 'Connect wallet to play ranked'}
      >
        {!canPlayRanked && (
          <div className="absolute top-2 right-2 text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded">
            🔒
          </div>
        )}
        <div className={`font-bold text-lg ${canPlayRanked ? 'text-orange-400' : 'text-gray-400'}`}>
          {GAME_MODES.ranked.label}
        </div>
        <div className={`text-sm mt-1 ${canPlayRanked ? 'text-gray-400' : 'text-gray-500'}`}>
          {canPlayRanked ? `Entry: ${entryFeeDisplay}` : 'Connect wallet to compete'}
        </div>
      </button>
    </div>
  );
}
