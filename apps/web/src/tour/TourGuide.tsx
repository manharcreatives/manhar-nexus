import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../ui/Button';
import {
  ASK,
  LANG_LABEL,
  PICK_LANGUAGE,
  STRINGS,
  TOUR_LANGS,
  stepsFor,
  type TourLang,
} from './content';
import { TourBotFace, type BotMood } from './TourBotFace';
import { readLang, readOutcome, writeLang, writeOutcome } from './storage';
import './tour.css';

type Phase = 'closed' | 'ask' | 'lang' | 'steps';

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
const isDesktop = (): boolean => typeof window === 'undefined' || window.matchMedia?.('(min-width: 1024px)').matches !== false;

const clamp = (n: number, lo: number, hi: number): number => Math.min(Math.max(n, lo), Math.max(lo, hi));
const MARGIN = 12;
/** Gap between the highlighted menu item and the bot's card. */
const GAP = 24;

/** Reveals `text` letter by letter (instantly for reduced motion). `typing` is true while it runs. */
function useTypewriter(text: string): { shown: string; typing: boolean } {
  const [count, setCount] = useState(0);
  const instant = prefersReducedMotion();
  useEffect(() => {
    if (instant) return;
    setCount(0);
    const chars = Array.from(text).length;
    const id = window.setInterval(() => {
      setCount((c) => {
        if (c >= chars) {
          window.clearInterval(id);
          return c;
        }
        return c + 1;
      });
    }, 16);
    return () => window.clearInterval(id);
  }, [text, instant]);
  if (instant) return { shown: text, typing: false };
  const chars = Array.from(text);
  return { shown: chars.slice(0, count).join(''), typing: count < chars.length };
}

interface Layout {
  x: number;
  y: number;
  /** Where the card's pointer sits, measured down from the card's top edge. Null: no pointer. */
  tailY: number | null;
  /** The highlighted element's box, viewport coordinates. Null when nothing is being pointed at. */
  spot: { x: number; y: number; w: number; h: number } | null;
}

export interface TourGuideProps {
  userId: string;
  displayName?: string;
  /** Paths of the sidebar pages this user can see, in sidebar order. */
  visiblePaths: readonly string[];
  /** The mobile drawer must be open for the sidebar highlight to be visible. */
  onNavOpen: (open: boolean) => void;
  /** Bumped by the "Take the tour" button to start again, skipping the first question. */
  replayToken?: number;
  /** False while something else (a forced password change, a modal) owns the screen. */
  enabled?: boolean;
}

/**
 * First-run tour led by Manhar Bot. Asks whether a tour is wanted, then for the language
 * (English / Hindi / Gujarati), then flies from menu item to menu item: the page dims around the item being
 * explained and the bot lands beside it with a solid card. "Skip" and "Done" are remembered per user;
 * "Ask me later" is not, so the question returns next time.
 */
