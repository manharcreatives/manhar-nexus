import { useCallback, useId, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyFloorArt } from '../brand/illustrations';
import { useWorkLocation } from '../context/LocationContext';
import { describeError } from '../restaurant/errors';
import { useSingleFlight } from '../restaurant/hooks';
import type { DiningTable } from '../restaurant/api';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Dialog } from '../ui/Dialog';
import { Field } from '../ui/Field';
import * as Icons from '../ui/icons';
import { PageHeader } from '../ui/PageHeader';
import { SectionHeader } from '../ui/SectionHeader';
import { StatusPill } from '../ui/StatusPill';
import { EmptyState, ErrorState, Skeleton } from '../ui/states';
import { useToast } from '../ui/Toast';
import { bulkCodes, floorApi, type SetupArea } from './api';
import { useLoad } from './useLoad';

type Dlg =
  | { kind: 'area'; area?: SetupArea }
  | { kind: 'table'; area: SetupArea; table?: DiningTable }
  | { kind: 'bulk'; area: SetupArea }
  | null;

/** Name an area, or rename it. */
function AreaDialog({ area, onSave, onClose }: { area?: SetupArea; onSave: (name: string, active: boolean) => Promise<void>; onClose: () => void }) {
  const { t } = useTranslation();
  const formId = useId();
  const [name, setName] = useState(area?.name ?? '');
  const [active, setActive] = useState(area?.isActive ?? true);
  const [error, setError] = useState('');
  const { busy, run } = useSingleFlight();
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError(t('setup.floor.nameRequired'));
    await run(async () => {
      try {
        await onSave(name.trim(), active);
      } catch (err) {
        setError(describeError(err, t, 'setup.errors.save'));
      }
    });
  }
  return (
    <Dialog
      open
      onClose={onClose}
      title={area ? t('setup.floor.renameArea') : t('setup.floor.addArea')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('setup.cancel')}</Button>
          <Button type="submit" form={formId} loading={busy}>{t('setup.save')}</Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-4">
        <Field label={t('setup.floor.areaName')} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('setup.floor.areaPlaceholder')} data-autofocus autoFocus />
        {area && <Checkbox label={t('setup.floor.areaActive')} checked={active} onChange={(e) => setActive(e.target.checked)} />}
        <p role="alert" className="text-sm text-bad">{error}</p>
      </form>
    </Dialog>
  );
}

