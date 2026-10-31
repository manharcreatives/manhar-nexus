import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Section, SectionHead } from '../components';
import { cx } from '../components/cx';
import { COMPARE } from '../content';
import { useInView, useReducedMotion } from '../hooks';
import '../styles/compare.css';
import { CompareScorecard } from './_b/CompareScorecard';
import { headlineNode } from './_b/headline';

const AUTO_MS = 6500;

/**
 * "One Saturday night, two ways": five moments between 6 pm and midnight on a hairline timeline. Pick a stop (or let
 * it advance on its own while in view, until you touch it) and the moment opens as two glass columns: without Nexus,
 * with Nexus. All five stay in the DOM as an ordered list; one is shown at a time in a shared grid cell, so the box
 * never changes height. Reduced motion renders all five as a static ledger. The honest scorecard sits behind a
 * disclosure.
 */
export default function Compare() {
  const { moments } = COMPARE;
  const n = moments.length;
  const reduced = useReducedMotion();
  const [cur, setCur] = useState(0);
  const [auto, setAuto] = useState(true);
  const [viewRef, inView] = useInView<HTMLDivElement>({ threshold: 0.35, once: false });
  const hold = useRef(false);

  useEffect(() => {
    if (reduced || !auto || !inView) return;
    const id = window.setInterval(() => {
      if (!hold.current) setCur((c) => (c + 1) % n);
    }, AUTO_MS);
    return () => window.clearInterval(id);
  }, [reduced, auto, inView, n]);

  const pick = (i: number) => {
    setAuto(false);
    setCur(i);
  };

  return (
    <Section id="why" tone="alt" labelledBy="why-title" className="lp-cs-section">
      <SectionHead
        eyebrow={COMPARE.header.eyebrow}
        title={headlineNode(COMPARE.header.headline)}
        titleId="why-title"
        lede={COMPARE.header.subhead}
      />

      <div className={cx('lp-cs', reduced && 'is-static')} ref={viewRef} onPointerEnter={() => (hold.current = true)} onPointerLeave={() => (hold.current = false)}>
        {reduced ? null : (
          <div className="lp-cs__track" style={{ '--x': n > 1 ? cur / (n - 1) : 0 } as CSSProperties}>
            <span className="lp-cs__line" aria-hidden="true">
              <span className="lp-cs__fill" />
            </span>
            <ul className="lp-cs__stops" aria-label="Pick a moment of the night">
              {moments.map((mo, i) => (
                <li key={mo.id}>
                  <button
                    type="button"
                    className="lp-cs__stop"
                    aria-current={i === cur ? 'true' : undefined}
                    aria-controls="lp-cs-moments"
                    aria-label={`${mo.label}: ${mo.title}`}
                    data-done={i <= cur}
                    onClick={() => pick(i)}
                  >
                    <span className="lp-cs__pin" aria-hidden="true" />
                    <span className="lp-cs__stamp lp-mono">{mo.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <ol className="lp-cs__moments" id="lp-cs-moments" aria-label="One Saturday night, moment by moment">
          {moments.map((mo, i) => (
            <li
              key={mo.id}
              className="lp-cs__m"
              data-state={reduced ? 'static' : i === cur ? 'current' : 'idle'}
              aria-current={!reduced && i === cur ? 'true' : undefined}
            >
              <div className="lp-cs__m-head">
                <span className="lp-num lp-cs__clock">{mo.clock}</span>
                <h3 className="lp-cs__m-title">{mo.title}</h3>
              </div>
              <div className="lp-cs__cols">
                <div className="lp-cs__cell lp-cs__cell--without">
                  <p className="lp-cs__tag lp-mono">{COMPARE.withoutLabel}</p>
                  <p className="lp-cs__text">{mo.without}</p>
                </div>
                <div className="lp-cs__cell lp-cs__cell--with lp-glass">
                  <p className="lp-cs__tag lp-mono">{COMPARE.withLabel}</p>
                  <p className="lp-cs__text">{mo.with}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
        <p className="lp-cs__caption">{COMPARE.caption}</p>
      </div>

      <CompareScorecard />
    </Section>
  );
}
