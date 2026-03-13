# Flappy Frontier — Game-Side MVP Implementation Plan

**Retention:** Carry-forward  
**Date:** 2026-03-12  
**Status:** Ready for implementation  
**Author:** Planning agent (research-backed)  
**Risk class:** Medium (game loop + new codebase, but no chain integration yet)

---

## 1. Executive Summary

This plan specifies how to build the **client-side game** for Flappy Frontier — a faithful, lightweight, EVE Frontier-themed Flappy Bird clone. The game runs in Canvas 2D inside a Vite + React shell, targets 60fps in a constrained CEF browser (787×1198px, Chrome 122), and is designed with clean extension points for future blockchain integration (on-chain seed, wallet auth, leaderboard, ranked mode).

The MVP delivers: splash screen, mode selector, gameplay with scoring, game-over flow, local high scores, and placeholder ranked mode — all in a space-themed visual wrapper faithful to the original Flappy Bird feel.

**Estimated implementation size:** ~800–1000 lines of TypeScript across ~15 files.  
**Recommended build budget:** 6–8 hours LLM-assisted, in 5 phases.

---

## 2. Product Goal and Non-Goals

### Goals
- Playable Flappy Bird clone that feels correct (gravity, jump cadence, pipe spacing, scoring)
- EVE Frontier space theme (starfield, ship, red pipe obstacles)
- Runs at 60fps in CEF 787×1198 and in standalone browser
- Clean extension points for chain seed, wallet auth, leaderboard, ranked mode
- Practice mode fully functional; Ranked mode visible but locked
- Local high score tracking via localStorage

### Non-Goals
- No blockchain integration (no wallet, no transactions, no on-chain state)
- No sound/audio (can be added later, not MVP)
- No complex particle effects or shader-based rendering
- No multiple difficulty levels or power-ups
- No mobile-specific optimizations (CEF is mouse+keyboard only)
- No backend server or API
- No cheat prevention beyond interface design

---

## 3. Gameplay Fidelity Targets

The game must feel like Flappy Bird with Frontier skinning. These are the specific fidelity targets derived from the original game analysis.

### Physics Model (delta-time based, 60fps target)

| Parameter | Value | Notes |
|-----------|-------|-------|
| Gravity | 1400 px/s² | Constant downward acceleration |
| Jump velocity | −300 px/s | Velocity **replacement**, not additive |
| Terminal velocity | 700 px/s | Implicit cap (ground usually reached first) |
| dt cap | 100 ms (0.1s) | Prevents physics explosion on tab-return |

**Jump feel:** On flap input, `velocity = JUMP_VELOCITY` regardless of current velocity. This creates the characteristic parabolic arc with a "floaty peak" — critical to the Flappy Bird feel.

### Obstacle Model

| Parameter | Value (for 787×1198 viewport) | Notes |
|-----------|-------------------------------|-------|
| Pipe scroll speed | 150 px/s | Constant — no acceleration |
| Horizontal spacing | 280 px between pipe pairs | ~2.8 pipes visible at once |
| Vertical gap | 140 px | Space between top and bottom pipe |
| Pipe width | 70 px | Visual width of each pipe column |
| Gap Y range | 20%–80% of play area height | Center of gap bounded within this range |
| Adjacent gap delta cap | 50% of gap size (70 px) | Prevents impossible transitions |

**Pipe spawn:** New pipe pair spawns when the rightmost pipe's trailing edge is `horizontalSpacing` from the right canvas edge. Pipes are removed once fully offscreen left.

### Scoring

| Aspect | Behavior |
|--------|----------|
| Score trigger | +1 when ship X passes pipe pair center X |
| Display | Large number, top center of canvas |
| Best score | localStorage, shown on game-over |
| Medal system | Not in MVP (could add later: 10/20/30/40 thresholds) |

### Collision

| Surface | Detection | Result |
|---------|-----------|--------|
| Pipes | AABB, bird hitbox ~72% of visual size | Game over |
| Ground | `shipY + shipHeight >= groundY` | Game over |
| Ceiling | `shipY <= 0` | Velocity clamped to 0 (no game over) |

Hitbox forgiveness (shrunk ~15–20% on each side) is essential — it makes near-misses feel rewarding and deaths feel fair.

### Speed / Difficulty

Constant scroll speed throughout. No acceleration, no new obstacle types. Difficulty comes from random gap positions and player fatigue. This is faithful to the original and drives the "one more try" loop.

### Time Limit

120-second maximum run time (per product vision). At 150 px/s scroll and 280 px spacing, theoretical max score is ~64 pipes. Timer displayed subtly (or not at all — can be added later).

---

## 4. Technical Constraints and Assumptions

### CEF/In-Game Browser (primary target)

| Constraint | Value | Source |
|-----------|-------|--------|
| Viewport | 787×1198 px, portrait | capabilities.json |
| DPR | 1 | capabilities.json |
| Engine | Chrome 122 (CEF) | capabilities.json |
| Input | Mouse + keyboard only (no touch) | capabilities.json, maxTouchPoints: 0 |
| Canvas 2D | Supported | capabilities.json |
| OffscreenCanvas | Supported | capabilities.json |
| requestAnimationFrame | Supported | capabilities.json |
| performance.now | Supported | capabilities.json |
| localStorage | Read/write available | capabilities.json |
| Sui wallet | **Not available** | capabilities.json (0 Sui wallets registered) |
| createImageBitmap | Supported (Chrome 50+) | Chrome 122 |
| Color scheme | `prefers-color-scheme: dark` | capabilities.json |

### Standalone Browser (secondary target)

- Any modern desktop browser
- Variable viewport (responsive)
- Sui wallet may be available (EVE Vault via `@evefrontier/dapp-kit`)

