import { useCallback, useState, type CSSProperties } from 'react';
import { Container, Heading, Section } from '../components';
import { PLATFORM } from '../content';
import { useScrollProgress } from '../hooks';
import '../styles/platform.css';
import { headlineNode } from './_b/headline';
import { SectionHead } from './_b/SectionHead';
import { ModuleTicket } from './_b/ModuleTicket';
import { useMq } from './_b/useMq';
import { usePinScroll } from './_b/usePinScroll';
import { clamp01, pad2 } from './_b/util';

/**
 * 3D "sticky fanned ticket stack" is only for fine-pointer desktops with room and no reduced-motion preference.
 * Everywhere else (phones, tablets, coarse pointers, reduced motion, tests) the SAME markup is a plain grid of cards.
 * Keep this string identical to the @media query in styles/platform.css.
 */
const STACK_MQ =
  '(min-width: 960px) and (min-height: 600px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)';
/** Fraction of the pinned scroll spent holding the first / last card (so both are readable). Mirrors platform.css. */
const DWELL_START = 0.05;
const DWELL_SPAN = 0.9;

export default function Platform() {
  const modules = PLATFORM.modules;
  const n = modules.length;
  const pinRef = useScrollProgress<HTMLDivElement>('pin');
  const stack = useMq(STACK_MQ);
  const [active, setActive] = useState(0);

  const onProgress = useCallback(
    (p: number) => {
      const pos = clamp01((p - DWELL_START) / DWELL_SPAN) * (n - 1);
      setActive(Math.round(pos));
    },
    [n],
  );
  usePinScroll(pinRef, stack, onProgress);

  /** Rail click: scroll so the pinned stage lands exactly on card `i`. */
  const goTo = (i: number) => {
    const el = pinRef.current;
    setActive(i);
    if (!el) return;
    const q = n > 1 ? i / (n - 1) : 0;
    const p = DWELL_START + q * DWELL_SPAN;
    const top = el.getBoundingClientRect().top + window.scrollY + p * (el.offsetHeight - window.innerHeight);
    window.scrollTo({ top, behavior: 'smooth' });
  };

  return (
    <Section id="platform" tone="canvas" labelledBy="platform-title" pad="none" bleed className="lp-platform">
      <Container className="lp-platform__head">
        <SectionHead
          eyebrow={PLATFORM.header.eyebrow}
          title={headlineNode(PLATFORM.header.headline)}
          titleId="platform-title"
          lede={PLATFORM.header.subhead}
        />
      </Container>

      {/* Pinned scene: the tall wrapper gets --p (0..1); the sticky stage fans the tickets from it. */}
      <div className="lp-pf" ref={pinRef} style={{ '--n': n } as CSSProperties}>
        <div className="lp-pf__stage">
          <Container className="lp-pf__grid">
            <nav className="lp-pf__rail" aria-label="Jump to a module">
              <p className="lp-pf__count lp-mono" aria-hidden="true">
                <span className="lp-num">{pad2(active + 1)}</span> / {pad2(n)}
              </p>
              <ol className="lp-pf__rail-list">
                {modules.map((m, i) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      className="lp-pf__rail-btn"
                      aria-current={i === active ? 'true' : undefined}
                      onClick={() => goTo(i)}
                    >
                      <span className="lp-num lp-pf__rail-no">{m.number}</span>
                      <span className="lp-pf__rail-title">{m.title}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
            <div className="lp-pf__deck">
              <ol className="lp-pf__cards" aria-label="Nexus modules, live today">
                {modules.map((m, i) => (
                  <li
                    key={m.id}
                    className="lp-pf__card"
                    style={{ '--i': i } as CSSProperties}
                    data-active={stack && i === active ? 'true' : undefined}
                  >
                    <ModuleTicket module={m} total={n} />
                  </li>
                ))}
              </ol>
            </div>
          </Container>
        </div>
      </div>

      <Container className="lp-platform__soon">
        <div className="lp-pf-soon__head">
          <Heading level={3} size="h3" id="platform-soon-title">
            {PLATFORM.comingSoonTitle}
          </Heading>
          <p className="lp-muted">{PLATFORM.comingSoonNote}</p>
        </div>
        <ul className="lp-pf-soon__grid" aria-labelledby="platform-soon-title">
          {PLATFORM.comingSoon.map((m) => (
            <li key={m.id}>
              <ModuleTicket module={m} total={n} muted />
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
