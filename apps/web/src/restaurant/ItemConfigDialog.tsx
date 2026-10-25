import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { cn } from '../lib/cn';
import { type CatalogItem, type ModifierGroup, formatMinorUnits } from './api';
import {
  type CartLine,
  type Selection,
  MAX_NOTE,
  MAX_QTY,
  availableOptions,
  availableVariants,
  buildLine,
  defaultSelection,
  groupBounds,
  toggleOption,
  unitPrice,
  validateSelection,
} from './cart';

function signed(minor: number): string {
  if (minor === 0) return '';
  return `${minor > 0 ? '+' : '-'}${formatMinorUnits(Math.abs(minor))}`;
}

function Choice({
  type,
  name,
  checked,
  disabled,
  label,
  price,
  onChange,
}: {
  type: 'radio' | 'checkbox';
  name: string;
  checked: boolean;
  disabled?: boolean;
  label: string;
  price?: string;
  onChange: () => void;
}) {
  return (
    <label
      className={cn(
        'flex min-h-12 cursor-pointer items-center gap-3 rounded-control border px-3 py-2',
        checked ? 'border-accent bg-sunken font-semibold' : 'border-line bg-surface',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <input type={type} name={name} checked={checked} disabled={disabled} onChange={onChange} className="size-5 shrink-0 accent-accent" />
      <span className="min-w-0 flex-1 text-base">{label}</span>
      {price && <span className="tabular shrink-0 text-sm text-muted">{price}</span>}
    </label>
  );
}

export function ItemConfigDialog({
  item,
  groups,
  onAdd,
  onClose,
}: {
  item: CatalogItem;
  groups: ModifierGroup[];
  onAdd: (line: CartLine) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const uid = useId();
  const [sel, setSel] = useState<Selection>(() => defaultSelection(item, groups));
  const [note, setNote] = useState('');
  const [qty, setQty] = useState(1);
  const [problems, setProblems] = useState<string[]>([]);

  const variants = availableVariants(item);
  const unit = unitPrice(item, groups, sel);

  function describe(g: ModifierGroup): string {
    const { min, max } = groupBounds(g);
    if (min === max) return t('restaurant.builder.config.chooseExactly', { count: min });
    if (min === 0) return t('restaurant.builder.config.optionalUpTo', { count: max });
    return t('restaurant.builder.config.chooseRange', { min, max });
  }

  function submit() {
    const issues = validateSelection(item, groups, sel);
    if (issues.length > 0) {
      setProblems(
        issues.map((i) =>
          i.code === 'variantRequired'
            ? t('restaurant.builder.config.errVariant')
            : i.code === 'groupMin'
              ? t('restaurant.builder.config.errMin', { name: i.groupName, count: i.min })
              : t('restaurant.builder.config.errMax', { name: i.groupName, count: i.max }),
        ),
      );
      return;
    }
    onAdd(buildLine(item, groups, sel, note, qty));
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={item.name}
      footer={
        <>
          <div className="mr-auto flex items-center gap-1" role="group" aria-label={t('restaurant.builder.quantity', { name: item.name })}>
            <button
              type="button"
              aria-label={t('restaurant.builder.remove', { name: item.name })}
              disabled={qty <= 1}
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="grid size-12 place-items-center rounded-control border border-line bg-surface text-xl hover:bg-sunken disabled:opacity-50"
            >
              <span aria-hidden>-</span>
            </button>
            <span className="tabular w-10 text-center text-lg font-semibold" aria-live="polite">
              {qty}
            </span>
            <button
              type="button"
              aria-label={t('restaurant.builder.add', { name: item.name })}
              disabled={qty >= MAX_QTY}
              onClick={() => setQty((q) => Math.min(MAX_QTY, q + 1))}
              className="grid size-12 place-items-center rounded-control border border-line bg-surface text-xl hover:bg-sunken disabled:opacity-50"
            >
              <span aria-hidden>+</span>
            </button>
          </div>
          <Button variant="secondary" size="lg" onClick={onClose}>
            {t('restaurant.common.cancel')}
          </Button>
          <Button size="lg" onClick={submit}>
            {t('restaurant.builder.config.addLine', { price: formatMinorUnits(unit * qty) })}
          </Button>
        </>
      }
    >
      <div className="max-h-[55dvh] space-y-5 overflow-y-auto pr-1">
        {variants.length > 0 && (
          <fieldset className="space-y-2">
            <legend className="mb-1 text-base font-semibold">
              {t('restaurant.builder.config.variant')}{' '}
              <span className="text-sm font-normal text-muted">{t('restaurant.builder.config.required')}</span>
            </legend>
            {variants.map((v) => (
              <Choice
                key={v.id}
                type="radio"
                name={`${uid}-variant`}
                checked={sel.variantId === v.id}
                label={v.name}
                price={formatMinorUnits(item.basePriceMinorUnits + v.priceAdjMinorUnits)}
                onChange={() => {
                  setProblems([]);
                  setSel((s) => ({ ...s, variantId: v.id }));
                }}
              />
            ))}
          </fieldset>
        )}

        {groups.map((g) => {
          const { min } = groupBounds(g);
          const picked = sel.options[g.id] ?? [];
          const single = g.selectionType === 'SINGLE';
          return (
            <fieldset key={g.id} className="space-y-2">
              <legend className="mb-1 text-base font-semibold">
                {g.name}{' '}
                <span className="text-sm font-normal text-muted">
                  {min > 0 ? t('restaurant.builder.config.required') : t('restaurant.builder.config.optional')}
                  {' - '}
                  {describe(g)}
                </span>
              </legend>
              {availableOptions(g).map((o) => (
                <Choice
                  key={o.id}
                  type={single ? 'radio' : 'checkbox'}
                  name={`${uid}-${g.id}`}
                  checked={picked.includes(o.id)}
                  disabled={!single && !picked.includes(o.id) && picked.length >= groupBounds(g).max}
                  label={o.name}
                  price={signed(o.priceAdjMinorUnits)}
                  onChange={() => {
                    setProblems([]);
                    setSel((s) => ({ ...s, options: { ...s.options, [g.id]: toggleOption(g, s.options[g.id] ?? [], o.id) } }));
                  }}
                />
              ))}
            </fieldset>
          );
        })}

        <div>
          <label htmlFor={`${uid}-note`} className="mb-1 block text-base font-semibold">
            {t('restaurant.builder.config.note')}
          </label>
          <textarea
            id={`${uid}-note`}
            value={note}
            maxLength={MAX_NOTE}
            rows={2}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('restaurant.builder.config.notePlaceholder')}
            className="w-full rounded-control border border-line bg-surface px-3 py-2 text-base"
          />
        </div>
      </div>

      <div role="alert" className="mt-3 text-sm text-bad">
        {problems.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
    </Dialog>
  );
}
