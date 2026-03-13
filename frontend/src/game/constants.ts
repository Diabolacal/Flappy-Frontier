// All values tuned for 787×1198 portrait viewport

// Canvas
export const CANVAS_WIDTH = 787;
export const CANVAS_HEIGHT = 1198;
export const GROUND_HEIGHT = 40;
export const PLAY_AREA_HEIGHT = CANVAS_HEIGHT - GROUND_HEIGHT;

// Ship
export const SHIP_WIDTH = 72;
export const SHIP_HEIGHT = 36;
export const SHIP_X = 157; // fixed X (20% of canvas width)
export const SHIP_START_Y = PLAY_AREA_HEIGHT * 0.4;

// Physics
export const GRAVITY = 1400; // px/s²
export const JUMP_VELOCITY = -300; // px/s (negative = up)
export const TERMINAL_VELOCITY = 700; // px/s
export const DT_CAP = 0.1; // seconds (100ms)

// Obstacles
export const PIPE_WIDTH = 70; // px
export const PIPE_GAP = 140; // px (vertical gap between top and bottom)
export const PIPE_SPEED = 150; // px/s (scroll left)
export const PIPE_SPACING = 280; // px (horizontal, center-to-center)
export const GAP_Y_MIN_PCT = 0.2;
export const GAP_Y_MAX_PCT = 0.8;
export const GAP_DELTA_CAP = 0.5; // fraction of PIPE_GAP
export const PIPE_CAP_HEIGHT = 20;
export const PIPE_CAP_EXTRA_WIDTH = 8; // extra width on each side of cap

// Collision
export const HITBOX_SHRINK = 0.15; // 15% inset on each side

// Visual
export const GROUND_SCROLL_SPEED = 150; // px/s (same as pipe speed)
export const BG_SCROLL_SPEED = 20; // px/s (slow parallax)
export const THRUSTER_PULSE_HZ = 2;
export const ATTITUDE_JET_DURATION = 0.15; // seconds

// Timing
export const MAX_GAME_TIME = 120; // seconds
export const RESTART_DELAY = 500; // ms

// Ship pitch
export const MAX_PITCH_UP = -15; // degrees
export const MAX_PITCH_DOWN = 15; // degrees
export const PITCH_FACTOR = 0.04;

// Colors
export const COLORS = {
  background: '#0A0A0F',
  ground: '#2A2D32',
  groundLine: '#1E2025',
  pipe: '#8B1A1A',
  pipeGradientEnd: '#5C1010',
  pipeCap: '#A02020',
  pipeCapHighlight: '#C03030',
  score: '#FFFFFF',
  scoreShadow: '#000000',
} as const;

// Star count for procedural starfield
export const STAR_COUNT = 70;
