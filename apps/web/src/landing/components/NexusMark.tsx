import { cx } from './cx';

/** Ticket-stub tile geometry copied from apps/web/src/brand/Monogram.tsx (that component uses the old green). */
export const TILE_PATH =
  'M8 0H24A8 8 0 0 1 32 8V13A3 3 0 0 0 32 19V24A8 8 0 0 1 24 32H8A8 8 0 0 1 0 24V19A3 3 0 0 0 0 13V8A8 8 0 0 1 8 0Z';
export const N_PATH =
  'M9.6 7.4h2v14.2h-2zM20.4 7.4h2v14.2h-2zM9.6 7.4h4.3L22.4 21.6h-4.3zM7.6 7.4h6.3v1.35H7.6zM18.4 7.4h6v1.35h-6zM7.6 20.25h6v1.35H7.6z';
export const RULE_PATH = 'M7.6 24.6h16.8v1.2H7.6z';

export interface NexusMarkProps {
  /** Pixel size (square). Default 32 */
  size?: number;
  /** Accessible name. Omit for decorative use (aria-hidden). */
  title?: string;
  /** Tile fill. Default Manhar Green #1DBA3C */
  tile?: string;
  /** Glyph fill. Default Ink #0B0F0E */
  glyph?: string;
  className?: string;
}

/** The Manhar Nexus product mark: green ticket-stub tile with the drawn N and ledger rule. */
export function NexusMark({ size = 32, title, tile = '#1DBA3C', glyph = '#0B0F0E', className }: NexusMarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={cx('lp-mark', className)}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <path d={TILE_PATH} fill={tile} />
      <path d={N_PATH} fill={glyph} />
      <path d={RULE_PATH} fill={glyph} opacity={0.62} />
    </svg>
  );
}

export interface NexusLockupProps {
  /** 'light' = Ink wordmark (for light surfaces) · 'dark' = white wordmark (for Ink surfaces) */
  tone?: 'light' | 'dark';
  size?: number;
  className?: string;
}

/** Mark + "Manhar Nexus" wordmark (typeset in Clash Display; this is the product name, not the studio logo). */
export function NexusLockup({ tone = 'light', size = 32, className }: NexusLockupProps) {
  return (
    <span className={cx('lp-lockup', tone === 'dark' && 'lp-lockup--dark', className)}>
      <NexusMark size={size} />
      <span className="lp-lockup__word">
        Manhar <b>Nexus</b>
      </span>
    </span>
  );
}
