import { useId, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { describeError } from '../restaurant/errors';
import { useSingleFlight } from '../restaurant/hooks';
import type { CatalogCategory, CatalogVariant } from '../restaurant/api';
import { cn } from '../lib/cn';
import { formatMoney, parseMoney } from '../lib/money';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Dialog } from '../ui/Dialog';
import { Field } from '../ui/Field';
import * as Icons from '../ui/icons';
import { PageHeader } from '../ui/PageHeader';
import { Select } from '../ui/Select';
import { SectionHeader } from '../ui/SectionHeader';
import { StatusPill } from '../ui/StatusPill';
import { EmptyState, ErrorState, Skeleton } from '../ui/states';
import { Table, Td, Th } from '../ui/Table';
import { useToast } from '../ui/Toast';
import { menuApi, type SetupItem, type TaxCategory } from './api';
import { useLoad } from './useLoad';

const pct = (rate: string | number) => `${Math.round(Number(rate) * 10000) / 100}%`;
/** "GST 5%" already says its rate; "Exempt" does not. */
const taxLabel = (x: { name: string; rate: string | number }) => (x.name.includes('%') ? x.name : `${x.name} (${pct(x.rate)})`);

type Dlg =
  | { kind: 'category'; category?: CatalogCategory }
  | { kind: 'item'; item?: SetupItem }
  | { kind: 'tax' }
  | null;

