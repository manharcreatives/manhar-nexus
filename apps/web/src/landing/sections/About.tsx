import { ExternalLink, Mail, MapPin, MessageCircle } from 'lucide-react';
import { Button, Icon, ImageSlot, Reveal, Section, SectionHead } from '../components';
import { ABOUT, CONTACT } from '../content';
import { mapWords } from './sectionsA.shared';
import '../styles/about.css';

/**
 * Only fields the content module marks publishable are rendered: paragraphs flagged `ownerConfirm` (claims about the
 * studio's experience around restaurants) stay out until the owner confirms them, as does the founder signature
 * until `signature.ownerApproved` is true. `internalNote` is never rendered.
 */
const PUBLISHABLE = ABOUT.paragraphs.filter((p) => !p.ownerConfirm).map((p) => p.text);

function splitBelief(text: string): { lead: string; rest: string } {
  const m = text.match(/^(.+?[.!?])\s+(.+)$/);
  return m ? { lead: m[1], rest: m[2] } : { lead: text, rest: '' };
}

const heading = <>{mapWords(ABOUT.header.headline.text, ABOUT.header.headline.accent, (node) => node)}</>;

/** About: who builds Nexus. Honest, short, no invented history. */
export default function About() {
  return (
    <Section id="about" tone="alt" labelledBy="about-title" className="lp-about">
      <SectionHead eyebrow={ABOUT.header.eyebrow} title={heading} titleId="about-title" />

      <div className="lp-about__grid">
        <div className="lp-about__story">
          <Reveal>
            <div className="lp-about__prose">
              {PUBLISHABLE.map((t) => (
                <p key={t}>{t}</p>
              ))}
            </div>
          </Reveal>
          <Reveal delay={120}>
            <aside className="lp-about__note" aria-label={ABOUT.honestNote.title}>
              <p className="lp-about__notetitle">{ABOUT.honestNote.title}</p>
              <p className="lp-about__notebody">{ABOUT.honestNote.body}</p>
            </aside>
          </Reveal>
          {ABOUT.signature.ownerApproved ? (
            <p className="lp-about__sign">
              <span>{ABOUT.signature.name}</span> · {ABOUT.signature.role}
            </p>
          ) : null}
        </div>

        <Reveal delay={140} className="lp-about__studiowrap">
          <aside className="lp-about__studio lp-glass" aria-label={ABOUT.studioLabel}>
            <p className="lp-about__studiolabel">{ABOUT.studioLabel}</p>
            <a
              className="lp-about__logo"
              href={CONTACT.studioUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Manhar Creatives (opens manharcreatives.com in a new tab)"
            >
              <ImageSlot
                src="/landing/brand/manhar-creatives-on-ink.jpg"
                alt="Manhar Creatives"
                width={610}
                height={540}
                decorative
                fit="contain"
                fallback="ink"
                fallbackLabel="Manhar Creatives"
              />
            </a>
            <p className="lp-about__tagline">{ABOUT.studioLine}</p>
            <ul className="lp-about__contact" aria-label="Contact Manhar Creatives">
              <li>
                <a href={`mailto:${CONTACT.email}`}>
                  <Icon icon={Mail} size={18} />
                  <span>{CONTACT.email}</span>
                </a>
              </li>
              <li>
                <a href={CONTACT.whatsappUrl} target="_blank" rel="noopener noreferrer">
                  <Icon icon={MessageCircle} size={18} />
                  <span>WhatsApp us</span>
                </a>
              </li>
              <li>
                <p className="lp-about__addr">
                  <Icon icon={MapPin} size={18} />
                  <span>{CONTACT.addressOneLine}</span>
                </p>
              </li>
            </ul>
            <Button href={CONTACT.studioUrl} external variant="secondary" size="sm">
              Visit manharcreatives.com
              <Icon icon={ExternalLink} size={16} />
            </Button>
          </aside>
        </Reveal>
      </div>

      <div className="lp-about__beliefs">
        <p className="lp-about__beliefstitle" id="about-beliefs">
          {ABOUT.beliefsTitle}
        </p>
        <ul className="lp-about__cards" aria-labelledby="about-beliefs">
          {ABOUT.beliefs.map((b, i) => {
            const { lead: l, rest } = splitBelief(b);
            return (
              <li key={b}>
                <Reveal delay={i * 100} className="lp-about__card">
                  <span className="lp-num lp-about__cardno" aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p className="lp-about__cardlead">{l}</p>
                  {rest ? <p className="lp-about__cardrest">{rest}</p> : null}
                </Reveal>
              </li>
            );
          })}
        </ul>
      </div>
    </Section>
  );
}
