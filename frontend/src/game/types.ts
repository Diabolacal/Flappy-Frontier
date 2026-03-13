export interface RNG {
  next(): number;
}

export interface PipeConfig {
  x: number;
  gapCenterY: number;
  scored: boolean;
}

export type GamePhase = 'ready' | 'playing' | 'dying' | 'dead';
export type GameMode = 'practice' | 'ranked';

export interface GameState {
  shipY: number;
  shipVelocity: number;
  shipPitch: number;

  pipes: PipeConfig[];

  score: number;
  bestScore: number;

  elapsed: number;

  phase: GamePhase;

  rng: RNG;
  seed: number;

  thrusterIntensity: number;
  attitudeJetAge: number;
  backgroundScroll: number;
  groundScroll: number;

  mode: GameMode;
}

export interface GameAssets {
  shipBitmap: ImageBitmap | null;
  pipeBitmap: ImageBitmap | null;
  pipeCapBitmap: ImageBitmap | null;
  groundBitmap: ImageBitmap | null;
}

export interface GameCallbacks {
  onScoreChange: (score: number) => void;
  onGameOver: (score: number, bestScore: number) => void;
  onPhaseChange: (phase: GamePhase) => void;
}
