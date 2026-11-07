import { describe, expect, it } from 'vitest';
import { CONTACT } from '../landing/content/nav';
import { supportWhatsAppUrl } from './support';

describe('support link', () => {
  it('reuses the website number and encodes the message', () => {
    const url = supportWhatsAppUrl('Hello, my email is a@b.com & I need help');
    expect(url.startsWith(`${CONTACT.whatsappUrl}?text=`)).toBe(true);
    expect(url).toContain(encodeURIComponent('a@b.com & I need help'));
  });
});
