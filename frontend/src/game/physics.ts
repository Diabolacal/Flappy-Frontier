import type { GameState } from './types';
import {
  GRAVITY,
  JUMP_VELOCITY,
  TERMINAL_VELOCITY,
  PITCH_FACTOR,
  MAX_PITCH_UP,
  MAX_PITCH_DOWN,
  PLAY_AREA_HEIGHT,
  ATTITUDE_JET_DURATION,
} from './constants';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function updatePhysics(
  state: GameState,
  dt: number,
  flapRequested: boolean,
): void {
  if (flapRequested && state.phase === 'playing') {
    state.shipVelocity = JUMP_VELOCITY;
    state.thrusterIntensity = 1.0;
    state.attitudeJetAge = 0;
  }

  // Gravity
  state.shipVelocity += GRAVITY * dt;
  state.shipVelocity = Math.min(state.shipVelocity, TERMINAL_VELOCITY);

  // Position
  state.shipY += state.shipVelocity * dt;

  // Ceiling clamp
  if (state.shipY < 0) {
    state.shipY = 0;
    state.shipVelocity = 0;
  }

  // Ground collision
  if (state.shipY >= PLAY_AREA_HEIGHT - 36) {
    state.shipY = PLAY_AREA_HEIGHT - 36;
    if (state.phase === 'dying') {
      state.phase = 'dead';
    }
  }

  // Pitch
  const targetPitch = clamp(state.shipVelocity * PITCH_FACTOR, MAX_PITCH_UP, MAX_PITCH_DOWN);
  state.shipPitch = lerp(state.shipPitch, targetPitch, 1 - Math.pow(0.05, dt));

  // Thruster decay
  state.thrusterIntensity = lerp(state.thrusterIntensity, 0.3, 1 - Math.pow(0.02, dt));

  // Attitude jet aging
  if (state.attitudeJetAge < 1) {
    state.attitudeJetAge = Math.min(1, state.attitudeJetAge + dt / ATTITUDE_JET_DURATION);
  }
}

export function updateDying(state: GameState, dt: number): void {
  state.shipVelocity += GRAVITY * dt;
  state.shipY += state.shipVelocity * dt;
  state.shipPitch += 120 * dt; // tumble

  if (state.shipY >= PLAY_AREA_HEIGHT - 36) {
    state.shipY = PLAY_AREA_HEIGHT - 36;
    state.phase = 'dead';
  }

  state.thrusterIntensity = lerp(state.thrusterIntensity, 0, 1 - Math.pow(0.01, dt));
}
