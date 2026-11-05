import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ASK,
  BYE,
  LANG_LABEL,
  PICK_LANGUAGE,
  STRINGS,
  TOUR_LANGS,
  stepsFor,
  type TourLang,
} from './content';
import { BOT, placeTourBot, type TourPlacement } from './placement';
import { TourBotFace, type BotMood } from './TourBotFace';
import { readLang, readOutcome, writeLang, writeOutcome } from './storage';
import './tour.css';

type Phase = 'closed' | 'ask' | 'lang' | 'steps' | 'bye';

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
const isDesktop = (): boolean => typeof window === 'undefined' || window.matchMedia?.('(min-width: 1024px)').matches !== false;

/** How long the goodbye stays before the bot leaves. */
const BYE_MS = 3200;
/** Moods the bot cycles through while explaining pages, so it is not the same face all the way through. */
const STEP_MOODS: readonly BotMood[] = ['explain', 'cheer', 'explain', 'think'];

/** Reveals `text` letter by letter (instantly for reduced motion). */
function useTypewriter(text: string): string {
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
  return instant ? text : Array.from(text).slice(0, count).join('');
}

interface Layout extends TourPlacement {
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
 * First-run tour led by Manhar Bot, drawn like the helper on the public website: just the character and a thought
 * bubble, no box. It asks whether a tour is wanted, then for the language (English / Hindi / Gujarati), then flies from
 * menu item to menu item: the page dims around the item being explained and the bot lands beside it. Its face changes
 * with what it is saying. "Skip" and "Done" are remembered per user; "Ask me later" is not, so the question returns.
 */
export function TourGuide({ userId, displayName, visiblePaths, onNavOpen, replayToken = 0, enabled = true }: TourGuideProps) {
  const [phase, setPhase] = useState<Phase>('closed');
  const [byeKind, setByeKind] = useState<'no' | 'later'>('no');
  /** The language the goodbye is said in; null before one was chosen (then all three are shown). */
  const [byeLang, setByeLang] = useState<TourLang | null>(null);
  /** First visit: language first, then "do you want a tour?". A replay skips the question. */
  const [needAsk, setNeedAsk] = useState(true);
  const [lang, setLang] = useState<TourLang>(() => readLang() ?? 'en');
  /** 0 = welcome, 1..n = pages, n+1 = finish. */
  const [index, setIndex] = useState(0);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [flying, setFlying] = useState(false);
  const [ready, setReady] = useState(false);
  const lastReplay = useRef(replayToken);
  const botRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);

  const pageSteps = useMemo(() => stepsFor(visiblePaths), [visiblePaths]);
  const total = pageSteps.length;
  const finishIndex = total + 1;

  // First visit: ask after the dashboard has had a moment to paint.
  useEffect(() => {
    if (!enabled || readOutcome(userId) !== null) return;
    const id = window.setTimeout(() => setPhase((p) => (p === 'closed' ? 'lang' : p)), 700);
    return () => window.clearTimeout(id);
  }, [enabled, userId]);

  // Replay from the sidebar: straight to the steps in the remembered language.
  useEffect(() => {
    if (replayToken === lastReplay.current) return;
    lastReplay.current = replayToken;
    setNeedAsk(false);
    setIndex(0);
    setPhase(readLang() ? 'steps' : 'lang');
  }, [replayToken]);

  const hide = useCallback(() => {
    setPhase('closed');
    setLayout(null);
    setReady(false);
    if (!isDesktop()) onNavOpen(false);
  }, [onNavOpen]);

  const close = useCallback(
    (outcome: 'done' | 'skipped' | 'later') => {
      if (outcome !== 'later') writeOutcome(userId, outcome);
      hide();
    },
    [userId, hide],
  );

  /** Declining before the tour starts: say goodbye with a friendly face instead of vanishing. */
  const decline = useCallback(
    (kind: 'no' | 'later', inLang: TourLang | null) => {
      if (kind === 'no') writeOutcome(userId, 'skipped');
      setByeKind(kind);
      setByeLang(inLang);
      setPhase('bye');
    },
    [userId],
  );

  useEffect(() => {
    if (phase !== 'bye') return;
    const id = window.setTimeout(hide, BYE_MS);
    return () => window.clearTimeout(id);
  }, [phase, hide]);

  const chooseLang = (l: TourLang): void => {
    setLang(l);
    writeLang(l);
    setIndex(0);
    // First visit: now that the language is known, ask (in it) whether a tour is wanted.
    setPhase(needAsk ? 'ask' : 'steps');
  };

