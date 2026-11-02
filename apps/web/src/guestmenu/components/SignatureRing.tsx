import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { prefersReducedMotion, useReveal } from '../motion';
import { formatPrice } from '../format';
import { T } from '../strings';
import type { MenuItem } from '../types';
import { BlurImage, VegMark } from './ui';

const MAX = 8;

/**
 * The signature ring: flat dish photographs arranged on a CSS 3D carousel (no WebGL). Drags and keys rotate it,
 * it drifts slowly when idle, pauses off-screen, and falls back to a still, step-by-step ring for reduced motion.
 */
export function SignatureRing({ items, currency, onOpen }: { items: MenuItem[]; currency: string; onOpen: (i: MenuItem) => void }) {
  const list = useMemo(() => items.slice(0, MAX), [items]);
  const n = list.length;
  const step = 360 / n;
  const stage = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const st = useRef({ angle: 0, vel: 0, dragging: false, x0: 0, a0: 0, lastX: 0, lastT: 0, pauseUntil: 0, visible: false, target: null as number | null, moved: false, w: 260 });
  const [front, setFront] = useState(0);
  const reveal = useReveal<HTMLElement>();
  const reduced = typeof window !== 'undefined' && prefersReducedMotion();

  const geometry = useCallback(() => {
    const el = stage.current;
    const vw = el?.clientWidth || 360;
    const w = Math.min(260, Math.max(190, vw * 0.58));
    const gap = 1.12;
    const r = Math.max(w * 0.9, (w / 2 / Math.tan(Math.PI / Math.max(3, n))) * gap);
    st.current.w = w;
    el?.style.setProperty('--w', `${w}px`);
    el?.style.setProperty('--r', `${r}px`);
    return { w, r };
  }, [n]);

  const paint = useCallback(() => {
    const s = st.current;
    const r = ring.current;
    if (!r) return;
    r.style.transform = `translateZ(calc(var(--r) * -1)) rotateY(${s.angle.toFixed(2)}deg)`;
    let best = 0;
    let bestD = 999;
    for (let i = 0; i < n; i++) {
      let d = (((i * step + s.angle) % 360) + 540) % 360 - 180; // -180..180, 0 = facing the viewer
      d = Math.abs(d);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
      const c = cardRefs.current[i];
      if (c) {
        c.style.setProperty('--dim', String(Math.min(0.78, (d / 180) * 1.05)));
        c.tabIndex = i === best ? 0 : -1;
      }
    }
    setFront((f) => (f === best ? f : best));
  }, [n, step]);

  const goTo = useCallback((index: number) => {
    const s = st.current;
    // nearest equivalent angle that brings card `index` to the front
    const want = -index * step;
    const diff = ((((want - s.angle) % 360) + 540) % 360) - 180;
    s.target = s.angle + diff;
    s.pauseUntil = performance.now() + 6000;
    if (reduced) {
      s.angle = s.target;
      s.target = null;
      paint();
    }
  }, [step, paint, reduced]);

  useEffect(() => {
    geometry();
    paint();
    const el = stage.current;
    if (!el) return;
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { geometry(); paint(); }) : null;
    ro?.observe(el);
    const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(([e]) => { st.current.visible = !!e?.isIntersecting; }) : null;
    io?.observe(el);
    if (!io) st.current.visible = true;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(48, now - last);
      last = now;
      const s = st.current;
      if (!s.visible || reduced || document.hidden) return;
      if (s.dragging) return;
      if (s.target !== null) {
        const d = s.target - s.angle;
        if (Math.abs(d) < 0.15) {
          s.angle = s.target;
          s.target = null;
        } else s.angle += d * Math.min(1, dt / 160);
      } else if (Math.abs(s.vel) > 0.01) {
        s.angle += s.vel * dt;
        s.vel *= 0.94;
        if (Math.abs(s.vel) <= 0.01) {
          // settle on the nearest card
          const idx = Math.round(-s.angle / step);
          s.target = -idx * step;
          s.pauseUntil = now + 4000;
        }
      } else if (now > s.pauseUntil) {
        s.angle -= dt * 0.006; // ~6 deg/s drift
      } else return;
      paint();
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      io?.disconnect();
    };
  }, [geometry, paint, reduced, step]);

  const onPointerDown = (e: React.PointerEvent) => {
    const s = st.current;
    s.dragging = true;
    s.moved = false;
    s.x0 = e.clientX;
    s.a0 = s.angle;
    s.lastX = e.clientX;
    s.lastT = performance.now();
    s.vel = 0;
    s.target = null;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = st.current;
    if (!s.dragging) return;
    const dx = e.clientX - s.x0;
    if (Math.abs(dx) > 5) s.moved = true;
    s.angle = s.a0 + dx * 0.32;
    const now = performance.now();
    const dt = Math.max(1, now - s.lastT);
    s.vel = ((e.clientX - s.lastX) * 0.32) / dt;
    s.lastX = e.clientX;
    s.lastT = now;
    paint();
  };
  const endDrag = () => {
    const s = st.current;
    if (!s.dragging) return;
    s.dragging = false;
    s.pauseUntil = performance.now() + 4000;
    if (reduced || Math.abs(s.vel) < 0.02) {
      const idx = Math.round(-s.angle / step);
      s.target = -idx * step;
      if (reduced) {
        s.angle = s.target;
        s.target = null;
        paint();
      }
    }
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo((front + 1) % n); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); goTo((front - 1 + n) % n); }
  };

  const cur = list[front];
  return (
    <section ref={reveal} className="gm-ring" aria-labelledby="gm-sig-h" data-reveal>
      <header className="gm-sec-head">
        <p className="gm-eyebrow">{T.signatureHint}</p>
        <h2 id="gm-sig-h">{T.signatures}</h2>
        <p className="gm-lede">{T.signaturesLede}</p>
      </header>
      <div
        ref={stage}
        className="gm-ring__stage"
        role="group"
        aria-roledescription="carousel"
        aria-label={T.signatures}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div ref={ring} className="gm-ring__ring">
          {list.map((it, i) => (
            <button
              key={it.id}
              ref={(el) => { cardRefs.current[i] = el; }}
              type="button"
              className="gm-ring__card"
              style={{ transform: `rotateY(${i * step}deg) translateZ(var(--r))` }}
              aria-label={`${it.name}, ${formatPrice(it.priceMinor, currency)}`}
              aria-current={i === front || undefined}
              onClick={() => {
                if (st.current.moved) return;
                if (i === front) onOpen(it);
                else goTo(i);
              }}
            >
              <BlurImage src={it.thumbUrl || it.imageUrl} blur={it.blurDataUri} color={it.color} className="gm-ring__img" width={520} height={660} />
              <span className="gm-ring__dim" aria-hidden="true" />
            </button>
          ))}
        </div>
        <div className="gm-ring__floor" aria-hidden="true" />
      </div>
      <div className="gm-ring__caption">
        <button type="button" className="gm-roundbtn gm-press" onClick={() => goTo((front - 1 + n) % n)} aria-label={T.prev}><ChevronLeft size={18} aria-hidden="true" /></button>
        <button type="button" className="gm-ring__cap" onClick={() => cur && onOpen(cur)}>
          <span className="gm-ring__name"><VegMark kind={cur?.veg} /> {cur?.name}</span>
          <span className="gm-ring__price tabular">{cur ? formatPrice(cur.priceMinor, currency) : ''}</span>
        </button>
        <button type="button" className="gm-roundbtn gm-press" onClick={() => goTo((front + 1) % n)} aria-label={T.next}><ChevronRight size={18} aria-hidden="true" /></button>
      </div>
    </section>
  );
}