### Framework

| Choice | Value | Rationale |
|--------|-------|-----------|
| Build tool | Vite | Project standard per copilot-instructions.md |
| UI framework | React | Project standard |
| Rendering | Canvas 2D | Best fit for simple 2D games (see §5) |
| Styling | Tailwind CSS | For menu/overlay UI only, not game canvas |
| State in game loop | Plain TypeScript objects | React state is too slow for 60fps updates |
| State in UI overlay | React useState/context | For menus, score display, mode selection |

### File Size Limits

Per project conventions:
- React components: ~150 lines max
- Hooks: ~100 lines max
- Game modules: pure logic files can be up to ~200 lines
- No file > 500 lines

---

## 5. Rendering and Architecture Choice

### Decision: **Canvas 2D**

Canvas 2D is the clear winner for this use case:

| Alternative | Verdict | Why |
|------------|---------|-----|
| **Canvas 2D** | **Use this** | Immediate-mode API matches game loop paradigm. ~15–25 draw calls per frame. Full Chrome 122 support. Zero overhead beyond clearing and drawing. |
| WebGL | Overkill | Shader/buffer complexity for zero visual benefit. <20 sprites per frame doesn't justify the setup cost. |
| SVG (DOM) | Wrong paradigm | Retained-mode DOM. Updating 10+ element positions per frame triggers reflow. Poor for continuous animation. |
| DOM/CSS | Wrong paradigm | Same retained-mode issue. CSS transforms are GPU-accelerated but layout thrashing on spawn/remove kills performance. |

**Key optimization:** `getContext('2d', { alpha: false })` — disables alpha compositing, saving ~20% of rendering cost. The game has an opaque background, so alpha is unnecessary.

### Architecture: Canvas 2D + React Integration

```
React (UI layer)                    Canvas 2D (game layer)
─────────────────                   ──────────────────────
App.tsx                             gameLoop.ts
├── GamePage.tsx                    ├── update(state, dt) → state
│   ├── <StartScreen />             ├── render(ctx, state, assets)
│   ├── <canvas ref={canvasRef} />  ├── input handler (flap flag)
│   ├── <ScoreOverlay />            └── requestAnimationFrame cycle
│   ├── <GameOverScreen />
│   └── <ModeSelector />
└── Providers (future: wallet)
```

- React owns the DOM: menus, overlays, score display, mode selection
- Canvas is an uncontrolled `<canvas>` element via `useRef`
- Game loop runs **outside React's render cycle** — `requestAnimationFrame` drives updates imperatively
- React never re-renders the canvas
- Communication: game loop → callbacks → React state updates → UI overlay re-renders
- Cleanup: `useEffect` cleanup calls `cancelAnimationFrame` + removes event listeners

---

## 6. State Model

### Game Screen States

```
┌───────────┐    start click    ┌───────────┐   first flap    ┌───────────┐
│   MENU    │ ──────────────►  │   READY   │ ─────────────►  │  PLAYING  │
│           │                   │ (ship     │                  │ (physics  │
│ - mode    │                   │  bobbing) │                  │  active)  │
│   select  │                   └───────────┘                  └─────┬─────┘
│ - scores  │                                                        │
└───────────┘                                                  collision
      ▲                                                              │
      │                        ┌───────────┐                   ┌─────▼─────┐
      └────── restart ─────── │ GAME_OVER │ ◄───── fall ───── │  DYING   │
                               │           │                   │ (tumble   │
                               │ - score   │                   │  to floor)│
                               │ - best    │                   └───────────┘
                               │ - restart │
                               └───────────┘
```

### Screen State Enum

```typescript
type ScreenState = 'menu' | 'ready' | 'playing' | 'dying' | 'gameOver';
```

### GameState Object (plain TypeScript, not React state)

```typescript
interface GameState {
  // Ship
  shipY: number;            // vertical position (px from top)
  shipVelocity: number;     // vertical velocity (px/s, positive = down)
  shipPitch: number;        // rotation in degrees (subtle, ±15° max)

  // Obstacles
  pipes: PipeConfig[];      // array of { x, gapCenterY, scored }
  
  // Scoring
  score: number;
  bestScore: number;
  
  // Timing
  elapsed: number;          // seconds since game start
  
  // Phase
  phase: 'ready' | 'playing' | 'dying' | 'dead';
  
  // RNG
  rng: RNG;                 // seeded PRNG instance
  seed: number;             // seed value (for later verification)
  
  // Visual state
  thrusterIntensity: number;   // 0–1
  attitudeJetAge: number;      // 0–1 (1 = expired)
  backgroundScroll: number;    // parallax X offset
  groundScroll: number;        // ground tile X offset
  
  // Mode
  mode: GameMode;           // 'practice' | 'ranked'
}

interface PipeConfig {
  x: number;                // left edge X position (scrolls left)
  gapCenterY: number;       // center of the gap
  scored: boolean;          // whether the player has passed this pipe
}
```

### React UI State (separate from game state)

```typescript
// In the GamePage component
const [screenState, setScreenState] = useState<ScreenState>('menu');
const [displayScore, setDisplayScore] = useState(0);
const [displayBestScore, setDisplayBestScore] = useState(0);
const [selectedMode, setSelectedMode] = useState<GameMode>('practice');
```

Sync pattern: the game loop calls stable callbacks (`onScoreChange`, `onGameOver`, `onPhaseChange`) which set React state. These callbacks are stored in `useRef` to avoid stale closures.

---

## 7. Physics and Obstacle Generation Model

### Physics Update (per frame)

