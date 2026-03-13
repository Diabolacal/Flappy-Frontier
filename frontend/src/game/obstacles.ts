import type { GameState } from './types';
import {
  CANVAS_WIDTH,
  PIPE_WIDTH,
  PIPE_SPACING,
  PLAY_AREA_HEIGHT,
} from './constants';
import { getDifficulty } from './progression';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function shouldSpawnPipe(state: GameState): boolean {
  if (state.pipes.length === 0) return true;
  const last = state.pipes[state.pipes.length - 1]!;
  return last.x + PIPE_WIDTH < CANVAS_WIDTH - PIPE_SPACING + PIPE_WIDTH;
}

export function spawnPipe(state: GameState): void {
  const diff = getDifficulty(state.score);
  const margin = 40;
  const minY = PLAY_AREA_HEIGHT * diff.gapYMinPct + diff.pipeGap / 2 + margin;
  const maxY = PLAY_AREA_HEIGHT * diff.gapYMaxPct - diff.pipeGap / 2 - margin;

  let gapCenterY = minY + state.rng.next() * (maxY - minY);

  if (state.pipes.length > 0) {
    const prevGap = state.pipes[state.pipes.length - 1]!.gapCenterY;
    const maxDelta = diff.pipeGap * diff.gapDeltaCap;
    gapCenterY = clamp(gapCenterY, prevGap - maxDelta, prevGap + maxDelta);
    gapCenterY = clamp(gapCenterY, minY, maxY);
  }

  state.pipes.push({
    x: CANVAS_WIDTH + PIPE_WIDTH,
    gapCenterY,
    gapSize: diff.pipeGap,
    scored: false,
  });
}

export function updateObstacles(state: GameState, dt: number): void {
  const diff = getDifficulty(state.score);

  for (const pipe of state.pipes) {
    pipe.x -= diff.pipeSpeed * dt;
  }

  // Remove offscreen pipes
  while (state.pipes.length > 0 && state.pipes[0]!.x + PIPE_WIDTH < -10) {
    state.pipes.shift();
  }

  // Spawn new pipes
  if (shouldSpawnPipe(state)) {
    spawnPipe(state);
  }
}
