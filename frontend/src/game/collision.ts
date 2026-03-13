import type { GameState } from './types';
import {
  SHIP_X,
  SHIP_WIDTH,
  SHIP_HEIGHT,
  PIPE_WIDTH,
  PLAY_AREA_HEIGHT,
  HITBOX_SHRINK,
} from './constants';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function checkCollision(state: GameState): boolean {
  const shrinkX = SHIP_WIDTH * HITBOX_SHRINK;
  const shrinkY = SHIP_HEIGHT * HITBOX_SHRINK;
  const shipRect: Rect = {
    x: SHIP_X + shrinkX + 4, // forward bias
    y: state.shipY + shrinkY,
    w: SHIP_WIDTH - shrinkX * 2,
    h: SHIP_HEIGHT - shrinkY * 2,
  };

  // Ground collision
  if (state.shipY + SHIP_HEIGHT >= PLAY_AREA_HEIGHT) {
    return true;
  }

  // Pipe collision
  for (const pipe of state.pipes) {
    const halfGap = pipe.gapSize / 2;
    const topPipe: Rect = {
      x: pipe.x,
      y: 0,
      w: PIPE_WIDTH,
      h: pipe.gapCenterY - halfGap,
    };
    const bottomPipe: Rect = {
      x: pipe.x,
      y: pipe.gapCenterY + halfGap,
      w: PIPE_WIDTH,
      h: PLAY_AREA_HEIGHT - (pipe.gapCenterY + halfGap),
    };

    if (rectsOverlap(shipRect, topPipe) || rectsOverlap(shipRect, bottomPipe)) {
      return true;
    }
  }

  return false;
}

export function checkScoring(state: GameState): boolean {
  let scored = false;
  const shipMidX = SHIP_X + SHIP_WIDTH / 2;

  for (const pipe of state.pipes) {
    if (!pipe.scored && shipMidX > pipe.x + PIPE_WIDTH / 2) {
      pipe.scored = true;
      state.score++;
      scored = true;
    }
  }

  return scored;
}