```typescript
function updatePhysics(state: GameState, dt: number, flapRequested: boolean): void {
  if (flapRequested) {
    state.shipVelocity = JUMP_VELOCITY;  // velocity replacement, not additive
    state.thrusterIntensity = 1.0;
    state.attitudeJetAge = 0;
  }

  // Gravity
  state.shipVelocity += GRAVITY * dt;
  state.shipVelocity = Math.min(state.shipVelocity, TERMINAL_VELOCITY);

  // Position
  state.shipY += state.shipVelocity * dt;

  // Ceiling clamp (no game over, just stop)
  if (state.shipY < 0) {
    state.shipY = 0;
    state.shipVelocity = 0;
  }

  // Pitch (subtle, velocity-proportional)
  const targetPitch = clamp(state.shipVelocity * 0.04, -15, 15);
  state.shipPitch = lerp(state.shipPitch, targetPitch, 1 - Math.pow(0.05, dt));
}
```

### Obstacle Generation (deterministic from seed)

```typescript
function spawnPipe(state: GameState): void {
  const minY = PLAY_AREA_TOP + GAP_SIZE / 2 + MARGIN;
  const maxY = PLAY_AREA_BOTTOM - GAP_SIZE / 2 - MARGIN;

  let gapCenterY = minY + state.rng.next() * (maxY - minY);

  // Constrain delta from previous pipe to prevent impossible transitions
  if (state.pipes.length > 0) {
    const prevGap = state.pipes[state.pipes.length - 1].gapCenterY;
    const maxDelta = GAP_SIZE * 0.5;
    gapCenterY = clamp(gapCenterY, prevGap - maxDelta, prevGap + maxDelta);
    gapCenterY = clamp(gapCenterY, minY, maxY);  // re-clamp within bounds
  }

  state.pipes.push({
    x: CANVAS_WIDTH + PIPE_WIDTH,  // spawn just offscreen right
    gapCenterY,
    scored: false,
  });
}
```

**Spawn trigger:** Check every frame — spawn a new pipe when the rightmost pipe's right edge has scrolled past `CANVAS_WIDTH - HORIZONTAL_SPACING`.

**Removal:** Delete pipes once `pipe.x + PIPE_WIDTH < -10` (fully offscreen left with margin).

**Score trigger:** When `shipX > pipe.x + PIPE_WIDTH / 2` and `!pipe.scored`, set `pipe.scored = true` and increment score.

### Seedable PRNG

```typescript
// Mulberry32 — fast, deterministic, 32-bit
export function createRNG(seed: number): RNG {
  let state = seed | 0;
  return {
    next(): number {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}
```

The game's obstacle generator ONLY calls `rng.next()` — never `Math.random()`. This makes every run reproducible from its seed.

---

## 8. UI / Screen Flow

### Screen Map

```
┌─────────────────────────────────────────────┐
│                MENU SCREEN                   │
│                                              │
│   ╔═══════════════════════════════════════╗  │
│   ║      F L A P P Y                     ║  │
│   ║      F R O N T I E R                 ║  │
│   ╚═══════════════════════════════════════╝  │
│                                              │
│   ┌─────────────┐   ┌─────────────────────┐ │
│   │  PRACTICE   │   │  RANKED  🔒         │ │
│   │  Free play  │   │  Coming soon        │ │
│   └─────────────┘   └─────────────────────┘ │
│                                              │
│   Best Score: 47                             │
│                                              │
│   [  Leaderboard (local)  ]                  │
│                                              │
│   ── scrolling starfield background ──       │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│                READY SCREEN                  │
│                                              │
│           "Click or press Space"             │
│                                              │
│             🚀 (ship bobbing)                │
│                                              │
│   ── scrolling starfield + ground ──         │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│               PLAYING SCREEN                 │
│                                              │
│                   47                         │
│                                              │
│         ║     🚀        ║        ║          │
│         ║               ║        ║          │
│         ║               ║        ║          │
│                                              │
│   ══════════════════════════════════════════ │
│   (ground tiles scrolling)                   │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│              GAME OVER SCREEN                │
│                                              │
│              G A M E   O V E R              │
│                                              │
│              Score:    47                    │
│              Best:     52                    │
│                                              │
│              [ RESTART ]                     │
│              [ MENU ]                        │
│                                              │
│   ── starfield background (static) ──        │
└─────────────────────────────────────────────┘
```

### Screen Transitions

| From | To | Trigger |
|------|-----|---------|
| Menu | Ready | Click "Practice" |
| Ready | Playing | First flap (click/space) |
| Playing | Dying | Collision detected |
| Dying | Game Over | Ship reaches ground / 1s elapsed |
| Game Over | Ready | Click "Restart" |
| Game Over | Menu | Click "Menu" |

**Key UX rules:**
- All transitions are instant (no fades, no loading screens)
- Game Over → Restart must be <1 second (no menus in between)
- Restart button has ~500ms delay to prevent accidental restart
- Background scrolls during Menu and Ready, stops on Game Over

### UI Overlay Approach

Menu, game-over, and score overlays are **React components** positioned absolutely over the canvas. The canvas fills the game area; React components float above it:

```tsx
<div className="relative w-full h-full">
  <canvas ref={canvasRef} className="absolute inset-0" />
  {screenState === 'menu' && <StartScreen onStart={handleStart} />}
  {screenState === 'gameOver' && <GameOverScreen score={score} best={best} onRestart={handleRestart} />}
  {(screenState === 'playing' || screenState === 'ready') && <ScoreOverlay score={displayScore} />}
</div>
```

---

## 9. Asset Plan

### Visual Stack: SVG sprites pre-rasterized to ImageBitmap + Canvas 2D dynamic effects

