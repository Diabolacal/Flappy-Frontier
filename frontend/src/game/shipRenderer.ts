import type { GameState, GameAssets } from './types';
import { SHIP_X, SHIP_WIDTH, SHIP_HEIGHT } from './constants';

export function renderShip(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  assets: GameAssets,
): void {
  ctx.save();

  const cx = SHIP_X + SHIP_WIDTH / 2;
  const cy = state.shipY + SHIP_HEIGHT / 2;

  ctx.translate(Math.round(cx), Math.round(cy));
  ctx.rotate((state.shipPitch * Math.PI) / 180);

  // Thruster glow (behind hull)
  if (state.thrusterIntensity > 0.05) {
    renderThruster(ctx, state.thrusterIntensity);
  }

  // Hull
  if (assets.shipBitmap) {
    ctx.drawImage(
      assets.shipBitmap,
      -SHIP_WIDTH / 2,
      -SHIP_HEIGHT / 2,
      SHIP_WIDTH,
      SHIP_HEIGHT,
    );
  } else {
    renderPlaceholderShip(ctx);
  }

  // Attitude jet (below hull, on flap)
  if (state.attitudeJetAge < 1) {
    renderAttitudeJet(ctx, state.attitudeJetAge);
  }

  ctx.restore();
}

function renderPlaceholderShip(ctx: CanvasRenderingContext2D): void {
  const hw = SHIP_WIDTH / 2;
  const hh = SHIP_HEIGHT / 2;

  // Hull body
  ctx.fillStyle = '#4A4E54';
  ctx.beginPath();
  ctx.moveTo(hw, 0);
  ctx.lineTo(hw * 0.3, -hh);
  ctx.lineTo(-hw, -hh * 0.7);
  ctx.lineTo(-hw, hh * 0.7);
  ctx.lineTo(hw * 0.3, hh);
  ctx.closePath();
  ctx.fill();

  // Panel lines
  ctx.strokeStyle = '#3A3D42';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-hw * 0.3, -hh);
  ctx.lineTo(-hw * 0.3, hh);
  ctx.moveTo(hw * 0.1, -hh * 0.8);
  ctx.lineTo(hw * 0.1, hh * 0.8);
  ctx.stroke();

  // Cockpit window
  ctx.fillStyle = '#2A4A6A';
  ctx.beginPath();
  ctx.moveTo(hw * 0.7, -hh * 0.25);
  ctx.lineTo(hw * 0.4, -hh * 0.35);
  ctx.lineTo(hw * 0.4, hh * 0.1);
  ctx.lineTo(hw * 0.7, 0);
  ctx.closePath();
  ctx.fill();
}

function renderThruster(ctx: CanvasRenderingContext2D, intensity: number): void {
  const flameLength = 10 + intensity * 15;
  const flameWidth = 6 + intensity * 4;
  const hw = SHIP_WIDTH / 2;

  const grad = ctx.createRadialGradient(-hw, 0, 1, -hw - flameLength, 0, flameLength);
  grad.addColorStop(0, `rgba(255, 180, 60, ${intensity})`);
  grad.addColorStop(0.4, `rgba(255, 120, 30, ${intensity * 0.7})`);
  grad.addColorStop(1, 'rgba(255, 80, 10, 0)');

  ctx.save();
  ctx.shadowBlur = 12 * intensity;
  ctx.shadowColor = 'rgba(255, 150, 40, 0.6)';
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(-hw - flameLength * 0.3, 0, flameLength, flameWidth, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function renderAttitudeJet(ctx: CanvasRenderingContext2D, age: number): void {
  const opacity = 1 - age;
  const length = 10 + age * 8;
  const hh = SHIP_HEIGHT / 2;

  const grad = ctx.createLinearGradient(0, hh, 0, hh + length);
  grad.addColorStop(0, `rgba(184, 212, 255, ${opacity})`);
  grad.addColorStop(1, `rgba(107, 163, 255, 0)`);

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(-3, hh);
  ctx.lineTo(3, hh);
  ctx.lineTo(1, hh + length);
  ctx.lineTo(-1, hh + length);
  ctx.closePath();
  ctx.fill();
}
