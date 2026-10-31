import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Section } from '../components';
import { cx } from '../components/cx';
import { COMPARE } from '../content';
import { useReducedMotion } from '../hooks';
import '../styles/compare.css';
import { PaperPile, TidyTicks } from './_b/CompareArtefacts';
import { CompareScorecard } from './_b/CompareScorecard';
import { currentMoment, readClock } from './_b/clock';
import { headlineNode } from './_b/headline';
import { SectionHead } from './_b/SectionHead';
import { useMq } from './_b/useMq';
import { usePinScroll } from './_b/usePinScroll';

/** Scroll-linked auto-play (pinned stage) only where there is room. Keep identical to styles/compare.css. */
const PIN_MQ = '(min-width: 900px) and (min-height: 680px) and (prefers-reduced-motion: no-preference)';
const STEP = 5; // minutes per slider step

/**
 * "One Saturday night, two ways". A native <input type="range"> is the clock (18:00 -> 00:00). The "with Nexus" line
 * under it is a second layer revealed by clip-path as the night advances (the wiper). The eight moments are an
 * ordered list that always stays in the DOM; one is shown at a time. While the block is in view the night plays with
 * the scroll, until the visitor touches the control. Reduced motion = a static, fully visible ledger (no slider).
 */
export default function Compare() {
  const { range, moments } = COMPARE;
  const total = range.totalMinutes;
  const reduced = useReducedMotion();
  const pinned = useMq(PIN_MQ) && !reduced;
  const [t, setT] = useState<number>(moments[0]?.minutes ?? 0);
  const [auto, setAuto] = useState(true);
  const autoRef = useRef(true);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    autoRef.current = auto;
  }, [auto]);

  const onProgress = useCallback(
    (p: number) => {
      if (!autoRef.current) return;
      const q = Math.min(1, Math.max(0, (p - 0.03) / 0.94));
      setT(Math.round((q * total) / STEP) * STEP);
    },
    [total],
  );
  usePinScroll(wrapRef, pinned, onProgress);

  const cur = currentMoment(
    moments.map((m) => m.minutes),
    t,
  );
  const now = readClock(t);
  const m = moments[cur];
  const touch = () => setAuto(false);
  const pct = (t / total) * 100;

  return (
    <Section id="why" tone="alt" labelledBy="why-title" className="lp-cs-section">
      <SectionHead
        eyebrow={COMPARE.header.eyebrow}
        title={headlineNode(COMPARE.header.headline)}
        titleId="why-title"
        lede={COMPARE.header.subhead}
      />

      <div className={cx('lp-cs', pinned && 'is-pinned', reduced && 'is-static')} ref={wrapRef}>
        <div className="lp-cs__stage">
          {reduced ? null : (
            <div className="lp-cs__clockbar">
              <p className="lp-cs__clock" aria-hidden="true">
                <span className="lp-cs__time">{now.clock}</span>
                <span className="lp-cs__label lp-mono">{now.label}</span>
              </p>
              <p className="lp-cs__hint lp-mono">{pinned && auto ? 'Scroll to play the night' : 'Drag the slider'}</p>
            </div>
          )}

          <ol className="lp-cs__moments" id="lp-cs-moments" aria-label="One Saturday night, moment by moment">
            {moments.map((mo, i) => (
              <li
                key={mo.id}
                className="lp-cs__m"
                data-state={reduced ? 'static' : i === cur ? 'current' : i < cur ? 'past' : 'future'}
                aria-current={!reduced && i === cur ? 'true' : undefined}
              >
                <div className="lp-cs__m-head">
                  <span className="lp-num lp-cs__stamp">{mo.clock}</span>
                  <h3 className="lp-cs__m-title">{mo.title}</h3>
                </div>
                <div className="lp-cs__cell lp-cs__cell--without">
                  <p className="lp-cs__tag lp-mono">{COMPARE.withoutLabel}</p>
                  <p className="lp-cs__text">{mo.without}</p>
                </div>
                <div className="lp-cs__cell lp-cs__cell--with">
                  <p className="lp-cs__tag lp-mono">{COMPARE.withLabel}</p>
                  <p className="lp-cs__text">{mo.with}</p>
                </div>
              </li>
            ))}
          </ol>

          {reduced ? null : (
            <>
              <div className="lp-cs__meters">
                <PaperPile current={cur} count={moments.length} />
                <TidyTicks current={cur} count={moments.length} />
              </div>

              <div className="lp-cs__control" onPointerDown={touch} onKeyDown={(e) => (e.key === 'Tab' ? undefined : touch())}>
                <div className="lp-cs__track" style={{ '--x': `${pct}%` } as CSSProperties}>
                  <div className="lp-cs__lane" aria-hidden="true">
                    <span className="lp-cs__line lp-cs__line--paper" />
                    <span className="lp-cs__line lp-cs__line--nexus" />
                    {moments.map((mo) => (
                      <span
                        key={mo.id}
                        className="lp-cs__pin"
                        data-done={mo.minutes <= t}
                        style={{ left: `${(mo.minutes / total) * 100}%` }}
                      />
                    ))}
                  </div>
                  <input
                    type="range"
                    className="lp-cs__range"
                    min={0}
                    max={total}
                    step={STEP}
                    value={t}
                    aria-label={range.sliderLabel}
                    aria-valuetext={`${now.label}. ${m?.title ?? ''}`}
                    aria-controls="lp-cs-moments"
                    onChange={(e) => {
                      setAuto(false);
                      setT(Number(e.target.value));
                    }}
                  />
                </div>
                <ol className="lp-cs__ticks" aria-hidden="true">
                  {range.ticks.map((tk, i) => (
                    <li key={tk} style={{ left: `${(i / Math.max(1, range.ticks.length - 1)) * 100}%` }}>
                      {tk}
                    </li>
                  ))}
                </ol>
                <ul className="lp-cs__chips" aria-label="Jump to a moment">
                  {moments.map((mo, i) => (
                    <li key={mo.id}>
                      <button
                        type="button"
                        className="lp-cs__chip lp-mono"
                        aria-current={i === cur ? 'true' : undefined}
                        aria-label={`${mo.label}: ${mo.title}`}
                        onClick={() => {
                          setAuto(false);
                          setT(mo.minutes);
                        }}
                      >
                        {mo.label}
                      </button>
                    </li>
                  ))}
                </ul>
                {pinned && !auto ? (
                  <button type="button" className="lp-cs__resume" onClick={() => setAuto(true)}>
                    Play with scroll again
                  </button>
                ) : null}
              </div>
            </>
          )}
          <p className="lp-cs__caption">{COMPARE.caption}</p>
        </div>
      </div>

      <CompareScorecard />
    </Section>
  );
}
