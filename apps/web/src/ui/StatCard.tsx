import type { ReactNode } from 'react';
import { Panel } from './Panel';

/** A KPI on its own panel. Inside a StatGrid it becomes one ruled cell of a ledger strip. */
export function StatCard({ label, value, note, cell }: { label: string; value: ReactNode; note?: string; cell?: boolean }) {
  const body = (
    <>
      <p className="eyebrow">{label}</p>
      <p className="tabular mt-2.5 font-display text-[1.875rem] leading-none font-semibold tracking-[-0.02em]">{value}</p>
      {note && <p className="mt-1.5 text-sm text-muted">{note}</p>}
    </>
  );
  return cell ? <div className="bg-[#0d1311] px-5 py-4.5">{body}</div> : <Panel>{body}</Panel>;
}

/** Ledger strip: KPI cells divided by hairlines inside one panel (pass cell to each StatCard). */
export function StatGrid({ children, className = 'sm:grid-cols-2 lg:grid-cols-4' }: { children: ReactNode; className?: string }) {
  return (
    <div className="nx-glass overflow-hidden rounded-panel bg-white/[0.06]">
      <div className={`grid grid-cols-1 gap-px ${className}`}>{children}</div>
    </div>
  );
}
