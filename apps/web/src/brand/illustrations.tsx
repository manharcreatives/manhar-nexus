/**
 * Empty-state line art. Original, drawn for this product: 1.5px strokes in
 * the muted ink, one ember detail each. Decorative (aria-hidden); the empty
 * state's heading carries the meaning. Each stays well under 2 KB.
 */
import type { SVGProps } from 'react';

const base: SVGProps<SVGSVGElement> = {
  viewBox: '0 0 160 96',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  className: 'h-24 w-40 text-muted/70',
};

/** A floor plan with one round table and four empty chairs. */
export function EmptyFloorArt() {
  return (
    <svg {...base}>
      <path d="M14 82h132" strokeDasharray="2 5" />
      <circle cx="80" cy="44" r="20" />
      <circle cx="80" cy="44" r="13" strokeDasharray="1 4" />
      <rect x="72" y="8" width="16" height="9" rx="3" />
      <rect x="72" y="71" width="16" height="9" rx="3" />
      <rect x="44" y="36" width="9" height="16" rx="3" />
      <rect x="107" y="36" width="9" height="16" rx="3" />
      <path d="M126 20v14M119 27h14" className="text-accent" stroke="currentColor" />
    </svg>
  );
}

/** A bill spike with one curled receipt and nothing else on it. */
export function EmptyBillsArt() {
  return (
    <svg {...base}>
      <path d="M50 86h60" />
      <path d="M80 86V14" />
      <path d="M74 86c0-4 12-4 12 0" />
      <path d="M62 30h36v40l-4.5-3-4.5 3-4.5-3-4.5 3-4.5-3-4.5 3-4.5-3-4.5 3z" />
      <path d="M68 40h14M68 48h24M68 56h18" />
      <path d="M86 40h6" className="text-accent" stroke="currentColor" />
      <circle cx="80" cy="14" r="1.5" />
    </svg>
  );
}

/** The ticket rail with empty clips and a check: the kitchen is clear. */
export function AllClearArt() {
  return (
    <svg {...base}>
      <path d="M16 24h128" strokeWidth="2.5" />
      <path d="M36 24v8M62 24v8M98 24v8M124 24v8" />
      <path d="M32 32h8M58 32h8M94 32h8M120 32h8" />
      <circle cx="80" cy="62" r="20" className="text-accent" stroke="currentColor" />
      <path d="M71 62.5l6.5 6.5 12-13" className="text-accent" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/** Three hooks on a rail, one apron waiting for its owner. */
export function EmptyTeamArt() {
  return (
    <svg {...base}>
      <path d="M24 18h112" strokeWidth="2.5" />
      <path d="M48 18v8a4 4 0 0 0 8 0M76 18v8a4 4 0 0 0 8 0M104 18v8a4 4 0 0 0 8 0" />
      <path d="M74 30c2 6 10 6 12 0" />
      <path d="M72 34h16l6 10v34a4 4 0 0 1-4 4H70a4 4 0 0 1-4-4V44z" />
      <path d="M66 50c-6 0-10 2-12 6M94 50c6 0 10 2 12 6" />
      <path d="M73 60h14v10H73z" className="text-accent" stroke="currentColor" />
    </svg>
  );
}

/** A blank order pad with a pencil: nothing taken at this table yet. */
export function EmptyOrderArt() {
  return (
    <svg {...base}>
      <path d="M48 86h64" strokeDasharray="2 5" />
      <path d="M54 12h44v66H54z" />
      <path d="M62 24h28M62 34h28M62 44h18M62 54h10" strokeDasharray="1 4" />
      <path d="M62 24h10" className="text-accent" stroke="currentColor" />
      <path d="M118 30l8 8-26 30-10 2 2-10z" />
      <path d="M113 35l8 8" />
    </svg>
  );
}
