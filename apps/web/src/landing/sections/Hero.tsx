import type { CSSProperties } from 'react';
import { BadgeCheck, Radio, ShieldCheck, type LucideIcon } from 'lucide-react';
import { Eyebrow, Heading, Icon, ImageSlot, Section, SectionButton } from '../components';
import { HERO, img } from '../content';
import { MiniTicket, OwnerDashboard } from '../devices';
import { prefersReducedMotion } from '../hooks/useReducedMotion';
import { useScrollProgress } from '../hooks/useScrollProgress';
import { useTilt } from '../hooks/useTilt';
import { SectionLink } from '../components/SectionLink';
import { mapWords, sectionIdOf, stripArrow } from './sectionsA.shared';
import { useMagnetic } from './useMagnetic';
import '../styles/hero.css';

const PROOF_ICONS: Record<string, LucideIcon> = { ShieldCheck, BadgeCheck, Radio };

/** The Preloader runs once per session on "/" without a hash: hold the line reveal until its curtain lifts (~1.06 s). */
function revealDelaySeconds(): number {
  if (typeof window === 'undefined' || prefersReducedMotion() || window.location.hash) return 0.12;
  try {
    return window.sessionStorage.getItem('nx-pl') ? 0.12 : 1.02;
  } catch {
    return 0.12;
  }
}

const STAGE_LABEL =
  'Preview of the Manhar Nexus owner dashboard with live order tickets and a settled bill stamped PAID. Illustrative sample data.';

/**
 * Hero "The Pass": copy on Ink, and a tilted HTML dashboard plane in CSS 3D that flattens as you scroll
 * (native scroll() timeline where supported, otherwise the --p variable from useScrollProgress('hero')).
 * Three ticket stubs float at different translateZ with a subtle pointer parallax. The single h1 lives here.
 */
export default function Hero() {
  const scrollRef = useScrollProgress<HTMLDivElement>('hero');
  const tiltRef = useTilt<HTMLDivElement>(3);
  const magnetRef = useMagnetic<HTMLSpanElement>(6, 96);
  const photo = img('hero-pass-evening');
  const delay = revealDelaySeconds();
  const rise = { ['--hd' as string]: `${delay}s` } as CSSProperties;

  return (
    <Section id="hero" tone="ink" labelledBy="hero-title" bleed pad="none" className="lp-hero">
      <div className="lp-hero__bg" aria-hidden="true">
        <div className="lp-hero__bgin">
          <ImageSlot
            src={photo.file}
            alt=""
            width={photo.width}
            height={photo.height}
            decorative
            priority
            fallback="ink"
            position="62% 40%"
            style={{ aspectRatio: 'auto', height: '100%' }}
          />
        </div>
      </div>

      <div className="lp-container lp-container--wide lp-hero__grid">
        <div className="lp-hero__copy" style={rise}>
          <Eyebrow className="lp-hero__eyebrow lp-hero__fade" style={{ ['--n' as string]: 0 }}>
            {HERO.eyebrow}
          </Eyebrow>
          <Heading level={1} id="hero-title" className="lp-hero__h1">
            {mapWords(HERO.headline.text, HERO.headline.accent, (node, i) => (
              <span className="lp-hero__w">
                <span style={{ ['--i' as string]: i }}>{node}</span>
              </span>
            ))}
          </Heading>
          <p className="lp-hero__sub lp-hero__fade" style={{ ['--n' as string]: 2 }}>
            {HERO.subhead}
          </p>
          <div className="lp-hero__actions lp-hero__fade" style={{ ['--n' as string]: 3 }}>
            <span ref={magnetRef} className="lp-hero__magnet">
              <SectionButton section={sectionIdOf(HERO.primaryCta.href)} size="lg" arrow>
                {HERO.primaryCta.label}
              </SectionButton>
            </span>
            <SectionButton section={sectionIdOf(HERO.secondaryCta.href)} variant="secondary" size="lg">
              {stripArrow(HERO.secondaryCta.label)}
              <svg className="lp-btn__arrow lp-hero__down" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <path d="M8 3v9M4 8.5l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </SectionButton>
          </div>
          <p className="lp-hero__micro lp-hero__fade" style={{ ['--n' as string]: 4 }}>
            {HERO.microcopy}
          </p>
        </div>

        <div ref={scrollRef} className="lp-hero__stage" role="img" aria-label={STAGE_LABEL}>
          <div ref={tiltRef} className="lp-hero__pointer">
            <div className="lp-hero__flat">
              <div className="lp-hero__para">
                <div className="lp-hero__plane">
                  <OwnerDashboard decorative />
                </div>
                <div className="lp-hero__tk lp-hero__tk--1">
                  <MiniTicket
                    number="0409"
                    table="Table 12"
                    lines={[
                      { qty: 1, name: 'Paneer Tikka', sub: 'Full' },
                      { qty: 2, name: 'Butter Naan' },
                    ]}
                    status="Preparing"
                  />
                </div>
                <div className="lp-hero__tk lp-hero__tk--2">
                  <MiniTicket
                    number="0412"
                    table="Table 7"
                    lines={[
                      { qty: 2, name: 'Masala Dosa', sub: 'Full · Extra butter' },
                      { qty: 1, name: 'Filter Coffee' },
                    ]}
                    status="Waiting 00:48"
                  />
                </div>
                <div className="lp-hero__tk lp-hero__tk--3">
                  <MiniTicket number="B-118" table="Table 7" lines={[{ qty: 5, name: 'Items · GST 5%' }]} total="₹693.00" stamp="Paid" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <ul className="lp-hero__proof" aria-label="What Nexus guarantees">
          {HERO.proofPoints.map((p, i) => (
            <li key={p.id} className="lp-hero__pt lp-hero__fade" style={{ ['--n' as string]: 5 + i, ...rise }}>
              <span className="lp-hero__pticon">
                <Icon icon={PROOF_ICONS[p.icon] ?? ShieldCheck} size={20} />
              </span>
              <p className="lp-hero__ptt">{p.title}</p>
              <p className="lp-hero__ptb">{p.body}</p>
            </li>
          ))}
        </ul>

        <SectionLink to="intro" className="lp-hero__cue">
          <span className="lp-hero__cueline" aria-hidden="true" />
          {HERO.scrollCue}
        </SectionLink>
      </div>
    </Section>
  );
}
