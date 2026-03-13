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

  // Hull glow for visibility against dark background
  ctx.save();
  ctx.shadowBlur = 10;
  ctx.shadowColor = 'rgba(180, 190, 200, 0.4)';

  // Hull — raster sprite from frontier-ship.png
  if (assets.shipBitmap) {
    ctx.drawImage(
      assets.shipBitmap,
      -SHIP_WIDTH / 2,
      -SHIP_HEIGHT / 2,
      SHIP_WIDTH,
      SHIP_HEIGHT,
    );
    // Second pass without shadow for crispness
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    ctx.globalAlpha = 0.15;
    ctx.drawImage(
      assets.shipBitmap,
      -SHIP_WIDTH / 2,
      -SHIP_HEIGHT / 2,
      SHIP_WIDTH,
      SHIP_HEIGHT,
    );
    ctx.globalAlpha = 1.0;
  } else {
    renderPlaceholderShip(ctx);
  }

  ctx.restore();

  // Attitude jet (below hull, on flap)
  if (state.attitudeJetAge < 1) {
    renderAttitudeJet(ctx, state.attitudeJetAge);
  }

  ctx.restore();
}

function renderPlaceholderShip(ctx: CanvasRenderingContext2D): void {
  const hw = SHIP_WIDTH / 2;
  const hh = SHIP_HEIGHT / 2;

  // Main hull body — elongated Frontier capital ship silhouette
  ctx.fillStyle = '#8A8B80';
  ctx.beginPath();
  ctx.moveTo(-hw, -hh * 0.15);           // stern top
  ctx.lineTo(-hw * 0.7, -hh * 0.5);      // aft deck
  ctx.lineTo(-hw * 0.3, -hh * 0.65);     // superstructure base left
  ctx.lineTo(-hw * 0.3, -hh * 0.9);      // superstructure left wall
  ctx.lineTo(0, -hh);                     // superstructure peak
  ctx.lineTo(hw * 0.2, -hh * 0.8);       // superstructure right slope
  ctx.lineTo(hw * 0.2, -hh * 0.6);       // superstructure base right
  ctx.lineTo(hw * 0.6, -hh * 0.35);      // forward hull
  ctx.lineTo(hw, 0);                      // bow tip
  ctx.lineTo(hw * 0.6, hh * 0.55);       // forward lower hull
  ctx.lineTo(hw * 0.2, hh * 0.8);        // mid belly
  ctx.lineTo(-hw * 0.3, hh * 0.9);       // aft belly
  ctx.lineTo(-hw * 0.7, hh * 0.6);       // stern lower hull
  ctx.lineTo(-hw, hh * 0.3);             // stern bottom
  ctx.closePath();
  ctx.fill();

  // Upper hull highlight
  ctx.fillStyle = '#A0A396';
  ctx.beginPath();
  ctx.moveTo(-hw * 0.7, -hh * 0.5);
  ctx.lineTo(hw * 0.6, -hh * 0.35);
  ctx.lineTo(hw * 0.6, -hh * 0.1);
  ctx.lineTo(-hw * 0.7, -hh * 0.15);
  ctx.closePath();
  ctx.fill();

  // Panel lines
  ctx.strokeStyle = '#6C6B66';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  // Vertical seams
  ctx.moveTo(-hw * 0.3, -hh * 0.65);
  ctx.lineTo(-hw * 0.3, hh * 0.9);
  ctx.moveTo(hw * 0.2, -hh * 0.6);
  ctx.lineTo(hw * 0.2, hh * 0.8);
  // Horizontal spine
  ctx.moveTo(-hw * 0.8, 0);
  ctx.lineTo(hw * 0.9, 0);
  ctx.stroke();

  // Turret mounts (2 visible at this size)
  ctx.fillStyle = '#7C7B74';
  ctx.beginPath();
  ctx.arc(-hw * 0.1, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(hw * 0.35, 0, 3, 0, Math.PI * 2);
  ctx.fill();

  // Engine nozzles
  ctx.fillStyle = '#3E3D3A';
  ctx.fillRect(-hw - 2, -hh * 0.3, 4, 3);
  ctx.fillRect(-hw - 2, hh * 0.05, 4, 3);
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
