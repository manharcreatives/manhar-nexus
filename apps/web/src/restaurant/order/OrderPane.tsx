import { useId, useState, type ReactNode, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/cn';
import { formatMinorUnits } from '../api';
import { MAX_NOTE } from '../cart';
import { LineChip } from './LineChip';
import type { LineChip as LineChipKind } from './lineState';

/** One row of the "Added to order" zone. Both the new-order builder and the edit dialog render through this. */
export interface PaneLine {
  id: string;
  name: string;
  detail: string;
  note: string;
  quantity: number;
  unitMinor: number;
  chip: LineChipKind;
  /** Marked for removal: shown struck through with Undo until the edit is saved. */
  removed?: boolean;
  /** Small extra mark such as "Added" / "Changed" (edit history of a line). */
  tag?: string;
}

const STEP =
  'grid size-12 shrink-0 place-items-center rounded-control border border-line bg-surface text-xl text-ink transition-colors hover:border-accent/50 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40';

function NoteEditor({ line, locked, onSave }: { line: PaneLine; locked: boolean; onSave: (note: string) => void }) {
  const { t } = useTranslation();
  const uid = useId();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');

  function open() {
    setValue(line.note);
    setEditing(true);
  }
  function commit() {
    setEditing(false);
    if (value.trim() !== line.note.trim()) onSave(value);
  }

  if (editing) {
    return (
      <div className="mt-2">
        <label htmlFor={uid} className="sr-only">
          {t('restaurant.orderZones.note.label', { name: line.name })}
        </label>
        <div className="flex items-start gap-2">
          <textarea
            id={uid}
            autoFocus
            rows={2}
            maxLength={MAX_NOTE}
            value={value}
            placeholder={t('restaurant.orderZones.note.placeholder')}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                setEditing(false);
              } else if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                commit();
              }
            }}
            className="min-h-12 w-full rounded-control border border-line bg-surface px-3 py-2 text-base"
          />
          <button
            type="button"
            // mousedown would blur the textarea first and commit twice; commit() is idempotent, so a plain click is fine.
            onClick={commit}
            className="min-h-12 shrink-0 rounded-control border border-accent/40 px-3 text-sm font-semibold text-accent-strong hover:bg-accent/10"
          >
            {t('restaurant.orderZones.note.done')}
          </button>
        </div>
      </div>
    );
  }

  if (line.note) {
    return (
      <p className="mt-1 flex items-start gap-2 text-sm text-ink-2">
        <span className="min-w-0 flex-1 break-words">
          <span className="text-muted">{t('restaurant.builder.notePrefix')}</span> {line.note}
        </span>
        {!locked && !line.removed && (
          <button
            type="button"
            onClick={open}
            aria-label={`${t('restaurant.orderZones.note.edit')}: ${line.name}`}
            className="min-h-11 shrink-0 rounded-control px-2 text-sm font-medium text-accent-strong hover:bg-accent/10"
          >
            {t('restaurant.orderZones.note.edit')}
          </button>
        )}
      </p>
    );
  }

  if (locked || line.removed) return null;
  return (
    <button
      type="button"
      onClick={open}
      aria-label={`${t('restaurant.orderZones.note.add')}: ${line.name}`}
      className="mt-1 -ml-2 min-h-11 rounded-control px-2 text-sm font-medium text-muted hover:bg-white/[0.06] hover:text-ink"
    >
      + {t('restaurant.orderZones.note.add')}
    </button>
  );
}

