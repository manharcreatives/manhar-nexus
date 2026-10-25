import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';
import { Button } from '../ui/Button';
import { StatusPill } from '../ui/StatusPill';
import { TableStatusPill } from './StatusPills';
import { type DiningTable, type GuestSession, timeAgo } from './api';

const TONE: Record<DiningTable['status'], string> = {
  AVAILABLE: 'border-ok/50 bg-surface hover:border-ok',
  OCCUPIED: 'border-warn/60 bg-warn-soft/60 hover:border-warn',
  CLEANING: 'border-line bg-sunken',
};

function TileBody({ table, session }: { table: DiningTable; session?: GuestSession }) {
  const { t } = useTranslation();
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="font-display text-2xl font-semibold">{table.code}</span>
        {table.isActive ? <TableStatusPill status={table.status} /> : <StatusPill>{t('restaurant.tables.inactive')}</StatusPill>}
      </div>
      <p className="mt-2 text-sm text-muted">{t('restaurant.tables.seats', { count: table.capacity })}</p>
      {session && (
        <p className="tabular mt-1 text-sm font-medium">
          {t('restaurant.tables.guests', { count: session.partySize })} - {timeAgo(session.openedAt)}
        </p>
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
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {tables.map((table) => {
        const session = sessionByTable.get(table.id);
        const tile = cn(
          'flex min-h-28 w-full flex-col rounded-panel border-2 p-4 text-left',
          table.isActive ? TONE[table.status] : 'border-line bg-sunken opacity-60',
        );
        const interactive = table.isActive && table.status !== 'CLEANING';
        return (
          <li key={table.id}>
            {interactive ? (
              <button
                type="button"
                onClick={() => onTableClick(table)}
                className={cn(tile, 'cursor-pointer transition-colors duration-(--duration-micro)')}
              >
                <TileBody table={table} session={session} />
              </button>
            ) : (
              <div className={tile}>
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
