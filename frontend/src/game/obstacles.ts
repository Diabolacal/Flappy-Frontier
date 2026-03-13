import type { GameState } from './types';
import {
  CANVAS_WIDTH,
  PIPE_WIDTH,
  PIPE_GAP,
  PIPE_SPEED,
  PIPE_SPACING,
  GAP_Y_MIN_PCT,
  GAP_Y_MAX_PCT,
  GAP_DELTA_CAP,
  PLAY_AREA_HEIGHT,
} from './constants';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function shouldSpawnPipe(state: GameState): boolean {
  if (state.pipes.length === 0) return true;
  const last = state.pipes[state.pipes.length - 1]!;
  return last.x + PIPE_WIDTH < CANVAS_WIDTH - PIPE_SPACING + PIPE_WIDTH;
}

export function spawnPipe(state: GameState): void {
  const margin = 40;
  const minY = PLAY_AREA_HEIGHT * GAP_Y_MIN_PCT + PIPE_GAP / 2 + margin;
  const maxY = PLAY_AREA_HEIGHT * GAP_Y_MAX_PCT - PIPE_GAP / 2 - margin;

  let gapCenterY = minY + state.rng.next() * (maxY - minY);

  if (state.pipes.length > 0) {
    const prevGap = state.pipes[state.pipes.length - 1]!.gapCenterY;
    const maxDelta = PIPE_GAP * GAP_DELTA_CAP;
    gapCenterY = clamp(gapCenterY, prevGap - maxDelta, prevGap + maxDelta);
    gapCenterY = clamp(gapCenterY, minY, maxY);
  }

  state.pipes.push({
    x: CANVAS_WIDTH + PIPE_WIDTH,
    gapCenterY,
    scored: false,
  });
}

export function updateObstacles(state: GameState, dt: number): void {
  for (const pipe of state.pipes) {
    pipe.x -= PIPE_SPEED * dt;
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
