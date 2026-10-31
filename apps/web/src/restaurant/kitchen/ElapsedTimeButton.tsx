import { forwardRef, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type RefObject, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/cn';
import { describeError } from '../errors';
import { useNow } from '../hooks';
import { useOutsideDismiss } from '../../ui/useBackdropDismiss';
import { Skeleton } from '../../ui/states';
import { Clock, RotateCw, X } from './icons';
import { actorLabel, formatDuration, liveTotalMs, stepDetail, stepLabel } from './timelineFormat';
import { useOrderTimeline } from './useOrderTimeline';

const WIDTH = 360;
const GAP = 8;
const MARGIN = 12;

interface Pos {
  top: number;
  left: number;
  maxHeight: number;
  sheet: boolean;
}

function place(anchor: DOMRect): Pos {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (vw < 640) return { top: 0, left: 0, maxHeight: Math.round(vh * 0.8), sheet: true };
  const left = Math.min(Math.max(MARGIN, anchor.right - WIDTH), vw - WIDTH - MARGIN);
  const below = vh - anchor.bottom - GAP - MARGIN;
  const above = anchor.top - GAP - MARGIN;
  if (below >= 260 || below >= above) return { top: anchor.bottom + GAP, left, maxHeight: Math.max(180, below), sheet: false };
  const maxHeight = Math.max(180, above);
  return { top: Math.max(MARGIN, anchor.top - GAP - Math.min(maxHeight, 520)), left, maxHeight, sheet: false };
}

/**
 * The small elapsed-time label on a kitchen ticket ("12m ago"). Pressing it opens a non-modal card with the order's
 * timeline: every step, who did it, when, and how long it took since the step before. Esc and a press outside close it;
 * a press that STARTS inside (text selection) and ends outside does not (only pointer-down origin counts, see useOutsideDismiss).
 */
export function ElapsedTimeButton({
  orderId,
  label,
  late,
  refreshKey,
  ticket,
}: {
  orderId: string;
  /** Ready-made text such as "12m ago". */
  label: string;
  late: boolean;
  /** Changes whenever the ticket changes, so an open card re-reads the timeline. */
  refreshKey: string;
  /** Used to name the card for assistive technology. */
  ticket: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) btnRef.current?.focus();
  }, []);
  useOutsideDismiss(open, [btnRef, popRef], () => setOpen(false));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close(true);
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, close]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t('restaurant.kitchenTimeline.open', { ticket, ago: label })}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'tabular nx-press -mr-2 inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-control px-2 text-sm font-medium underline decoration-dotted decoration-1 underline-offset-4 hover:bg-white/[0.06]',
          late ? 'text-bad' : 'text-muted hover:text-ink',
        )}
      >
        <Clock aria-hidden className="size-3.5" />
        {label}
      </button>
      {open &&
        createPortal(
          <TimelineCard
            ref={popRef}
            anchor={btnRef}
            titleId={titleId}
            orderId={orderId}
            refreshKey={refreshKey}
            ticket={ticket}
            onClose={() => close(true)}
          />,
          document.body,
        )}
    </>
  );
}

