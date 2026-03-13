import { CANVAS_WIDTH, CANVAS_HEIGHT, STAR_COUNT } from './constants';
import type { RNG } from './types';

interface Star {
  x: number;
  y: number;
  size: number;
  brightness: number;
  layer: number; // 0 = far (slow), 1 = near (faster)
}

let stars: Star[] | null = null;

export function initStarfield(rng: RNG): void {
  stars = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      x: rng.next() * CANVAS_WIDTH,
      y: rng.next() * CANVAS_HEIGHT,
      size: 0.5 + rng.next() * 1.5,
      brightness: 0.3 + rng.next() * 0.7,
      layer: rng.next() > 0.7 ? 1 : 0,
    });
  }
}

export function renderStarfield(
  ctx: CanvasRenderingContext2D,
  bgScroll: number,
): void {
  if (!stars) return;

  for (const star of stars) {
    const parallax = star.layer === 0 ? 0.3 : 0.8;
    let drawX = (star.x - bgScroll * parallax) % CANVAS_WIDTH;
    if (drawX < 0) drawX += CANVAS_WIDTH;

    ctx.globalAlpha = star.brightness;
    ctx.fillStyle =
      star.layer === 0 ? '#8090A0' : star.brightness > 0.6 ? '#FFFFFF' : '#C8D0DC';
    ctx.fillRect(Math.round(drawX), Math.round(star.y), star.size, star.size);
  }
  ctx.globalAlpha = 1;
}
