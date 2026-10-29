import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { describeError } from '../restaurant/errors';
import { useSingleFlight } from '../restaurant/hooks';
import type { ModifierGroup, ModifierOption } from '../restaurant/api';
import { formatMoney, parseMoney } from '../lib/money';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Dialog } from '../ui/Dialog';
import { Field } from '../ui/Field';
import * as Icons from '../ui/icons';
import { Select } from '../ui/Select';
import { SectionHeader } from '../ui/SectionHeader';
import { StatusPill } from '../ui/StatusPill';
import { menuApi } from './api';

/** "+₹20", "−₹10" or "free" for an option price delta. */
export function deltaLabel(minor: number, free: string): string {
  if (minor === 0) return free;
  return `${minor > 0 ? '+' : '−'}${formatMoney(Math.abs(minor))}`;
}

/** Limits implied by the simple choices the owner makes (pick one / several, required). */
export function limitsFor(type: 'SINGLE' | 'MULTIPLE', required: boolean, maxText: string): { min: number; max: number | null } | null {
  if (type === 'SINGLE') return { min: required ? 1 : 0, max: 1 };
  const min = required ? 1 : 0;
  if (maxText.trim() === '') return { min, max: null };
  const max = Number(maxText);
  if (!Number.isInteger(max) || max < Math.max(1, min)) return null;
  return { min, max };
}

