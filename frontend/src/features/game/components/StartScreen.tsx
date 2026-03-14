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
  const { status, debug } = ssuWallet;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-10">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold tracking-widest text-white mb-1">
          FLAPPY
        </h1>
        <h1 className="text-4xl font-bold tracking-widest text-orange-400">
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
            className="py-2 px-4 rounded-lg bg-orange-900/60 hover:bg-orange-800/70
                       text-orange-300 text-sm border border-orange-600/50 transition-colors"
          >
            Use Game Client Wallet
          </button>
        ) : (
          /* status === 'unavailable' — normal browser, generic chooser */
          <button
            onClick={onConnect}
            className="py-2 px-4 rounded-lg bg-gray-800 hover:bg-gray-700
                       text-gray-300 text-sm border border-gray-600 transition-colors"
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
                   text-orange-400 text-sm border border-gray-700 transition-colors"
      >
        View Leaderboard
      </button>

      <div className="mt-6 text-gray-600 text-xs">
        Click or press Space to flap
      </div>

      {import.meta.env.DEV && (
      <div className="absolute bottom-2 left-2 right-2 flex justify-between text-[9px] text-gray-700 font-mono pointer-events-none">
        <span>build:direct-wallet-v4</span>
        <span>
          w:{debug.walletCount} s:{status} {debug.settled ? '✓' : '…'}
          {debug.walletNames.length > 0 && ` [${debug.walletNames.join(',')}]`}
        </span>
      </div>
      )}
    </div>
  );
}
