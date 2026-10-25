import type { ReactNode } from 'react';
import { Panel } from './Panel';

export function StatCard({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <Panel>
      <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
      <p className="tabular mt-2 font-display text-3xl font-semibold">{value}</p>
      {note && <p className="mt-1 text-sm text-muted">{note}</p>}
    </Panel>
  );
}