| Asset | Format | Rendered Size | Notes |
|-------|--------|---------------|-------|
| Ship hull | SVG → ImageBitmap | 72×36 px | Angular EVE-style vessel, pre-rasterized at init |
| Pipe segment | SVG → ImageBitmap | 70 × variable px | Red/dark obstacle column, tileable vertically |
| Pipe cap | SVG → ImageBitmap | 78×20 px | Wider cap at gap edge (classic Flappy Bird detail) |
| Ground tile | SVG → ImageBitmap | 128×40 px | Industrial/metallic plating, tileable horizontally |
| Background | Canvas-drawn starfield | Full canvas | Procedural dots + optional parallax layer |
| Thruster glow | Canvas 2D (dynamic) | ~20×14 px | Radial gradient + shadowBlur, intensity varies per state |
| Attitude jet | Canvas 2D (dynamic) | ~6×18 px | Linear gradient cone, 150ms lifetime on flap |

### Asset Loading

All SVG assets loaded and pre-rasterized via `createImageBitmap` during a brief init phase. Total asset count: 4 SVGs (ship, pipe body, pipe cap, ground tile). Background is procedural (Canvas-drawn starfield with random star positions generated from a fixed seed).

```typescript
async function loadAssets(): Promise<GameAssets> {
  const [shipBitmap, pipeBitmap, pipeCapBitmap, groundBitmap] = await Promise.all([
    loadSVGToBitmap('/assets/ship-hull.svg', 72, 36),
    loadSVGToBitmap('/assets/pipe-body.svg', 70, 600),  // tall strip, drawn clipped
    loadSVGToBitmap('/assets/pipe-cap.svg', 78, 20),
    loadSVGToBitmap('/assets/ground-tile.svg', 128, 40),
  ]);
  return { shipBitmap, pipeBitmap, pipeCapBitmap, groundBitmap };
}
```

### Color Palette

| Element | Colors | Notes |
|---------|--------|-------|
| Background | `#0A0A0F` (near-black) | Deep space |
| Stars | `#FFFFFF`, `#C8D0DC`, `#8090A0` at various alphas | 50–100 dots, random positions |
| Ship hull | `#4A4E54` → `#3A3D42` gradient, panels `#555A61` / `#3D4147` | Industrial grey, desaturated |
| Ship thruster | `#FFB43C` → `#FF781E` → `#FF500A` | Amber/orange glow |
| Attitude jet | `#B8D4FF` → `#6BA3FF` | Blue-white burst |
| Pipes | `#8B1A1A` → `#5C1010` gradient (dark red) | Ominous red obstacles |
| Pipe caps | `#A02020`, highlight edge `#C03030` | Slightly brighter caps |
| Ground | `#2A2D32`, panel lines `#1E2025` | Dark metallic plates |
| Score text | `#FFFFFF`, shadow `#000000` | High contrast |
| Menu text | `#E0E4EA` (primary), `#8892A0` (secondary) | Light on dark |

### Typography

Score display uses `ctx.fillText` with a clean sans-serif font stack: `'Orbitron', 'Share Tech Mono', monospace`. Orbitron is a Google Font with sci-fi feel; fallback to system monospace for zero-load-time MVP. Load Orbitron via `<link>` in index.html (optional polish).

For MVP, system font is fine: `ctx.font = 'bold 48px monospace'` for gameplay score, 24px for menus.

---

## 10. Ship SVG Simplification Plan

### Ship Design Brief

The ship replaces the Flappy Bird. It's viewed from the **side profile, facing right**. The design is industrial/angular (EVE Frontier aesthetic), not sleek sci-fi.

### Silhouette

```
        ┌──────────────┐
   ┌────┤  HULL BODY   ├────────┐
   │    │  (angular,   │ COCKPIT│
───┤ E  │  panel detail├────────┘
   │ N  │  flat top)   │
   │ G  ├──────────────┤
   └────┤  UNDERBODY   │
        └──────┬───────┘
               └── (attitude jet nozzle)
```

- Forward (right): Angled wedge nose, truncated trapezoid shape
- Top line: Nearly flat with 1–2 angular steps (panel breaks)
- Bottom line: Slightly angled underbelly with nozzle bump
- Rear (left): Flat engine housing for thruster glow overlay
- Panel details: 3–4 straight lines dividing hull into sections

### SVG Specification

| Spec | Target |
|------|--------|
| viewBox | `0 0 96 48` |
| Rendered size | 72×36 px (DPR 1) |
| Max paths | 15 (hull outline + 6–8 panels + cockpit + structural) |
| Strokes | Zero — all filled paths (strokes scale poorly at small size) |
| Gradients | Max 2 linear gradients (hull body, cockpit glass) |
| File size target | < 2 KB |

### Animation States (Canvas-driven, not SVG frames)

| State | Ship | Thruster | Attitude Jet | Pitch |
|-------|------|----------|-------------|-------|
| IDLE | Static | Dim pulse (0.3 ± 0.1, 2Hz sine) | None | 0° |
| THRUST | Static | Bright flare (1.0 → decay) | Blue-white cone, 150ms | −8° (nose up) |
| COAST | Static | Medium glow (0.5) | None | +5° to +12° (proportional to fall speed) |
| DEAD | Static | Off (0.0) | None | Slow tumble (120°/s) |

### Thruster Rendering

Rendered as a Canvas radial gradient behind the hull, at the engine housing position:
- Core: `rgba(255, 180, 60, intensity)` (amber-white)
- Mid: `rgba(255, 120, 30, intensity × 0.7)` (orange)
- Outer: `rgba(255, 80, 10, 0)` (fade)
- Canvas `shadowBlur: 12 × intensity` for glow halo

### Attitude Jet Rendering

