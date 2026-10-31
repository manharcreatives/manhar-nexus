import { ExternalLink, IndianRupee, KeyRound, Mail, MapPin, MessageCircle, MessageSquareText, Phone, type LucideIcon } from 'lucide-react';
import { Button, Eyebrow, Heading, Icon, IconTile, ImageSlot, Reveal, Section } from '../components';
import { ABOUT, CONTACT } from '../content';
import { mapWords } from './sectionsA.shared';
import '../styles/about.css';

const BELIEF_ICONS: readonly LucideIcon[] = [KeyRound, MessageSquareText, IndianRupee];

/**
 * Only fields the content module marks publishable are rendered: paragraphs flagged `ownerConfirm` (claims about the
 * studio's experience around restaurants) stay out until the owner confirms them, as does the founder signature
 * until `signature.ownerApproved` is true. `internalNote` is never rendered.
 */
const PUBLISHABLE = ABOUT.paragraphs.filter((p) => !p.ownerConfirm).map((p) => p.text);

/** Splits the last sentence off a paragraph so it can be set as the pull-quote (no duplicated copy). */
function splitPullQuote(text: string): { body: string; quote: string } {
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)/g)?.map((s) => s.trim()) ?? [];
  if (sentences.length < 3) return { body: text, quote: '' };
  return { body: sentences.slice(0, -1).join(' '), quote: sentences[sentences.length - 1] };
}

function splitBelief(text: string): { lead: string; rest: string } {
  const m = text.match(/^(.+?[.!?])\s+(.+)$/);
  return m ? { lead: m[1], rest: m[2] } : { lead: text, rest: '' };
}

const heading = (
  <>
    {mapWords(ABOUT.header.headline.text, ABOUT.header.headline.accent, (node) => node)}
  </>
);

/** About: who builds Nexus. Honest, no invented history. Light Grey alternate section with an Ink studio panel. */
export default function About() {
  const last = PUBLISHABLE[PUBLISHABLE.length - 1] ?? '';
  const { body, quote } = splitPullQuote(last);
  const lead = PUBLISHABLE.slice(0, -1);

  return (
    <Section id="about" tone="alt" labelledBy="about-title" className="lp-about">
      <div className="lp-about__head">
        <Eyebrow className="lp-about__eyebrow">{ABOUT.header.eyebrow}</Eyebrow>
        <Heading level={2} id="about-title" className="lp-about__h2">
          {heading}
        </Heading>
      </div>

      <div className="lp-about__grid">
        <div className="lp-about__story">
          <Reveal>
            <div className="lp-about__prose">
              {lead.map((t) => (
                <p key={t}>{t}</p>
              ))}
              {body ? <p>{body}</p> : null}
            </div>
          </Reveal>
          {quote ? (
            <Reveal delay={100}>
              <blockquote className="lp-about__quote">
                <p>{quote}</p>
              </blockquote>
            </Reveal>
          ) : null}
          <Reveal delay={160}>
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

        <Reveal delay={120} className="lp-about__studiowrap">
          <aside className="lp-about__studio" aria-label={ABOUT.studioLabel}>
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
            <p className="lp-about__reach">{CONTACT.reach}</p>
            <ul className="lp-about__contact" aria-label="Contact Manhar Creatives">
              <li>
                <a href={`mailto:${CONTACT.email}`}>
                  <Icon icon={Mail} size={18} />
                  <span>{CONTACT.email}</span>
                </a>
              </li>
              <li>
                <a href={CONTACT.phoneTel}>
                  <Icon icon={Phone} size={18} />
                  <span>{CONTACT.phoneDisplay}</span>
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
            <div className="lp-about__studioactions">
              <Button href={CONTACT.studioUrl} external variant="secondary" tone="dark">
                Visit manharcreatives.com
                <Icon icon={ExternalLink} size={16} />
              </Button>
              <ul className="lp-about__social">
                {CONTACT.social.map((s) => (
                  <li key={s.href}>
                    <a href={s.href} target="_blank" rel="noopener noreferrer">
                      {s.text}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
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
                  <div className="lp-about__cardtop">
                    <IconTile icon={BELIEF_ICONS[i % BELIEF_ICONS.length]} size={20} />
                    <span className="lp-num lp-about__cardno" aria-hidden="true">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  </div>
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