function PaneRow({
  line,
  locked,
  readOnly,
  onAdjust,
  onRemove,
  onRestore,
  onNote,
}: {
  line: PaneLine;
  locked: boolean;
  readOnly: boolean;
  onAdjust: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
  onRestore?: (id: string) => void;
  onNote: (id: string, note: string) => void;
}) {
  const { t } = useTranslation();
  const total = formatMinorUnits(line.unitMinor * line.quantity);
  if (readOnly) {
    return (
      <li data-line-id={line.id} data-chip={line.chip} className="border-b border-line/70 px-2 py-3 last:border-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base leading-snug font-medium">
              <span className="tabular mr-2 font-semibold">{line.quantity}&times;</span>
              {line.name}
            </p>
            {line.detail && <p className="text-sm text-muted">{line.detail}</p>}
            {line.note && (
              <p className="text-sm text-ink-2">
                <span className="text-muted">{t('restaurant.builder.notePrefix')}</span> {line.note}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <LineChip kind={line.chip} />
            <span className="tabular text-sm text-muted">{total}</span>
          </div>
        </div>
      </li>
    );
  }
  return (
    <li data-line-id={line.id} data-chip={line.chip} className="border-b border-line/70 px-2 py-3 last:border-0">
      <div className={cn('flex items-start justify-between gap-3', line.removed && 'opacity-60')}>
        <div className="min-w-0">
          <p className={cn('text-base leading-snug font-medium', line.removed && 'line-through')}>{line.name}</p>
          {line.detail && <p className="text-sm text-muted">{line.detail}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <LineChip kind={line.chip} />
          {line.tag && <span className="eyebrow text-muted">{line.tag}</span>}
        </div>
      </div>
      <NoteEditor line={line} locked={locked} onSave={(n) => onNote(line.id, n)} />
      {line.removed ? (
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-sm text-muted">{t('restaurant.orderZones.order.removedNote')}</p>
          {onRestore && (
            <button
              type="button"
              onClick={() => onRestore(line.id)}
              aria-label={t('restaurant.orderZones.order.undoRemove', { name: line.name })}
              className="min-h-12 rounded-control border border-line px-4 text-sm font-semibold hover:border-accent/50 hover:bg-white/[0.06]"
            >
              {t('restaurant.orderZones.order.undo')}
            </button>
          )}
        </div>
      ) : (
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="tabular text-base font-semibold">{total}</p>
          <div className="flex items-center gap-1" role="group" aria-label={t('restaurant.builder.quantity', { name: line.name })}>
            <button
              type="button"
              disabled={locked}
              aria-label={t('restaurant.builder.remove', { name: line.name })}
              onClick={() => onAdjust(line.id, -1)}
              className={STEP}
            >
              <span aria-hidden>{'−'}</span>
            </button>
            <span className="tabular w-10 text-center text-lg font-semibold" aria-live="polite">
              {line.quantity}
            </span>
            <button type="button" disabled={locked} aria-label={t('restaurant.builder.add', { name: line.name })} onClick={() => onAdjust(line.id, 1)} className={STEP}>
              <span aria-hidden>+</span>
            </button>
            <button
              type="button"
              disabled={locked}
              aria-label={t('restaurant.builder.removeLine', { name: line.name })}
              onClick={() => onRemove(line.id)}
              className={cn(STEP, 'ml-1 text-bad hover:border-bad/50')}
            >
              <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

/**
 * Zone (a): the running order. Always its own surface (sunken, accent hairline), never mixed into the menu list.
 * Lines scroll inside the pane; the heading and `footer` stay put.
 */
export function OrderPane({
  lines,
  locked,
  readOnly = false,
  headingRef,
  onAdjust,
  onRemove,
  onRestore,
  onNote,
  footer,
  notice,
}: {
  lines: PaneLine[];
  locked: boolean;
  /** No controls at all: a plain receipt-style list (used when an order can no longer be edited). */
  readOnly?: boolean;
  headingRef?: Ref<HTMLHeadingElement>;
  onAdjust: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
  onRestore?: (id: string) => void;
  onNote: (id: string, note: string) => void;
  footer?: ReactNode;
  notice?: ReactNode;
}) {
  const { t } = useTranslation();
  const hid = useId();
  const count = lines.reduce((n, l) => (l.removed ? n : n + l.quantity), 0);
  return (
    <section
      aria-labelledby={hid}
      data-zone="order"
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-panel border border-accent/25 bg-sunken shadow-[0_0_0_1px_rgb(var(--accent-rgb)/0.05),0_18px_40px_-24px_rgb(0_0_0/0.8)]"
    >
      <header className="flex items-center justify-between gap-3 border-b border-accent/20 bg-accent/[0.06] px-4 py-3">
        <h3 id={hid} ref={headingRef} tabIndex={-1} className="font-display text-lg font-semibold focus:outline-none">
          {t('restaurant.orderZones.order.heading')}
        </h3>
        <span className="tabular rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-accent-strong" aria-live="polite">
          {t('restaurant.orderZones.order.count', { count })}
        </span>
      </header>
      {notice}
      <div className="min-h-0 flex-1 overflow-y-auto px-2">
        {lines.length === 0 ? (
          <div className="grid h-full place-items-center px-6 py-10 text-center">
            <div>
              <p className="font-display text-lg font-semibold">{t('restaurant.orderZones.order.emptyTitle')}</p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-muted">{t('restaurant.orderZones.order.emptyBody')}</p>
            </div>
          </div>
        ) : (
          <ul>
            {lines.map((l) => (
              <PaneRow key={l.id} line={l} locked={locked} readOnly={readOnly} onAdjust={onAdjust} onRemove={onRemove} onRestore={onRestore} onNote={onNote} />
            ))}
          </ul>
        )}
      </div>
      {footer}
    </section>
  );
}
