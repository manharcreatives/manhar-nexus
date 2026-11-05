import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LANG_LABEL, TOUR_LANGS, type TourLang } from '../../../tour/content';
import { readLang, writeLang } from '../../../tour/storage';
import { TourBotFace, type BotMood } from '../../../tour/TourBotFace';
import type { RegistrationFieldName } from '../../content';
import { fieldId } from '../validation';
import { BUDDY_UI, GREET, reactTo } from './content';
import { BOT, placeBuddy, type Placement } from './placement';
import { GUIDE_ORDER, emitBuddy, expectGuidedFocus, getBuddyProgress, nextField, useBuddyState, type BuddyEvent } from './store';
import './buddy.css';

/** Short labels for the language chips (the full name is the accessible name). */
const CHIP: Record<TourLang, string> = { en: 'EN', hi: 'हि', gu: 'ગુ' };
/** How long the bot waits on a field before gently asking again, and then before offering a human. */
const REMIND_AFTER_MS = 10_000;
const HUMAN_AFTER_MS = 15_000;
/** After a field is accepted, the pause (cheer first) before the bot leads on to the next one. */
const LEAD_ON_AFTER_MS = 1_000;
/** Events that mean the visitor is actively working, so the patience timers start over. */
const USER_EVENTS: ReadonlySet<BuddyEvent['type']> = new Set(['focus', 'typing', 'valid', 'invalid', 'consent']);
/** Below this width there is no room beside a field, so the bot stays docked in the corner. */
const FOLLOW_MIN_WIDTH = '(min-width: 900px)';

/** How long a reaction stays before a calmer event (the next field's hint) may replace it. */
const HOLD_MS: Partial<Record<BuddyEvent['type'], number>> = { valid: 900, invalid: 1800 };
const URGENT: ReadonlySet<BuddyEvent['type']> = new Set(['invalid', 'consent', 'submit', 'success', 'failure']);

/**
 * Tabbing out of a field fires "accepted" and, a millisecond later, "focused the next field". Without a hold the
 * cheer would vanish before it could be read, so ordinary events wait until the last reaction has had its moment.
 */
function useHeldEvent(event: BuddyEvent, seq: number): { event: BuddyEvent; seq: number } {
  const [shown, setShown] = useState({ event, seq });
  const shownRef = useRef({ event, at: Date.now() });
  useEffect(() => {
    const age = Date.now() - shownRef.current.at;
    const hold = HOLD_MS[shownRef.current.event.type] ?? 0;
    const wait = URGENT.has(event.type) ? 0 : Math.max(0, hold - age);
    const id = window.setTimeout(() => {
      shownRef.current = { event, at: Date.now() };
      setShown({ event, seq });
    }, wait);
    return () => window.clearTimeout(id);
  }, [event, seq]);
  return shown;
}

/** First guess at the language: what the browser says, else English. */
function browserLang(): TourLang {
  const first = (typeof navigator !== 'undefined' ? navigator.language : 'en').toLowerCase();
  if (first.startsWith('hi')) return 'hi';
  if (first.startsWith('gu')) return 'gu';
  return 'en';
}

const matches = (query: string): boolean => typeof window !== 'undefined' && window.matchMedia?.(query).matches === true;

function useMedia(query: string): boolean {
  const [on, setOn] = useState(() => matches(query));
  useEffect(() => {
    const mql = window.matchMedia?.(query);
    if (!mql) return;
    const update = (): void => setOn(mql.matches);
    update();
    mql.addEventListener?.('change', update);
    return () => mql.removeEventListener?.('change', update);
  }, [query]);
  return on;
}

type Target = RegistrationFieldName | 'submit' | 'ticket';

/** What on the form the bot should stand beside for this event; null keeps wherever it was. */
function targetOf(event: BuddyEvent): Target | null {
  switch (event.type) {
    case 'focus':
    case 'valid':
    case 'invalid':
    case 'typing':
      return event.field;
    case 'consent':
      return 'consent';
    case 'ask':
      return event.field;
    case 'submit':
    case 'ready':
      return 'submit';
    case 'success':
      return 'ticket';
    default:
      return null;
  }
}

function elementFor(target: Target): HTMLElement | null {
  if (target === 'submit') return document.querySelector<HTMLElement>('.lp-reg-submit');
  if (target === 'ticket') return document.querySelector<HTMLElement>('.lp-reg-live');
  return document.getElementById(fieldId(target));
}

const toBox = (r: DOMRect): { left: number; top: number; width: number; height: number } => ({
  left: r.left,
  top: r.top,
  width: r.width,
  height: r.height,
});

/**
 * Manhar Bot beside the registration form: just the character and a thought bubble, no box. On a wide screen it
 * flies to sit right beside the field being typed in (left of left-column fields, right of right-column ones)
 * and the bubble explains that field; on a phone it stays docked in the corner. It cheers accepted answers,
 * worries kindly about mistakes, celebrates the reference code and offers WhatsApp after 30 s of quiet. The form
 * only reports events (see store.ts); the wording lives in content.ts.
 */