/** Add or edit a single table; editing also offers hide and remove. */
function TableDialog({
  area,
  table,
  onSave,
  onRemove,
  onClose,
}: {
  area: SetupArea;
  table?: DiningTable;
  onSave: (v: { code: string; capacity: number; isActive: boolean }) => Promise<void>;
  onRemove?: () => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const formId = useId();
  const [code, setCode] = useState(table?.code ?? '');
  const [seats, setSeats] = useState(String(table?.capacity ?? 4));
  const [active, setActive] = useState(table?.isActive ?? true);
  const [error, setError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const { busy, run } = useSingleFlight();
  async function submit(e: FormEvent) {
    e.preventDefault();
    const capacity = Number(seats);
    if (!code.trim()) return setError(t('setup.floor.codeRequired'));
    if (!Number.isInteger(capacity) || capacity < 1) return setError(t('setup.floor.seatsInvalid'));
    await run(async () => {
      try {
        await onSave({ code: code.trim(), capacity, isActive: active });
      } catch (err) {
        setError(describeError(err, t, 'setup.errors.save'));
      }
    });
  }
  async function remove() {
    if (!onRemove) return;
    await run(async () => {
      try {
        await onRemove();
      } catch {
        setConfirmRemove(false);
        setError(t('setup.floor.removeBlocked'));
      }
    });
  }
  return (
    <Dialog
      open
      onClose={onClose}
      title={table ? t('setup.floor.editTable', { code: table.code }) : t('setup.floor.addTableTo', { area: area.name })}
      footer={
        <>
          {onRemove &&
            (confirmRemove ? (
              <Button variant="danger" onClick={remove} loading={busy} className="mr-auto">{t('setup.floor.confirmRemove')}</Button>
            ) : (
              <Button variant="ghost" onClick={() => setConfirmRemove(true)} className="mr-auto text-bad">
                <Icons.Trash2 className="size-4" aria-hidden />
                {t('setup.remove')}
              </Button>
            ))}
          <Button variant="secondary" onClick={onClose}>{t('setup.cancel')}</Button>
          <Button type="submit" form={formId} loading={busy}>{t('setup.save')}</Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-4">
        <Field label={t('setup.floor.tableCode')} hint={t('setup.floor.tableCodeHint')} value={code} onChange={(e) => setCode(e.target.value)} maxLength={20} autoFocus data-autofocus />
        <Field label={t('setup.floor.seats')} type="number" min={1} value={seats} onChange={(e) => setSeats(e.target.value)} className="tabular" />
        {table && <Checkbox label={t('setup.floor.tableActive')} checked={active} onChange={(e) => setActive(e.target.checked)} />}
        {table && !active && <p className="text-sm text-muted">{t('setup.floor.hiddenNote')}</p>}
        <p role="alert" className="text-sm text-bad">{error}</p>
      </form>
    </Dialog>
  );
}

/** Add many tables in one go: T1…T10 with the same seat count. */
function BulkDialog({ area, existing, onSave, onClose }: { area: SetupArea; existing: string[]; onSave: (codes: string[], seats: number) => Promise<void>; onClose: () => void }) {
  const { t } = useTranslation();
  const formId = useId();
  const [prefix, setPrefix] = useState('T');
  const [from, setFrom] = useState('1');
  const [count, setCount] = useState('6');
  const [seats, setSeats] = useState('4');
  const [error, setError] = useState('');
  const { busy, run } = useSingleFlight();
  const codes = useMemo(() => {
    const n = Number(count);
    const f = Number(from);
    return Number.isInteger(n) && n >= 1 && n <= 60 && Number.isInteger(f) && f >= 0 ? bulkCodes(prefix, f, n) : [];
  }, [prefix, from, count]);
  const clash = codes.filter((c) => existing.some((e) => e.toLowerCase() === c.toLowerCase()));
  async function submit(e: FormEvent) {
    e.preventDefault();
    const capacity = Number(seats);
    if (codes.length === 0) return setError(t('setup.floor.bulkInvalid'));
    if (!Number.isInteger(capacity) || capacity < 1) return setError(t('setup.floor.seatsInvalid'));
    if (clash.length > 0) return setError(t('setup.floor.bulkClash', { codes: clash.join(', ') }));
    await run(async () => {
      try {
        await onSave(codes, capacity);
      } catch (err) {
        setError(describeError(err, t, 'setup.errors.save'));
      }
    });
  }
  return (
    <Dialog
      open
      onClose={onClose}
      title={t('setup.floor.bulkTitle', { area: area.name })}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('setup.cancel')}</Button>
          <Button type="submit" form={formId} loading={busy} disabled={codes.length === 0}>{t('setup.floor.bulkAdd', { count: codes.length })}</Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Field label={t('setup.floor.bulkPrefix')} value={prefix} onChange={(e) => setPrefix(e.target.value)} maxLength={8} autoFocus data-autofocus />
          <Field label={t('setup.floor.bulkFrom')} type="number" min={0} value={from} onChange={(e) => setFrom(e.target.value)} className="tabular" />
          <Field label={t('setup.floor.bulkCount')} type="number" min={1} max={60} value={count} onChange={(e) => setCount(e.target.value)} className="tabular" />
        </div>
        <Field label={t('setup.floor.seatsEach')} type="number" min={1} value={seats} onChange={(e) => setSeats(e.target.value)} className="tabular" />
        {codes.length > 0 && (
          <p className="text-sm text-muted">
            {t('setup.floor.preview')}: <span className="ticket-no text-ink">{codes.length > 6 ? `${codes.slice(0, 4).join(', ')} … ${codes[codes.length - 1]}` : codes.join(', ')}</span>
          </p>
        )}
        <p role="alert" className="text-sm text-bad">{error}</p>
      </form>
    </Dialog>
  );
}

export function FloorSetupPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const work = useWorkLocation();
  const [dlg, setDlg] = useState<Dlg>(null);

  // One location: use it. Several: the header switcher decides (all-locations has no single floor).
  const locationId = work.locationId ?? (work.locations.length === 1 ? work.locations[0].id : null);

  const loadAreas = useCallback(() => (locationId ? floorApi.areas(locationId) : Promise.resolve<SetupArea[]>([])), [locationId]);
  const areas = useLoad(loadAreas);
  const tables = useLoad(floorApi.tables);
  const reload = () => {
    areas.reload();
    tables.reload();
  };

  const tablesByArea = useMemo(() => {
    const map = new Map<string, DiningTable[]>();
    for (const tb of tables.data ?? []) map.set(tb.diningAreaId, [...(map.get(tb.diningAreaId) ?? []), tb]);
    for (const list of map.values()) list.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
    return map;
  }, [tables.data]);

  const done = (msg: string) => {
    setDlg(null);
    toast.show(msg, 'ok');
    reload();
  };

  const header = (
    <PageHeader
      eyebrow={t('setup.eyebrow')}
      title={t('setup.floor.title')}
      description={t('setup.floor.subtitle')}
      actions={
        locationId ? (
          <Button onClick={() => setDlg({ kind: 'area' })}>
            <Icons.Plus className="size-4" aria-hidden />
            {t('setup.floor.addArea')}
          </Button>
        ) : undefined
      }
    />
  );

  if (!locationId) {
    return (
      <>
        {header}
        <EmptyState
          title={t('setup.floor.pickLocationTitle')}
          body={t('setup.floor.pickLocationBody')}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {work.locations.map((l) => (
                <Button key={l.id} variant="secondary" onClick={() => work.setLocationId(l.id)}>
                  <Icons.MapPin className="size-4" aria-hidden />
                  {l.name}
                </Button>
              ))}
            </div>
          }
        />
      </>
    );
  }
  if ((areas.loading && !areas.data) || (tables.loading && !tables.data)) {
    return (
      <>
        {header}
        <Skeleton className="h-48" />
      </>
    );
  }
  if (areas.error || tables.error) {
    return (
      <>
        {header}
        <ErrorState title={t('setup.errors.load')} onRetry={reload} retryLabel={t('setup.retry')} />
      </>
    );
  }

  const list = areas.data ?? [];
  const total = (tables.data ?? []).filter((x) => list.some((a) => a.id === x.diningAreaId)).length;

  return (
    <>
      {header}
      {list.length === 0 ? (
        <EmptyState
          illustration={<EmptyFloorArt />}
          title={t('setup.floor.emptyTitle')}
          body={t('setup.floor.emptyBody')}
          action={<Button onClick={() => setDlg({ kind: 'area' })}>{t('setup.floor.addFirstArea')}</Button>}
        />
      ) : (
        <div className="space-y-10">
          <p className="text-sm text-muted">{t('setup.floor.summary', { areas: list.length, tables: total })}</p>
          {list.map((area) => {
            const rows = tablesByArea.get(area.id) ?? [];
            return (
              <section key={area.id} aria-labelledby={`area-${area.id}`}>
                <SectionHeader
                  id={`area-${area.id}`}
                  title={
                    <span className="inline-flex items-center gap-3">
                      {area.name}
                      {!area.isActive && <StatusPill tone="neutral">{t('setup.hidden')}</StatusPill>}
                    </span>
                  }
                  eyebrow={t('setup.floor.tableCount', { count: rows.length })}
                  action={
                    <>
                      <Button variant="ghost" onClick={() => setDlg({ kind: 'area', area })}>
                        <Icons.Pencil className="size-4" aria-hidden />
                        {t('setup.floor.rename')}
                      </Button>
                      <Button variant="secondary" onClick={() => setDlg({ kind: 'bulk', area })}>{t('setup.floor.addMany')}</Button>
                      <Button onClick={() => setDlg({ kind: 'table', area })}>
                        <Icons.Plus className="size-4" aria-hidden />
                        {t('setup.floor.addTable')}
                      </Button>
                    </>
                  }
                />
                {rows.length === 0 ? (
                  <p className="mt-4 text-sm text-muted">{t('setup.floor.areaEmpty')}</p>
                ) : (
                  <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
                    {rows.map((tb) => (
                      <li key={tb.id}>
                        <button
                          type="button"
                          onClick={() => setDlg({ kind: 'table', area, table: tb })}
                          aria-label={t('setup.floor.editTable', { code: tb.code })}
                          className="nx-glass nx-card-hover group flex min-h-24 w-full flex-col justify-between rounded-panel p-4 text-left"
                        >
                          <span className="flex items-start justify-between gap-2">
                            <span className="font-display text-2xl leading-none font-semibold">{tb.code}</span>
                            <Icons.Pencil className="size-4 text-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden />
                          </span>
                          <span className="mt-3 flex items-center justify-between gap-2 text-sm text-muted">
                            {t('setup.floor.seatsCount', { count: tb.capacity })}
                            {!tb.isActive && <StatusPill tone="neutral">{t('setup.hidden')}</StatusPill>}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {dlg?.kind === 'area' && (
        <AreaDialog
          area={dlg.area}
          onClose={() => setDlg(null)}
          onSave={async (name, active) => {
            if (dlg.area) {
              await floorApi.updateArea(dlg.area.id, { name, isActive: active });
              done(t('setup.floor.areaSaved'));
            } else {
              await floorApi.createArea({ locationId, name });
              done(t('setup.floor.areaAdded', { name }));
            }
          }}
        />
      )}
      {dlg?.kind === 'table' && (
        <TableDialog
          area={dlg.area}
          table={dlg.table}
          onClose={() => setDlg(null)}
          onSave={async (v) => {
            if (dlg.table) {
              await floorApi.updateTable(dlg.table.id, v);
              done(t('setup.floor.tableSaved', { code: v.code }));
            } else {
              await floorApi.createTable({ diningAreaId: dlg.area.id, locationId, code: v.code, capacity: v.capacity });
              done(t('setup.floor.tableAdded', { code: v.code }));
            }
          }}
          onRemove={
            dlg.table
              ? async () => {
                  await floorApi.deleteTable(dlg.table!.id);
                  done(t('setup.floor.tableRemoved', { code: dlg.table!.code }));
                }
              : undefined
          }
        />
      )}
      {dlg?.kind === 'bulk' && (
        <BulkDialog
          area={dlg.area}
          existing={(tables.data ?? []).map((x) => x.code)}
          onClose={() => setDlg(null)}
          onSave={async (codes, seats) => {
            try {
              for (const code of codes) await floorApi.createTable({ diningAreaId: dlg.area.id, locationId, code, capacity: seats });
            } catch (err) {
              reload(); // some tables may already exist; show them while the dialog reports the failure
              throw err;
            }
            done(t('setup.floor.bulkDone', { count: codes.length }));
          }}
        />
      )}
    </>
  );
}
