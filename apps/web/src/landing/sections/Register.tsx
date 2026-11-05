import { Suspense, lazy } from 'react';
import { Link } from 'react-router-dom';
import '../styles/w2-base.css';
import '../styles/register.css';
import { Icon, Section } from '../components';
import { SectionHead } from '../sectionsC/SectionHead';
import { CONTACT, REGISTER_HEADER, REGISTER_NEXT_STEPS, REGISTER_NEXT_TITLE } from '../content';
import { RegisterForm } from '../registration/RegisterForm';

// The helper bot pulls in the avatar renderer, so it loads after the form is already usable.
const RegisterBuddy = lazy(() => import('../registration/buddy/RegisterBuddy'));
import { renderHeadline } from '../sectionsC/headline';
import { Mail, MapPin, MessageCircle, Phone, ShieldCheck } from '../sectionsC/icons';

const TRUST_NOTES = [
  'No spam. We use your details only to reply and to set up your Workspace.',
  'No card or UPI PIN here. Payment comes later, on a secure Cashfree page.',
  'Ask us to delete your details at any time.',
] as const;

/**
 * Register: a dark section (1px green top edge) holding the form on a surface card. On phones the order is
 * heading, form, then the trust notes and contact details; from 1024 px the notes sit beside the form.
 */
export default function Register() {
  return (
    <Section id="register" tone="ink" labelledBy="register-title" className="lp-edge-green lp-reg">
      <div className="lp-reg__grid">
        <div className="lp-reg__intro">
          <SectionHead
            eyebrow={REGISTER_HEADER.eyebrow}
            title={renderHeadline(REGISTER_HEADER.headline)}
            titleId="register-title"
            lede={REGISTER_HEADER.subhead}
          />
        </div>

        <div className="lp-reg__form">
          <RegisterForm />
        </div>

        <Suspense fallback={null}>
          <RegisterBuddy />
        </Suspense>

        <aside className="lp-reg__side" aria-label="About your details and how to reach us">
          <ul className="lp-reg__trust">
            {TRUST_NOTES.map((note) => (
              <li key={note}>
                <Icon icon={ShieldCheck} size={18} />
                <span>{note}</span>
              </li>
            ))}
          </ul>
          <p className="lp-reg__privacy">
            Read the{' '}
            <Link to="/privacy" className="lp-link">
              Privacy Policy
            </Link>
            .
          </p>

          <div className="lp-reg__next">
            <h3 className="lp-reg__side-title">{REGISTER_NEXT_TITLE}</h3>
            <ol>
              {REGISTER_NEXT_STEPS.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>

          <div className="lp-reg__contact">
            <h3 className="lp-reg__side-title">Prefer to talk first?</h3>
            <ul>
              <li>
                <Icon icon={MessageCircle} size={18} />
                <a href={CONTACT.whatsappUrl} target="_blank" rel="noopener noreferrer" className="lp-link">
                  WhatsApp {CONTACT.phoneDisplay}
                  <span className="lp-visually-hidden"> (opens in a new tab)</span>
                </a>
              </li>
              <li>
                <Icon icon={Phone} size={18} />
                <a href={CONTACT.phoneTel} className="lp-link">
                  {CONTACT.phoneDisplay}
                </a>
              </li>
              <li>
                <Icon icon={Mail} size={18} />
                <a href={`mailto:${CONTACT.email}`} className="lp-link">
                  {CONTACT.email}
                </a>
              </li>
              <li>
                <Icon icon={MapPin} size={18} />
                <span>{CONTACT.addressOneLine}</span>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </Section>
  );
}
