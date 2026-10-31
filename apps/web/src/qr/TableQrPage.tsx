import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { brand as appBrand } from '../lib/brand';
import { LiveBadge } from '../realtime/LiveBadge';
import { useLiveRefresh } from '../realtime/RealtimeProvider';
import { describeError } from '../restaurant/errors';
import { diningApi } from '../restaurant/api';
import { PageHeader } from '../ui/PageHeader';
import { ErrorState, Skeleton } from '../ui/states';
import { Tabs } from '../ui/Tabs';
import { qrApi } from './api';
import { MenuSettingsPanel } from './MenuSettingsPanel';
import { PhotoManager } from './PhotoManager';
import type { PrintBrand } from './PrintPages';
import { TableQrTab } from './TableQrTab';
import type { QrSettings, QrTable } from './types';

const TABS = ['tables', 'settings', 'photos'] as const;
type Tab = (typeof TABS)[number];
const FALLBACK_ACCENT = '#22c55e';

/**
 * "Table QR codes": the staff hub for the guest menu. Tabs: per-table codes and printing,
 * menu settings with a live phone preview, and the dish photo manager.
 */
export function TableQrPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const tab: Tab = (TABS as readonly string[]).includes(requested ?? '') ? (requested as Tab) : 'tables';
  const setTab = (next: string) => setParams(next === 'tables' ? {} : { tab: next }, { replace: true });

  const [tables, setTables] = useState<QrTable[] | null>(null);
  const [settings, setSettings] = useState<QrSettings | null>(null);
  const [seated, setSeated] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [list, s, dining] = await Promise.all([
        qrApi.tables(),
        qrApi.settings(),
        diningApi.listTables().catch(() => []),
      ]);
      setTables(list);
      setSettings(s);
      setSeated(new Set(dining.filter((d) => d.status === 'OCCUPIED').map((d) => d.id)));
      setError('');
    } catch (err) {
      setError(describeError(err, t, 'qr.errors.load'));
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);
  // Guest orders and table state change the badges on each card.
  useLiveRefresh(['tables', 'orders'], load);

  const businessName = user?.business?.name ?? appBrand.name;
  const defaultAccent = user?.business?.accentColor ?? appBrand.accent ?? FALLBACK_ACCENT;
  const printBrand = useMemo<PrintBrand>(
    () => ({ name: businessName, tagline: settings?.tagline ?? '', logoUrl: settings?.logoUrl ?? null, accent: settings?.accentColor ?? defaultAccent }),
    [businessName, defaultAccent, settings],
  );

  const onTableChanged = useCallback((next: QrTable) => setTables((list) => (list ?? []).map((x) => (x.tableId === next.tableId ? { ...x, ...next } : x))), []);

  const header = (
    <PageHeader
      title={t('qr.page.title')}
      description={t('qr.page.description')}
      actions={<LiveBadge />}
    />
  );
  const tabItems = TABS.map((k) => ({ key: k, label: t(`qr.page.tabs.${k}`) }));

  let body;
  if (tab === 'photos') {
    body = <PhotoManager />;
  } else if (!tables || !settings) {
    body = error ? (
      <ErrorState title={t('qr.page.loadErrorTitle')} body={error} onRetry={() => void load()} retryLabel={t('qr.common.retry')} />
    ) : (
      <div role="status" aria-label={t('qr.common.loading')} className="grid grid-cols-1 gap-4 min-[30rem]:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-72" />
        ))}
      </div>
    );
  } else if (tab === 'settings') {
    body = (
      <MenuSettingsPanel settings={settings} businessName={businessName} defaultAccent={defaultAccent} onSaved={setSettings} />
    );
  } else {
    body = (
      <TableQrTab
        tables={tables}
        settings={settings}
        brand={printBrand}
        seatedTableIds={seated}
        onTableChanged={onTableChanged}
        onReload={() => void load()}
        onOpenSettings={() => setTab('settings')}
      />
    );
  }

  return (
    <div>
      {header}
      <Tabs items={tabItems} active={tab} onChange={setTab} label={t('qr.page.tabsLabel')} />
      <div role="tabpanel" aria-label={t(`qr.page.tabs.${tab}`)}>
        {error && tables && <p role="alert" className="mb-4 rounded-control bg-warn-soft px-4 py-3 text-sm text-warn">{t('qr.page.stale')} {error}</p>}
        {body}
      </div>
    </div>
  );
}

export default TableQrPage;
