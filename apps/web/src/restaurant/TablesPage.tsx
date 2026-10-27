import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWorkLocation } from '../context/LocationContext';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { PageHeader } from '../ui/PageHeader';
import { EmptyState, ErrorState, Skeleton } from '../ui/states';
import { Tabs } from '../ui/Tabs';
import { SectionHeader } from '../ui/SectionHeader';
import { EmptyFloorArt } from '../brand/illustrations';
import { useToast } from '../ui/Toast';
import { FloorGrid } from './FloorGrid';
import { OpenSessionDialog } from './OpenSessionDialog';
import { SessionPanel } from './SessionPanel';
import { describeError } from './errors';
import {
  type CatalogCategory,
  type CatalogItem,
  type DiningArea,
  type DiningTable,
  type GuestSession,
  catalogApi,
  diningApi,
  sessionApi,
} from './api';

const POLL_MS = 30_000;
const OTHER_AREA = '__other';

export function TablesPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [areas, setAreas] = useState<DiningArea[]>([]);
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [sessions, setSessions] = useState<GuestSession[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [openingTable, setOpeningTable] = useState<DiningTable | null>(null);
  const [activeSession, setActiveSession] = useState<{ session: GuestSession; table: DiningTable } | null>(null);
  const [selectedArea, setSelectedArea] = useState('all');
  const [resetting, setResetting] = useState<ReadonlySet<string>>(new Set());
  const resetInFlight = useRef(new Set<string>());
  const loadInFlight = useRef(false);
  const { locationId } = useWorkLocation();

  const load = useCallback(async () => {
    if (loadInFlight.current) return;
    loadInFlight.current = true;
    setRefreshing(true);
    try {
      const [areasData, tablesData, sessionsData, catsData, itemsData] = await Promise.all([
        diningApi.listAreas(locationId ?? undefined),
        diningApi.listTables(),
        sessionApi.list({ status: 'OPEN', locationId: locationId ?? undefined }),
        catalogApi.listCategories(),
        catalogApi.listItems(),
      ]);
      setAreas(areasData);
      // The tables endpoint filters by area only, so scope to the working location here.
      setTables(locationId ? tablesData.filter((tb) => tb.locationId === locationId) : tablesData);
      setSessions(sessionsData);
      setCategories(catsData);
      setCatalogItems(itemsData);
      setError('');
      setLoaded(true);
    } catch (err) {
      setError(describeError(err, t, 'restaurant.errors.loadFloor'));
    } finally {
      loadInFlight.current = false;
      setRefreshing(false);
    }
  }, [t, locationId]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const resetTable = useCallback(
    async (table: DiningTable) => {
      if (resetInFlight.current.has(table.id)) return;
      resetInFlight.current.add(table.id);
      setResetting(new Set(resetInFlight.current));
      try {
        await diningApi.resetTable(table.id);
        toast.show(t('restaurant.tables.tableAvailableToast', { code: table.code }));
        loadInFlight.current = false;
        await load();
      } catch (err) {
        toast.show(describeError(err, t, 'restaurant.errors.resetTable'), 'bad');
      } finally {
        resetInFlight.current.delete(table.id);
        setResetting(new Set(resetInFlight.current));
      }
    },
    [load, t, toast],
  );

  const sessionByTable = useMemo(() => new Map(sessions.map((s) => [s.diningTableId, s])), [sessions]);

  function handleTableClick(table: DiningTable) {
    if (!table.isActive) return;
    if (table.status === 'AVAILABLE') {
      setOpeningTable(table);
    } else if (table.status === 'OCCUPIED') {
      const session = sessionByTable.get(table.id);
      if (session) setActiveSession({ session, table });
    }
  }

  const activeAreas = useMemo(() => areas.filter((a) => a.isActive), [areas]);
  const knownAreaIds = useMemo(() => new Set(activeAreas.map((a) => a.id)), [activeAreas]);
  const orphanTables = useMemo(() => tables.filter((tb) => !knownAreaIds.has(tb.diningAreaId)), [tables, knownAreaIds]);

  const groups = useMemo(() => {
    const g = activeAreas.map((area) => ({ key: area.id, name: area.name, tables: tables.filter((tb) => tb.diningAreaId === area.id) }));
    if (orphanTables.length > 0) g.push({ key: OTHER_AREA, name: t('restaurant.tables.otherArea'), tables: orphanTables });
    return g.filter((x) => x.tables.length > 0);
  }, [activeAreas, tables, orphanTables, t]);

  const visibleGroups = selectedArea === 'all' ? groups : groups.filter((g) => g.key === selectedArea);
  const tabItems = [{ key: 'all', label: t('restaurant.tables.allAreas') }, ...groups.map((g) => ({ key: g.key, label: g.name }))];

  const header = (
    <PageHeader
      title={t('restaurant.tables.title')}
      description={t('restaurant.tables.description')}
      actions={
        <Button variant="secondary" size="lg" loading={refreshing} onClick={() => void load()}>
          {refreshing ? t('restaurant.common.refreshing') : t('restaurant.common.refresh')}
        </Button>
      }
    />
  );

  if (!loaded && !error) {
    return (
      <div>
        {header}
        <div role="status" aria-label={t('restaurant.common.refreshing')} className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div>
        {header}
        <ErrorState title={t('restaurant.tables.loadErrorTitle')} body={error} onRetry={() => void load()} retryLabel={t('restaurant.common.retry')} />
      </div>
    );
  }

  return (
    <div>
      {header}

      <p role="alert" className={error ? 'mb-4 rounded-control bg-warn-soft px-4 py-3 text-sm text-warn' : 'sr-only'}>
        {error && `${t('restaurant.tables.staleError')} ${error}`}
      </p>

      {tables.length === 0 ? (
        <EmptyState illustration={<EmptyFloorArt />} title={t('restaurant.tables.emptyTitle')} body={t('restaurant.tables.emptyBody')} />
      ) : (
        <>
          {groups.length > 1 && (
            <Tabs items={tabItems} active={selectedArea} onChange={setSelectedArea} label={t('restaurant.tables.areaTabs')} />
          )}
          <div role={groups.length > 1 ? 'tabpanel' : undefined} className="space-y-10">
            {visibleGroups.length === 0 && <EmptyState title={t('restaurant.tables.emptyAreaTitle')} />}
            {visibleGroups.map((g) => (
              <section key={g.key} aria-label={t('restaurant.tables.floorLabel', { area: g.name })}>
                <SectionHeader
                  title={g.name}
                  size="sm"
                  className="mb-4"
                  action={
                    <span className="tabular text-sm text-muted">
                      {t('restaurant.tables.areaCount', {
                        occupied: g.tables.filter((tb) => tb.status === 'OCCUPIED').length,
                        total: g.tables.length,
                      })}
                    </span>
                  }
                />
                <FloorGrid
                  tables={g.tables}
                  sessionByTable={sessionByTable}
                  resetting={resetting}
                  onTableClick={handleTableClick}
                  onResetTable={(tb) => void resetTable(tb)}
                />
              </section>
            ))}
          </div>
        </>
      )}

      {openingTable && (
        <OpenSessionDialog
          table={openingTable}
          locationId={openingTable.locationId || tables[0]?.locationId || sessions[0]?.locationId || ''}
          onOpened={(session) => {
            const table = openingTable;
            setSessions((prev) => [session, ...prev]);
            setTables((prev) => prev.map((tb) => (tb.id === table.id ? { ...tb, status: 'OCCUPIED' } : tb)));
            setOpeningTable(null);
            setActiveSession({ session, table: { ...table, status: 'OCCUPIED' } });
            toast.show(t('restaurant.tables.sessionOpenedToast', { code: table.code }));
          }}
          onCancel={() => setOpeningTable(null)}
        />
      )}

      {activeSession && (
        <SessionPanel
          session={activeSession.session}
          table={activeSession.table}
          categories={categories}
          items={catalogItems}
          onClose={() => setActiveSession(null)}
          onRefresh={() => {
            loadInFlight.current = false;
            void load();
          }}
        />
      )}
    </div>
  );
}
