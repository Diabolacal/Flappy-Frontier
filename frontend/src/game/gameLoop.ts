import type { GameState, GameAssets, GameCallbacks, GameMode, GamePhase } from './types';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  SHIP_START_Y,
  DT_CAP,
  BG_SCROLL_SPEED,
  JUMP_VELOCITY,
  MAX_GAME_TIME,
  THRUSTER_PULSE_HZ,
} from './constants';
import { createRNG } from '@/lib/rng';
import { getLocalSeed } from '@/lib/seedProvider';
import { updatePhysics, updateDying } from './physics';
import { updateObstacles } from './obstacles';
import { checkCollision, checkScoring } from './collision';
import { render, renderScore } from './renderer';
import { initStarfield } from './starfield';
import { loadAssets } from './assets';
import { createInputHandler } from './input';
import { getDifficulty } from './progression';
import { playFlap, playCrash, ensureAudioResumed } from './audio';

function createInitialState(mode: GameMode, bestScore: number): GameState {
  const { seed } = getLocalSeed();
  const rng = createRNG(seed);

  return {
    shipY: SHIP_START_Y,
    shipVelocity: 0,
    shipPitch: 0,
    pipes: [],
    score: 0,
    bestScore,
    elapsed: 0,
    phase: 'ready',
    rng,
    seed,
    thrusterIntensity: 0.3,
    attitudeJetAge: 1,
    backgroundScroll: 0,
    groundScroll: 0,
    mode,
  };
}

export interface GameLoopHandle {
  start: (mode: GameMode) => void;
  stop: () => void;
  restart: (mode: GameMode) => void;
}

export function startGameLoop(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
): GameLoopHandle {
  const ctx = canvas.getContext('2d', { alpha: false })!;
  if (!ctx) throw new Error('Canvas 2D context not available');

  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;

  let state: GameState = createInitialState('practice', loadBestScore());
  let assets: GameAssets = { shipBitmap: null, pipeBitmap: null, pipeCapBitmap: null, groundBitmap: null };
  let rafId = 0;
  let lastTime = 0;
  let running = false;

  const { state: inputState, cleanup: cleanupInput } = createInputHandler(canvas);

  // Init starfield with a fixed seed so stars are stable
  initStarfield(createRNG(42));

  // Load assets in background
  loadAssets().then((loaded) => {
    assets = loaded;
  });

  function gameFrame(timestamp: number): void {
    if (!running) return;

    if (lastTime === 0) lastTime = timestamp;
    let dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    // Cap dt to prevent physics explosions
    if (dt > DT_CAP) dt = DT_CAP;

    update(dt);
    draw();

    rafId = requestAnimationFrame(gameFrame);
  }

  function update(dt: number): void {
    // Background/ground always scroll in ready and playing
    if (state.phase === 'ready' || state.phase === 'playing') {
      const diff = getDifficulty(state.score);
      state.backgroundScroll += BG_SCROLL_SPEED * dt;
      state.groundScroll += diff.pipeSpeed * dt;
    }

    if (state.phase === 'ready') {
      // Bobbing animation
      state.shipY = SHIP_START_Y + Math.sin(state.elapsed * 1.5 * Math.PI * 2) * 3;
      state.elapsed += dt;

      // Idle thruster pulse
      state.thrusterIntensity = 0.3 + 0.1 * Math.sin(state.elapsed * THRUSTER_PULSE_HZ * Math.PI * 2);

      // First flap transitions to playing AND performs the first jump
      if (inputState.pendingFlap) {
        inputState.pendingFlap = false;
        ensureAudioResumed();
        playFlap();
        state.phase = 'playing';
        state.shipY = SHIP_START_Y;
        state.shipVelocity = JUMP_VELOCITY;
        state.thrusterIntensity = 1.0;
        state.attitudeJetAge = 0;
        state.elapsed = 0;
        callbacks.onPhaseChange('playing');
      }
      return;
    }

    if (state.phase === 'playing') {
      const flap = inputState.pendingFlap;
      inputState.pendingFlap = false;

      if (flap) playFlap();

      updatePhysics(state, dt, flap);
      updateObstacles(state, dt);

      if (checkScoring(state)) {
        callbacks.onScoreChange(state.score);
      }

      if (checkCollision(state)) {
        state.phase = 'dying';
        state.thrusterIntensity = 0;
        playCrash();
        callbacks.onPhaseChange('dying');
      }

      state.elapsed += dt;

      // Time limit
      if (state.elapsed >= MAX_GAME_TIME) {
        state.phase = 'dying';
        callbacks.onPhaseChange('dying');
      }
      return;
    }

    if (state.phase === 'dying') {
      inputState.pendingFlap = false;
      updateDying(state, dt);

      if ((state.phase as GamePhase) === 'dead') {
        const newBest = Math.max(state.score, state.bestScore);
        state.bestScore = newBest;
        saveBestScore(newBest);
        callbacks.onGameOver(state.score, newBest);
        callbacks.onPhaseChange('dead');
      }
      return;
    }

    // dead — no updates
    inputState.pendingFlap = false;
  }

  function draw(): void {
    render(ctx, state, assets);

    if (state.phase === 'playing' || state.phase === 'dying') {
      renderScore(ctx, state.score);
    }
  }

  const handle: GameLoopHandle = {
    start(mode: GameMode) {
      state = createInitialState(mode, loadBestScore());
      lastTime = 0;
      running = true;
      callbacks.onPhaseChange('ready');
      rafId = requestAnimationFrame(gameFrame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
      cleanupInput();
    },
    restart(mode: GameMode) {
      state = createInitialState(mode, loadBestScore());
      lastTime = 0;
      callbacks.onScoreChange(0);
      callbacks.onPhaseChange('ready');
    },
  };

  return handle;
}

function loadBestScore(): number {
  try {
    const val = localStorage.getItem('flappy-frontier-best');
    return val ? parseInt(val, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

function saveBestScore(score: number): void {
  try {
    localStorage.setItem('flappy-frontier-best', String(score));
  } catch {
    // localStorage unavailable — ignore
  }
}
