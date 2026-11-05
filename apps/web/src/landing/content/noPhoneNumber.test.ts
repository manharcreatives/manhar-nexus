import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTACT } from './nav';
import { SITE } from '../site';
import { FALLBACK_WHATSAPP_LABEL } from './register';

const DIGITS = /97145|71522/;

describe('the company phone number is not published on the website', () => {
  it('is not part of the contact details the pages render', () => {
    expect(Object.keys(CONTACT)).not.toContain('phoneDisplay');
    expect(Object.keys(CONTACT)).not.toContain('phoneTel');
    expect(Object.keys(SITE)).not.toContain('phoneDisplay');
    expect(Object.keys(SITE)).not.toContain('phoneTel');
    expect(FALLBACK_WHATSAPP_LABEL).not.toMatch(DIGITS);
  });

  it('is not in the page shell: structured data and the no-JavaScript text', () => {
    const html = readFileSync(resolve(__dirname, '../../../index.html'), 'utf8');
    expect(html).not.toMatch(DIGITS);
    expect(html).not.toContain('"telephone"');
  });

  it('is not in the SEO structured data', () => {
    const seo = readFileSync(resolve(__dirname, './seo.ts'), 'utf8');
    expect(seo).not.toMatch(DIGITS);
    expect(seo).not.toContain('telephone');
  });
});
