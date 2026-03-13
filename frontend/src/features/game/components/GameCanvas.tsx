import { useRef, useEffect, useCallback } from 'react';
import type { GamePhase, GameMode } from '@/game/types';
import { startGameLoop } from '@/game/gameLoop';
import type { GameLoopHandle } from '@/game/gameLoop';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/game/constants';

interface GameCanvasProps {
  mode: GameMode;
  isActive: boolean;
  onScoreChange: (score: number) => void;
  onGameOver: (score: number, bestScore: number) => void;
  onPhaseChange: (phase: GamePhase) => void;
  onLoopReady: (handle: GameLoopHandle) => void;
}

export function GameCanvas({
  mode,
  isActive,
  onScoreChange,
  onGameOver,
  onPhaseChange,
  onLoopReady,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loopRef = useRef<GameLoopHandle | null>(null);
  const callbacksRef = useRef({ onScoreChange, onGameOver, onPhaseChange });

  // Keep callbacks current without re-creating the loop
  callbacksRef.current = { onScoreChange, onGameOver, onPhaseChange };

  const initLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || loopRef.current) return;

    const handle = startGameLoop(canvas, {
      onScoreChange: (s) => callbacksRef.current.onScoreChange(s),
      onGameOver: (s, b) => callbacksRef.current.onGameOver(s, b),
      onPhaseChange: (p) => callbacksRef.current.onPhaseChange(p),
    });

    loopRef.current = handle;
    onLoopReady(handle);
  }, [onLoopReady]);

  useEffect(() => {
    if (isActive) {
      initLoop();
      loopRef.current?.start(mode);
    }

    return () => {
      loopRef.current?.stop();
      loopRef.current = null;
      // Clear canvas so old frames don't bleed through menu overlay
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
  }, [isActive, mode, initLoop]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      className="block"
      style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
    />
  );
}
