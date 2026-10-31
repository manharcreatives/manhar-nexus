import type { CSSProperties } from 'react';
import { Heading, IconTile, Section, SectionButton, Tag } from '../components';
import { HOW } from '../content';
import { useScrollProgress } from '../hooks';
import '../styles/how.css';
import { HowChip } from './_b/HowChips';
import { headlineNode } from './_b/headline';
import { SectionHead } from './_b/SectionHead';
import { iconFor } from './_b/icons';

/**
 * How it works: five numbered steps joined by a rule that draws as the list scrolls through the viewport
 * (--p from useScrollProgress('view'); the CSS falls back to the finished rule when --p is absent, as with
 * reduced motion). Honest about the manual part: a human provisions every Workspace, and the payment link is
 * sent by us until the Cashfree integration exists.
 */
export default function HowItWorks() {
  const flowRef = useScrollProgress<HTMLDivElement>('view');
  const n = HOW.steps.length;
  return (
    <Section id="how" tone="alt" labelledBy="how-title" className="lp-how-section">
      <SectionHead
        eyebrow={HOW.header.eyebrow}
        title={headlineNode(HOW.header.headline)}
        titleId="how-title"
        lede={HOW.header.subhead}
      />

      <div className="lp-how__flow" ref={flowRef} style={{ '--n': n } as CSSProperties}>
        <span className="lp-how__rule" aria-hidden="true">
          <span className="lp-how__rule-fill" />
        </span>
        <ol className="lp-how__steps">
          {HOW.steps.map((s, i) => (
            <li key={s.id} className="lp-how__step" style={{ '--i': i } as CSSProperties}>
              <span className="lp-how__node lp-num" aria-hidden="true">
                {s.number}
              </span>
              <div className="lp-how__card">
                <IconTile icon={iconFor(s.icon)} size={20} />
                <Heading level={3} size="h3" className="lp-how__title">
                  {s.title}
                </Heading>
                <p className="lp-how__body">{s.body}</p>
                <div className="lp-how__chip-wrap" aria-hidden="true">
                  <HowChip id={s.id} />
                </div>
                {s.id === 'pay' ? (
                  // INTEGRATION POINT: Pay step. Replace this interim line with the Cashfree payment / subscription
                  // link flow once it exists (see HOW.integrationNote and docs 03b section 5).
                  <p className="lp-how__interim">
                    <Tag>Today</Tag> {HOW.payInterim}
                  </p>
                ) : null}
                <p className="lp-how__time lp-mono">{s.time}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="lp-how__under">
        <p className="lp-how__under-text">{HOW.underStrip}</p>
        <p className="lp-how__guarantee">{HOW.guaranteeLine}</p>
        <div className="lp-how__ctas">
          <SectionButton section="register" arrow>
            Register your restaurant
          </SectionButton>
          <SectionButton section="register?begin=demo" variant="secondary">
            Ask for a demo
          </SectionButton>
        </div>
      </div>
    </Section>
  );
}