export default function RegisterBuddy() {
  const raw = useBuddyState();
  const { event, seq } = useHeldEvent(raw.event, raw.seq);
  const [lang, setLang] = useState<TourLang>(() => readLang() ?? browserLang());
  const [inView, setInView] = useState(false);
  const [closed, setClosed] = useState(false);
  const [bubbleOpen, setBubbleOpen] = useState(true);
  const [target, setTarget] = useState<Target>('restaurantName');
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [ready, setReady] = useState(false);
  /** The bot stays out of sight until the visitor actually starts on the form (clicks into it or types). */
  const [engaged, setEngaged] = useState(false);
  /** Flips on the frame after the bot is placed, so it glides in from the edge of the screen instead of popping up. */
  const [entered, setEntered] = useState(false);
  const introSeq = useRef<number | null>(null);
  const [moving, setMoving] = useState(false);
  const lastSeq = useRef(seq);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const follow = useMedia(FOLLOW_MIN_WIDTH);

  // Appear only while the registration section is on screen. No IntersectionObserver: always on.
  useEffect(() => {
    const section = document.getElementById('register');
    if (!section || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(([entry]) => setInView(entry?.isIntersecting === true), { threshold: 0.1 });
    io.observe(section);
    return () => io.disconnect();
  }, []);

  // A new event reopens a bubble the visitor had tucked away, and may move the bot to another field.
  useEffect(() => {
    if (raw.seq === lastSeq.current) return;
    lastSeq.current = raw.seq;
    setBubbleOpen(true);
    const next = targetOf(raw.event);
    if (next) setTarget(next);
    if (USER_EVENTS.has(raw.event.type)) {
      setEngaged((was) => {
        if (!was) introSeq.current = raw.seq;
        return true;
      });
    }
  }, [raw.seq, raw.event]);

  /** Work out where the bot goes for the current target. */
  const measure = useCallback(() => {
    if (!follow) return;
    const el = elementFor(target);
    const card = document.querySelector<HTMLElement>('.lp-reg-card');
    if (!el || !card) return;
    const next = placeBuddy(toBox(el.getBoundingClientRect()), toBox(card.getBoundingClientRect()), window.innerWidth, window.innerHeight);
    setPlacement((prev) =>
      prev && prev.x === next.x && prev.y === next.y && prev.side === next.side && prev.bubble.mode === next.bubble.mode ? prev : next,
    );
  }, [follow, target]);

  useLayoutEffect(() => {
    measure();
  }, [measure, inView]);

  // The page scrolls and resizes under a fixed bot; keep it beside its field.
  useEffect(() => {
    if (!follow) return;
    let frame = 0;
    const schedule = (): void => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [follow, measure]);

  // The first time the visitor works on the form the bot appears: it waits, off-screen, at the edge on its field's side,
  // then flies in. Two frames: first allow gliding, then move it to its place.
  useEffect(() => {
    if (!engaged || !placement || entered) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      setReady(true);
      second = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(first);
      if (second) cancelAnimationFrame(second);
    };
  }, [engaged, placement, entered]);

  // The flight in from the edge: jets on until it lands.
  useEffect(() => {
    if (!entered) return;
    setMoving(true);
    const id = window.setTimeout(() => setMoving(false), 900);
    return () => window.clearTimeout(id);
  }, [entered]);

  // A long hop makes the bot "fly" (jets on) until it lands.
  useEffect(() => {
    if (!placement) return;
    const prev = lastPos.current;
    lastPos.current = { x: placement.x, y: placement.y };
    if (!prev || !ready) return;
    if (Math.abs(prev.x - placement.x) + Math.abs(prev.y - placement.y) < 40) return;
    setMoving(true);
    const id = window.setTimeout(() => setMoving(false), 650);
    return () => window.clearTimeout(id);
  }, [placement, ready]);

  /** Lead the visitor on: name the next empty field (and move the cursor there), or say the form is ready. */
  const leadOn = useCallback((opts: { focus: boolean; first?: boolean; again?: boolean }): void => {
    const done = getBuddyProgress();
    let next = nextField(done);
    // A patient reminder stays with the field the visitor is on, if it is still empty, instead of jumping elsewhere.
    if (opts.again) {
      const active = GUIDE_ORDER.find((f) => document.getElementById(fieldId(f)) === document.activeElement);
      if (active && !done.has(active)) next = active;
    }
    if (next === null) {
      emitBuddy({ type: 'ready' });
      return;
    }
    emitBuddy({ type: 'ask', field: next, ...(opts.first ? { first: true } : {}), ...(opts.again ? { again: true } : {}) });
    if (opts.focus) {
      expectGuidedFocus(next);
      document.getElementById(fieldId(next))?.focus();
    }
  }, []);

  // When a field is accepted, lead on to the next empty one, unless the visitor has already gone to another control.
  useEffect(() => {
    if (!inView || closed) return;
    const e = raw.event;
    const accepted = (e.type === 'valid' && e.field !== 'businessKind') || (e.type === 'consent' && e.checked);
    if (!accepted) return;
    const id = window.setTimeout(() => {
      const active = document.activeElement;
      const typing = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement;
      const justTicked = e.type === 'consent';
      if (typing && !justTicked && document.querySelector('.lp-reg-card')?.contains(active)) return;
      leadOn({ focus: !justTicked });
    }, LEAD_ON_AFTER_MS);
    return () => window.clearTimeout(id);
  }, [raw.seq, raw.event, inView, closed, leadOn]);

  // Patience: if the visitor goes quiet, ask once more for the same field, then offer a human. Never after sending.
  const stage = useRef(0);
  useEffect(() => {
    if (!engaged || !inView || closed || raw.event.type === 'success' || raw.event.type === 'submit') return;
    if (USER_EVENTS.has(raw.event.type)) stage.current = 0;
    if (stage.current >= 2) return;
    const id = window.setTimeout(() => {
      if (stage.current === 0) {
        stage.current = 1;
        leadOn({ focus: false, again: true });
      } else {
        stage.current = 2;
        emitBuddy({ type: 'nudge' });
      }
    }, stage.current === 0 ? REMIND_AFTER_MS : HUMAN_AFTER_MS);
    return () => window.clearTimeout(id);
  }, [raw.seq, raw.event, engaged, inView, closed, leadOn]);

  // Highlight the field the bot is asking for (a pulsing ring) until the visitor takes over.
  const [hint, setHint] = useState<Target | null>(null);
  useEffect(() => {
    if (raw.event.type === 'ask' || raw.event.type === 'ready') setHint(targetOf(raw.event));
    else if (USER_EVENTS.has(raw.event.type) || raw.event.type === 'submit') setHint(null);
  }, [raw.seq, raw.event]);
  useEffect(() => {
    if (!hint) return;
    const el = elementFor(hint);
    el?.classList.add('lp-buddy-hint');
    return () => el?.classList.remove('lp-buddy-hint');
  }, [hint]);

  const reaction = useMemo(() => reactTo(event, lang, seq), [event, lang, seq]);
  // The very first reaction after flying in introduces the bot, in front of the hint for the field the visitor is on.
  const intro = introSeq.current !== null && seq === introSeq.current;
  const text = intro ? `${GREET[lang]} ${reaction.text}` : reaction.text;
  const mood: BotMood = moving ? 'fly' : intro ? 'hello' : reaction.mood;
  const ui = BUDDY_UI[lang];
  const shown = engaged && inView && !closed && (!follow || placement !== null);
  // Until it has flown in, the bot waits just outside the screen on the side of its field.
  const startX = placement ? (placement.side === 'left' ? -BOT - 30 : window.innerWidth + 30) : 0;
  const x = placement ? (entered ? placement.x : startX) : 0;
  const pos = follow && placement ? (placement.bubble.mode === 'out' ? `out-${placement.side}` : placement.bubble.mode) : 'dock';

  const pick = (l: TourLang): void => {
    setLang(l);
    writeLang(l);
  };

  return (
    <div
      className="lp-buddy"
      data-mode={follow ? 'follow' : 'dock'}
      data-visible={shown ? 'true' : 'false'}
      data-ready={ready ? 'true' : 'false'}
      role="complementary"
      aria-label={ui.label}
      aria-hidden={shown ? undefined : true}
      lang={lang}
      style={follow && placement ? { transform: `translate3d(${x}px, ${placement.y}px, 0)`, width: BOT, height: BOT } : undefined}
    >
      <button
        type="button"
        className="lp-buddy__bot"
        aria-expanded={bubbleOpen}
        aria-label={bubbleOpen ? ui.hide : ui.show}
        onClick={() => setBubbleOpen((o) => !o)}
        tabIndex={shown ? 0 : -1}
      >
        <TourBotFace mood={mood} size={BOT} />
      </button>

      {bubbleOpen ? (
        <div className="lp-buddy__bubble" data-pos={pos} style={follow && placement ? placement.bubble.style : undefined}>
          <p key={seq} role="status" aria-live="polite" className="lp-buddy__text">
            {text}
          </p>
          <div className="lp-buddy__foot">
            <div className="lp-buddy__langs" role="group" aria-label="Language">
              {TOUR_LANGS.map((l) => (
                <button
                  key={l}
                  type="button"
                  lang={l}
                  aria-pressed={l === lang}
                  aria-label={LANG_LABEL[l]}
                  tabIndex={shown ? 0 : -1}
                  onClick={() => pick(l)}
                >
                  {CHIP[l]}
                </button>
              ))}
            </div>
            <button type="button" className="lp-buddy__close" aria-label={ui.hide} tabIndex={shown ? 0 : -1} onClick={() => setClosed(true)}>
              ×
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
