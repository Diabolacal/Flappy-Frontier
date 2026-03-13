import type { GameState, GameAssets } from './types';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  PLAY_AREA_HEIGHT,
  GROUND_HEIGHT,
  PIPE_WIDTH,
  PIPE_CAP_HEIGHT,
  PIPE_CAP_EXTRA_WIDTH,
  COLORS,
} from './constants';
import { renderShip } from './shipRenderer';
import { renderStarfield } from './starfield';

export function render(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  assets: GameAssets,
): void {
  // Background
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Starfield
  renderStarfield(ctx, state.backgroundScroll);

  // Pipes
  renderPipes(ctx, state, assets);

  // Ship
  renderShip(ctx, state, assets);

  // Ground
  renderGround(ctx, state, assets);
}

function renderPipes(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  assets: GameAssets,
): void {
  for (const pipe of state.pipes) {
    const halfGap = pipe.gapSize / 2;
    const topHeight = pipe.gapCenterY - halfGap;
    const bottomY = pipe.gapCenterY + halfGap;
    const bottomHeight = PLAY_AREA_HEIGHT - bottomY;
    const x = Math.round(pipe.x);

    // Subtle glow for pipe visibility
    ctx.save();
    ctx.shadowBlur = 6;
    ctx.shadowColor = 'rgba(200, 50, 50, 0.35)';

    if (assets.pipeBitmap) {
      // Draw clipped pipe bitmaps
      // Top pipe (inverted)
      ctx.save();
      ctx.translate(x, topHeight);
      ctx.scale(1, -1);
      ctx.drawImage(assets.pipeBitmap, 0, 0, PIPE_WIDTH, topHeight);
      ctx.restore();

      // Bottom pipe
      ctx.drawImage(assets.pipeBitmap, x, bottomY, PIPE_WIDTH, bottomHeight);
    } else {
      // Fallback: gradient rectangles
      const topGrad = ctx.createLinearGradient(x, 0, x + PIPE_WIDTH, 0);
      topGrad.addColorStop(0, COLORS.pipe);
      topGrad.addColorStop(0.5, COLORS.pipeCap);
      topGrad.addColorStop(1, COLORS.pipeGradientEnd);

      ctx.fillStyle = topGrad;
      ctx.fillRect(x, 0, PIPE_WIDTH, topHeight);
      ctx.fillRect(x, bottomY, PIPE_WIDTH, bottomHeight);

      // Pipe edge highlights
      ctx.fillStyle = COLORS.pipeCapHighlight;
      ctx.fillRect(x, 0, 2, topHeight);
      ctx.fillRect(x, bottomY, 2, bottomHeight);
    }

    // Pipe caps
    const capX = x - PIPE_CAP_EXTRA_WIDTH;
    const capW = PIPE_WIDTH + PIPE_CAP_EXTRA_WIDTH * 2;

    if (assets.pipeCapBitmap) {
      // Top cap (at bottom of top pipe)
      ctx.drawImage(assets.pipeCapBitmap, capX, topHeight - PIPE_CAP_HEIGHT, capW, PIPE_CAP_HEIGHT);
      // Bottom cap (at top of bottom pipe)
      ctx.drawImage(assets.pipeCapBitmap, capX, bottomY, capW, PIPE_CAP_HEIGHT);
    } else {
      ctx.fillStyle = COLORS.pipeCap;
      ctx.fillRect(capX, topHeight - PIPE_CAP_HEIGHT, capW, PIPE_CAP_HEIGHT);
      ctx.fillRect(capX, bottomY, capW, PIPE_CAP_HEIGHT);

      // Cap highlight
      ctx.fillStyle = COLORS.pipeCapHighlight;
      ctx.fillRect(capX, topHeight - PIPE_CAP_HEIGHT, capW, 2);
      ctx.fillRect(capX, bottomY, capW, 2);
    }

    ctx.restore();
  }
}

function renderGround(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  assets: GameAssets,
): void {
  const y = PLAY_AREA_HEIGHT;

  if (assets.groundBitmap) {
    const tileW = 128;
    const offset = -(state.groundScroll % tileW);
    for (let x = offset; x < CANVAS_WIDTH; x += tileW) {
      ctx.drawImage(assets.groundBitmap, Math.round(x), y, tileW, GROUND_HEIGHT);
    }
  } else {
    // Fallback ground
    ctx.fillStyle = COLORS.ground;
    ctx.fillRect(0, y, CANVAS_WIDTH, GROUND_HEIGHT);

    // Ground panel lines
    ctx.strokeStyle = COLORS.groundLine;
    ctx.lineWidth = 1;
    const tileW = 64;
    const offset = -(state.groundScroll % tileW);
    for (let x = offset; x < CANVAS_WIDTH; x += tileW) {
      ctx.beginPath();
      ctx.moveTo(Math.round(x), y);
      ctx.lineTo(Math.round(x), y + GROUND_HEIGHT);
      ctx.stroke();
    }

    // Top edge highlight
    ctx.fillStyle = '#6A6E75';
    ctx.fillRect(0, y, CANVAS_WIDTH, 2);
  }
}

export function renderScore(
  ctx: CanvasRenderingContext2D,
  score: number,
): void {
  ctx.save();
  ctx.font = 'bold 48px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.scoreShadow;
  ctx.fillText(String(score), CANVAS_WIDTH / 2 + 2, 72);
  ctx.fillStyle = COLORS.score;
  ctx.fillText(String(score), CANVAS_WIDTH / 2, 70);
  ctx.restore();
}
