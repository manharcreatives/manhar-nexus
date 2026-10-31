import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { Container, Heading, ImageSlot, Section, Tag } from '../components';
import { cx } from '../components/cx';
import { BUILT_FOR, img, imgSrcSet } from '../content';
import { prefersReducedMotion, useInView, useScrollProgress } from '../hooks';
import '../styles/builtfor.css';
import { headlineNode } from './_b/headline';
import { SectionHead } from './_b/SectionHead';
import { useMq } from './_b/useMq';

/** Ring (3D) only from tablet up and with motion allowed; otherwise a scroll-snap strip. Keep identical to builtfor.css. */
const RING_MQ = '(min-width: 768px) and (prefers-reduced-motion: no-preference)';
const AUTO_MS = 5200;
const DRAG_DEG_PER_PX = 0.35;

/**
 * PERSPECTIVE CAROUSEL RING. n flat photo cards at rotateY(i * 360/n) translateZ(r) inside a perspective stage.
 * The ring turns by: Previous / Next buttons, arrow keys, dragging, a slow auto-rotate (one step every few
 * seconds; paused by hover, focus, the Pause button, reduced motion and when off-screen) and a small scroll-linked
 * offset (--p on the stage). Rotation is written straight to the ring's --rot (no React render per frame).
 * Every card's title, line and status stay in the DOM as a normal list; the live region only speaks on user action.
 */
export default function BuiltFor() {
  const items = BUILT_FOR.items;
  const n = items.length;
  const stepDeg = 360 / n;
  const ringMode = useMq(RING_MQ);
  const sceneRef = useScrollProgress<HTMLDivElement>('view');
  const [viewRef, inView] = useInView<HTMLDivElement>({ threshold: 0.15, once: false });
  const ringEl = useRef<HTMLOListElement>(null);
  const stepRef = useRef(0); // integer: which step the ring is on (unbounded, so it keeps turning one way)
  const drag = useRef<{ x: number; a0: number } | null>(null);
  const [front, setFront] = useState(0);
  const [announce, setAnnounce] = useState('');
  const [paused, setPaused] = useState(false);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);

  const writeRot = useCallback((deg: number) => ringEl.current?.style.setProperty('--rot', `${deg}deg`), []);

  const goStep = useCallback(
    (s: number, user: boolean) => {
      stepRef.current = s;
      writeRot(-s * stepDeg);
      const idx = ((s % n) + n) % n;
      setFront(idx);
      if (user) setAnnounce(`Showing ${items[idx]?.title ?? ''}, ${idx + 1} of ${n}`);
    },
    [items, n, stepDeg, writeRot],
  );

  // slow auto-rotate
  useEffect(() => {
    if (!ringMode || paused || hover || focus || !inView || prefersReducedMotion()) return;
    const id = window.setInterval(() => goStep(stepRef.current + 1, false), AUTO_MS);
    return () => window.clearInterval(id);
  }, [ringMode, paused, hover, focus, inView, goStep]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      goStep(stepRef.current + 1, true);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goStep(stepRef.current - 1, true);
    }
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!ringMode || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag.current = { x: e.clientX, a0: -stepRef.current * stepDeg };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* not supported: dragging still works while the pointer stays over the stage */
    }
    ringEl.current?.classList.add('is-dragging');
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (d) writeRot(d.a0 + (e.clientX - d.x) * DRAG_DEG_PER_PX);
  };
  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    ringEl.current?.classList.remove('is-dragging');
    const a = d.a0 + (e.clientX - d.x) * DRAG_DEG_PER_PX;
    goStep(Math.round(-a / stepDeg), Math.abs(e.clientX - d.x) > 4);
  };

  return (
    <Section id="builtfor" tone="canvas" labelledBy="builtfor-title" pad="none" bleed className="lp-bf-section">
      <Container className="lp-bf__head">
        <SectionHead
          eyebrow={BUILT_FOR.header.eyebrow}
          title={headlineNode(BUILT_FOR.header.headline)}
          titleId="builtfor-title"
        />
      </Container>

      <div
        className="lp-bf"
        ref={viewRef}
        role="group"
        aria-roledescription="carousel"
        aria-label="Business types Nexus is built for"
        onKeyDown={onKeyDown}
        onPointerEnter={() => setHover(true)}
        onPointerLeave={() => setHover(false)}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
      >
        <div
          className="lp-bf__scene"
          ref={sceneRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div className="lp-bf__spin">
            <ol
              className="lp-bf__ring"
              ref={ringEl}
              aria-label="Business types, scroll sideways"
              tabIndex={ringMode ? undefined : 0}
              style={{ '--n': n, '--rk': 1 / (2 * Math.tan(Math.PI / n)) } as CSSProperties}
            >
              {items.map((it, i) => {
                const im = img(it.image);
                return (
                  <li
                    key={it.id}
                    className="lp-bf__card"
                    style={{ '--i': i } as CSSProperties}
                    data-front={i === front ? 'true' : undefined}
                  >
                    <ImageSlot
                      className="lp-bf__photo"
                      src={im.file}
                      srcSet={imgSrcSet(it.image)}
                      sizes="(min-width: 768px) 280px, 78vw"
                      alt={im.alt}
                      width={im.width}
                      height={im.height}
                      decorative
                      fallback="ink"
                      style={{ aspectRatio: undefined }}
                    />
                    <span className="lp-bf__scrim" aria-hidden="true" />
                    <div className="lp-bf__text">
                      <Heading level={3} size="h3" className="lp-bf__title">
                        {it.title}
                      </Heading>
                      <p className="lp-bf__line">{it.line}</p>
                      <Tag tone={it.status === 'coming-soon' ? 'outline' : 'mint'} className="lp-bf__status">
                        {it.statusLabel}
                      </Tag>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>

        <div className="lp-bf__controls">
          <button type="button" className="lp-bf__btn" aria-label="Previous business type" onClick={() => goStep(stepRef.current - 1, true)}>
            <ChevronLeft size={20} strokeWidth={2} aria-hidden="true" focusable="false" />
          </button>
          <button
            type="button"
            className={cx('lp-bf__btn', 'lp-bf__btn--pause')}
            aria-label={paused ? 'Resume automatic rotation' : 'Pause automatic rotation'}
            aria-pressed={paused}
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? (
              <Play size={18} strokeWidth={2} aria-hidden="true" focusable="false" />
            ) : (
              <Pause size={18} strokeWidth={2} aria-hidden="true" focusable="false" />
            )}
          </button>
          <button type="button" className="lp-bf__btn" aria-label="Next business type" onClick={() => goStep(stepRef.current + 1, true)}>
            <ChevronRight size={20} strokeWidth={2} aria-hidden="true" focusable="false" />
          </button>
        </div>
        <p className="lp-visually-hidden" role="status" aria-live="polite">
          {announce}
        </p>

        {/* Ring mode only (CSS): the same one-liners as visible text under the ring. Hidden from AT: the cards carry them. */}
        <ul className="lp-bf__lines" aria-hidden="true">
          {items.map((it, i) => (
            <li key={it.id} className="lp-bf__lineitem" data-front={i === front ? 'true' : undefined}>
              <span className="lp-bf__line-title">{it.title}</span>
              <span className="lp-bf__line-text">{it.line}</span>
              <span className="lp-bf__line-status lp-mono">{it.statusLabel}</span>
            </li>
          ))}
        </ul>
      </div>

      <Container className="lp-bf__foot">
        <p className="lp-bf__closing">{BUILT_FOR.closingLine}</p>
      </Container>
    </Section>
  );
}