export function TourGuide({ userId, displayName, visiblePaths, onNavOpen, replayToken = 0, enabled = true }: TourGuideProps) {
  const [phase, setPhase] = useState<Phase>('closed');
  const [lang, setLang] = useState<TourLang>(() => readLang() ?? 'en');
  /** 0 = welcome, 1..n = pages, n+1 = finish. */
  const [index, setIndex] = useState(0);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [flying, setFlying] = useState(false);
  const lastReplay = useRef(replayToken);
  const cardRef = useRef<HTMLDivElement>(null);

  const pageSteps = useMemo(() => stepsFor(visiblePaths), [visiblePaths]);
  const total = pageSteps.length;
  const finishIndex = total + 1;

  // First visit: ask after the dashboard has had a moment to paint.
  useEffect(() => {
    if (!enabled || readOutcome(userId) !== null) return;
    const id = window.setTimeout(() => setPhase((p) => (p === 'closed' ? 'ask' : p)), 700);
    return () => window.clearTimeout(id);
  }, [enabled, userId]);

  // Replay from the sidebar: straight to the steps in the remembered language.
  useEffect(() => {
    if (replayToken === lastReplay.current) return;
    lastReplay.current = replayToken;
    setIndex(0);
    setPhase(readLang() ? 'steps' : 'lang');
  }, [replayToken]);

  const close = useCallback(
    (outcome: 'done' | 'skipped' | 'later') => {
      if (outcome !== 'later') writeOutcome(userId, outcome);
      setPhase('closed');
      setLayout(null);
      if (!isDesktop()) onNavOpen(false);
    },
    [userId, onNavOpen],
  );

  const chooseLang = (l: TourLang): void => {
    setLang(l);
    writeLang(l);
    setIndex(0);
    setPhase('steps');
  };

  // Escape = skip (or "later" on the first question).
  useEffect(() => {
    if (phase === 'closed') return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close(phase === 'ask' ? 'later' : 'skipped');
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [phase, close]);

  const current = phase === 'steps' && index >= 1 && index <= total ? pageSteps[index - 1] : null;

  // On a phone the drawer must be open for the item to be visible.
  useEffect(() => {
    if (phase !== 'steps') return;
    if (!isDesktop()) onNavOpen(index >= 1 && index <= total);
  }, [phase, index, total, onNavOpen]);

  /** Work out where the card and the spotlight go for the current step. */
  const measure = useCallback(() => {
    const card = cardRef.current;
    if (!card || phase === 'closed') return;
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const target = current ? document.querySelector<HTMLElement>(`aside nav a[href="${current.path}"]`) : null;

    if (target && isDesktop()) {
      const r = target.getBoundingClientRect();
      const x = clamp(r.right + GAP, MARGIN, vw - w - MARGIN);
      const y = clamp(r.top + r.height / 2 - h / 2, MARGIN, vh - h - MARGIN);
      setLayout({
        x,
        y,
        tailY: clamp(r.top + r.height / 2 - y, 26, h - 26),
        spot: { x: r.left - 4, y: r.top - 4, w: r.width + 8, h: r.height + 8 },
      });
      return;
    }
    // Phone, or a step with nothing to point at: sit in the corner. The spotlight still marks the item on a phone.
    const spot =
      target && !isDesktop()
        ? (() => {
            const r = target.getBoundingClientRect();
            return { x: r.left - 4, y: r.top - 4, w: r.width + 8, h: r.height + 8 };
          })()
        : null;
    setLayout({
      x: isDesktop() ? vw - w - 24 : MARGIN,
      y: vh - h - (isDesktop() ? 24 : MARGIN),
      tailY: null,
      spot,
    });
  }, [phase, current]);

  // Scroll the item into view, then measure; measure again once the mobile drawer has finished sliding.
  useLayoutEffect(() => {
    if (phase === 'closed') return;
    const target = current ? document.querySelector<HTMLElement>(`aside nav a[href="${current.path}"]`) : null;
    target?.scrollIntoView?.({ block: 'nearest' });
    measure();
    const timers = [window.setTimeout(measure, 120), window.setTimeout(measure, 420)];
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [phase, index, lang, current, measure]);

  // The card changes size when the text or language changes, and the window can be resized or scrolled.
  useEffect(() => {
    if (phase === 'closed') return;
    window.addEventListener('resize', measure);
    document.addEventListener('scroll', measure, true);
    const card = cardRef.current;
    const ro = typeof ResizeObserver !== 'undefined' && card ? new ResizeObserver(measure) : null;
    if (ro && card) ro.observe(card);
    return () => {
      window.removeEventListener('resize', measure);
      document.removeEventListener('scroll', measure, true);
      ro?.disconnect();
    };
  }, [phase, measure]);

  // The bot "flies" (tilts, shows its jets) for the time the card takes to glide to the next item.
  useEffect(() => {
    if (phase !== 'steps' || prefersReducedMotion()) return;
    setFlying(true);
    const id = window.setTimeout(() => setFlying(false), 750);
    return () => window.clearTimeout(id);
  }, [phase, index]);

  const S = STRINGS[lang];
  const firstName = (displayName ?? '').trim().split(/\s+/)[0] ?? '';

  let title = '';
  let body = '';
  if (phase === 'ask') {
    title = ASK.title;
    body = ASK.lines.en;
  } else if (phase === 'lang') {
    title = ASK.title;
    body = PICK_LANGUAGE.lines.en;
  } else if (phase === 'steps') {
    if (index === 0) {
      title = S.welcome.title(firstName);
      body = S.welcome.body;
    } else if (index === finishIndex) {
      title = S.finish.title;
      body = S.finish.body;
    } else if (current) {
      title = current.copy[lang].title;
      body = current.copy[lang].body;
    }
  }

  const spoken = phase === 'ask' || phase === 'lang' ? '' : body;
  const { shown } = useTypewriter(spoken);

  if (phase === 'closed') return null;

  const pointed = layout?.tailY != null;
  const mood: BotMood =
    phase === 'ask' || phase === 'lang'
      ? 'ask'
      : index === 0
        ? 'hello'
        : index === finishIndex
          ? 'done'
          : flying
            ? 'fly'
            : 'explain';

  return (
    <>
      {/* While the steps run, the page is dimmed and inert so a stray click cannot navigate away mid-tour. */}
      {phase === 'steps' ? <div aria-hidden className="nx-tour-catcher" /> : null}
      <div
        aria-hidden
        data-tour-spot
        data-active={phase === 'steps' && layout?.spot ? 'true' : 'false'}
        className="nx-tour-ring"
        style={
          layout?.spot
            ? { transform: `translate3d(${layout.spot.x}px, ${layout.spot.y}px, 0)`, width: layout.spot.w, height: layout.spot.h }
            : undefined
        }
      />

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby="nx-tour-title"
        className="nx-tour-pos"
        style={{
          transform: layout ? `translate3d(${layout.x}px, ${layout.y}px, 0)` : undefined,
          visibility: layout ? 'visible' : 'hidden',
        }}
      >
        <div className="nx-tour-card nx-tour-panel">
          {pointed ? <span aria-hidden className="nx-tour-tail" style={{ top: (layout?.tailY ?? 0) - 8 }} /> : null}

          <TourBotFace mood={mood} />

          <div className="min-w-0 flex-1">
            <h2 id="nx-tour-title" lang={phase === 'steps' ? lang : undefined} className="text-base font-semibold text-ink">
              {title}
            </h2>

            {phase === 'ask' && (
              <>
                <ul className="mt-1 space-y-1 text-sm text-ink-2">
                  {TOUR_LANGS.map((l) => (
                    <li key={l} lang={l}>
                      {ASK.lines[l]}
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button onClick={() => setPhase('lang')}>{ASK.yes}</Button>
                  <Button variant="secondary" onClick={() => close('skipped')}>
                    {ASK.no}
                  </Button>
                  <Button variant="ghost" onClick={() => close('later')}>
                    {ASK.later}
                  </Button>
                </div>
              </>
            )}

            {phase === 'lang' && (
              <>
                <ul className="mt-1 space-y-1 text-sm text-ink-2">
                  {TOUR_LANGS.map((l) => (
                    <li key={l} lang={l}>
                      {PICK_LANGUAGE.lines[l]}
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  {TOUR_LANGS.map((l) => (
                    <Button key={l} variant={l === lang ? 'primary' : 'secondary'} lang={l} onClick={() => chooseLang(l)}>
                      {LANG_LABEL[l]}
                    </Button>
                  ))}
                </div>
              </>
            )}

            {phase === 'steps' && (
              <div lang={lang}>
                {/* The animated copy is hidden from screen readers; this hidden line announces the whole sentence once. */}
                <p className="sr-only" role="status" aria-live="polite">
                  {title}. {body}
                </p>
                {/* The full text is laid out invisibly underneath so the card keeps one size while the letters appear. */}
                <p aria-hidden className="mt-1 grid text-sm leading-relaxed text-ink-2">
                  <span className="invisible col-start-1 row-start-1">{body}</span>
                  <span className="col-start-1 row-start-1">{shown}</span>
                </p>

                {current ? <p className="mt-2 text-xs text-muted">{S.ui.stepOf(index, total)}</p> : null}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {index > 0 ? (
                    <Button variant="secondary" onClick={() => setIndex((i) => Math.max(0, i - 1))}>
                      {S.ui.back}
                    </Button>
                  ) : null}
                  {index < finishIndex ? (
                    <Button onClick={() => setIndex((i) => Math.min(finishIndex, i + 1))}>{S.ui.next}</Button>
                  ) : (
                    <Button onClick={() => close('done')}>{S.ui.done}</Button>
                  )}
                  {index < finishIndex ? (
                    <Button variant="ghost" onClick={() => close('skipped')}>
                      {S.ui.skip}
                    </Button>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setPhase('lang')}
                  className="mt-2 text-xs text-muted underline underline-offset-2 hover:text-ink"
                >
                  {S.ui.changeLanguage}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
