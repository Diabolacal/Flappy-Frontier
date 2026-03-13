// All values tuned for 787×1198 portrait viewport

// Canvas
export const CANVAS_WIDTH = 787;
export const CANVAS_HEIGHT = 1198;
export const GROUND_HEIGHT = 40;
export const PLAY_AREA_HEIGHT = CANVAS_HEIGHT - GROUND_HEIGHT;

// Ship — sized for the Frontier ship raster sprite (original ~4.5:1 aspect)
export const SHIP_WIDTH = 120;
export const SHIP_HEIGHT = 42;
export const SHIP_X = 150; // fixed X (~19% of canvas width)
export const SHIP_START_Y = PLAY_AREA_HEIGHT * 0.4;

// Physics
export const GRAVITY = 1400; // px/s²
export const JUMP_VELOCITY = -300; // px/s (negative = up)
export const TERMINAL_VELOCITY = 700; // px/s
export const DT_CAP = 0.1; // seconds (100ms)

// Obstacles (base values — progression.ts overrides gap, speed, and Y range)
export const PIPE_WIDTH = 70; // px
export const PIPE_GAP = 160; // px — initial gap (progression shrinks it)
export const PIPE_SPEED = 140; // px/s — initial speed (progression increases it)
export const PIPE_SPACING = 280; // px (horizontal, center-to-center)
export const GAP_Y_MIN_PCT = 0.25;
export const GAP_Y_MAX_PCT = 0.75;
export const GAP_DELTA_CAP = 0.4; // fraction of PIPE_GAP
export const PIPE_CAP_HEIGHT = 20;
export const PIPE_CAP_EXTRA_WIDTH = 8; // extra width on each side of cap

// Collision
export const HITBOX_SHRINK = 0.15; // 15% inset on each side

// Visual
export const BG_SCROLL_SPEED = 20; // px/s (slow parallax)
export const THRUSTER_PULSE_HZ = 2;
export const ATTITUDE_JET_DURATION = 0.15; // seconds

// Timing
export const MAX_GAME_TIME = 120; // seconds
export const RESTART_DELAY = 500; // ms

// Ship pitch (subtle for capital ship feel)
export const MAX_PITCH_UP = -8; // degrees
export const MAX_PITCH_DOWN = 8; // degrees
export const PITCH_FACTOR = 0.025;

// Colors
export const COLORS = {
  background: '#0A0A0F',
  ground: '#3A3E45',
  groundLine: '#2A2E35',
  pipe: '#C42828',
  pipeGradientEnd: '#8A1818',
  pipeCap: '#E03535',
  pipeCapHighlight: '#FF5050',
  score: '#FFFFFF',
  scoreShadow: '#000000',
} as const;

// Star count for procedural starfield
export const STAR_COUNT = 70;
