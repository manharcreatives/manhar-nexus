import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';
import { Button } from '../ui/Button';
import { StatusPill } from '../ui/StatusPill';
import { TableStatusLabel } from './StatusPills';
import { minutesSince } from './time';
import { type DiningTable, type GuestSession, timeAgo } from './api';

const EDGE: Record<DiningTable['status'], string> = {
  AVAILABLE: 'border-line hover:border-ink/30',
  OCCUPIED: 'border-accent/30 hover:border-accent/60',
  CLEANING: 'border-line',
};

/** Two hours fills the occupancy meter; it is a quiet cue, the minutes are the fact. */
const METER_FULL_MIN = 120;

function TileBody({ table, session }: { table: DiningTable; session?: GuestSession }) {
  const { t } = useTranslation();
  const mins = session ? minutesSince(session.openedAt, Date.now()) : 0;
  const pct = Math.min(100, (mins / METER_FULL_MIN) * 100);
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-2">
        <span className="font-display text-[1.75rem] leading-none font-semibold tracking-[-0.02em]">{table.code}</span>
        {table.isActive ? (
          <TableStatusLabel status={table.status} className="mt-1 max-w-full" />
        ) : (
          <StatusPill>{t('restaurant.tables.inactive')}</StatusPill>
        )}
      </div>
      <p className="mt-1.5 text-sm text-muted">{t('restaurant.tables.seats', { count: table.capacity })}</p>
      {session && (
        <div className="mt-auto pt-4">
          <p className="tabular flex min-w-0 flex-wrap items-baseline justify-between gap-x-2 text-sm font-medium">
            <span className="whitespace-nowrap">{t('restaurant.tables.guests', { count: session.partySize })}</span>
            <span className="whitespace-nowrap text-muted">{timeAgo(session.openedAt)}</span>
          </p>
          <div aria-hidden className="nx-meter mt-2">
            <span style={{ width: `${Math.max(4, pct)}%` }} className={cn(pct >= 75 && 'bg-accent-strong!')} />
          </div>
        </div>
      )}
    </>
  );
}

export function FloorGrid({
  tables,
  sessionByTable,
  resetting,
  onTableClick,
  onResetTable,
}: {
  tables: DiningTable[];
  sessionByTable: Map<string, GuestSession>;
  resetting: ReadonlySet<string>;
  onTableClick: (table: DiningTable) => void;
  onResetTable: (table: DiningTable) => void;
}) {
  const { t } = useTranslation();
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {tables.map((table) => {
        const session = sessionByTable.get(table.id);
        const tile = cn(
          'nx-tile flex h-full min-h-32 w-full flex-col rounded-panel border bg-surface p-4 text-left',
          table.isActive ? EDGE[table.status] : 'border-dashed border-line bg-sunken opacity-60',
        );
        const interactive = table.isActive && table.status !== 'CLEANING';
        return (
          <li key={table.id} className="min-w-0">
            {interactive ? (
              <button
                type="button"
                onClick={() => onTableClick(table)}
                data-status={table.status}
                className={cn(tile, 'cursor-pointer')}
              >
                <TileBody table={table} session={session} />
              </button>
            ) : (
              <div className={tile} data-status={table.isActive ? table.status : undefined}>
                <TileBody table={table} session={session} />
                {table.isActive && table.status === 'CLEANING' && (
                  <Button
                    variant="secondary"
                    className="mt-3 w-full"
                    loading={resetting.has(table.id)}
                    aria-label={t('restaurant.tables.markAvailable', { code: table.code })}
                    onClick={() => onResetTable(table)}
                  >
                    {t('restaurant.tables.markAvailableShort')}
                  </Button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