Small downward-pointing linear gradient cone below the ship, triggered on flap:
- Duration: 150ms (age 0 → 1, then off)
- Core: `#B8D4FF` (blue-white)
- Opacity fades as age increases
- Length expands slightly as it fades (10px → 18px)

### Hitbox

| Metric | Value |
|--------|-------|
| Visual size | 72×36 px |
| Hitbox size | 52×26 px (72% of visual) |
| Hitbox position | Centered, shifted 4px right (forward bias) |

This creates the "feels fair" collision that Flappy Bird depends on.

### SVG Authoring Approach

**Recommended:** Hand-build in Figma or Inkscape at 96×48 viewBox. Export optimized SVG. Run through SVGO to strip metadata. Place at `frontend/public/assets/ship-hull.svg`.

The attached reference image shows the general aesthetic to target — angular plating, muted greys, clearly identifiable as a spacecraft. Simplify aggressively: 15 paths max, flat fills with 2 gradients, no detail finer than ~4px at rendered size.

---

## 11. Future Integration Seams

The MVP code structure explicitly supports five future chain-connected features. Each seam is a clean interface that can be swapped from a local implementation to a chain implementation without changing game logic.

### 11.1 Seed/Entropy Interface

**Files:** `src/lib/rng.ts`, `src/lib/seedProvider.ts`

```typescript
// rng.ts — pure PRNG, no change needed for chain integration
interface RNG { next(): number; }
function createRNG(seed: number): RNG;

// seedProvider.ts — swap point
interface SeedResult {
  seed: number;
  runId: string | null;    // on-chain run ID (null for practice)
  source: 'local' | 'chain';
}
function getLocalSeed(): SeedResult;       // MVP: used now
// function getChainSeed(): Promise<SeedResult>;  // FUTURE: calls start_run()
```

The obstacle generator receives `RNG` as a parameter — never imports seedProvider or calls `Math.random()` directly. This makes the game fully deterministic and verifiable.

### 11.2 Authentication Shell

**Files:** `src/features/auth/types.ts`, `src/features/auth/hooks/usePlayerIdentity.ts`

```typescript
interface PlayerIdentity {
  address: string | null;       // Sui address (null = not connected)
  displayName: string;          // "Pilot" default
  isInGameBrowser: boolean;     // CEF detection
}

function usePlayerIdentity(): {
  player: PlayerIdentity;
  canPlayRanked: boolean;       // MVP: always false
  connect: () => void;          // MVP: no-op
  disconnect: () => void;       // MVP: no-op
};
```

**In-game detection:** `src/lib/environment.ts` — checks `?mode=ingame` query param or 787×1198 viewport + `window.ethereum` heuristic.

### 11.3 Score Submission Interface

**Files:** `src/features/score/types.ts`, `src/features/score/services/scoreService.ts`

```typescript
interface ScoreSubmission {
  score: number;
  runSeed: number;
  gameHash: string;         // future: SHA-256 of game state for integrity
  runId: string | null;     // on-chain run ID
}

interface SubmitResult {
  success: boolean;
  txDigest: string | null;  // Sui tx digest (null for local)
  target: 'local' | 'chain';
}

function submitScore(submission: ScoreSubmission): Promise<SubmitResult>;
// MVP: writes to localStorage, returns { target: 'local' }
// FUTURE: signs Sui transaction, calls submit_score() on-chain
```

### 11.4 Leaderboard Data Interface

**Files:** `src/features/leaderboard/types.ts`, `src/features/leaderboard/services/leaderboardService.ts`

```typescript
interface LeaderboardEntry {
  rank: number;
  playerName: string;
  playerAddress: string | null;
  score: number;
  timestamp: number;
}

function getTopScores(): Promise<LeaderboardEntry[]>;
// MVP: reads from localStorage
// FUTURE: queries Sui shared object via SuiJsonRpcClient
```

### 11.5 Game Mode Model

**Files:** `src/features/game/types.ts`

```typescript
type GameMode = 'practice' | 'ranked';

interface GameModeConfig {
  mode: GameMode;
  seedSource: 'local' | 'chain';
  scorePersistence: 'local' | 'chain';
  requiresEntryFee: boolean;
  leaderboardEligible: boolean;
  label: string;
  description: string;
}

const GAME_MODES: Record<GameMode, GameModeConfig> = {
  practice: {
    mode: 'practice',
    seedSource: 'local',
    scorePersistence: 'local',
    requiresEntryFee: false,
    leaderboardEligible: false,
    label: 'Practice',
    description: 'Free play — no wallet needed',
  },
  ranked: {
    mode: 'ranked',
    seedSource: 'chain',
    scorePersistence: 'chain',
    requiresEntryFee: true,
    leaderboardEligible: true,
    label: 'Ranked',
    description: 'Compete for weekly prizes — 0.1 SUI entry',
  },
};
```

**Mode naming decision: "Ranked"** — universally understood by gamers, implies competitive leaderboard + stakes. "Prize" is ambiguous and could imply lottery/gambling. The prize pool info goes in the mode description and leaderboard panel, not in the mode name.

**MVP behavior:** Practice mode is fully functional. Ranked mode button is visible but locked with "Requires wallet" tooltip. The mode config object is the single source of truth for what each mode does.

---

## 12. Performance Constraints

### What to Do

| Directive | Rationale |
|-----------|-----------|
| `getContext('2d', { alpha: false })` | Disables alpha compositing, ~20% rendering speedup |
| Integer coordinates for `drawImage` | `Math.round()` positions to avoid sub-pixel anti-aliasing |
| Pre-rasterize SVGs via `createImageBitmap` at init | Zero per-frame SVG decoding |
| Cap `dt` at 100ms | Prevents physics explosion on tab-return |
| Auto-pause on `document.hidden` via `visibilitychange` | Don't waste cycles when backgrounded |
| Limit star count to 50–80 dots | Starfield is drawn every frame; keep it cheap |
| Remove pipes once offscreen left | Prevent unbounded pipe array growth |

