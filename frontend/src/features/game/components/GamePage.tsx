import { useState, useCallback, useRef, useEffect } from 'react';
import { ConnectModal } from '@mysten/dapp-kit';
import type { GamePhase, GameMode } from '@/game/types';
import type { GameLoopHandle } from '@/game/gameLoop';
import { CANVAS_WIDTH, CANVAS_HEIGHT, RESTART_DELAY } from '@/game/constants';
import { CONTRACT_CONFIG } from '@/lib/contractConfig';
import { buildStartRunTransaction, parseSeedFromEvents } from '@/lib/seedProvider';
import { buildSubmitScoreTransaction, submitScore } from '@/features/score/services/scoreService';
import { usePlayerIdentity } from '@/features/auth/hooks/usePlayerIdentity';
import { useGameTransaction } from '@/features/auth/hooks/useGameTransaction';
import { usePlayerName } from '@/features/auth/hooks/usePlayerName';
import type { SSUWalletInfo } from '@/features/auth/hooks/useSSUWallet';
import { LeaderboardPanel } from '@/features/score/components/LeaderboardPanel';
import { GameCanvas } from './GameCanvas';
import { StartScreen } from './StartScreen';
import { GameOverScreen } from './GameOverScreen';
import { ReadyOverlay } from './ReadyOverlay';
import { LogoBadge } from './LogoBadge';

type ScreenState = 'menu' | 'startingRanked' | 'ready' | 'playing' | 'dying' | 'gameOver';

const ENTRY_FEE_EVE = CONTRACT_CONFIG.entryFeeAmount / 1_000_000_000;
const ENTRY_FEE_LUX = ENTRY_FEE_EVE * 100;
const ENTRY_FEE_DISPLAY = `${ENTRY_FEE_EVE} EVE (${ENTRY_FEE_LUX.toLocaleString()} LUX)`;

interface GamePageProps {
  ssuWallet: SSUWalletInfo;
}

