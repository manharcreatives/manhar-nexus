import { CONTACT } from '../landing/content/nav';

/**
 * The one place the app builds a link to Manhar's support WhatsApp. It reuses the number the website already
 * publishes (landing/content/nav), so a change there changes every help link; no number is written anywhere else.
 */
export function supportWhatsAppUrl(text: string): string {
  return `${CONTACT.whatsappUrl}?text=${encodeURIComponent(text)}`;
}
