import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { describeError } from '../restaurant/errors';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { SectionHeader } from '../ui/SectionHeader';
import { EmptyState } from '../ui/states';
import { useToast } from '../ui/Toast';
import { qrApi } from './api';
import { copyText } from './clipboard';
import * as Icons from './icons';
import { PrintDialog, PrintPortal } from './PrintDialog';
import type { PrintBrand } from './PrintPages';
import { type PrintLayout } from './printLayout';
import { downloadBlob, fileSlug, isLocalOrigin, menuUrl, qrPngBlob, qrSvgString } from './qrCode';
import { RotateTokenDialog } from './RotateTokenDialog';
import { TableQrCard } from './TableQrCard';
import type { QrSettings, QrTable } from './types';

const NO_AREA = '__none';

export function TableQrTab({
  tables,
  settings,
  brand,
  seatedTableIds,
  onTableChanged,
  onReload,
  onOpenSettings,
}: {
  tables: QrTable[];
  settings: QrSettings | null;
  brand: PrintBrand;
  /** Tables with an open guest session (rotating those cuts off live guests). */
  seatedTableIds?: ReadonlySet<string>;
  onTableChanged: (t: QrTable) => void;
  onReload: () => void;
  onOpenSettings: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [rotating, setRotating] = useState<QrTable | null>(null);
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(new Set());
  const inFlight = useRef(new Set<string>());
  const [printDialog, setPrintDialog] = useState<{ tables: QrTable[]; layout: PrintLayout } | null>(null);
  const [printJob, setPrintJob] = useState<{ tables: QrTable[]; layout: PrintLayout } | null>(null);

  const setBusy = useCallback((id: string, on: boolean) => {
    if (on) inFlight.current.add(id);
    else inFlight.current.delete(id);
    setBusyIds(new Set(inFlight.current));
  }, []);

  /** Swaps one table in; if the API answered with something unusable, refetch instead. */
  const applyResult = useCallback(
    (res: QrTable) => {
      if (res.tableId && res.token) onTableChanged(res);
      else onReload();
    },
    [onTableChanged, onReload],
  );

  const copy = useCallback(
    async (table: QrTable) => {
      const ok = await copyText(menuUrl(table.token));
      toast.show(ok ? t('qr.card.copied', { code: table.code }) : t('qr.errors.copy'), ok ? 'ok' : 'bad');
    },
    [t, toast],
  );

  const download = useCallback(
    async (table: QrTable, format: 'png' | 'svg') => {
      const url = menuUrl(table.token);
      const base = `qr-${fileSlug(table.code)}`;
      try {
        if (format === 'svg') {
          downloadBlob(new Blob([qrSvgString(url, t('qr.card.qrLabel', { code: table.code }))], { type: 'image/svg+xml' }), `${base}.svg`);
        } else {
          downloadBlob(await qrPngBlob(url, t('qr.print.tableName', { code: table.code })), `${base}.png`);
        }
      } catch {
        toast.show(t('qr.errors.download'), 'bad');
      }
    },
    [t, toast],
  );

  const toggle = useCallback(
    async (table: QrTable) => {
      if (inFlight.current.has(table.tableId)) return;
      setBusy(table.tableId, true);
      try {
        applyResult(await qrApi.setTableEnabled(table.tableId, !table.enabled));
        toast.show(table.enabled ? t('qr.card.disabledToast', { code: table.code }) : t('qr.card.enabledToast', { code: table.code }));
      } catch (err) {
        toast.show(describeError(err, t, 'qr.errors.toggle'), 'bad');
      } finally {
        setBusy(table.tableId, false);
      }
    },
    [applyResult, setBusy, t, toast],
  );

  const confirmRotate = useCallback(async () => {
    const table = rotating;
    if (!table || inFlight.current.has(table.tableId)) return;
    setBusy(table.tableId, true);
    try {
      applyResult(await qrApi.rotate(table.tableId));
      toast.show(t('qr.rotate.done', { code: table.code }));
      setRotating(null);
    } catch (err) {
      toast.show(describeError(err, t, 'qr.errors.rotate'), 'bad');
    } finally {
      setBusy(table.tableId, false);
    }
  }, [applyResult, rotating, setBusy, t, toast]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? tables.filter((tb) => tb.code.toLowerCase().includes(q) || (tb.areaName ?? '').toLowerCase().includes(q)) : tables;
  }, [tables, query]);

  const groups = useMemo(() => {
    const byArea = new Map<string, QrTable[]>();
    for (const tb of filtered) {
      const key = tb.areaName ?? NO_AREA;
      byArea.set(key, [...(byArea.get(key) ?? []), tb]);
    }
    return [...byArea.entries()].map(([key, list]) => ({ key, name: key === NO_AREA ? t('qr.tables.noArea') : key, tables: list }));
  }, [filtered, t]);

  const enabledCount = tables.filter((tb) => tb.enabled).length;

  if (tables.length === 0) {
    return <EmptyState title={t('qr.tables.emptyTitle')} body={t('qr.tables.emptyBody')} />;
  }

  return (
    <div className="space-y-8">
      {settings && !settings.enabled && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-panel border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-warn">
          <span className="flex items-center gap-2">
            <Icons.TriangleAlert className="size-4 shrink-0" aria-hidden />
            {t('qr.tables.masterOff')}
          </span>
          <Button variant="secondary" onClick={onOpenSettings}>
            {t('qr.tables.openSettings')}
          </Button>
        </div>
      )}
      {isLocalOrigin() && (
        <p role="note" className="flex items-start gap-2 rounded-panel border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-muted">
          <Icons.Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t('qr.tables.localNote')}
        </p>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="w-full max-w-xs">
          <Field label={t('qr.tables.search')} type="search" value={query} placeholder={t('qr.tables.searchPlaceholder')} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="tabular text-sm text-muted">{t('qr.tables.enabledCount', { enabled: enabledCount, total: tables.length })}</p>
          <Button size="lg" onClick={() => setPrintDialog({ tables, layout: 'sheet6' })} disabled={enabledCount === 0}>
            <Icons.Printer className="size-4" aria-hidden />
            {t('qr.tables.printAll')}
          </Button>
        </div>
      </div>

      {groups.length === 0 && <EmptyState title={t('qr.tables.noMatch')} />}
      {groups.map((g) => (
        <section key={g.key} aria-label={t('qr.tables.areaLabel', { area: g.name })}>
          <SectionHeader title={g.name} size="sm" className="mb-4" action={<span className="tabular text-sm text-muted">{g.tables.length}</span>} />
          <ul className="grid grid-cols-1 gap-4 min-[30rem]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {g.tables.map((table) => (
              <li key={table.tableId} className="min-w-0">
                <TableQrCard
                  table={table}
                  busy={busyIds.has(table.tableId)}
                  onCopy={(tb) => void copy(tb)}
                  onDownload={(tb, f) => void download(tb, f)}
                  onPrintTent={(tb) => setPrintDialog({ tables: [tb], layout: 'tent' })}
                  onRotate={setRotating}
                  onToggle={(tb) => void toggle(tb)}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {rotating && (
        <RotateTokenDialog
          table={rotating}
          busy={busyIds.has(rotating.tableId)}
          seated={seatedTableIds?.has(rotating.tableId)}
          onConfirm={() => void confirmRotate()}
          onClose={() => setRotating(null)}
        />
      )}
      {printDialog && (
        <PrintDialog
          tables={printDialog.tables}
          brand={brand}
          initialLayout={printDialog.layout}
          onClose={() => setPrintDialog(null)}
          onPrint={(sel) => {
            setPrintDialog(null);
            setPrintJob(sel);
          }}
        />
      )}
      {printJob && <PrintPortal tables={printJob.tables} layout={printJob.layout} brand={brand} onDone={() => setPrintJob(null)} />}
    </div>
  );
}