export function GamePage({ ssuWallet }: GamePageProps) {
  const { execute: executeTransaction, sponsorship, suiClient } = useGameTransaction();
  const playerName = usePlayerName(usePlayerIdentity().player.address);
  const { player, canPlayRanked, disconnect } = usePlayerIdentity();

  const [screenState, setScreenState] = useState<ScreenState>('menu');
  const [displayScore, setDisplayScore] = useState(0);
  const [displayBestScore, setDisplayBestScore] = useState(() => {
    try {
      // Show max of both mode bests on initial load (before a mode is selected)
      const practice = parseInt(localStorage.getItem('flappy-frontier-best-practice') ?? '0', 10) || 0;
      const ranked = parseInt(localStorage.getItem('flappy-frontier-best-ranked') ?? '0', 10) || 0;
      if (practice === 0 && ranked === 0) {
        // Migration: fall back to legacy shared key
        return parseInt(localStorage.getItem('flappy-frontier-best') ?? '0', 10) || 0;
      }
      return Math.max(practice, ranked);
    } catch { return 0; }
  });
  const [selectedMode, setSelectedMode] = useState<GameMode>('practice');
  const [isCanvasActive, setIsCanvasActive] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);

  // Ranked run state
  const [chainSeed, setChainSeed] = useState<number | undefined>(undefined);
  const [chainRunSeed, setChainRunSeed] = useState<string | null>(null);
  const [rankedError, setRankedError] = useState<string | null>(null);

  // Score submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; txDigest: string | null } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Track final score for auto-submit (displayScore may lag behind setState)
  const finalScoreRef = useRef(0);

  const loopRef = useRef<GameLoopHandle | null>(null);
  const canRestartRef = useRef(true);

  const handleStart = useCallback(async (mode: GameMode) => {
    setSelectedMode(mode);
    setDisplayScore(0);
    setSubmitResult(null);
    setSubmitError(null);
    setRankedError(null);

    if (mode === 'ranked' && player.address) {
      // Ranked: fetch chain seed via start_run PTB
      setScreenState('startingRanked');
      try {
        const tx = await buildStartRunTransaction(suiClient, player.address);
        const result = await executeTransaction(tx, player.address);
        const events = (result as { events?: Array<{ type: string; parsedJson?: Record<string, unknown> }> }).events ?? [];
        const seed = parseSeedFromEvents(events);
        // Also extract the raw u256 seed for score submission
        const runEvent = events.find((e) => e.type.includes('::game::RunStartedEvent'));
        const rawSeed = String(runEvent?.parsedJson?.['seed'] ?? '0');

        setChainSeed(seed);
        setChainRunSeed(rawSeed);
        setScreenState('ready');
        setIsCanvasActive(true);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to start ranked run';
        if (msg.includes('No EVE coins') || msg.includes('Insufficient EVE')) {
          setRankedError('Not enough EVE for the entry fee. Open Keeper > Wallet > Open Currency Exchange and swap LUX to EVE (10 LUX = 100 EVE).');
        } else if (msg.includes('insufficient') || msg.includes('gas')) {
          setRankedError(
            sponsorship.canSponsorGameTx
              ? 'Gas sponsorship failed unexpectedly. Please try again.'
              : 'Insufficient SUI for gas. You need SUI to pay transaction fees, plus EVE for the entry fee.',
          );
        } else if (msg.includes('rejected') || msg.includes('denied')) {
          setRankedError('Transaction was rejected in your wallet. Try again when ready.');
        } else {
          setRankedError(msg);
        }
        setScreenState('menu');
      }
    } else {
      // Practice: synchronous local seed
      setChainSeed(undefined);
      setChainRunSeed(null);
      setScreenState('ready');
      setIsCanvasActive(true);
    }
  }, [player.address, suiClient, executeTransaction, sponsorship.canSponsorGameTx]);

  const handleScoreChange = useCallback((score: number) => {
    setDisplayScore(score);
  }, []);

  const handleGameOver = useCallback((score: number, bestScore: number) => {
    setDisplayScore(score);
    setDisplayBestScore(bestScore);
    finalScoreRef.current = score;
    canRestartRef.current = false;
    setTimeout(() => { canRestartRef.current = true; }, RESTART_DELAY);
  }, []);

  const handlePhaseChange = useCallback((phase: GamePhase) => {
    if (phase === 'playing') setScreenState('playing');
    else if (phase === 'dying') setScreenState('dying');
    else if (phase === 'dead') setScreenState('gameOver');
    else if (phase === 'ready') setScreenState('ready');
  }, []);

  const handleSubmitScore = useCallback(async () => {
    if (!chainRunSeed || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);

    const scoreToSubmit = finalScoreRef.current || displayScore;

    try {
      const tx = buildSubmitScoreTransaction(scoreToSubmit, chainRunSeed);
      const result = await executeTransaction(tx, player.address ?? '');
      const digest = (result as { digest?: string }).digest ?? null;
      setSubmitResult({ success: true, txDigest: digest });

      // Also save locally
      await submitScore({
        score: scoreToSubmit,
        runSeed: chainSeed ?? 0,
        gameHash: '',
        runId: digest,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Score submission failed';
      if (msg.includes('insufficient') || msg.includes('gas')) {
        setSubmitError(
          sponsorship.canSponsorGameTx
            ? 'Gas sponsorship failed during score submission. Please retry.'
            : 'Insufficient SUI for gas. You need a small amount of SUI to submit scores.',
        );
      } else if (msg.includes('rejected') || msg.includes('denied')) {
        setSubmitError('Transaction was rejected. You can retry using the button below.');
      } else {
        setSubmitError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [chainRunSeed, chainSeed, displayScore, isSubmitting, player.address, executeTransaction, sponsorship.canSponsorGameTx]);

  // Auto-submit score for ranked runs when game ends
  useEffect(() => {
    if (
      screenState === 'gameOver' &&
      selectedMode === 'ranked' &&
      chainRunSeed &&
      !submitResult &&
      !isSubmitting &&
      !submitError
    ) {
      void handleSubmitScore();
    }
  }, [screenState, selectedMode, chainRunSeed, submitResult, isSubmitting, submitError, handleSubmitScore]);

  const handleRestart = useCallback(async () => {
    if (!canRestartRef.current) return;
    setDisplayScore(0);
    setSubmitResult(null);
    setSubmitError(null);

    if (selectedMode === 'ranked' && player.address) {
      // Re-run the chain seed flow for a new ranked run
      setScreenState('startingRanked');
      try {
        const tx = await buildStartRunTransaction(suiClient, player.address);
        const result = await executeTransaction(tx, player.address);
        const events = (result as { events?: Array<{ type: string; parsedJson?: Record<string, unknown> }> }).events ?? [];
        const seed = parseSeedFromEvents(events);
        const runEvent = events.find((e) => e.type.includes('::game::RunStartedEvent'));
        const rawSeed = String(runEvent?.parsedJson?.['seed'] ?? '0');

        setChainSeed(seed);
        setChainRunSeed(rawSeed);
        loopRef.current?.restart(selectedMode, seed);
        setScreenState('ready');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to start ranked run';
        setRankedError(msg);
        setScreenState('menu');
      }
    } else {
      loopRef.current?.restart(selectedMode);
      setScreenState('ready');
    }
  }, [selectedMode, player.address, suiClient, executeTransaction]);

  const handleMenu = useCallback(() => {
    setIsCanvasActive(false);
    setScreenState('menu');
    setChainSeed(undefined);
    setChainRunSeed(null);
    setRankedError(null);
  }, []);

  const handleLoopReady = useCallback((handle: GameLoopHandle) => {
    loopRef.current = handle;
  }, []);

  const handleConnect = useCallback(() => {
    // During detection settling, do nothing — prevents opening generic modal prematurely
    if (ssuWallet.status === 'detecting') return;
    // SSU wallet found: connect directly, skip generic chooser
    if (ssuWallet.isSSU) {
      ssuWallet.connectDirectly();
    } else {
      setShowConnectModal(true);
    }
  }, [ssuWallet]);

  const handleDisconnect = useCallback(() => {
    disconnect();
  }, [disconnect]);

  // In-game mode: fill viewport directly. Desktop: scale to fit.
  const isInGame = player.isInGameBrowser;
  const MAX_UPSCALE = 1.5;
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (isInGame) return; // In-game viewport ≈ canvas size; no scaling needed
    function updateScale() {
      const scaleX = window.innerWidth / CANVAS_WIDTH;
      const scaleY = window.innerHeight / CANVAS_HEIGHT;
      setScale(Math.min(scaleX, scaleY, MAX_UPSCALE));
    }
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [isInGame]);

  return (
    <div className="relative flex items-center justify-center w-full h-full bg-black overflow-hidden">
      {/* Wallet connect modal */}
      <ConnectModal
        open={showConnectModal}
        onOpenChange={setShowConnectModal}
        trigger={<></>}
      />

      {/* Viewport shell — in-game: fill viewport directly; desktop: CSS-transform scale */}
      <div
        style={isInGame ? undefined : {
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
        }}
        className={`relative overflow-hidden ${isInGame ? 'w-full h-full' : 'shadow-2xl shadow-orange-900/20'}`}
      >
        {/* Canvas layer */}
        <GameCanvas
          mode={selectedMode}
          isActive={isCanvasActive}
          externalSeed={chainSeed}
          fillParent={isInGame}
          onScoreChange={handleScoreChange}
          onGameOver={handleGameOver}
          onPhaseChange={handlePhaseChange}
          onLoopReady={handleLoopReady}
        />

        {/* UI Overlays */}
        {screenState === 'menu' && (
          <StartScreen
            bestScore={displayBestScore}
            canPlayRanked={canPlayRanked}
            playerAddress={player.address}
            playerDisplayName={playerName}
            entryFeeDisplay={ENTRY_FEE_DISPLAY}
            ssuWallet={ssuWallet}
            onStart={handleStart}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onShowLeaderboard={() => setShowLeaderboard(true)}
          />
        )}

        {screenState === 'startingRanked' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10">
            <div className="text-lg font-bold mb-2" style={{ color: '#ff4c26' }}>Starting Ranked Run…</div>
            <div className="text-gray-300 text-sm mb-2">
              Entry fee: {ENTRY_FEE_DISPLAY}
            </div>
            <div className="text-gray-500 text-xs mb-1">
              Your EVE goes into the on-chain prize pool.
            </div>
            <div className="text-gray-500 text-xs mb-3">
              {sponsorship.canSponsorGameTx
                ? 'Approve the transaction in your wallet. EVE fee only, gas is sponsored.'
                : 'Approve the transaction in your wallet. EVE fee + SUI gas.'}
            </div>
            <button
              onClick={handleMenu}
              className="text-gray-500 hover:text-gray-300 text-xs underline transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {screenState === 'ready' && <ReadyOverlay isVisible />}

        {screenState === 'gameOver' && (
          <GameOverScreen
            score={displayScore}
            bestScore={displayBestScore}
            isRanked={selectedMode === 'ranked'}
            isSubmitting={isSubmitting}
            submitResult={submitResult}
            submitError={submitError}
            onSubmitScore={handleSubmitScore}
            onRestart={handleRestart}
            onMenu={handleMenu}
            onShowLeaderboard={() => setShowLeaderboard(true)}
          />
        )}

        {/* Ranked error toast */}
        {rankedError && screenState === 'menu' && (
          <div className="absolute bottom-4 left-4 right-4 bg-red-900/90 border border-red-700
                          rounded-lg p-3 text-red-200 text-sm z-20">
            <div className="font-bold mb-1">Ranked run failed</div>
            <div className="text-xs mb-1">{rankedError}</div>
            <div className="text-xs text-red-400/60">
              {sponsorship.canSponsorGameTx
                ? 'Ranked requires 100 EVE entry fee. Gas is sponsored.'
                : 'Ranked requires 100 EVE entry fee and SUI for gas.'}
            </div>
            <button
              onClick={() => setRankedError(null)}
              className="mt-2 text-xs text-red-400 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Brand badge — bottom-right of playspace */}
        <LogoBadge />
      </div>

      {/* Leaderboard panel (full-screen overlay) */}
      {showLeaderboard && (
        <LeaderboardPanel onClose={() => setShowLeaderboard(false)} />
      )}
    </div>
  );
}