function GroupDialog({ group, onDone, onClose }: { group?: ModifierGroup; onDone: (msg: string, keepOpen?: boolean) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const formId = useId();
  const [name, setName] = useState(group?.name ?? '');
  const [type, setType] = useState<'SINGLE' | 'MULTIPLE'>(group?.selectionType ?? 'SINGLE');
  const [required, setRequired] = useState(group?.isRequired ?? false);
  const [maxText, setMaxText] = useState(group?.selectionType === 'MULTIPLE' && group.maxSelections ? String(group.maxSelections) : '');
  const [current, setCurrent] = useState<ModifierGroup | undefined>(group);
  const [options, setOptions] = useState<ModifierOption[]>(group?.options ?? []);
  const [oName, setOName] = useState('');
  const [oPrice, setOPrice] = useState('');
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const { busy, run } = useSingleFlight();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError(t('setup.addons.nameRequired'));
    const limits = limitsFor(type, required, maxText);
    if (!limits) return setError(t('setup.addons.maxInvalid'));
    await run(async () => {
      try {
        const body = { name: name.trim(), selectionType: type, isRequired: required, minSelections: limits.min, maxSelections: limits.max };
        if (group) {
          await menuApi.updateGroup(group.id, body);
          onDone(t('setup.addons.saved', { name: name.trim() }));
        } else {
          const created = await menuApi.createGroup(body);
          setCurrent(created);
          setOptions(created.options ?? []);
          setError('');
          onDone(t('setup.addons.created', { name: name.trim() }), true);
        }
      } catch (err) {
        setError(describeError(err, t, 'setup.errors.save'));
      }
    });
  }

  async function addOption() {
    if (!current) return;
    const delta = oPrice.trim() === '' ? 0 : parseMoney(oPrice.trim().replace(/^[+-]/, ''));
    if (!oName.trim() || delta === null) return setError(t('setup.addons.optionInvalid'));
    const signed = oPrice.trim().startsWith('-') ? -delta : delta;
    await run(async () => {
      try {
        const o = await menuApi.createOption(current.id, { name: oName.trim(), priceAdjMinorUnits: signed });
        setOptions((l) => [...l, o]);
        setOName('');
        setOPrice('');
        setError('');
        onDone('', true);
      } catch (err) {
        setError(describeError(err, t, 'setup.errors.save'));
      }
    });
  }
  async function removeOption(o: ModifierOption) {
    if (!current) return;
    await run(async () => {
      try {
        await menuApi.deleteOption(current.id, o.id);
        setOptions((l) => l.filter((x) => x.id !== o.id));
        onDone('', true);
      } catch {
        setError(t('setup.addons.optionRemoveBlocked'));
      }
    });
  }
  async function removeGroup() {
    if (!group) return;
    await run(async () => {
      try {
        await menuApi.deleteGroup(group.id);
        onDone(t('setup.addons.removed', { name: group.name }));
      } catch {
        setConfirm(false);
        setError(t('setup.addons.removeBlocked'));
      }
    });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={group ? t('setup.addons.edit') : t('setup.addons.add')}
      className="w-[min(36rem,calc(100vw-2rem))]"
      footer={
        <>
          {group &&
            (confirm ? (
              <Button variant="danger" onClick={removeGroup} loading={busy} className="mr-auto">{t('setup.menu.confirmRemove')}</Button>
            ) : (
              <Button variant="ghost" onClick={() => setConfirm(true)} className="mr-auto text-bad">
                <Icons.Trash2 className="size-4" aria-hidden />
                {t('setup.remove')}
              </Button>
            ))}
          <Button variant="secondary" onClick={onClose}>{current && !group ? t('setup.addons.done') : t('setup.cancel')}</Button>
          <Button type="submit" form={formId} loading={busy}>{t('setup.save')}</Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-4">
        <Field label={t('setup.addons.name')} placeholder={t('setup.addons.namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} autoFocus data-autofocus />
        <Select label={t('setup.addons.type')} value={type} onChange={(e) => setType(e.target.value as 'SINGLE' | 'MULTIPLE')}>
          <option value="SINGLE">{t('setup.addons.single')}</option>
          <option value="MULTIPLE">{t('setup.addons.multiple')}</option>
        </Select>
        <Checkbox label={t('setup.addons.required')} checked={required} onChange={(e) => setRequired(e.target.checked)} />
        {type === 'MULTIPLE' && (
          <Field label={t('setup.addons.max')} hint={t('setup.addons.maxHint')} type="number" min={1} value={maxText} onChange={(e) => setMaxText(e.target.value)} className="tabular" />
        )}

        {current ? (
          <fieldset className="rounded-control border border-white/10 p-3">
            <legend className="px-1 text-sm font-medium">{t('setup.addons.options')}</legend>
            {options.length > 0 && (
              <ul className="mb-3 divide-y divide-white/[0.06]">
                {options.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span>{o.name}</span>
                    <span className="flex items-center gap-2">
                      <span className="tabular text-muted">{deltaLabel(o.priceAdjMinorUnits, t('setup.addons.free'))}</span>
                      <button type="button" aria-label={t('setup.addons.removeOption', { name: o.name })} onClick={() => removeOption(o)} className="grid size-9 place-items-center rounded-control text-muted hover:bg-white/[0.06] hover:text-bad">
                        <Icons.Trash2 className="size-4" aria-hidden />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-end gap-2">
              <Field label={t('setup.addons.optionName')} placeholder={t('setup.addons.optionPlaceholder')} value={oName} onChange={(e) => setOName(e.target.value)} />
              <Field label={t('setup.addons.optionPrice')} inputMode="decimal" placeholder="+20" value={oPrice} onChange={(e) => setOPrice(e.target.value)} className="tabular" />
              <Button variant="secondary" onClick={addOption} disabled={busy}>{t('setup.menu.addVariant')}</Button>
            </div>
          </fieldset>
        ) : (
          <p className="text-sm text-muted">{t('setup.addons.optionsAfterSave')}</p>
        )}
        <p role="alert" className="text-sm text-bad">{error}</p>
      </form>
    </Dialog>
  );
}

/** Add-on groups (extra cheese, spice level…) that dishes can offer. */
export function AddOnsSection({ groups, onChanged }: { groups: ModifierGroup[]; onChanged: (msg?: string) => void }) {
  const { t } = useTranslation();
  const [dlg, setDlg] = useState<{ group?: ModifierGroup } | null>(null);
  return (
    <section aria-labelledby="addons-h" className="mt-14">
      <SectionHeader
        id="addons-h"
        size="sm"
        as="h2"
        title={t('setup.addons.title')}
        action={
          <Button variant="secondary" onClick={() => setDlg({})}>
            <Icons.Plus className="size-4" aria-hidden />
            {t('setup.addons.add')}
          </Button>
        }
      />
      <p className="mt-3 max-w-prose text-sm text-muted">{t('setup.addons.body')}</p>
      {groups.length === 0 ? (
        <p className="mt-4 text-sm text-muted">{t('setup.addons.none')}</p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {groups.map((g) => (
            <li key={g.id}>
              <button type="button" onClick={() => setDlg({ group: g })} className="nx-glass nx-card-hover block w-full rounded-panel p-4 text-left" aria-label={t('setup.addons.editNamed', { name: g.name })}>
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{g.name}</span>
                  <span className="flex gap-1.5">
                    <StatusPill tone="neutral">{g.selectionType === 'SINGLE' ? t('setup.addons.single') : t('setup.addons.multiple')}</StatusPill>
                    {g.isRequired && <StatusPill tone="accent">{t('setup.addons.requiredTag')}</StatusPill>}
                  </span>
                </span>
                <span className="mt-2 block text-sm text-muted">
                  {g.options.length === 0 ? t('setup.addons.noOptions') : g.options.map((o) => `${o.name} (${deltaLabel(o.priceAdjMinorUnits, t('setup.addons.free'))})`).join(' · ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {dlg && (
        <GroupDialog
          group={dlg.group}
          onClose={() => {
            setDlg(null);
            onChanged();
          }}
          onDone={(msg, keepOpen) => {
            if (!keepOpen) setDlg(null);
            onChanged(msg || undefined);
          }}
        />
      )}
    </section>
  );
}
