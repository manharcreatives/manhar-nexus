import { useEffect, useRef, type PointerEvent } from 'react';
import { Container, Heading, IconTile, ImageSlot, Reveal, Section } from '../components';
import { TRUST, img } from '../content';
import { isCoarsePointer, prefersReducedMotion, useScrollProgress } from '../hooks';
import '../styles/trust.css';
import { RefundMock } from './_b/RefundMock';
import { headlineNode } from './_b/headline';
import { SectionHead } from './_b/SectionHead';
import { iconFor } from './_b/icons';

/** The six pillars shown as cards, in the order the story reads. The other two blocks are shown as plain facts. */
const PILLAR_IDS = ['self-proving-record', 'finished-is-finished', 'no-double', 'own-job', 'walled-off', 'passwords'] as const;

/**
 * Trust on an Ink/Night block with a 1px green top edge. Behind the content sits a LAYERED DEPTH ROOM: flat photos
 * and HTML layers at different translateZ values inside one perspective box, moving with the pointer (fine pointers
 * only) and with scroll (--p). A flat Ink veil on top keeps every line of text AA-readable. On phones, coarse
 * pointers and reduced motion the room is a still, flat backdrop. No data-residency, blockchain or uptime claims.
 */
export default function Trust() {
  const roomRef = useScrollProgress<HTMLDivElement>('view');
  const raf = useRef(0);
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(
    () => () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    },
    [],
  );

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || isCoarsePointer() || prefersReducedMotion()) return;
    const r = e.currentTarget.getBoundingClientRect();
    pointer.current = { x: (e.clientX - r.left) / r.width - 0.5, y: (e.clientY - r.top) / r.height - 0.5 };
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      const room = roomRef.current;
      if (!room) return;
      room.style.setProperty('--rx', `${(pointer.current.x * 7).toFixed(2)}deg`);
      room.style.setProperty('--ry', `${(-pointer.current.y * 5).toFixed(2)}deg`);
    });
  };

  const byId = new Map(TRUST.blocks.map((b) => [b.id, b]));
  const pillars = PILLAR_IDS.map((id) => byId.get(id)).filter((b): b is NonNullable<typeof b> => Boolean(b));
  const rest = TRUST.blocks.filter((b) => !PILLAR_IDS.some((id) => id === b.id));
  const back = img('restaurant-before-service');
  const mid = img('restaurant-dining-golden-hour');

  return (
    <Section id="trust" tone="night" labelledBy="trust-title" pad="none" bleed className="lp-edge-green lp-tr">
      <div className="lp-tr__wrap" onPointerMove={onMove}>
        <div className="lp-tr__room" ref={roomRef} aria-hidden="true">
          <div className="lp-tr__inner">
            <div className="lp-tr__layer lp-tr__layer--back">
              <ImageSlot src={back.file} alt="" decorative width={back.width} height={back.height} fallback="ink" style={{ aspectRatio: undefined }} className="lp-tr__img" />
            </div>
            <div className="lp-tr__layer lp-tr__layer--mid">
              <ImageSlot src={mid.file} alt="" decorative width={mid.width} height={mid.height} fallback="ink" style={{ aspectRatio: undefined }} className="lp-tr__img" />
            </div>
            <span className="lp-tr__layer lp-tr__layer--ticket-a" />
            <span className="lp-tr__layer lp-tr__layer--ticket-b" />
          </div>
          <div className="lp-tr__veil" />
        </div>

        <Container className="lp-tr__content">
          <div className="lp-tr__intro">
            <SectionHead
              eyebrow={TRUST.header.eyebrow}
              title={headlineNode(TRUST.header.headline)}
              titleId="trust-title"
            />
            <RefundMock />
          </div>

          <ul className="lp-tr__pillars">
            {pillars.map((b, i) => (
              <Reveal as="li" key={b.id} delay={(i % 3) * 80} className="lp-tr__pillar">
                <IconTile icon={iconFor(b.icon)} />
                <Heading level={3} size="h3" className="lp-tr__title">
                  {b.title}
                </Heading>
                <p className="lp-tr__claim">{b.claim}</p>
                <p className="lp-tr__evidence">
                  <span className="lp-tr__evidence-label lp-mono">{TRUST.backingLabel}</span>
                  {b.backing}
                </p>
              </Reveal>
            ))}
          </ul>

          <ul className="lp-tr__facts">
            {rest.map((b) => (
              <li key={b.id} className="lp-tr__fact">
                <Heading level={3} size="h3" className="lp-tr__fact-title">
                  {b.title}
                </Heading>
                <p>{b.claim}</p>
                <p className="lp-tr__evidence">
                  <span className="lp-tr__evidence-label lp-mono">{TRUST.backingLabel}</span>
                  {b.backing}
                </p>
              </li>
            ))}
          </ul>

          <aside className="lp-tr__notyet" aria-labelledby="trust-notyet-title">
            <Heading level={3} size="h3" id="trust-notyet-title">
              {TRUST.notYet.title}
            </Heading>
            <p>{TRUST.notYet.body}</p>
          </aside>
        </Container>
      </div>
    </Section>
  );
}
