import { cn } from '../lib/cn';
import './tour.css';

/**
 * Manhar Bot: a small friendly robot drawn in SVG. It floats, blinks, waves when it appears and moves its
 * mouth while `talking`. Purely decorative (aria-hidden); the words next to it carry the meaning.
 */
export function ManharBot({
  talking = false,
  wave = false,
  flying = false,
  small = false,
}: {
  talking?: boolean;
  wave?: boolean;
  flying?: boolean;
  small?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 120 120"
      aria-hidden
      focusable="false"
      className={cn('nx-bot', small && 'nx-bot--sm', wave && 'nx-bot--wave', talking && 'nx-bot--talk', flying && 'nx-bot--fly')}
    >
      <g className="nx-bot__body">
        {/* antenna */}
        <line x1="60" y1="14" x2="60" y2="26" stroke="var(--color-accent)" strokeWidth="3" strokeLinecap="round" />
        <circle cx="60" cy="11" r="5" fill="var(--color-accent)" />
        <circle cx="60" cy="11" r="5" fill="var(--color-accent)" className="nx-bot__antenna" />
        {/* head */}
        <rect x="24" y="26" width="72" height="54" rx="20" fill="#16201c" stroke="var(--color-accent)" strokeWidth="3" />
        <rect x="32" y="34" width="56" height="38" rx="14" fill="#0b1210" />
        {/* eyes */}
        <ellipse className="nx-bot__eye" cx="48" cy="52" rx="6" ry="7" fill="var(--color-accent)" />
        <ellipse className="nx-bot__eye" cx="72" cy="52" rx="6" ry="7" fill="var(--color-accent)" />
        {/* mouth */}
        <rect className="nx-bot__mouth" x="52" y="62" width="16" height="5" rx="2.5" fill="var(--color-accent)" />
        {/* jets, only lit while the bot glides to the next item */}
        <g className="nx-bot__jet">
          <path d="M50 110 q-4 12 0 18 q4 -6 0 -18z" fill="#fbbf24" />
          <path d="M70 110 q-4 12 0 18 q4 -6 0 -18z" fill="#fbbf24" />
        </g>
        {/* body */}
        <rect x="38" y="84" width="44" height="26" rx="12" fill="#16201c" stroke="var(--color-accent)" strokeWidth="3" />
        <circle cx="60" cy="97" r="4" fill="var(--color-accent)" opacity="0.8" />
        {/* arms */}
        <rect x="22" y="88" width="14" height="8" rx="4" fill="var(--color-accent)" opacity="0.85" />
        <g className="nx-bot__arm">
          <rect x="84" y="88" width="16" height="8" rx="4" fill="var(--color-accent)" />
        </g>
      </g>
    </svg>
  );
}
