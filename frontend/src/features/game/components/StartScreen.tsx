import type { GameMode } from '@/game/types';
import type { SSUWalletInfo } from '@/features/auth/hooks/useSSUWallet';
import { ModeSelector } from './ModeSelector';

interface StartScreenProps {
  bestScore: number;
  canPlayRanked: boolean;
  playerAddress: string | null;
  entryFeeDisplay: string;
  ssuWallet: SSUWalletInfo;
  onStart: (mode: GameMode) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onShowLeaderboard: () => void;
}

export function StartScreen({
  bestScore,
  canPlayRanked,
  playerAddress,
  entryFeeDisplay,
  ssuWallet,
  onStart,
  onConnect,
  onDisconnect,
  onShowLeaderboard,
}: StartScreenProps) {
  // Use status as the primary driver for what to show, not isSSU directly.
  // During 'detecting' phase, neither SSU nor generic path is committed.
  const { status } = ssuWallet;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-10">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold tracking-widest text-white mb-1">
          FLAPPY
        </h1>
        <h1 className="text-4xl font-bold tracking-widest" style={{ color: '#ff4c26' }}>
          FRONTIER
        </h1>
      </div>

      {/* Wallet connection — driven by SSU wallet status */}
      <div className="mb-6">
        {playerAddress ? (
          <div className="flex items-center gap-2">
            <span className="text-green-400 text-xs">●</span>
            <span className="text-gray-300 text-sm font-mono">
              {playerAddress.slice(0, 6)}…{playerAddress.slice(-4)}
            </span>
            <button
              onClick={onDisconnect}
              className="text-gray-500 hover:text-gray-300 text-xs ml-2 underline"
            >
              Disconnect
            </button>
          </div>
        ) : status === 'detecting' ? (
          <span className="text-gray-400 text-sm">Detecting wallet…</span>
        ) : status === 'auto-connecting' ? (
          <span className="text-orange-400 text-sm">Connecting…</span>
        ) : status === 'connected' ? (
          /* Brief flash before playerAddress propagates */
          <span className="text-green-400 text-sm">Connected</span>
        ) : status === 'ready' ? (
          /* SSU wallet found, auto-connect didn't fire — direct button */
          <button
            onClick={onConnect}
            className="py-2 px-5 rounded-lg text-sm font-bold border transition-colors"
            style={{
              backgroundColor: 'rgba(255, 76, 38, 0.15)',
              borderColor: '#ff4c26',
              color: '#ff4c26',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 76, 38, 0.3)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 76, 38, 0.15)'; }}
          >
            Use Game Client Wallet
          </button>
        ) : (
          /* status === 'unavailable' — normal browser, generic chooser */
          <button
            onClick={onConnect}
            className="py-2 px-5 rounded-lg text-white text-sm font-bold border transition-colors"
            style={{
              backgroundColor: 'rgba(255, 76, 38, 0.15)',
              borderColor: '#ff4c26',
              color: '#ff4c26',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 76, 38, 0.3)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 76, 38, 0.15)'; }}
          >
            Connect Wallet
          </button>
        )}
      </div>

      <ModeSelector
        onSelectMode={onStart}
        canPlayRanked={canPlayRanked}
        entryFeeDisplay={entryFeeDisplay}
      />

      {bestScore > 0 && (
        <div className="mt-6 text-gray-400 text-sm">
          Best Score: <span className="text-white font-bold">{bestScore}</span>
        </div>
      )}

      <button
        onClick={onShowLeaderboard}
        className="mt-4 py-2 px-4 rounded-lg bg-gray-800/60 hover:bg-gray-700/60
                   text-sm border border-gray-700 transition-colors"
        style={{ color: '#ff4c26' }}
      >
        View Leaderboard
      </button>

      <div className="mt-6 text-gray-500 text-xs">
        Click or press Space to flap
      </div>


    </div>
  );
}