const TimelineCard = forwardRef(function TimelineCard(
  {
    anchor,
    titleId,
    orderId,
    refreshKey,
    ticket,
    onClose,
  }: {
    anchor: RefObject<HTMLButtonElement | null>;
    titleId: string;
    orderId: string;
    refreshKey: string;
    ticket: string;
    onClose: () => void;
  },
  ref: Ref<HTMLDivElement>,
) {
  const { t } = useTranslation();
  const now = useNow(1000);
  const { state, reload } = useOrderTimeline(orderId, true, refreshKey);
  const [pos, setPos] = useState<Pos | null>(null);
  const local = useRef<HTMLDivElement | null>(null);
  const setRefs = useCallback(
    (el: HTMLDivElement | null) => {
      local.current = el;
      if (typeof ref === 'function') ref(el);
      else if (ref) (ref as { current: HTMLDivElement | null }).current = el;
    },
    [ref],
  );

  useLayoutEffect(() => {
    const update = () => {
      const r = anchor.current?.getBoundingClientRect();
      if (r) setPos(place(r));
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [anchor]);

  // Move focus into the card so keyboard and screen-reader users land on it.
  useEffect(() => {
    local.current?.focus({ preventScroll: true });
  }, []);

  const data = state.data;
  return (
    <div
      ref={setRefs}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      tabIndex={-1}
      data-testid="order-timeline"
      style={
        pos?.sheet
          ? { maxHeight: pos.maxHeight }
          : { top: pos?.top ?? 0, left: pos?.left ?? 0, width: WIDTH, maxHeight: pos?.maxHeight, visibility: pos ? 'visible' : 'hidden' }
      }
      className={cn(
        'nx-pop fixed z-[70] flex flex-col overflow-hidden text-ink focus:outline-none',
        pos?.sheet ? 'inset-x-0 bottom-0 rounded-t-panel' : 'rounded-panel',
      )}
    >
      <div className="flex items-start justify-between gap-3 border-b border-white/[0.07] px-4 py-3">
        <div className="min-w-0">
          <h2 id={titleId} className="text-base font-semibold">
            {t('restaurant.kitchenTimeline.title')}
          </h2>
          <p className="truncate text-sm text-muted">{ticket}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('restaurant.kitchenTimeline.close')}
          className="nx-press -mr-2 -mt-1 grid size-10 shrink-0 place-items-center rounded-control text-muted hover:bg-white/[0.06] hover:text-ink"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3" aria-live="polite" aria-busy={state.status === 'loading'}>
        {state.status === 'loading' && (
          <div role="status" aria-label={t('restaurant.kitchenTimeline.loading')} className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-4/5" />
          </div>
        )}

        {state.status === 'error' && !data && (
          <div role="alert" className="py-4 text-center">
            <p className="text-sm font-semibold text-bad">{t('restaurant.kitchenTimeline.errorTitle')}</p>
            <p className="mx-auto mt-1 max-w-[28ch] text-sm text-ink-2">{describeError(state.error, t, 'restaurant.kitchenTimeline.errorBody')}</p>
            <button
              type="button"
              onClick={reload}
              className="nx-press mt-3 inline-flex min-h-10 items-center gap-2 rounded-control border border-white/10 bg-white/[0.04] px-4 text-sm font-medium hover:border-accent/40"
            >
              <RotateCw aria-hidden className="size-3.5" />
              {t('restaurant.common.retry')}
            </button>
          </div>
        )}

        {data && data.steps.length === 0 && (
          <p className="py-6 text-center text-sm text-muted">{t('restaurant.kitchenTimeline.empty')}</p>
        )}

        {data && data.steps.length > 0 && (
          <>
            {state.status === 'error' && (
              <p role="alert" className="mb-3 rounded-control bg-warn-soft px-3 py-2 text-sm text-warn">
                {t('restaurant.kitchenTimeline.stale')}{' '}
                <button type="button" onClick={reload} className="font-semibold underline underline-offset-2">
                  {t('restaurant.common.retry')}
                </button>
              </p>
            )}
            <ol aria-label={t('restaurant.kitchenTimeline.title')} className="relative space-y-0">
              {data.steps.map((step, i) => {
                const last = i === data.steps.length - 1;
                const detail = stepDetail(step, t);
                return (
                  <li key={step.id} className="relative grid grid-cols-[1rem_1fr] gap-x-3 pb-4 last:pb-0">
                    <span aria-hidden className="relative flex justify-center">
                      <span className={cn('mt-1.5 size-2.5 rounded-full border-2', last ? 'border-accent bg-accent' : 'border-muted bg-transparent')} />
                      {!last && <span className="absolute top-5 bottom-[-1rem] w-px bg-line" />}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <p className="text-sm font-semibold">{stepLabel(step, t)}</p>
                        <time dateTime={step.at} className="tabular text-xs text-muted">
                          {new Date(step.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </time>
                      </div>
                      <p className="text-xs text-muted">
                        {t('restaurant.kitchenTimeline.by', { actor: actorLabel(step.actor, t) })}
                        {i > 0 && (
                          <>
                            {' - '}
                            <span className="tabular font-medium text-ink-2">{t('restaurant.kitchenTimeline.after', { duration: formatDuration(step.sincePreviousMs) })}</span>
                          </>
                        )}
                      </p>
                      {detail && <p className="mt-0.5 text-xs text-ink-2">{detail}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
            <div className="mt-4 flex items-baseline justify-between border-t border-dashed border-line pt-3">
              <span className="eyebrow">{data.finished ? t('restaurant.kitchenTimeline.total') : t('restaurant.kitchenTimeline.totalSoFar')}</span>
              <span className="tabular font-display text-xl font-semibold">{formatDuration(liveTotalMs(data, state.fetchedAtMs, now))}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
});
