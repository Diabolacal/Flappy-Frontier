import { useState, useCallback, useRef, useEffect } from 'react';
import type { GamePhase, GameMode } from '@/game/types';
import type { GameLoopHandle } from '@/game/gameLoop';
import { CANVAS_WIDTH, CANVAS_HEIGHT, RESTART_DELAY } from '@/game/constants';
import { GameCanvas } from './GameCanvas';
import { StartScreen } from './StartScreen';
import { GameOverScreen } from './GameOverScreen';
import { ReadyOverlay } from './ReadyOverlay';

type ScreenState = 'menu' | 'ready' | 'playing' | 'dying' | 'gameOver';

export function GamePage() {
  const [screenState, setScreenState] = useState<ScreenState>('menu');
  const [displayScore, setDisplayScore] = useState(0);
  const [displayBestScore, setDisplayBestScore] = useState(() => {
    try {
      return parseInt(localStorage.getItem('flappy-frontier-best') ?? '0', 10) || 0;
    } catch { return 0; }
  });
  const [selectedMode, setSelectedMode] = useState<GameMode>('practice');
  const [isCanvasActive, setIsCanvasActive] = useState(false);
  const loopRef = useRef<GameLoopHandle | null>(null);
  const canRestartRef = useRef(true);

  const handleStart = useCallback((mode: GameMode) => {
    setSelectedMode(mode);
    setDisplayScore(0);
    setScreenState('ready');
    setIsCanvasActive(true);
  }, []);

  const handleScoreChange = useCallback((score: number) => {
    setDisplayScore(score);
  }, []);

  const handleGameOver = useCallback((score: number, bestScore: number) => {
    setDisplayScore(score);
    setDisplayBestScore(bestScore);
    canRestartRef.current = false;
    setTimeout(() => { canRestartRef.current = true; }, RESTART_DELAY);
  }, []);

  const handlePhaseChange = useCallback((phase: GamePhase) => {
    if (phase === 'playing') setScreenState('playing');
    else if (phase === 'dying') setScreenState('dying');
    else if (phase === 'dead') setScreenState('gameOver');
    else if (phase === 'ready') setScreenState('ready');
  }, []);

  const handleRestart = useCallback(() => {
    if (!canRestartRef.current) return;
    setDisplayScore(0);
    loopRef.current?.restart(selectedMode);
    setScreenState('ready');
  }, [selectedMode]);

  const handleMenu = useCallback(() => {
    setIsCanvasActive(false);
    setScreenState('menu');
  }, []);

  const handleLoopReady = useCallback((handle: GameLoopHandle) => {
    loopRef.current = handle;
  }, []);

  // Scale the fixed-size game viewport to fit within the browser window
  const [scale, setScale] = useState(1);

  useEffect(() => {
    function updateScale() {
      const scaleX = window.innerWidth / CANVAS_WIDTH;
      const scaleY = window.innerHeight / CANVAS_HEIGHT;
      setScale(Math.min(scaleX, scaleY, 1)); // never upscale beyond 1:1
    }
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  return (
    <div className="relative flex items-center justify-center w-full h-full bg-black overflow-hidden">
      {/* Scaled viewport shell — fixed playfield, CSS-scaled to fit screen */}
      <div
        style={{
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
        }}
        className="relative overflow-hidden shadow-2xl shadow-emerald-900/20"
      >
        {/* Canvas layer */}
        <GameCanvas
          mode={selectedMode}
          isActive={isCanvasActive}
          onScoreChange={handleScoreChange}
          onGameOver={handleGameOver}
          onPhaseChange={handlePhaseChange}
          onLoopReady={handleLoopReady}
        />

        {/* UI Overlays */}
        {screenState === 'menu' && (
          <StartScreen bestScore={displayBestScore} onStart={handleStart} />
        )}

        {screenState === 'ready' && <ReadyOverlay isVisible />}

        {screenState === 'gameOver' && (
          <GameOverScreen
            score={displayScore}
            bestScore={displayBestScore}
            onRestart={handleRestart}
            onMenu={handleMenu}
          />
        )}
      </div>
    </div>
  );
}
