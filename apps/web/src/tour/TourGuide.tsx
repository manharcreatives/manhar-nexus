import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { ManharBot } from './ManharBot';
import { readLang, readOutcome, writeLang, writeOutcome } from './storage';
import './tour.css';

type Phase = 'closed' | 'ask' | 'lang' | 'steps';

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
const isDesktop = (): boolean => typeof window === 'undefined' || window.matchMedia?.('(min-width: 1024px)').matches !== false;

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
 * (English / Hindi / Gujarati), then lights up each sidebar page the user can see and explains it.
 * "Skip" and "Done" are remembered per user; "Ask me later" is not, so the question returns next time.
 */
export function TourGuide({ userId, displayName, visiblePaths, onNavOpen, replayToken = 0, enabled = true }: TourGuideProps) {
  const [phase, setPhase] = useState<Phase>('closed');
  const [lang, setLang] = useState<TourLang>(() => readLang() ?? 'en');
  /** 0 = welcome, 1..n = pages, n+1 = finish. */
  const [index, setIndex] = useState(0);
  const lastReplay = useRef(replayToken);

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

  // Escape = skip.
  useEffect(() => {
    if (phase === 'closed') return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close(phase === 'ask' ? 'later' : 'skipped');
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [phase, close]);

  // Light up the sidebar item being explained (and open the mobile drawer so it can be seen).
  const current = phase === 'steps' && index >= 1 && index <= total ? pageSteps[index - 1] : null;
  useEffect(() => {
    if (phase !== 'steps') return;
    if (!isDesktop()) onNavOpen(index >= 1 && index <= total);
    if (!current) return;
    const el = document.querySelector<HTMLElement>(`aside nav a[href="${current.path}"]`);
    if (!el) return;
    el.classList.add('nx-tour-spot');
    el.scrollIntoView?.({ block: 'nearest' });
    return () => el.classList.remove('nx-tour-spot');
  }, [phase, index, current, total, onNavOpen]);

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
  const { shown, typing } = useTypewriter(spoken);

  if (phase === 'closed') return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="nx-tour-title"
      className="nx-tour-card fixed inset-x-3 bottom-3 z-50 sm:left-auto sm:right-6 sm:bottom-6 sm:w-[26rem] lg:left-[17rem] lg:right-auto"
    >
      <div className="nx-glass flex gap-3 rounded-panel border border-accent/30 bg-[#0b1210]/95 p-4 shadow-2xl backdrop-blur-xl">
        <ManharBot talking={typing} wave={phase === 'ask' || (phase === 'steps' && index === 0)} />

        <div className="min-w-0 flex-1">
          <h2 id="nx-tour-title" lang={phase === 'steps' ? lang : undefined} className="text-base font-semibold">
            {title}
          </h2>

          {phase === 'ask' && (
            <>
              <ul className="mt-1 space-y-1 text-sm text-ink/90">
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
              <ul className="mt-1 space-y-1 text-sm text-ink/90">
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
              <p aria-hidden className="mt-1 min-h-[3.5rem] text-sm leading-relaxed text-ink/90">
                {shown}
              </p>

              {current ? (
                <p className="mt-2 text-xs text-muted">{S.ui.stepOf(index, total)}</p>
              ) : null}

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
  );
}
