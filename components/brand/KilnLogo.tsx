import Link from 'next/link';
import KilnMark, { type KilnMarkVariant } from './KilnMark';
import { brand } from '@/config/brand.config';

/**
 * Wordmark. Set rather than drawn, so it inherits the product typeface and
 * stays crisp at any size. Tight tracking and a raised small-cap "ILN" give
 * it the compactness of a drawn logotype without the maintenance cost.
 */
export function KilnWordmark({ className = '' }: { className?: string }) {
  return (
    <span
      className={`select-none font-semibold leading-none tracking-[-0.02em] ${className}`}
      style={{ fontFeatureSettings: '"ss01", "cv11"' }}
    >
      {brand.name.toLowerCase()}
    </span>
  );
}

interface KilnLogoProps {
  className?: string;
  /** Size of the mark. The wordmark scales with the surrounding text size. */
  markClassName?: string;
  variant?: KilnMarkVariant;
  /** Render as a link back to the marketing home. */
  href?: string | null;
  /** Hide the wordmark and show the mark alone (mobile headers, favicons). */
  markOnly?: boolean;
}

/**
 * The standard lockup: mark, then wordmark, on one baseline.
 */
export default function KilnLogo({
  className = '',
  markClassName = 'w-[22px] h-[22px]',
  variant = 'gradient',
  href = '/',
  markOnly = false,
}: KilnLogoProps) {
  const content = (
    <span className={`inline-flex items-center gap-[9px] ${className}`}>
      <KilnMark className={markClassName} variant={variant} title={brand.name} />
      {!markOnly && <KilnWordmark className="text-[19px]" />}
    </span>
  );

  if (!href) return content;

  return (
    <Link href={href} aria-label={`${brand.name} home`} className="contents">
      {content}
    </Link>
  );
}
