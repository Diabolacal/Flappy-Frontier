/**
 * LogoBadge — Decorative brand badge for the Flappy Frontier playspace.
 *
 * Visual treatment: dark glass container with orange accent border and
 * layered glow matching the EFMap badge language. Purely decorative —
 * not interactive, not focusable.
 */

/** EFMap badge orange — used as the canonical accent for this badge. */
const BADGE_ACCENT = '#ff4c26';

/** Resting state: dark shadows + accent orange border glow. */
const REST_SHADOW = [
  '0 2px 10px rgba(0,0,0,0.65)',
  '0 0 0 1px rgba(255,255,255,0.05)',
  '0 0 10px rgba(255,255,255,0.08)',
  `0 0 24px -4px ${BADGE_ACCENT}`,
].join(', ');

/** Hover state: intensified shadows + stronger accent bloom. */
const HOVER_SHADOW = [
  '0 4px 18px rgba(0,0,0,0.75)',
  '0 0 0 1px rgba(255,255,255,0.12)',
  '0 0 16px rgba(255,255,255,0.16)',
  `0 0 36px -4px ${BADGE_ACCENT}`,
].join(', ');

export function LogoBadge() {
  return (
    <div
      className="absolute bottom-2.5 right-2.5 z-[30] pointer-events-auto"
      aria-hidden="true"
    >
      <div className="group relative flex h-24 w-24 cursor-default items-center justify-center">
        {/* Glass background layer — accent border visible at rest */}
        <span
          className="absolute inset-0 rounded-[10px] backdrop-blur-[3px]
                     transition-all duration-300"
          style={{
            background: 'rgba(0, 0, 0, 0.82)',
            border: `1px solid ${BADGE_ACCENT}`,
            boxShadow: REST_SHADOW,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = HOVER_SHADOW;
            e.currentTarget.style.borderColor = BADGE_ACCENT;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = REST_SHADOW;
            e.currentTarget.style.borderColor = BADGE_ACCENT;
          }}
        />

        {/* Logo glyph */}
        <span className="pointer-events-none relative flex h-[78%] w-[78%] select-none items-center justify-center">
          <img
            src="/assets/branding/flappy-frontier-logo.png"
            alt=""
            className="pointer-events-none h-full w-full select-none object-contain"
            draggable={false}
          />
        </span>
      </div>
    </div>
  );
}