### What NOT to Do

| Avoid | Why |
|-------|-----|
| WebGL or Three.js | Shader complexity is entirely unnecessary for ~20 draw calls/frame |
| `requestAnimationFrame` inside React render | Game loop must be imperative, outside React's cycle |
| React state for per-frame game data | Re-rendering React 60x/sec is catastrophic |
| `setInterval` for pipe spawning | Must be distance-based (deterministic), not time-based |
| CSS animations on canvas or overlapping DOM | Compositor conflicts and unpredictable layering |
| Unoptimized font rendering per frame | Pre-render score glyphs to offscreen canvas if font rendering is slow (unlikely, but option exists) |
| Multiple canvas layers | One canvas is sufficient for this game's complexity |

### Frame Budget

At 60fps, each frame has 16.6ms. Target budget:

| Phase | Budget | Expected |
|-------|--------|----------|
| Update (physics, collision, scoring) | 1ms | ~0.2ms |
| Render (clear, background, pipes, ship, UI) | 3ms | ~1.5ms |
| Input processing | <0.1ms | ~0.01ms |
| **Total** | **~4ms** | **~1.7ms** |

Headroom is enormous. This game will never be CPU-bound on any machine from the last decade.

---

## 13. Build Phases for Implementation

### Phase 1: Project Scaffold + Canvas Bootstrap (~30 min)

**Goal:** Vite + React project running, canvas rendering a static frame.

**Files to create:**
- `frontend/package.json` + dependencies
- `frontend/tsconfig.json`
- `frontend/vite.config.ts`
- `frontend/index.html`
- `frontend/src/main.tsx` — React root
- `frontend/src/app/App.tsx` — minimal shell
- `frontend/src/features/game/components/GameCanvas.tsx` — canvas ref + resize handler
- `frontend/src/game/constants.ts` — all game constants (physics, dimensions, colors)

**Verification:**
- `npm run dev` serves a page with a black canvas at correct viewport size
- TypeScript compiles clean

### Phase 2: Game Loop + Physics + Ship Placeholder (~1.5 hours)

**Goal:** Ship flies and falls with gravity. Flap input works. No obstacles yet.

**Files to create:**
- `frontend/src/game/types.ts` — GameState, PipeConfig, RNG interfaces
- `frontend/src/game/gameLoop.ts` — requestAnimationFrame loop, dt calculation, update/render split
- `frontend/src/game/physics.ts` — gravity, jump, ceiling clamp, pitch calculation
- `frontend/src/game/renderer.ts` — clear canvas, draw background, draw ship placeholder (rectangle), draw ground
- `frontend/src/game/input.ts` — keyboard/mouse event binding, flap flag
- `frontend/src/lib/rng.ts` — mulberry32 PRNG
- `frontend/src/lib/seedProvider.ts` — getLocalSeed()

