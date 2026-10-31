import { Link2 } from 'lucide-react';

/**
 * Tiny decorative UI chips, one per "How it works" step (pure HTML/CSS, aria-hidden by the parent).
 * They illustrate the step; the information itself is in the step text.
 */
export function HowChip({ id }: { id: string }) {
  switch (id) {
    case 'register':
      return (
        <div className="lp-how__chip lp-how__chip--form">
          {['Restaurant', 'City', 'Outlets'].map((f) => (
            <span key={f} className="lp-how__field lp-mono">
              {f}
            </span>
          ))}
        </div>
      );
    case 'pay':
      return (
        <div className="lp-how__chip lp-how__chip--link lp-mono">
          <Link2 size={14} strokeWidth={2} aria-hidden="true" focusable="false" />
          Payment link
          <span className="lp-how__chip-sub">by WhatsApp or email</span>
        </div>
      );
    case 'workspace':
      return (
        <div className="lp-how__chip lp-how__chip--row lp-mono">
          <span>Owner login</span>
          <span>Location 1</span>
        </div>
      );
    case 'menu-and-tables':
      return (
        <div className="lp-how__chip lp-how__chip--row lp-mono">
          <span>T1 Available</span>
          <span>T2 Occupied</span>
          <span>T3 Cleaning</span>
        </div>
      );
    default:
      return (
        <div className="lp-how__chip lp-how__chip--ticket lp-mono">
          <span>Service Request</span>
          <span aria-hidden="true">{'->'}</span>
          <span>KOS</span>
        </div>
      );
  }
}
