import { useEffect, useState, useCallback } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { CONTRACT_CONFIG } from '@/lib/contractConfig';
import { buildTriggerPayoutTransaction } from '@/features/score/services/scoreService';
import { useGameTransaction } from '@/features/auth/hooks/useGameTransaction';

interface LeaderboardEntry {
  player: string;
  score: number;
  timestamp_ms: number;
}

interface LeaderboardData {
  entries: LeaderboardEntry[];
  prizePool: number;
  epochStartMs: number;
  currentEpoch: number;
}

function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatEve(baseUnits: number): string {
  return (baseUnits / 1_000_000_000).toFixed(0);
}

function epochTimeState(epochStartMs: number, durationMs: number): { label: string; expired: boolean } {
  const endMs = epochStartMs + durationMs;
  const remainMs = endMs - Date.now();
  if (remainMs <= 0) return { label: 'Epoch ended', expired: true };
  const minutes = Math.floor(remainMs / 60_000);
  const seconds = Math.floor((remainMs % 60_000) / 1_000);
  if (minutes > 60) {
    const hours = Math.floor(minutes / 60);
    return { label: `${hours}h ${minutes % 60}m`, expired: false };
  }
  return { label: `${minutes}m ${seconds}s`, expired: false };
}

export function LeaderboardPanel({ onClose }: { onClose: () => void }) {
  const { execute: executeTransaction, sponsorship, suiClient } = useGameTransaction();
  const account = useCurrentAccount();
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Payout trigger state
  const [isPayingOut, setIsPayingOut] = useState(false);
  const [payoutResult, setPayoutResult] = useState<string | null>(null);
  const [payoutError, setPayoutError] = useState<string | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [lbResult, treasuryResult] = await Promise.all([
        suiClient.getObject({
          id: CONTRACT_CONFIG.leaderboardId,
          options: { showContent: true },
        }),
        suiClient.getObject({
          id: CONTRACT_CONFIG.treasuryId,
          options: { showContent: true },
        }),
      ]);

      const lbContent = lbResult.data?.content;
      if (!lbContent || lbContent.dataType !== 'moveObject') {
        throw new Error('Failed to read leaderboard');
      }
      const lbFields = lbContent.fields as Record<string, unknown>;
      const rawEntries = (lbFields['entries'] as Array<{ fields: Record<string, string> }>) ?? [];
      const entries: LeaderboardEntry[] = rawEntries.map((e) => ({
        player: e.fields['player'] ?? '',
        score: Number(e.fields['score'] ?? 0),
        timestamp_ms: Number(e.fields['timestamp_ms'] ?? 0),
      }));

      const tContent = treasuryResult.data?.content;
      let prizePool = 0;
      let epochStartMs = 0;
      let currentEpoch = 1;
      if (tContent && tContent.dataType === 'moveObject') {
        const tFields = tContent.fields as Record<string, unknown>;
        const balanceField = tFields['balance'] as string | number | undefined;
        prizePool = Number(balanceField ?? 0);
        epochStartMs = Number(tFields['epoch_start_ms'] ?? 0);
        currentEpoch = Number(tFields['current_epoch'] ?? 1);
      }

      setData({ entries, prizePool, epochStartMs, currentEpoch });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  }, [suiClient]);

  useEffect(() => {
    void fetchLeaderboard();
    const interval = setInterval(() => void fetchLeaderboard(), 30_000);
    return () => clearInterval(interval);
  }, [fetchLeaderboard]);

  // Countdown timer update
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1_000);
    return () => clearInterval(timer);
  }, []);

  const handleTriggerPayout = useCallback(async () => {
    if (isPayingOut) return;
    setIsPayingOut(true);
    setPayoutError(null);
    setPayoutResult(null);

    try {
      const tx = buildTriggerPayoutTransaction();
      const result = await executeTransaction(tx, account?.address ?? '');
      const digest = (result as { digest?: string }).digest ?? null;
      setPayoutResult(digest);
      // Refresh leaderboard to show post-payout state
      await fetchLeaderboard();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Payout trigger failed';
      if (msg.includes('EEpochNotExpired') || msg.includes('epoch')) {
        setPayoutError('Epoch has not expired yet. Payout will be available once the timer reaches zero.');
      } else if (msg.includes('insufficient') || msg.includes('gas')) {
        setPayoutError(
          sponsorship.canSponsorGameTx
            ? 'Gas sponsorship failed for payout trigger. Please try again.'
            : 'Insufficient SUI for gas. You need a small amount of SUI to send this transaction.',
        );
      } else {
        setPayoutError(msg);
      }
    } finally {
      setIsPayingOut(false);
    }
  }, [isPayingOut, executeTransaction, fetchLeaderboard, account?.address, sponsorship.canSponsorGameTx]);

  const timeState = data
    ? epochTimeState(data.epochStartMs, CONTRACT_CONFIG.epochDurationMs)
    : null;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-[360px] max-h-[90%] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-orange-400">Leaderboard</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-lg"
          >
            ✕
          </button>
        </div>

        {/* Epoch info */}
        {data && timeState && (
          <div className="mb-4 text-sm space-y-1">
            <div className="flex justify-between text-gray-400">
              <span>Epoch</span>
              <span className="text-white">#{data.currentEpoch}</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Prize Pool</span>
              <span className="text-orange-400 font-bold">
                {formatEve(data.prizePool)} EVE
              </span>
            </div>
            {data.prizePool > 0 && (
              <div className="text-gray-500 text-xs">
                Entry fees are held on-chain in the treasury — not controlled by any operator.
              </div>
            )}
            <div className="flex justify-between text-gray-400">
              <span>{timeState.expired ? 'Status' : 'Time Left'}</span>
              <span className={timeState.expired ? 'text-yellow-400 font-bold' : 'text-white'}>
                {timeState.label}
              </span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Splits</span>
              <span className="text-gray-300 text-xs">
                1st:{CONTRACT_CONFIG.payoutShares[0]}% 2nd:{CONTRACT_CONFIG.payoutShares[1]}% 3rd:{CONTRACT_CONFIG.payoutShares[2]}%
              </span>
            </div>

            {/* Payout trigger - shown when epoch expired and prizes exist */}
            {timeState.expired && data.prizePool > 0 && data.entries.length > 0 && (
              <div className="mt-3 p-3 bg-yellow-900/30 border border-yellow-700/50 rounded-lg">
                <div className="text-yellow-300 text-xs mb-2">
                  Epoch has ended. {formatEve(data.prizePool)} EVE is ready to be distributed
                  to the top {Math.min(data.entries.length, CONTRACT_CONFIG.payoutShares.length)} players.
                  Anyone can trigger this — it&apos;s a public on-chain action.
                </div>
                {account ? (
                  <button
                    onClick={() => void handleTriggerPayout()}
                    disabled={isPayingOut}
                    className="w-full py-2 rounded bg-yellow-600 hover:bg-yellow-500
                               text-black font-bold text-sm transition-colors
                               disabled:opacity-50 disabled:cursor-wait"
                  >
                    {isPayingOut ? 'Triggering Payout…' : 'Trigger Epoch Payout'}
                  </button>
                ) : (
                  <div className="text-yellow-400/60 text-xs text-center">
                    Connect a wallet to trigger payout
                  </div>
                )}
              </div>
            )}

            {/* Epoch ended, no entries */}
            {timeState.expired && data.entries.length === 0 && (
              <div className="mt-2 text-gray-500 text-xs">
                Epoch ended with no entries. A new epoch will start when the next ranked run begins.
              </div>
            )}

            {/* Payout result feedback */}
            {payoutResult && (
              <div className="mt-2 p-2 bg-green-900/30 border border-green-700/50 rounded text-green-300 text-xs">
                Payout distributed! New epoch started.
                <div className="text-green-500/60 font-mono mt-1">tx: {payoutResult.slice(0, 16)}…</div>
              </div>
            )}
            {payoutError && (
              <div className="mt-2 p-2 bg-red-900/30 border border-red-700/50 rounded text-red-300 text-xs">
                {payoutError}
              </div>
            )}
          </div>
        )}

        <div className="border-t border-gray-700 pt-3">
          {loading && !data && (
            <div className="text-gray-400 text-center py-4">Loading…</div>
          )}

          {error && (
            <div className="text-red-400 text-center py-4 text-sm">{error}</div>
          )}

          {data && data.entries.length === 0 && (
            <div className="text-gray-500 text-center py-4 text-sm">
              No scores yet this epoch. Be the first!
            </div>
          )}

          {data && data.entries.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs">
                  <th className="text-left pb-2">#</th>
                  <th className="text-left pb-2">Player</th>
                  <th className="text-right pb-2">Score</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((entry, i) => (
                  <tr
                    key={`${entry.player}-${i}`}
                    className={`border-t border-gray-800 ${
                      i < 3 ? 'text-orange-300' : 'text-gray-300'
                    }`}
                  >
                    <td className="py-1.5 font-bold">{i + 1}</td>
                    <td className="py-1.5 font-mono text-xs">
                      {shortenAddress(entry.player)}
                    </td>
                    <td className="py-1.5 text-right font-bold">{entry.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <button
          onClick={() => void fetchLeaderboard()}
          className="mt-4 w-full py-2 text-sm bg-gray-800 hover:bg-gray-700
                     text-gray-300 rounded transition-colors"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