**Verification:**
- Ship falls with gravity, jumps on click/space
- Physics feels right (parabolic arc, snappy response)
- dt-capped (tab backgrounding doesn't break state)
- Frame rate visually smooth (~60fps)

### Phase 3: Obstacles + Collision + Scoring (~1.5 hours)

**Goal:** Pipes spawn, scroll, and collide. Score increments. Game over on collision.

**Files to create/modify:**
- `frontend/src/game/obstacles.ts` — pipe spawning (seeded), scrolling, removal
- `frontend/src/game/collision.ts` — AABB collision detection (ships vs pipes, floor, ceiling check)
- Modify `renderer.ts` — add pipe rendering (red rectangles initially), score text
- Modify `gameLoop.ts` — integrate obstacles and collision into update cycle
- Modify `physics.ts` — add dying/dead state handling

**Verification:**
- Pipes spawn at regular intervals with randomized gaps
- Ship collides with pipes and ground → game over
- Score increments when passing pipes
- Same seed produces same obstacle layout (determinism check)

### Phase 4: UI Screens + Game Flow (~1 hour)

**Goal:** Complete screen flow from menu through gameplay to game over and restart.

**Files to create:**
- `frontend/src/features/game/components/StartScreen.tsx` — title, mode selector, best score
- `frontend/src/features/game/components/GameOverScreen.tsx` — score, best, restart/menu buttons
- `frontend/src/features/game/components/ScoreOverlay.tsx` — live score display
- `frontend/src/features/game/components/ModeSelector.tsx` — Practice (active) + Ranked (locked)
- `frontend/src/features/game/types.ts` — GameMode, GameModeConfig, GAME_MODES
- `frontend/src/features/score/services/scoreService.ts` — localStorage persistence
- `frontend/src/features/auth/types.ts` — PlayerIdentity, ANONYMOUS_PLAYER
- `frontend/src/lib/environment.ts` — detectEnvironment()

**Modifications:**
- `GameCanvas.tsx` — wire screen state, callbacks, overlay rendering
- `App.tsx` — layout structure

**Verification:**
- Full flow: Menu → Ready → Playing → Game Over → Restart works
- Best score persists across game sessions (localStorage)
- Ranked mode shows locked state
- In-game mode detection works with `?mode=ingame` query param

### Phase 5: Visual Polish — SVG Assets + Effects (~1.5 hours)

**Goal:** Replace placeholder rectangles with themed assets. Add thruster effects and starfield.

**Files to create:**
- `frontend/public/assets/ship-hull.svg` — angular EVE-style ship
- `frontend/public/assets/pipe-body.svg` — red obstacle column
- `frontend/public/assets/pipe-cap.svg` — wider cap piece
- `frontend/public/assets/ground-tile.svg` — metallic plating
- `frontend/src/game/assets.ts` — asset loading (SVG → ImageBitmap)
- `frontend/src/game/shipRenderer.ts` — ship drawing with thruster + attitude jet effects
- `frontend/src/game/starfield.ts` — procedural starfield background

**Modifications:**
- `renderer.ts` — integrate asset-based rendering
- `gameLoop.ts` — add asset pre-loading before loop start

**Verification:**
- All placeholder rectangles replaced with themed assets
- Thruster effect visible and responsive to game state
- Starfield scrolls with parallax
- Game still runs at 60fps with all visual effects
- Visual quality appropriate for demo/submission

### Optional Phase 6: Leaderboard Panel + Polish (~30 min)

**Goal:** Minimal local leaderboard display. Final polish pass.

**Files to create:**
- `frontend/src/features/leaderboard/types.ts`
- `frontend/src/features/leaderboard/services/leaderboardService.ts`
- `frontend/src/features/leaderboard/components/LeaderboardPanel.tsx`

**Verification:**
- Menu screen shows top local scores
- Build succeeds (`npm run build`)
- TypeScript clean (`npx tsc --noEmit`)
- Game loads in CEF-sized viewport (resize browser to 787×1198)

---

## 14. File Structure (Complete)

```
frontend/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── public/
│   └── assets/
│       ├── ship-hull.svg          # ~2KB, angular EVE vessel
│       ├── pipe-body.svg          # ~1KB, red obstacle column
│       ├── pipe-cap.svg           # ~1KB, wider cap piece
│       └── ground-tile.svg        # ~1KB, metallic plating
└── src/
    ├── main.tsx                   # React root (~15 lines)
    ├── app/
    │   └── App.tsx                # Providers + layout (~30 lines)
    ├── lib/
    │   ├── rng.ts                 # Mulberry32 PRNG (~25 lines)
    │   ├── seedProvider.ts        # Seed source abstraction (~30 lines)
    │   └── environment.ts         # In-game detection (~20 lines)
    ├── game/
    │   ├── constants.ts           # All game constants (~60 lines)
    │   ├── types.ts               # GameState, PipeConfig interfaces (~40 lines)
    │   ├── gameLoop.ts            # rAF loop orchestration (~100 lines)
    │   ├── physics.ts             # Gravity, jump, ceiling (~60 lines)
    │   ├── obstacles.ts           # Pipe spawn/scroll/remove (~70 lines)
    │   ├── collision.ts           # AABB detection (~40 lines)
    │   ├── renderer.ts            # Main render function (~120 lines)
    │   ├── shipRenderer.ts        # Ship + thruster + jet drawing (~80 lines)
    │   ├── starfield.ts           # Procedural starfield (~40 lines)
    │   ├── assets.ts              # SVG→ImageBitmap loader (~30 lines)
    │   └── input.ts               # Keyboard/mouse binding (~40 lines)
    ├── features/
    │   ├── auth/
    │   │   ├── types.ts           # PlayerIdentity (~15 lines)
    │   │   └── hooks/
    │   │       └── usePlayerIdentity.ts  # MVP: anonymous (~30 lines)
    │   ├── game/
    │   │   ├── types.ts           # GameMode, GameModeConfig (~40 lines)
    │   │   ├── components/
    │   │   │   ├── GameCanvas.tsx     # Canvas wrapper + lifecycle (~80 lines)
    │   │   │   ├── GamePage.tsx       # Page orchestrator (~60 lines)
    │   │   │   ├── StartScreen.tsx    # Menu overlay (~50 lines)
    │   │   │   ├── GameOverScreen.tsx # Game over overlay (~50 lines)
    │   │   │   ├── ScoreOverlay.tsx   # Live score (~20 lines)
    │   │   │   └── ModeSelector.tsx   # Practice/Ranked selector (~50 lines)
    │   │   └── hooks/
    │   │       └── useGameSession.ts  # Orchestrates seed→play→submit (~60 lines)
    │   ├── score/
    │   │   ├── types.ts              # ScoreSubmission, SubmitResult (~20 lines)
    │   │   └── services/
    │   │       └── scoreService.ts   # localStorage persistence (~40 lines)
    │   └── leaderboard/
    │       ├── types.ts              # LeaderboardEntry (~10 lines)
    │       ├── services/
    │       │   └── leaderboardService.ts  # localStorage reads (~30 lines)
    │       └── components/
    │           └── LeaderboardPanel.tsx    # Top scores display (~50 lines)
    └── styles/
        └── index.css              # Tailwind directives + minimal base (~15 lines)
```

**Total estimated lines:** ~1,300 lines across ~30 files.  
No file exceeds 120 lines. Game logic core (game/ directory) is ~665 lines.

---

## 15. Risks and Open Questions

| # | Risk | Impact | Mitigation |
|---|------|--------|------------|
| 1 | Physics tuning doesn't "feel right" on first pass | Medium — game feels wrong | Constants are centralized in `constants.ts`. Budget 30 min for tuning gravity/jump/speed ratios. Original Flappy Bird values are well-documented. |
| 2 | SVG ship asset doesn't read well at 72×36 px | Low–Medium — looks bad | Author at 2× (192×96), shrink to verify legibility before finalizing. Keep geometry simple (15 paths max). If SVG fails, fall back to Canvas-drawn geometric ship (triangle + rectangle). |
| 3 | createImageBitmap not working as expected in CEF | Low — asset loading fails | Fallback: load SVGs as `Image` objects (`img.src = url`, wait for `onload`), draw via `drawImage(img)` instead. Slightly less optimal but universally supported. |
| 4 | Pipe gap randomness feels too easy or too hard | Medium — bad gameplay | `GAP_SIZE`, `GAP_DELTA_CAP`, and gap Y range are all constants. Tunable without code changes. Start with generous gaps and tighten. |
| 5 | Time limit (120s) doesn't integrate cleanly | Low | Optional feature — can omit from MVP. If included, a simple `elapsed > MAX_TIME` check in the update loop suffices. |
| 6 | Font rendering varies between CEF and standalone | Low | System monospace fallback is always safe. Sci-fi font (Orbitron) is optional polish. |
| 7 | Canvas sizing on responsive standalone viewport | Medium | Read canvas dimensions from container element. Use CSS to maintain portrait aspect ratio (max-width with aspect-ratio constraint). |

### Open Questions (to resolve during implementation)

1. **Ground element:** Should the "ground" be a floating platform, or the bottom of the viewport? Suggest: visible metallic ground strip at the bottom (~40px). Ship collision with ground = game over. Ground scrolls like pipes.

2. **Parallax layers:** One starfield layer or two? Suggest: one static background + one slow-scrolling star layer. Keep it minimal.

3. **Ready state ship bobbing:** Sine wave bob (classic Flappy Bird) or stationary with idle thruster pulse? Suggest: combine both — small sine bob (±3px, 1.5Hz) + dim thruster pulse.

4. **Score display during playing:** Canvas-drawn text or React overlay? Suggest: React overlay (`<div>` positioned at top-center) for crisp text that doesn't compete with the game canvas rendering pipeline. Alternative: Canvas `fillText` to keep everything in one layer.

---

## 16. Recommended Next Agent Prompt Scope

### Immediate next step: Phase 1 + Phase 2

A single implementation agent should be prompted with:

> **Goal:** Build the Flappy Frontier project scaffold (Vite + React + Canvas 2D) and implement the core game loop with ship physics. Ship can fly and fall with gravity. Flap input works via mouse click and spacebar. No obstacles yet — just the flying feel.
>
> **Reference:** `docs/plans/flappy-frontier-game-mvp-plan.md`, Phases 1 and 2.
>
> **Constraints:** Follow the file structure and architecture from the plan. Use Canvas 2D with `alpha: false`. Game loop must be imperative (outside React render cycle). Physics must use delta-time. Use the constants from §3 and §7. Ship is a colored rectangle placeholder for now.
>
> **Verification:** `npm run build` succeeds, `npx tsc --noEmit` passes, dev server shows a canvas where a rectangle falls and jumps on click/space.

After Phase 1+2, subsequent prompts should follow the plan's phase structure: Phase 3 (obstacles + collision), Phase 4 (UI screens), Phase 5 (visual assets), Phase 6 (leaderboard polish).

Each phase is designed to be completable in a single focused prompt with clear inputs, outputs, and verification criteria.

---

## Appendix A: Constants Reference

```typescript
// All values for 787×1198 viewport. Adjust proportionally for other sizes.

// Canvas
const CANVAS_WIDTH = 787;
const CANVAS_HEIGHT = 1198;
const GROUND_HEIGHT = 40;
const PLAY_AREA_HEIGHT = CANVAS_HEIGHT - GROUND_HEIGHT;

// Ship
const SHIP_WIDTH = 72;
const SHIP_HEIGHT = 36;
const SHIP_X = 157;                           // fixed X (20% of canvas width)
const SHIP_START_Y = PLAY_AREA_HEIGHT * 0.4;  // start at 40% height

// Physics
const GRAVITY = 1400;            // px/s²
const JUMP_VELOCITY = -300;      // px/s (negative = up)
const TERMINAL_VELOCITY = 700;   // px/s
const DT_CAP = 0.1;             // seconds (100ms)

// Obstacles
const PIPE_WIDTH = 70;           // px
const PIPE_GAP = 140;            // px (vertical gap between top and bottom)
const PIPE_SPEED = 150;          // px/s (scroll left)
const PIPE_SPACING = 280;        // px (horizontal, center-to-center)
const GAP_Y_MIN_PCT = 0.20;     // gap center min (% of play area)
const GAP_Y_MAX_PCT = 0.80;     // gap center max (% of play area)
const GAP_DELTA_CAP = 0.5;      // max delta between adjacent gaps (fraction of PIPE_GAP)

// Collision
const HITBOX_SHRINK = 0.15;     // 15% inset on each side

// Visual
const GROUND_SCROLL_SPEED = 150; // px/s (same as pipe speed)
const BG_SCROLL_SPEED = 20;     // px/s (slow parallax)
const THRUSTER_PULSE_HZ = 2;    // idle pulse frequency
const ATTITUDE_JET_DURATION = 0.15; // seconds

// Timing
const MAX_GAME_TIME = 120;      // seconds
const RESTART_DELAY = 500;      // ms (prevent accidental restart)

// Ship pitch
const MAX_PITCH_UP = -15;       // degrees
const MAX_PITCH_DOWN = 15;      // degrees
const PITCH_FACTOR = 0.04;      // velocity-to-pitch multiplier
```

---

## Appendix B: Input Mapping

| Input | Action | Scope |
|-------|--------|-------|
| Space key | Flap | `document` keydown |
| Up arrow | Flap | `document` keydown |
| Enter key | Flap (during gameplay only) | `document` keydown |
| Mouse click (left) | Flap | `canvas` mousedown |
| Escape | Pause (future) | `document` keydown |

All inputs map to a single `pendingFlap = true` flag consumed in the next `update()` tick. `event.preventDefault()` called for Space and Up arrow to prevent page scrolling.

---

*End of plan. This document is the primary reference for all game-side MVP implementation work. Subsequent phases should be executed in order, with verification gates at each phase boundary.*
