import { useEffect, useMemo, useRef, useState } from 'react';
import { LANG_LABEL, TOUR_LANGS, type TourLang } from '../../../tour/content';
import { readLang, writeLang } from '../../../tour/storage';
import { TourBotFace } from '../../../tour/TourBotFace';
import { BUDDY_UI, reactTo } from './content';
import { emitBuddy, useBuddyState, type BuddyEvent } from './store';
import './buddy.css';

/** Short labels for the language chips (the full name is the accessible name). */
const CHIP: Record<TourLang, string> = { en: 'EN', hi: 'हि', gu: 'ગુ' };
const NUDGE_AFTER_MS = 30_000;

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

/**
 * Manhar Bot beside the registration form: just the character and a thought bubble, no box. It appears when
 * the visitor reaches the form, explains each field as it is focused, cheers accepted answers, worries kindly
 * about mistakes, celebrates the reference code and offers WhatsApp help after a quiet moment. The form only
 * reports events (see store.ts); the wording lives in content.ts.
 */
export default function RegisterBuddy() {
  const raw = useBuddyState();
  const { event, seq } = useHeldEvent(raw.event, raw.seq);
  const [lang, setLang] = useState<TourLang>(() => readLang() ?? browserLang());
  const [inView, setInView] = useState(false);
  const [closed, setClosed] = useState(false);
  const [bubbleOpen, setBubbleOpen] = useState(true);
  const lastSeq = useRef(seq);

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

  // A new event reopens a bubble the visitor had tucked away.
  useEffect(() => {
    if (seq !== lastSeq.current) {
      lastSeq.current = seq;
      setBubbleOpen(true);
    }
  }, [seq]);

  // After a quiet moment, offer a human. Never after success, and not while the form is submitting.
  useEffect(() => {
    if (!inView || closed || event.type === 'success' || event.type === 'submit') return;
    const id = window.setTimeout(() => emitBuddy({ type: 'nudge' }), NUDGE_AFTER_MS);
    return () => window.clearTimeout(id);
  }, [seq, inView, closed, event.type]);

  const reaction = useMemo(() => reactTo(event, lang, seq), [event, lang, seq]);
  const ui = BUDDY_UI[lang];
  const shown = inView && !closed;

  const pick = (l: TourLang): void => {
    setLang(l);
    writeLang(l);
  };

  return (
    <div
      className="lp-buddy"
      data-visible={shown ? 'true' : 'false'}
      role="complementary"
      aria-label={ui.label}
      aria-hidden={shown ? undefined : true}
      lang={lang}
    >
      <button
        type="button"
        className="lp-buddy__bot"
        aria-expanded={bubbleOpen}
        aria-label={bubbleOpen ? ui.hide : ui.show}
        onClick={() => setBubbleOpen((o) => !o)}
        tabIndex={shown ? 0 : -1}
      >
        <TourBotFace mood={reaction.mood} size={104} />
      </button>

      {bubbleOpen ? (
        <div className="lp-buddy__bubble">
          <p key={seq} role="status" aria-live="polite" className="lp-buddy__text">
            {reaction.text}
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