function CategoryDialog({ category, onSave, onRemove, onClose }: { category?: CatalogCategory; onSave: (name: string, active: boolean) => Promise<void>; onRemove?: () => Promise<void>; onClose: () => void }) {
  const { t } = useTranslation();
  const formId = useId();
  const [name, setName] = useState(category?.name ?? '');
  const [active, setActive] = useState(category?.isActive ?? true);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const { busy, run } = useSingleFlight();
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError(t('setup.menu.categoryNameRequired'));
    await run(async () => {
      try {
        await onSave(name.trim(), active);
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
        setConfirm(false);
        setError(t('setup.menu.categoryRemoveBlocked'));
      }
    });
  }
  return (
    <Dialog
      open
      onClose={onClose}
      title={category ? t('setup.menu.editCategory') : t('setup.menu.addCategory')}
      footer={
        <>
          {onRemove &&
            (confirm ? (
              <Button variant="danger" onClick={remove} loading={busy} className="mr-auto">{t('setup.menu.confirmRemove')}</Button>
            ) : (
              <Button variant="ghost" onClick={() => setConfirm(true)} className="mr-auto text-bad">
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
        <Field label={t('setup.menu.categoryName')} placeholder={t('setup.menu.categoryPlaceholder')} value={name} onChange={(e) => setName(e.target.value)} autoFocus data-autofocus />
        {category && <Checkbox label={t('setup.menu.categoryActive')} checked={active} onChange={(e) => setActive(e.target.checked)} />}
        <p role="alert" className="text-sm text-bad">{error}</p>
      </form>
    </Dialog>
  );
}

function TaxDialog({ onSave, onClose }: { onSave: (name: string, rate: number) => Promise<void>; onClose: () => void }) {
  const { t } = useTranslation();
  const formId = useId();
  const [name, setName] = useState('');
  const [rate, setRate] = useState('5');
  const [error, setError] = useState('');
  const { busy, run } = useSingleFlight();
  async function submit(e: FormEvent) {
    e.preventDefault();
    const r = Number(rate);
    if (!name.trim()) return setError(t('setup.menu.taxNameRequired'));
    if (!Number.isFinite(r) || r < 0 || r > 100) return setError(t('setup.menu.taxRateInvalid'));
    await run(async () => {
      try {
        await onSave(name.trim(), Math.round(r * 100) / 10000);
      } catch (err) {
        setError(describeError(err, t, 'setup.errors.save'));
      }
    });
  }
  return (
    <Dialog
      open
      onClose={onClose}
      title={t('setup.menu.addTax')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('setup.cancel')}</Button>
          <Button type="submit" form={formId} loading={busy}>{t('setup.save')}</Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-4">
        <Field label={t('setup.menu.taxName')} placeholder="GST 5%" value={name} onChange={(e) => setName(e.target.value)} autoFocus data-autofocus />
        <Field label={t('setup.menu.taxRate')} type="number" min={0} max={100} step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} className="tabular" />
        <p role="alert" className="text-sm text-bad">{error}</p>
      </form>
    </Dialog>
  );
}

function ItemDialog({
  item,
  categories,
  taxes,
  defaultCategoryId,
  onDone,
  onClose,
}: {
  item?: SetupItem;
  categories: CatalogCategory[];
  taxes: TaxCategory[];
  defaultCategoryId: string;
  onDone: (msg: string, keepOpen?: boolean) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const formId = useId();
  const [name, setName] = useState(item?.name ?? '');
  const [price, setPrice] = useState(item ? String(item.basePriceMinorUnits / 100) : '');
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? defaultCategoryId);
  const defaultTax = taxes.find((x) => x.isDefault && x.isActive)?.id ?? '';
  const [taxId, setTaxId] = useState(item ? (item.taxCategoryId ?? '') : defaultTax);
  const [available, setAvailable] = useState(item?.isAvailable ?? true);
  const [variants, setVariants] = useState<CatalogVariant[]>(item?.variants ?? []);
  const [vName, setVName] = useState('');
  const [vPrice, setVPrice] = useState('');
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const { busy, run } = useSingleFlight();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const minor = parseMoney(price);
    if (!name.trim()) return setError(t('setup.menu.itemNameRequired'));
    if (minor === null) return setError(t('setup.menu.priceInvalid'));
    await run(async () => {
      try {
        if (item) {
          await menuApi.updateItem(item.id, { name: name.trim(), basePriceMinorUnits: minor, categoryId, taxCategoryId: taxId || null, isAvailable: available });
          onDone(t('setup.menu.itemSaved', { name: name.trim() }));
        } else {
          await menuApi.createItem({ categoryId, name: name.trim(), basePriceMinorUnits: minor, ...(taxId ? { taxCategoryId: taxId } : {}) });
          onDone(t('setup.menu.itemAdded', { name: name.trim() }));
        }
      } catch (err) {
        setError(describeError(err, t, 'setup.errors.save'));
      }
    });
  }

  async function addVariant() {
    if (!item) return;
    const delta = vPrice.trim() === '' ? 0 : parseMoney(vPrice.replace(/^[+]/, '').replace(/^-/, ''));
    if (!vName.trim() || delta === null) return setError(t('setup.menu.variantInvalid'));
    const signed = vPrice.trim().startsWith('-') ? -delta : delta;
    await run(async () => {
      try {
        const v = await menuApi.createVariant(item.id, { name: vName.trim(), priceAdjMinorUnits: signed });
        setVariants((list) => [...list, v]);
        setVName('');
        setVPrice('');
        setError('');
        onDone('', true);
      } catch (err) {
        setError(describeError(err, t, 'setup.errors.save'));
      }
    });
  }
  async function removeVariant(v: CatalogVariant) {
    if (!item) return;
    await run(async () => {
      try {
        await menuApi.deleteVariant(item.id, v.id);
        setVariants((list) => list.filter((x) => x.id !== v.id));
        onDone('', true);
      } catch (err) {
        setError(describeError(err, t, 'setup.errors.save'));
      }
    });
  }
  async function removeItem() {
    if (!item) return;
    await run(async () => {
      try {
        await menuApi.deleteItem(item.id);
        onDone(t('setup.menu.itemRemoved', { name: item.name }));
      } catch {
        setConfirm(false);
        setError(t('setup.menu.itemRemoveBlocked'));
      }
    });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={item ? t('setup.menu.editItem') : t('setup.menu.addItem')}
      className="w-[min(36rem,calc(100vw-2rem))]"
      footer={
        <>
          {item &&
            (confirm ? (
              <Button variant="danger" onClick={removeItem} loading={busy} className="mr-auto">{t('setup.menu.confirmRemove')}</Button>
            ) : (
              <Button variant="ghost" onClick={() => setConfirm(true)} className="mr-auto text-bad">
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
        <Field label={t('setup.menu.itemName')} value={name} onChange={(e) => setName(e.target.value)} autoFocus data-autofocus />
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('setup.menu.price')} inputMode="decimal" placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)} className="tabular" />
          <Select label={t('setup.menu.category')} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </div>
        <Select label={t('setup.menu.tax')} value={taxId} onChange={(e) => setTaxId(e.target.value)}>
          <option value="">{t('setup.menu.noTax')}</option>
          {taxes.filter((x) => x.isActive).map((x) => (
            <option key={x.id} value={x.id}>{taxLabel(x)}</option>
          ))}
        </Select>
        {item && <Checkbox label={t('setup.menu.available')} checked={available} onChange={(e) => setAvailable(e.target.checked)} />}

        {item ? (
          <fieldset className="rounded-control border border-white/10 p-3">
            <legend className="px-1 text-sm font-medium">{t('setup.menu.variants')}</legend>
            <p className="mb-2 text-sm text-muted">{t('setup.menu.variantsHint')}</p>
            {variants.length > 0 && (
              <ul className="mb-3 divide-y divide-white/[0.06]">
                {variants.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span>{v.name}</span>
                    <span className="flex items-center gap-2">
                      <span className="tabular text-muted">{v.priceAdjMinorUnits === 0 ? t('setup.menu.samePrice') : `${v.priceAdjMinorUnits > 0 ? '+' : '−'}${formatMoney(Math.abs(v.priceAdjMinorUnits))}`}</span>
                      <button type="button" aria-label={t('setup.menu.removeVariant', { name: v.name })} onClick={() => removeVariant(v)} className="grid size-9 place-items-center rounded-control text-muted hover:bg-white/[0.06] hover:text-bad">
                        <Icons.Trash2 className="size-4" aria-hidden />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-end gap-2">
              <Field label={t('setup.menu.variantName')} placeholder={t('setup.menu.variantPlaceholder')} value={vName} onChange={(e) => setVName(e.target.value)} />
              <Field label={t('setup.menu.variantDelta')} inputMode="decimal" placeholder="+20" value={vPrice} onChange={(e) => setVPrice(e.target.value)} className="tabular" />
              <Button variant="secondary" onClick={addVariant} disabled={busy}>{t('setup.menu.addVariant')}</Button>
            </div>
          </fieldset>
        ) : (
          <p className="text-sm text-muted">{t('setup.menu.variantsAfterSave')}</p>
        )}
        <p role="alert" className="text-sm text-bad">{error}</p>
      </form>
    </Dialog>
  );
}

export function MenuSetupPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const cats = useLoad(menuApi.categories);
  const items = useLoad(menuApi.items);
  const taxes = useLoad(menuApi.taxCategories);
  const [selected, setSelected] = useState<string | null>(null);
  const [dlg, setDlg] = useState<Dlg>(null);
  const reload = () => {
    cats.reload();
    items.reload();
    taxes.reload();
  };

  const categories = useMemo(() => [...(cats.data ?? [])].sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name)), [cats.data]);
  const current = categories.find((c) => c.id === selected) ?? categories[0] ?? null;
  const itemsOf = (id: string) => (items.data ?? []).filter((i) => i.categoryId === id);
  const taxName = (id: string | null) => {
    const x = (taxes.data ?? []).find((y) => y.id === id);
    return x ? taxLabel(x) : t('setup.menu.noTax');
  };
  const done = (msg: string, keepOpen?: boolean) => {
    if (!keepOpen) setDlg(null);
    if (msg) toast.show(msg, 'ok');
    reload();
  };

  const header = (
    <PageHeader
      eyebrow={t('setup.eyebrow')}
      title={t('setup.menu.title')}
      description={t('setup.menu.subtitle')}
      actions={
        <Button onClick={() => setDlg({ kind: 'category' })}>
          <Icons.Plus className="size-4" aria-hidden />
          {t('setup.menu.addCategory')}
        </Button>
      }
    />
  );

  if ((cats.loading && !cats.data) || (items.loading && !items.data)) {
    return (
      <>
        {header}
        <Skeleton className="h-64" />
      </>
    );
  }
  if (cats.error || items.error) {
    return (
      <>
        {header}
        <ErrorState title={t('setup.errors.load')} onRetry={reload} retryLabel={t('setup.retry')} />
      </>
    );
  }

  const taxList = taxes.data ?? [];

  return (
    <>
      {header}
      {categories.length === 0 ? (
        <EmptyState
          title={t('setup.menu.emptyTitle')}
          body={t('setup.menu.emptyBody')}
          action={<Button onClick={() => setDlg({ kind: 'category' })}>{t('setup.menu.addFirstCategory')}</Button>}
        />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
          <nav aria-label={t('setup.menu.categories')}>
            <p className="eyebrow mb-2">{t('setup.menu.categories')}</p>
            <ul className="space-y-1">
              {categories.map((c) => {
                const on = c.id === current?.id;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      aria-current={on || undefined}
                      onClick={() => setSelected(c.id)}
                      className={cn(
                        'flex min-h-11 w-full items-center justify-between gap-2 rounded-control px-3 text-left text-sm font-medium transition-colors',
                        on ? 'bg-gradient-to-r from-accent/18 to-accent/[0.03] text-ink shadow-[inset_0_0_0_1px_rgb(var(--accent-rgb)/0.22)]' : 'text-ink/75 hover:bg-white/[0.05] hover:text-ink',
                      )}
                    >
                      <span className="truncate">{c.name}</span>
                      <span className="tabular text-xs text-muted">{itemsOf(c.id).length}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {current && (
            <section aria-labelledby="menu-cat-h" className="min-w-0">
              <SectionHeader
                id="menu-cat-h"
                title={
                  <span className="inline-flex items-center gap-3">
                    {current.name}
                    {!current.isActive && <StatusPill tone="neutral">{t('setup.hidden')}</StatusPill>}
                  </span>
                }
                action={
                  <>
                    <Button variant="ghost" onClick={() => setDlg({ kind: 'category', category: current })}>
                      <Icons.Pencil className="size-4" aria-hidden />
                      {t('setup.menu.editCategory')}
                    </Button>
                    <Button onClick={() => setDlg({ kind: 'item' })}>
                      <Icons.Plus className="size-4" aria-hidden />
                      {t('setup.menu.addItem')}
                    </Button>
                  </>
                }
              />
              {itemsOf(current.id).length === 0 ? (
                <div className="mt-5">
                  <EmptyState title={t('setup.menu.noItemsTitle')} body={t('setup.menu.noItemsBody')} action={<Button onClick={() => setDlg({ kind: 'item' })}>{t('setup.menu.addItem')}</Button>} />
                </div>
              ) : (
                <div className="mt-5">
                  <Table>
                    <thead>
                      <tr>
                        <Th>{t('setup.menu.item')}</Th>
                        <Th numeric>{t('setup.menu.price')}</Th>
                        <Th>{t('setup.menu.tax')}</Th>
                        <Th>{t('setup.menu.status')}</Th>
                        <Th>
                          <span className="sr-only">{t('setup.menu.actions')}</span>
                        </Th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemsOf(current.id).map((it) => (
                        <tr key={it.id}>
                          <Td>
                            <span className="font-medium">{it.name}</span>
                            {(it.variants?.length ?? 0) > 0 && <span className="ml-2 text-xs text-muted">{t('setup.menu.variantCount', { count: it.variants!.length })}</span>}
                          </Td>
                          <Td numeric>{formatMoney(it.basePriceMinorUnits)}</Td>
                          <Td>{taxName(it.taxCategoryId)}</Td>
                          <Td>
                            {it.isAvailable === false ? <StatusPill tone="warn">{t('setup.menu.soldOut')}</StatusPill> : <StatusPill tone="ok">{t('setup.menu.onMenu')}</StatusPill>}
                          </Td>
                          <Td className="text-right">
                            <Button variant="secondary" onClick={() => setDlg({ kind: 'item', item: it })}>{t('setup.edit')}</Button>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </section>
          )}
        </div>
      )}

      <section aria-labelledby="tax-h" className="mt-14">
        <SectionHeader
          id="tax-h"
          size="sm"
          as="h2"
          title={t('setup.menu.taxTitle')}
          action={
            <Button variant="secondary" onClick={() => setDlg({ kind: 'tax' })}>
              <Icons.Plus className="size-4" aria-hidden />
              {t('setup.menu.addTax')}
            </Button>
          }
        />
        <p className="mt-3 max-w-prose text-sm text-muted">{t('setup.menu.taxBody')}</p>
        {taxList.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {taxList.map((x) => (
              <li key={x.id}>
                <StatusPill tone={x.isActive ? 'accent' : 'neutral'}>
                  {taxLabel(x)}
                </StatusPill>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted">{t('setup.menu.noTaxYet')}</p>
        )}
      </section>

      {dlg?.kind === 'category' && (
        <CategoryDialog
          category={dlg.category}
          onClose={() => setDlg(null)}
          onSave={async (name, active) => {
            if (dlg.category) {
              await menuApi.updateCategory(dlg.category.id, { name, isActive: active });
              done(t('setup.menu.categorySaved'));
            } else {
              const c = await menuApi.createCategory({ name, sortOrder: categories.length });
              setSelected(c.id);
              done(t('setup.menu.categoryAdded', { name }));
            }
          }}
          onRemove={
            dlg.category
              ? async () => {
                  await menuApi.deleteCategory(dlg.category!.id);
                  setSelected(null);
                  done(t('setup.menu.categoryRemoved', { name: dlg.category!.name }));
                }
              : undefined
          }
        />
      )}
      {dlg?.kind === 'item' && current && (
        <ItemDialog item={dlg.item} categories={categories.filter((c) => c.isActive || c.id === dlg.item?.categoryId)} taxes={taxList} defaultCategoryId={current.id} onDone={done} onClose={() => setDlg(null)} />
      )}
      {dlg?.kind === 'tax' && (
        <TaxDialog
          onClose={() => setDlg(null)}
          onSave={async (name, rate) => {
            await menuApi.createTaxCategory({ name, rate, isDefault: taxList.length === 0 });
            done(t('setup.menu.taxAdded', { name }));
          }}
        />
      )}
    </>
  );
}
