import { Button, Icon } from '../components';
import {
  FALLBACK_BUTTONS,
  FALLBACK_LINE,
  buildMailtoUrl,
  buildWhatsAppUrl,
  type RegistrationFormValues,
} from '../content';
import { Mail, MessageCircle } from '../sectionsC/icons';

/**
 * Tier-0 fallback: the same details, prefilled into a WhatsApp message or an email draft that the visitor sends
 * themselves. Built from the values currently in the form, so a failed submit never loses what was typed.
 */
export function FallbackActions({ values }: { values: Partial<RegistrationFormValues> }) {
  return (
    <div className="lp-fallback">
      <p className="lp-fallback__line">{FALLBACK_LINE}</p>
      <div className="lp-fallback__buttons">
        <Button href={buildWhatsAppUrl(values)} external variant="secondary" size="sm">
          <Icon icon={MessageCircle} size={16} /> {FALLBACK_BUTTONS.whatsapp}
          <span className="lp-visually-hidden"> (opens in a new tab)</span>
        </Button>
        <Button href={buildMailtoUrl(values)} variant="secondary" size="sm">
          <Icon icon={Mail} size={16} /> {FALLBACK_BUTTONS.email}
        </Button>
      </div>
    </div>
  );
}
