import { brand, isDefaultBrand } from '../lib/brand';
import { cn } from '../lib/cn';

/**
 * The tile: an ember square with a half-moon notch in each side — a ticket
 * stub — so the mark carries the same cut as the kitchen tickets.
 */
export const TILE_PATH =
  'M8 0H24A8 8 0 0 1 32 8V13A3 3 0 0 0 32 19V24A8 8 0 0 1 24 32H8A8 8 0 0 1 0 24V19A3 3 0 0 0 0 13V8A8 8 0 0 1 8 0Z';

/** A hand-drawn serif N: hairline stems, a heavy diagonal, bracket-less slab serifs. */
export const N_PATH =
  'M9.6 7.4h2v14.2h-2zM20.4 7.4h2v14.2h-2zM9.6 7.4h4.3L22.4 21.6h-4.3zM7.6 7.4h6.3v1.35H7.6zM18.4 7.4h6v1.35h-6zM7.6 20.25h6v1.35h-6z';

/** The ledger line the letter sits on. */
export const RULE_PATH = 'M7.6 24.6h16.8v1.2H7.6z';

export interface MonogramProps {
  className?: string;
  /** Tile colour; the glyph is always surface. */
  tone?: 'accent' | 'ink';
  title?: string;
}

/**
 * Brand monogram (SVG). Rebrands keep the tile and set their own initial in
 * Fraunces; the drawn N is reserved for the default brand.
 */
export function Monogram({ className, tone = 'accent', title }: MonogramProps) {
  const initial = brand.name.trim().charAt(0).toUpperCase();
  return (
    <svg
      viewBox="0 0 32 32"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={cn('shrink-0', className)}
    >
      <path d={TILE_PATH} className={tone === 'accent' ? 'fill-accent' : 'fill-ink'} />
      {isDefaultBrand ? (
        <path d={N_PATH} className="fill-surface" />
      ) : (
        <text
          x="16"
          y="21.4"
          textAnchor="middle"
          className="fill-surface font-display"
          style={{ fontSize: 17, fontWeight: 600 }}
        >
          {initial}
        </text>
      )}
      <path d={RULE_PATH} className="fill-surface" opacity={0.62} />
    </svg>
  );
}
