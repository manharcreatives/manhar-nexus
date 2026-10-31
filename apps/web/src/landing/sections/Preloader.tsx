import { useEffect, useState } from 'react';
import { NexusMark } from '../components/NexusMark';
import { prefersReducedMotion } from '../hooks/useReducedMotion';
import '../styles/preloader.css';

const STORAGE_KEY = 'nx-pl';
/** The curtain starts lifting here; everything is removed at END_MS (hard cap). */
const LIFT_MS = 1060;
const END_MS = 1400;

const COPY = ['Laying the tables…', 'Firing the first ticket…', 'Counting the drawer twice…', 'Opening for service.'] as const;

function shouldShow(): boolean {
  if (typeof window === 'undefined') return false;
  if (prefersReducedMotion()) return false;
  // A deep link (#pricing) or a direct article/policy route is never held back. Preloader only lives on "/".
  if (window.location.hash) return false;
  try {
    if (window.sessionStorage.getItem(STORAGE_KEY)) return false;
  } catch {
    /* storage blocked: still show once per mount */
  }
  return true;
}

/**
 * "Kitchen Printer": an order ticket prints out of a printer slot in 16 stepped frames, a Forest READY stamp
 * lands, the N tile pops and an Ink curtain lifts. Once per session, skipped for reduced motion / deep links,
 * <= 1.4 s, never gates content: the page is already in the DOM underneath, the overlay is aria-hidden,
 * does not lock scroll or trap focus, and any key press or click dismisses it immediately.
 */
export default function Preloader() {
  const [show, setShow] = useState(shouldShow);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!show) return;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
    const timers: number[] = [];
    timers.push(window.setTimeout(() => setDone(true), LIFT_MS));
    timers.push(window.setTimeout(() => setShow(false), END_MS));
    const skip = () => {
      timers.forEach((t) => window.clearTimeout(t));
      setDone(true);
      timers.push(window.setTimeout(() => setShow(false), 360));
    };
    window.addEventListener('keydown', skip, { once: true });
    window.addEventListener('pointerdown', skip, { once: true });
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener('keydown', skip);
      window.removeEventListener('pointerdown', skip);
    };
  }, [show]);

  if (!show) return null;
  return (
    <div className={`lp-pl${done ? ' is-done' : ''}`} aria-hidden="true" role="presentation" data-testid="lp-preloader">
      <div className="lp-pl__stage">
        <div className="lp-pl-printer">
          <div className="lp-pl-body">
            <i className="lp-pl-led" />
          </div>
          <div className="lp-pl-chute">
            <div className="lp-pl-ticket">
              <span>Table 07 · 2 covers</span>
              <span>1× Paneer tikka</span>
              <span>2× Butter naan</span>
              <span>1× Masala chai</span>
              <span>Fired 19:42</span>
              <b className="lp-pl-stamp">Ready</b>
              <NexusMark size={40} className="lp-pl-mark" />
            </div>
          </div>
        </div>
        <p className="lp-pl-copy">
          {COPY.map((line, i) => (
            <span key={line} style={{ ['--i' as string]: i }}>
              {line}
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}