  const startTour = (): void => {
    setNeedAsk(false);
    setIndex(0);
    setPhase('steps');
  };

  // Escape = skip (or "later" on the first question).
  useEffect(() => {
    if (phase === 'closed') return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      if (phase === 'bye') hide();
      else if (phase === 'ask') decline('later', lang);
      else if (phase === 'lang' && needAsk) decline('later', null);
      else if (phase === 'lang') hide();
      else close('skipped');
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [phase, lang, needAsk, close, decline, hide]);

  const current = phase === 'steps' && index >= 1 && index <= total ? pageSteps[index - 1] : null;

  // On a phone the drawer must be open for the item to be visible.
  useEffect(() => {
    if (phase !== 'steps') return;
    if (!isDesktop()) onNavOpen(index >= 1 && index <= total);
  }, [phase, index, total, onNavOpen]);

  /** Work out where the bot and its bubble go for the current step. */
  const measure = useCallback(() => {
    if (phase === 'closed') return;
    const target = current ? document.querySelector<HTMLElement>(`aside nav a[href="${current.path}"]`) : null;
    const r = target?.getBoundingClientRect();
    const item = r ? { left: r.left, top: r.top, width: r.width, height: r.height } : null;
    const placement = placeTourBot({
      item,
      bubbleH: bubbleRef.current?.offsetHeight ?? 0,
      vw: window.innerWidth,
      vh: window.innerHeight,
      desktop: isDesktop(),
    });
    const spot = r ? { x: r.left - 4, y: r.top - 4, w: r.width + 8, h: r.height + 8 } : null;
    setLayout((prev) =>
      prev &&
      prev.x === placement.x &&
      prev.y === placement.y &&
      prev.pos === placement.pos &&
      prev.bubble.top === placement.bubble.top &&
      prev.bubble.width === placement.bubble.width &&
      prev.tailY === placement.tailY &&
      prev.spot?.x === spot?.x &&
      prev.spot?.y === spot?.y
        ? prev
        : { ...placement, spot },
    );
  }, [phase, current]);

  // Scroll the item into view, then measure; measure again once the mobile drawer has finished sliding.
  useLayoutEffect(() => {
    if (phase === 'closed') return;
    const target = current ? document.querySelector<HTMLElement>(`aside nav a[href="${current.path}"]`) : null;
    target?.scrollIntoView?.({ block: 'nearest' });
    measure();
    const timers = [window.setTimeout(measure, 120), window.setTimeout(measure, 420)];
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [phase, index, lang, byeKind, current, measure]);

  // The bubble changes size with its text and language; the window can be resized or scrolled.
  useEffect(() => {
    if (phase === 'closed') return;
    window.addEventListener('resize', measure);
    document.addEventListener('scroll', measure, true);
    const bubble = bubbleRef.current;
    const ro = typeof ResizeObserver !== 'undefined' && bubble ? new ResizeObserver(measure) : null;
    if (ro && bubble) ro.observe(bubble);
    return () => {
      window.removeEventListener('resize', measure);
      document.removeEventListener('scroll', measure, true);
      ro?.disconnect();
    };
  }, [phase, measure]);

  // Gliding starts only after the first placement, so the bot does not fly in from the corner of the screen.
  useEffect(() => {
    if (!layout || ready) return;
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, [layout, ready]);

  // The bot "flies" (jets on) for the time it takes to glide to the next item.
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
  if (phase === 'steps') {
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
  const shown = useTypewriter(phase === 'steps' ? body : '');

  if (phase === 'closed') return null;

  const mood: BotMood =
    phase === 'lang'
      ? 'ask'
      : phase === 'ask'
        ? 'hello'
      : phase === 'bye'
        ? 'nudge'
        : index === 0
          ? 'hello'
          : index === finishIndex
            ? 'done'
            : flying
              ? 'fly'
              : (STEP_MOODS[(index - 1) % STEP_MOODS.length] ?? 'explain');

  const pos = layout?.pos ?? 'out-left';
  const bubbleStyle = layout
    ? {
        width: layout.bubble.width,
        top: layout.bubble.top,
        ...(layout.bubble.left !== undefined ? { left: layout.bubble.left } : {}),
        ...(layout.bubble.right !== undefined ? { right: layout.bubble.right } : {}),
        ['--tail-y' as string]: `${layout.tailY ?? 0}px`,
      }
    : undefined;

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
        ref={botRef}
        className="nx-tbot"
        data-ready={ready ? 'true' : 'false'}
        style={{
          width: BOT,
          height: BOT,
          transform: layout ? `translate3d(${layout.x}px, ${layout.y}px, 0)` : undefined,
          visibility: layout ? 'visible' : 'hidden',
        }}
      >
        <div className="nx-tbot__face" aria-hidden>
          <TourBotFace mood={mood} size={BOT} />
        </div>

        <div
          ref={bubbleRef}
          role="dialog"
          aria-modal="false"
          aria-labelledby="nx-tour-title"
          className="nx-tb"
          data-pos={pos}
          style={bubbleStyle}
        >
          {phase === 'lang' && (
            <>
              <h2 id="nx-tour-title" className="nx-tb__title">{ASK.title}</h2>
              <ul className="nx-tb__lines">
                {TOUR_LANGS.map((l) => (
                  <li key={l} lang={l}>
                    {PICK_LANGUAGE.lines[l]}
                  </li>
                ))}
              </ul>
              <div className="nx-tb__actions">
                {TOUR_LANGS.map((l) => (
                  <button
                    key={l}
                    type="button"
                    lang={l}
                    className={`nx-tb__btn${l === lang ? ' nx-tb__btn--primary' : ''}`}
                    onClick={() => chooseLang(l)}
                  >
                    {LANG_LABEL[l]}
                  </button>
                ))}
              </div>
              {needAsk ? (
                <button type="button" className="nx-tb__link" onClick={() => decline('later', null)}>
                  {ASK.later}
                </button>
              ) : null}
            </>
          )}

          {phase === 'ask' && (
            <div lang={lang}>
              <h2 id="nx-tour-title" className="nx-tb__title">{ASK.title}</h2>
              <p className="nx-tb__body" role="status">{S.ask.line}</p>
              <div className="nx-tb__actions">
                <button type="button" className="nx-tb__btn nx-tb__btn--primary" onClick={startTour}>
                  {S.ask.yes}
                </button>
                <button type="button" className="nx-tb__btn" onClick={() => decline('no', lang)}>
                  {S.ask.no}
                </button>
                <button type="button" className="nx-tb__btn nx-tb__btn--ghost" onClick={() => decline('later', lang)}>
                  {S.ask.later}
                </button>
              </div>
              <button type="button" onClick={() => setPhase('lang')} className="nx-tb__link">
                {S.ui.changeLanguage}
              </button>
            </div>
          )}

          {phase === 'bye' && (
            <>
              <h2 id="nx-tour-title" className="nx-tb__title">{ASK.title}</h2>
              <ul className="nx-tb__lines" role="status">
                {(byeLang ? [byeLang] : TOUR_LANGS).map((l) => (
                  <li key={l} lang={l}>
                    {BYE[byeKind][l]}
                  </li>
                ))}
              </ul>
            </>
          )}

          {phase === 'steps' && (
            <div lang={lang}>
              <h2 id="nx-tour-title" className="nx-tb__title">{title}</h2>
              {/* The animated copy is hidden from screen readers; this hidden line announces the whole sentence once. */}
              <p className="sr-only" role="status" aria-live="polite">
                {title}. {body}
              </p>
              {/* The full text is laid out invisibly underneath so the bubble keeps one size while the letters appear. */}
              <p aria-hidden className="nx-tb__body">
                <span className="invisible col-start-1 row-start-1">{body}</span>
                <span className="col-start-1 row-start-1">{shown}</span>
              </p>

              {current ? <p className="nx-tb__step">{S.ui.stepOf(index, total)}</p> : null}

              <div className="nx-tb__actions">
                {index > 0 ? (
                  <button type="button" className="nx-tb__btn" onClick={() => setIndex((i) => Math.max(0, i - 1))}>
                    {S.ui.back}
                  </button>
                ) : null}
                {index < finishIndex ? (
                  <button type="button" className="nx-tb__btn nx-tb__btn--primary" onClick={() => setIndex((i) => Math.min(finishIndex, i + 1))}>
                    {S.ui.next}
                  </button>
                ) : (
                  <button type="button" className="nx-tb__btn nx-tb__btn--primary" onClick={() => close('done')}>
                    {S.ui.done}
                  </button>
                )}
                {index < finishIndex ? (
                  <button type="button" className="nx-tb__btn nx-tb__btn--ghost" onClick={() => close('skipped')}>
                    {S.ui.skip}
                  </button>
                ) : null}
              </div>
              <button type="button" onClick={() => setPhase('lang')} className="nx-tb__link">
                {S.ui.changeLanguage}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
