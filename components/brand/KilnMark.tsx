/**
 * The Kiln mark.
 *
 * An arch within an arch: the mouth of a kiln, and — at a glance — the
 * chrome of an application window. The inner chamber carries the glow,
 * which is the only part that changes between states, so the silhouette
 * stays recognisable down to 16px where the gradient stops being legible.
 */

export type KilnMarkVariant = 'solid' | 'gradient' | 'firing';

interface KilnMarkProps {
  className?: string;
  /**
   * solid    — single currentColor silhouette. Use in dense UI and anywhere
   *            the mark sits on a coloured background.
   * gradient — brand gradient chamber. The default for marketing surfaces.
   * firing   — animated chamber, for "a build is running" states.
   */
  variant?: KilnMarkVariant;
  title?: string;
}

// Outer arch: flat base, semicircular crown.
const OUTER = 'M3 21V12a9 9 0 0 1 18 0v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z';
// Inner chamber, concentric with the outer arch.
const CHAMBER = 'M8.5 22v-9.5a3.5 3.5 0 0 1 7 0V22Z';

export default function KilnMark({
  className = 'w-6 h-6',
  variant = 'solid',
  title,
}: KilnMarkProps) {
  // Unique per instance so multiple marks on one page don't share defs.
  const uid = `kiln-${variant}`;

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}

      {variant !== 'solid' && (
        <defs>
          <linearGradient id={`${uid}-chamber`} x1="8" y1="22" x2="16" y2="9">
            <stop offset="0%" stopColor="var(--kiln-iris-600, #4f35db)" />
            <stop offset="55%" stopColor="var(--kiln-iris-400, #8a6ff7)" />
            <stop offset="100%" stopColor="var(--kiln-glow-500, #f2b441)" />
          </linearGradient>
        </defs>
      )}

      {/* Body of the kiln. */}
      <path d={OUTER} fill="currentColor" />

      {/* Chamber. Punched out of the body on the solid variant, lit on the others. */}
      {variant === 'solid' ? (
        <path d={CHAMBER} fill="var(--kiln-mark-void, #ffffff)" />
      ) : (
        <>
          <path d={CHAMBER} fill={`url(#${uid}-chamber)`}>
            {variant === 'firing' && (
              <animate
                attributeName="opacity"
                values="0.72;1;0.72"
                dur="2.4s"
                repeatCount="indefinite"
              />
            )}
          </path>
        </>
      )}
    </svg>
  );
}
