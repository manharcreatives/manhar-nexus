import { Suspense } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FAILURE_MESSAGES,
  FAQS,
  FAQ_FEATURED_IDS,
  INSIGHTS_FEATURED_SLUGS,
  LEGAL_DOCUMENTS,
  LEGAL_UI,
  POSTS,
  QR_MENU_LIVE,
  QR_MENU_NAME,
  TERMS,
  faqPageJsonLd,
  getLegalDocumentByPath,
  getPost,
  type LegalBlock,
} from '../content';
import { getRegistrationIntent, resetRegistrationIntent } from '../hooks/useRegistrationIntent';
import { POLICY_ROUTES } from '../paths';
import { LANDING_ROUTES } from '../routes';
import { filterFaqs, isPublishableAnswer, publishableFaqJsonLd, topicCounts } from '../faq/faqLogic';
import { countPlaceholders } from '../pages/LegalBody';
import ArticlePage from '../pages/ArticlePage';
import LegalPage from '../pages/LegalPage';
import CtaBanner from './CtaBanner';
import Faq from './Faq';
import Insights from './Insights';
import Pricing from './Pricing';
import Register from './Register';

const OPEN = '2026-12-01T10:00:00+05:30';
const UPCOMING = '2026-10-31T10:00:00+05:30';
const CLOSED = '2027-03-01T10:00:00+05:30';

function at(iso: string): void {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(iso));
}

function inRouter(ui: React.ReactElement, path = '/') {
  return render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>);
}

/** Pricing keeps comparison, fees and payment details inside native <details>; open them so role queries see them. */
function openDisclosures(root: ParentNode = document): void {
  root.querySelectorAll('details').forEach((d) => d.setAttribute('open', ''));
}

beforeEach(() => {
  resetRegistrationIntent();
  window.history.pushState({}, '', '/');
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.head.querySelectorAll('[data-lp-ld]').forEach((n) => n.remove());
});

/* ───────────────────────────────── Pricing ───────────────────────────────── */

describe('Pricing', () => {
  const card = (container: HTMLElement, key: string): HTMLElement => container.querySelector<HTMLElement>(`[data-plan="${key}"]`) as HTMLElement;

  it('keeps the section contract: id, aria-labelledby and exactly one h2', () => {
    at(OPEN);
    const { container } = inRouter(<Pricing />);
    const section = container.querySelector('section#pricing');
    expect(section?.getAttribute('aria-labelledby')).toBe('pricing-title');
    expect(document.getElementById('pricing-title')?.tagName).toBe('H2');
    expect(container.querySelectorAll('h2')).toHaveLength(1);
  });

  it('renders three priced plans and the Many Doors enquiry card with real prices from plans.ts', () => {
    at(CLOSED);
    const { container } = inRouter(<Pricing />);
    expect(container.querySelectorAll('[data-plan]')).toHaveLength(4);
    expect(card(container, 'counter').textContent).toContain('₹5,990');
    expect(card(container, 'floor').textContent).toContain('₹12,990');
    expect(card(container, 'pass').textContent).toContain('₹24,990');
    expect(card(container, 'many-doors').textContent).toContain('Let’s talk');
    expect(card(container, 'many-doors').textContent).not.toMatch(/₹\d/);
  });

  it('has an accessible monthly/yearly radiogroup that defaults to yearly and drives the shared intent', () => {
    at(CLOSED);
    const { container } = inRouter(<Pricing />);
    const group = screen.getByRole('radiogroup', { name: 'Billing period' });
    const [monthly, yearly] = within(group).getAllByRole('radio') as HTMLInputElement[];
    expect(yearly?.checked).toBe(true);
    expect(monthly?.checked).toBe(false);
    fireEvent.click(monthly as HTMLInputElement);
    expect(getRegistrationIntent().cycle).toBe('monthly');
    expect(card(container, 'floor').textContent).toContain('₹1,299');
    expect(card(container, 'floor').textContent).not.toContain('₹12,990');
    expect(card(container, 'counter').textContent).toContain('₹599');
    expect(card(container, 'pass').textContent).toContain('₹2,499');
    fireEvent.click(yearly as HTMLInputElement);
    expect(getRegistrationIntent().cycle).toBe('yearly');
    expect(card(container, 'floor').textContent).toContain('₹12,990');
  });

  it('explains that yearly means 10 months paid', () => {
    at(CLOSED);
    inRouter(<Pricing />);
    expect(screen.getByText(/Yearly = 10 months paid/)).toBeTruthy();
  });

  it('shows GST-inclusive prices to the paisa when the switch is on, and says so in words', () => {
    at(CLOSED);
    const { container } = inRouter(<Pricing />);
    fireEvent.click(screen.getByRole('radio', { name: /^Monthly/ }));
    const sw = screen.getByRole('switch', { name: /Show prices with 18% GST/ });
    expect((sw as HTMLInputElement).checked).toBe(false);
    expect(card(container, 'floor').textContent).toContain('+ GST');
    fireEvent.click(sw);
    expect((sw as HTMLInputElement).checked).toBe(true);
    expect(card(container, 'floor').textContent).toContain('₹1,532.82');
    expect(card(container, 'floor').textContent).toContain('incl. 18% GST');
    expect(card(container, 'counter').textContent).toContain('₹706.82');
    expect(card(container, 'floor').querySelector('.lp-visually-hidden')?.textContent).toMatch(/including 18 percent GST/);
  });

  it('gives every card the same price-block structure in both cycles (no layout shift on toggle)', () => {
    at(OPEN);
    const { container } = inRouter(<Pricing />);
    const shape = (): string[] =>
      Array.from(container.querySelectorAll('.lp-plan__price')).map((el) => Array.from(el.children).map((c) => c.className).join('|'));
    const yearly = shape();
    fireEvent.click(screen.getByRole('radio', { name: /^Monthly/ }));
    const monthly = shape();
    expect(yearly).toEqual(monthly);
    expect(new Set(yearly).size).toBe(1);
    expect(yearly[0]?.split('|')).toHaveLength(4);
  });

  it('choosing a plan writes plan + cycle to the registration intent and points at #register', () => {
    at(CLOSED);
    inRouter(<Pricing />);
    const floor = screen.getByRole('link', { name: /Start with Floor/ });
    expect(floor.getAttribute('href')).toBe('#register');
    fireEvent.click(floor);
    expect(getRegistrationIntent()).toMatchObject({ plan: 'floor', cycle: 'yearly', begin: 'register' });

    fireEvent.click(screen.getByRole('radio', { name: /^Monthly/ }));
    fireEvent.click(screen.getByRole('link', { name: /Start with Pass/ }));
    expect(getRegistrationIntent()).toMatchObject({ plan: 'pass', cycle: 'monthly' });

    fireEvent.click(screen.getByRole('link', { name: /Talk to us/ }));
    expect(getRegistrationIntent().plan).toBe('many-doors');

    fireEvent.click(screen.getByRole('link', { name: /Book a live demo/ }));
    expect(getRegistrationIntent().begin).toBe('demo');
  });

  it('plan buttons link to the home page section from a policy page', () => {
    at(CLOSED);
    inRouter(<Pricing />, '/terms');
    expect(screen.getByRole('link', { name: /Start with Counter/ }).getAttribute('href')).toBe('/#register');
  });

  describe('Founding Restaurants offer follows the IST window', () => {
    it('open: banner with the exact window, strike-through list price and founding price', () => {
      at(OPEN);
      const { container } = inRouter(<Pricing />);
      expect(screen.getByRole('heading', { level: 3, name: 'Founding Restaurants' })).toBeTruthy();
      expect(screen.getByText('Open now')).toBeTruthy();
      expect(screen.getByText('1 Nov 2026 – 31 Jan 2027, 11:59 pm IST')).toBeTruthy();
      expect(card(container, 'floor').querySelector('s')?.textContent).toContain('₹12,990');
      expect(card(container, 'floor').textContent).toContain('₹9,740');
      expect(card(container, 'floor').textContent).toContain('Founding price');
      // monthly is not discounted
      fireEvent.click(screen.getByRole('radio', { name: /^Monthly/ }));
      expect(card(container, 'floor').querySelector('s')).toBeNull();
    });

    it('upcoming (today, 31 Oct 2026): says it opens, shows no discounted prices', () => {
      at(UPCOMING);
      const { container } = inRouter(<Pricing />);
      expect(screen.getByText('Opens soon')).toBeTruthy();
      expect(screen.getByText(/OPENS 1 NOV 2026/)).toBeTruthy();
      expect(card(container, 'floor').querySelector('s')).toBeNull();
      expect(card(container, 'floor').textContent).not.toContain('₹9,740');
    });

    it('closed: renders nothing about the offer', () => {
      at(CLOSED);
      const { container } = inRouter(<Pricing />);
      expect(screen.queryByRole('heading', { name: 'Founding Restaurants' })).toBeNull();
      expect(container.querySelector('.lp-founding')).toBeNull();
      expect(card(container, 'floor').querySelector('s')).toBeNull();
      expect(card(container, 'pass').textContent).not.toMatch(/Founding/);
    });
  });

  it('makes no fake social proof', () => {
    at(OPEN);
    const { container } = inRouter(<Pricing />);
    expect(container.textContent).not.toMatch(/most chosen|most popular|trusted by|customers love/i);
  });

  it('lifts the middle plan with a brand-gradient edge and gives every plan at most five bullets', () => {
    at(CLOSED);
    const { container } = inRouter(<Pricing />);
    const cards = Array.from(container.querySelectorAll<HTMLElement>('[data-plan]'));
    const featured = cards.filter((c) => c.classList.contains('lp-plan--featured'));
    expect(featured.map((c) => c.getAttribute('data-plan'))).toEqual(['floor']);
    expect(featured[0]?.classList.contains('w2-glow-edge')).toBe(true);
    // the featured card is the second of the three priced cards (the middle one)
    expect(cards.slice(0, 3).indexOf(featured[0] as HTMLElement)).toBe(1);
    for (const c of cards) expect(c.querySelectorAll('.lp-plan__features li').length).toBeLessThanOrEqual(5);
  });

  it('puts Many Doors in a wide enquiry card, outside the priced grid, with one call to action', () => {
    at(CLOSED);
    const { container } = inRouter(<Pricing />);
    const grid = container.querySelector('.lp-plans') as HTMLElement;
    expect(grid.querySelector('[data-plan="many-doors"]')).toBeNull();
    const enquiry = container.querySelector('.lp-plans__wide [data-plan="many-doors"]') as HTMLElement;
    expect(enquiry).not.toBeNull();
    expect(enquiry.querySelectorAll('a.lp-btn')).toHaveLength(1);
  });

  it('keeps compare plans, fees and payment details in three closed disclosures', () => {
    at(CLOSED);
    const { container } = inRouter(<Pricing />);
    const discs = Array.from(container.querySelectorAll<HTMLDetailsElement>('.lp-pricing__discs > details'));
    expect(discs.map((d) => d.querySelector('summary .w2-disc__title')?.textContent)).toEqual([
      'Compare plans',
      'Setup and add-ons',
      'Trying it, paying, and billing',
    ]);
    expect(discs.every((d) => !d.open)).toBe(true);
  });

  it('mentions Nexus Menu as included in every plan when the flag is on', () => {
    at(CLOSED);
    const { container } = inRouter(<Pricing />);
    expect(QR_MENU_LIVE).toBe(true);
    expect(card(container, 'counter').textContent).toContain(`${QR_MENU_NAME}: QR menu and table ordering`);
    expect(container.textContent).toContain(`${QR_MENU_NAME}: QR menu and table ordering, in every plan`);
  });

  it('has a real comparison table with caption, column headers, row headers and row groups', () => {
    at(CLOSED);
    inRouter(<Pricing />);
    openDisclosures();
    const table = screen.getByRole('table', { name: 'Plan comparison' });
    expect(within(table).getAllByRole('columnheader')).toHaveLength(5);
    expect(within(table).getAllByRole('rowheader').length).toBeGreaterThan(15);
    expect(table.querySelectorAll('th[scope="rowgroup"]').length).toBeGreaterThanOrEqual(4);
    expect(table.querySelector('caption')).not.toBeNull();
    // yes/no cells are readable without colour or icons
    expect(within(table).getAllByText('Included').length).toBeGreaterThan(10);
    expect(within(table).getAllByText('Not included').length).toBeGreaterThan(2);
    const region = table.closest('[role="region"]');
    expect(region?.getAttribute('tabindex')).toBe('0');
  });

  it('labels roadmap items as Coming soon and does not sell them', () => {
    at(CLOSED);
    inRouter(<Pricing />);
    expect(screen.getAllByText('Coming soon').length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText(/Printer & kitchen-ticket setup/)).toBeTruthy();
  });

  it('lists onboarding fees and add-ons as tables', () => {
    at(CLOSED);
    inRouter(<Pricing />);
    openDisclosures();
    expect(screen.getByRole('table', { name: /Onboarding \(one-time\), prices exclude GST/ })).toBeTruthy();
    expect(screen.getByRole('table', { name: /Add-ons, prices exclude GST/ })).toBeTruthy();
    expect(screen.getByText('₹3,499')).toBeTruthy();
  });

  it('explains how payment works honestly and marks the Cashfree integration point', () => {
    at(CLOSED);
    const { container } = inRouter(<Pricing />);
    openDisclosures();
    expect(screen.getByRole('heading', { level: 3, name: 'How payment works' })).toBeTruthy();
    const pay = container.querySelector('[data-integration="cashfree-subscription"]');
    expect(pay).not.toBeNull();
    expect(pay?.textContent).toContain(FAILURE_MESSAGES.interim);
    expect(container.textContent).toMatch(/Nothing is charged on this page/);
    expect(container.textContent).not.toMatch(/\bPAID\b/);
  });

  it('shows the 14-day guarantee and pilot/demo options and a five-question billing mini FAQ', () => {
    at(CLOSED);
    const { container } = inRouter(<Pricing />);
    expect(container.textContent).toMatch(/14 days of your Workspace being activated/);
    expect(screen.getByText('14-day pilot')).toBeTruthy();
    expect(container.querySelectorAll('.lp-acc__btn')).toHaveLength(5);
  });
});

/* ───────────────────────────────── Register section ───────────────────────────────── */

describe('Register section', () => {
  it('keeps the contract and shows trust notes, privacy link and contact details beside the form', () => {
    at(CLOSED);
    const { container } = inRouter(<Register />);
    const section = container.querySelector('section#register');
    expect(section?.getAttribute('aria-labelledby')).toBe('register-title');
    expect(section?.className).toContain('lp-edge-green');
    expect(container.querySelectorAll('h2')).toHaveLength(1);
    expect(container.querySelector('form')).not.toBeNull();
    expect(screen.getByText(/No spam/)).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /Privacy Policy/ }).length).toBeGreaterThanOrEqual(1);
    expect(container.querySelector('a[href="mailto:info@manharcreatives.com"]')).not.toBeNull();
    // The company's phone number is not shown on the site (the WhatsApp link stays, without printing the number).
    expect(container.querySelector('a[href^="tel:"]')).toBeNull();
    expect(container.textContent).not.toContain('97145');
    const wa = container.querySelector('a[href="https://wa.me/919714571522"]');
    expect(wa?.getAttribute('target')).toBe('_blank');
    expect(wa?.getAttribute('rel')).toContain('noopener');
  });
});

/* ───────────────────────────────── FAQ ───────────────────────────────── */

describe('Faq', () => {
  const buttons = (container: HTMLElement): HTMLButtonElement[] => Array.from(container.querySelectorAll<HTMLButtonElement>('button.lp-acc__btn'));
  const moreBtn = (): HTMLButtonElement => screen.getByRole('button', { name: /^(More questions|Show fewer questions)/ });

  it('keeps the contract and shows only the five featured questions, in order', () => {
    const { container } = inRouter(<Faq />);
    expect(container.querySelector('section#faq')?.getAttribute('aria-labelledby')).toBe('faq-title');
    expect(container.querySelectorAll('h2')).toHaveLength(1);
    expect(FAQ_FEATURED_IDS).toHaveLength(5);
    expect(buttons(container).map((b) => b.id)).toEqual(FAQ_FEATURED_IDS.map((id) => `faq-q-${id}`));
  });

  it('reveals the remaining questions behind “More questions” and hides them again', () => {
    const { container } = inRouter(<Faq />);
    const rest = FAQS.length - FAQ_FEATURED_IDS.length;
    const more = moreBtn();
    expect(more.textContent).toContain(`(${rest})`);
    expect(more.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(more);
    expect(buttons(container)).toHaveLength(FAQS.length);
    expect(moreBtn().getAttribute('aria-expanded')).toBe('true');
    expect(moreBtn().textContent).toBe('Show fewer questions');
    fireEvent.click(moreBtn());
    expect(buttons(container)).toHaveLength(FAQ_FEATURED_IDS.length);
  });

  it('accordion buttons expose aria-expanded / aria-controls and toggle (several can be open)', () => {
    const { container } = inRouter(<Faq />);
    const [first, second] = buttons(container);
    expect(first?.getAttribute('aria-expanded')).toBe('false');
    const panelId = first?.getAttribute('aria-controls') ?? '';
    const panel = document.getElementById(panelId);
    expect(panel?.getAttribute('role')).toBe('region');
    expect(panel?.getAttribute('aria-labelledby')).toBe(first?.id);
    fireEvent.click(first as HTMLButtonElement);
    fireEvent.click(second as HTMLButtonElement);
    expect(first?.getAttribute('aria-expanded')).toBe('true');
    expect(second?.getAttribute('aria-expanded')).toBe('true');
    expect(panel?.getAttribute('data-open')).toBe('true');
    fireEvent.click(first as HTMLButtonElement);
    expect(first?.getAttribute('aria-expanded')).toBe('false');
  });

  it('moves focus between questions with the arrow, Home and End keys', () => {
    const { container } = inRouter(<Faq />);
    const all = buttons(container);
    all[0]?.focus();
    fireEvent.keyDown(all[0] as HTMLButtonElement, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(all[1]);
    fireEvent.keyDown(all[1] as HTMLButtonElement, { key: 'End' });
    expect(document.activeElement).toBe(all[all.length - 1]);
    fireEvent.keyDown(all[all.length - 1] as HTMLButtonElement, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(all[0]);
    fireEvent.keyDown(all[0] as HTMLButtonElement, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(all[all.length - 1]);
  });

  it('opens the question named by #faq-<id> (also one behind “More”) and scrolls to it', async () => {
    window.history.pushState({}, '', '/#faq-gst');
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    const { container } = inRouter(<Faq />);
    expect(FAQ_FEATURED_IDS).not.toContain('gst');
    const gst = container.querySelector<HTMLButtonElement>('#faq-q-gst');
    expect(gst?.getAttribute('aria-expanded')).toBe('true');
    expect(moreBtn().getAttribute('aria-expanded')).toBe('true');
    await waitFor(() => expect(scroll).toHaveBeenCalled());
    // a later hash change opens another one
    act(() => {
      window.history.pushState({}, '', '/#faq-refund-policy');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(container.querySelector('#faq-q-refund-policy')?.getAttribute('aria-expanded')).toBe('true');
  });

  it('ignores unknown hashes and keeps “More” closed', () => {
    window.history.pushState({}, '', '/#faq-not-a-question');
    const { container } = inRouter(<Faq />);
    expect(buttons(container).every((b) => b.getAttribute('aria-expanded') === 'false')).toBe(true);
    expect(moreBtn().getAttribute('aria-expanded')).toBe('false');
  });

  it('lists every question in the FAQPage JSON-LD (not only the five on screen), and removes it on unmount', () => {
    const { unmount } = inRouter(<Faq />);
    const script = document.head.querySelector('script[data-lp-ld="faq"]');
    expect(script?.getAttribute('type')).toBe('application/ld+json');
    const data = JSON.parse(script?.textContent ?? '{}') as { '@type': string; mainEntity: { name: string; acceptedAnswer: { text: string } }[] };
    expect(data['@type']).toBe('FAQPage');
    expect(data.mainEntity).toHaveLength(FAQS.length);
    expect(data.mainEntity[0]?.name).toBe(FAQS[0]?.question);
    expect(data.mainEntity[0]?.acceptedAnswer.text).toBe(FAQS[0]?.answer);
    unmount();
    expect(document.head.querySelector('script[data-lp-ld="faq"]')).toBeNull();
  });

  it('structured data equals the content builder and excludes answers with owner placeholders', () => {
    expect(publishableFaqJsonLd()).toEqual(faqPageJsonLd());
    const leaky = { ...FAQS[0]!, answer: 'Call [SUPPORT PHONE] today.' };
    expect(isPublishableAnswer(leaky)).toBe(false);
    expect(isPublishableAnswer({ ...FAQS[0]!, answer: 'Owner: add languages.' })).toBe(false);
    const ld = publishableFaqJsonLd([leaky, FAQS[1]!]) as { mainEntity: unknown[] };
    expect(ld.mainEntity).toHaveLength(1);
  });

  it('filter helpers still work (used by the pricing billing mini-FAQ and future search)', () => {
    const expected = filterFaqs(FAQS, 'refund', 'all');
    expect(expected.length).toBeGreaterThan(0);
    expect(expected.length).toBeLessThan(FAQS.length);
    expect(filterFaqs(FAQS, 'zzzz-nothing', 'all')).toHaveLength(0);
    expect(topicCounts().billing).toBe(5);
    expect(filterFaqs(FAQS, '', 'billing')).toHaveLength(5);
  });

  it('never renders internal notes', () => {
    const { container } = inRouter(<Faq />);
    fireEvent.click(moreBtn());
    for (const f of FAQS) {
      if (f.internalNote) expect(container.textContent).not.toContain(f.internalNote.slice(0, 40));
    }
  });
});

/* ───────────────────────────────── Insights ───────────────────────────────── */

describe('Insights', () => {
  it('shows exactly three article cards, each with a real link, category, read time and date', () => {
    const { container } = inRouter(<Insights />);
    expect(container.querySelector('section#insights')?.getAttribute('aria-labelledby')).toBe('insights-title');
    expect(container.querySelectorAll('h2')).toHaveLength(1);
    const expected = INSIGHTS_FEATURED_SLUGS.map((slug) => getPost(slug)?.path);
    expect(expected).toHaveLength(3);
    const links = Array.from(container.querySelectorAll<HTMLAnchorElement>('a.lp-post__link'));
    expect(links.map((a) => a.getAttribute('href'))).toEqual(expected);
    expect(container.querySelectorAll('article')).toHaveLength(3);
    expect(container.querySelectorAll('article time')).toHaveLength(3);
    expect(container.textContent).toMatch(/\d+ min read/);
  });

  it('keeps the other articles one click away behind “More articles”', () => {
    const { container } = inRouter(<Insights />);
    const disc = container.querySelector('details.w2-disc') as HTMLDetailsElement;
    expect(disc.querySelector('summary')?.textContent).toContain('More articles');
    expect(disc.open).toBe(false);
    const hrefs = Array.from(disc.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    const rest = POSTS.filter((p) => !INSIGHTS_FEATURED_SLUGS.includes(p.slug)).map((p) => p.path);
    expect(hrefs).toEqual(rest);
    // every article is reachable from the home page
    const all = new Set([...container.querySelectorAll<HTMLAnchorElement>('a.lp-post__link')].map((a) => a.getAttribute('href')).concat(hrefs));
    expect(all.size).toBe(POSTS.length);
  });

  it('stays typographic when a cover photo is missing', () => {
    const { container } = inRouter(<Insights />);
    const photos = Array.from(container.querySelectorAll('img.lp-post__photo'));
    expect(photos.length).toBe(3);
    fireEvent.error(photos[0] as Element);
    expect(container.querySelectorAll('img.lp-post__photo')).toHaveLength(2);
    expect(container.querySelectorAll('.lp-post__numeral')).toHaveLength(3);
  });
});

/* ───────────────────────────────── CTA banner ───────────────────────────────── */

describe('CtaBanner', () => {
  it('is an Ink banner with a green top edge, one h2, a register button and a demo button', () => {
    at(OPEN);
    const { container } = inRouter(<CtaBanner />);
    const section = container.querySelector('section#cta');
    expect(section?.className).toContain('lp-edge-green');
    expect(section?.getAttribute('aria-labelledby')).toBe('cta-title');
    expect(container.querySelectorAll('h2')).toHaveLength(1);
    expect(container.querySelectorAll('h2 .lp-accent')).toHaveLength(1);
    const primary = screen.getByRole('link', { name: /Register your restaurant/ });
    expect(primary.getAttribute('href')).toBe('#register');
    fireEvent.click(screen.getByRole('link', { name: /Book a live demo/ }));
    expect(getRegistrationIntent().begin).toBe('demo');
    fireEvent.click(primary);
    expect(getRegistrationIntent().begin).toBe('register');
  });

  it('opens WhatsApp in a new tab safely', () => {
    at(OPEN);
    inRouter(<CtaBanner />);
    const wa = screen.getByRole('link', { name: /WhatsApp us/ });
    expect(wa.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/919714571522/);
    expect(wa.getAttribute('target')).toBe('_blank');
    expect(wa.getAttribute('rel')).toContain('noopener');
  });

  it('mentions the Founding offer only while it can still be used', () => {
    at(OPEN);
    const open = inRouter(<CtaBanner />);
    expect(open.container.textContent).toMatch(/Founding Restaurants offer until 31 Jan 2027/);
    open.unmount();
    at(CLOSED);
    const closed = inRouter(<CtaBanner />);
    expect(closed.container.textContent).not.toMatch(/Founding/);
    expect(closed.container.textContent).toMatch(/14-day money-back guarantee/);
  });
});

/* ───────────────────────────────── Article pages ───────────────────────────────── */

function renderArticle(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/insights/${slug}`]}>
      <Routes>
        <Route path="/insights/:slug" element={<ArticlePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ArticlePage', () => {
  const post = POSTS[0]!;

  it('renders the article: h1, meta, body headings, contents, JSON-LD and document title', () => {
    const { container } = renderArticle(post.slug);
    expect(screen.getByRole('heading', { level: 1, name: post.title })).toBeTruthy();
    expect(document.title).toBe(post.seoTitle);
    const h2s = post.body.flatMap((b) => (b.type === 'h2' ? [b.text] : []));
    for (const text of h2s) expect(screen.getByRole('heading', { level: 2, name: text })).toBeTruthy();

    const toc = screen.getByRole('navigation', { name: 'In this article' });
    const links = Array.from(toc.querySelectorAll('a'));
    expect(links).toHaveLength(h2s.length);
    for (const a of links) {
      const id = (a.getAttribute('href') ?? '').slice(1);
      expect(document.getElementById(id)?.tagName).toBe('H2');
    }
    expect(container.querySelector('time')?.getAttribute('datetime')).toBe(post.publishedAt);
    expect(container.textContent).toContain(`${post.readMinutes} min read`);

    const ld = JSON.parse(document.head.querySelector('script[data-lp-ld="article"]')?.textContent ?? '{}') as { '@type': string; headline: string };
    expect(ld['@type']).toBe('BlogPosting');
    expect(ld.headline).toBe(post.title);
  });

  it('every article in posts.ts renders without a 404 and with an h1', () => {
    for (const p of POSTS) {
      const view = renderArticle(p.slug);
      expect(screen.getByRole('heading', { level: 1, name: p.title })).toBeTruthy();
      view.unmount();
    }
  });

  it('has a reading-progress bar, a share row that copies the link, and a CTA to #register', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { container } = renderArticle(post.slug);
    const bar = container.ownerDocument.querySelector<HTMLElement>('.lp-progress');
    expect(bar?.getAttribute('aria-hidden')).toBe('true');
    expect(bar?.style.getPropertyValue('--p')).toBe('0');

    fireEvent.click(screen.getByRole('button', { name: /Copy link/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}${post.path}`));
    expect(await screen.findByText('Link copied.')).toBeTruthy();

    const wa = within(container.querySelector('.lp-share') as HTMLElement).getByRole('link', { name: /WhatsApp/ });
    expect(wa.getAttribute('href')).toContain('https://wa.me/?text=');

    const cta = container.querySelector('.lp-article__cta') as HTMLElement;
    expect(within(cta).getByRole('link', { name: /Register your restaurant/ }).getAttribute('href')).toBe('/#register');
  });

  it('links to the previous and next article', () => {
    renderArticle(POSTS[0]!.slug);
    expect(screen.queryByRole('link', { name: /Previous/ })).toBeNull();
    expect(screen.getByRole('link', { name: new RegExp(`Next.*${escapeRe(POSTS[1]!.title)}`) }).getAttribute('href')).toBe(POSTS[1]!.path);
    cleanup();
    renderArticle(POSTS[1]!.slug);
    expect(screen.getByRole('link', { name: /Previous/ }).getAttribute('href')).toBe(POSTS[0]!.path);
  });

  it('shows a calm 404 state for an unknown slug, with a way home, and asks search engines to skip it', () => {
    renderArticle('this-article-does-not-exist');
    expect(screen.getByRole('heading', { level: 1, name: 'We couldn’t find that article' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /See all insights/ }).getAttribute('href')).toBe('/#insights');
    expect(screen.getByRole('link', { name: 'Back to Manhar Nexus' }).getAttribute('href')).toBe('/');
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex,follow');
    expect(document.head.querySelector('script[data-lp-ld="article"]')).toBeNull();
  });
});

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ───────────────────────────────── Legal pages ───────────────────────────────── */

function blockTexts(block: LegalBlock): string[] {
  switch (block.type) {
    case 'p':
    case 'clause':
    case 'callout':
      return [block.text];
    case 'ul':
    case 'ol':
      return [...block.items];
    case 'table':
      return block.rows.flat();
  }
}

describe('LegalPage', () => {
  it.each(LEGAL_DOCUMENTS.map((d) => [d.path, d.title] as const))('%s renders its title as the single h1', (path, title) => {
    const doc = getLegalDocumentByPath(path)!;
    const { container } = inRouter(<LegalPage path={path} />, path);
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeTruthy();
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container.textContent).toContain(`Last updated ${doc.lastUpdated}`);
    expect(container.textContent).toContain(doc.summary);
    expect(document.title).toContain(doc.title);
  });

  it('has one anchored section per clause group and a contents list that points at them', () => {
    for (const doc of LEGAL_DOCUMENTS) {
      const { container, unmount } = inRouter(<LegalPage path={doc.path} />, doc.path);
      const toc = screen.queryByRole('navigation', { name: LEGAL_UI.onThisPage });
      // A one-section document needs no contents list; anything longer must have one.
      if (doc.sections.length < 2) expect(toc, doc.path).toBeNull();
      else expect(toc, doc.path).not.toBeNull();
      const links = Array.from(toc?.querySelectorAll('a') ?? []);
      expect(links).toHaveLength(doc.sections.length < 2 ? 0 : doc.sections.length);
      links.forEach((a, i) => {
        const id = (a.getAttribute('href') ?? '').slice(1);
        expect(id).toBe(doc.sections[i]?.id);
        const target = container.querySelector(`section[id="${id}"]`);
        expect(target, `${doc.path} #${id}`).not.toBeNull();
        expect(target?.querySelector('h2')?.textContent).toBe(doc.sections[i]?.heading);
      });
      expect(new Set(doc.sections.map((s) => s.id)).size).toBe(doc.sections.length);
      unmount();
    }
  });

  it('the contents control is a disclosure on small screens and a list on wide ones (one nav)', () => {
    inRouter(<LegalPage path="/terms" />, '/terms');
    const toggle = screen.getByRole('button', { name: /On this page/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getAllByRole('navigation', { name: LEGAL_UI.onThisPage })).toHaveLength(1);
  });

  it('highlights every [placeholder] token with a title hint', () => {
    for (const doc of LEGAL_DOCUMENTS) {
      const { container, unmount } = inRouter(<LegalPage path={doc.path} />, doc.path);
      const expected = [...doc.intro, ...doc.sections.flatMap((s) => s.blocks)].flatMap(blockTexts).reduce((n, t) => n + countPlaceholders(t), 0);
      const marks = Array.from(container.querySelectorAll('mark.lp-ph'));
      expect(marks).toHaveLength(expected);
      for (const m of marks) {
        expect(m.textContent).toMatch(/^\[.+\]$/);
        expect(m.getAttribute('title')).toMatch(/Placeholder/);
      }
      unmount();
    }
    inRouter(<LegalPage path={TERMS.path} />, TERMS.path);
    expect(document.querySelectorAll('mark.lp-ph').length).toBeGreaterThan(0);
  });

  it('never renders the drafting note', () => {
    for (const doc of LEGAL_DOCUMENTS) {
      const { container, unmount } = inRouter(<LegalPage path={doc.path} />, doc.path);
      if (doc.internalNote.length > 20) expect(container.textContent).not.toContain(doc.internalNote.slice(0, 50));
      expect(container.textContent).not.toMatch(/internal ?note/i);
      unmount();
    }
  });

  it('links to the other five policies', () => {
    const { container } = inRouter(<LegalPage path="/privacy" />, '/privacy');
    const others = container.querySelector('.lp-legal__others');
    expect(others?.querySelectorAll('a')).toHaveLength(LEGAL_DOCUMENTS.length - 1);
    expect(others?.querySelector('a[href="/privacy"]')).toBeNull();
  });

  it('renders a calm not-found for a path with no document', () => {
    inRouter(<LegalPage path="/nope" />, '/nope');
    expect(screen.getByRole('heading', { level: 1, name: 'We couldn’t find that page' })).toBeTruthy();
  });
});

/* ───────────────────────────────── Route table ───────────────────────────────── */

describe('route table', () => {
  function renderRoutes(path: string) {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <Suspense fallback={null}>
          <Routes>
            {LANDING_ROUTES.map((r) => (
              <Route key={r.path} path={r.path} element={r.element} />
            ))}
          </Routes>
        </Suspense>
      </MemoryRouter>,
    );
  }

  it('declares every policy path, the article path and the legacy redirects', () => {
    const paths = LANDING_ROUTES.map((r) => r.path);
    for (const r of POLICY_ROUTES) expect(paths).toContain(r.path);
    expect(paths).toContain('/insights/:slug');
    expect(paths).toContain('/blog/:slug');
    for (const alias of ['/refund-cancellation', '/billing-payments', '/dpa', '/insights']) expect(paths).toContain(alias);
  });

  it.each(POLICY_ROUTES.map((r) => r.path))('lazy-loads %s and shows the document title', async (path) => {
    const doc = getLegalDocumentByPath(path)!;
    renderRoutes(path);
    expect(await screen.findByRole('heading', { level: 1, name: doc.title }, { timeout: 15000 })).toBeTruthy();
  }, 20000);

  it('lazy-loads an article and redirects /blog/:slug and legacy policy spellings', async () => {
    const view = renderRoutes(POSTS[0]!.path);
    expect(await screen.findByRole('heading', { level: 1, name: POSTS[0]!.title }, { timeout: 15000 })).toBeTruthy();
    view.unmount();
    renderRoutes(`/blog/${POSTS[1]!.slug}`);
    expect(await screen.findByRole('heading', { level: 1, name: POSTS[1]!.title }, { timeout: 15000 })).toBeTruthy();
    cleanup();
    renderRoutes('/dpa');
    const dpa = getLegalDocumentByPath('/data-processing')!;
    expect(await screen.findByRole('heading', { level: 1, name: dpa.title }, { timeout: 15000 })).toBeTruthy();
  }, 30000);
});

/* ───────────────────────────────── Source hygiene ───────────────────────────────── */

describe('source hygiene for the sections-C files', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = (rel: string): string => resolve(here, '..', rel);
  const dirs = ['registration', 'pages', 'pricing', 'faq', 'insights', 'sectionsC'];
  const sources: { file: string; text: string }[] = [];
  for (const dir of dirs) {
    for (const name of readdirSync(root(dir))) {
      if (/\.test\.tsx?$/.test(name) || !/\.tsx?$/.test(name)) continue;
      sources.push({ file: `${dir}/${name}`, text: readFileSync(root(`${dir}/${name}`), 'utf8') });
    }
  }
  for (const name of ['Pricing', 'Register', 'Faq', 'Insights', 'CtaBanner']) {
    sources.push({ file: `sections/${name}.tsx`, text: readFileSync(root(`sections/${name}.tsx`), 'utf8') });
  }
  sources.push({ file: 'routes.tsx', text: readFileSync(root('routes.tsx'), 'utf8') });
  const styles = ['w2-base', 'pricing', 'pricing-lux', 'register', 'faq', 'insights', 'pages'].map((n) => ({
    file: `styles/${n}.css`,
    text: readFileSync(root(`styles/${n}.css`), 'utf8'),
  }));

  it('uses no banned greens, no pure black, and only the two brand gradients (plus opaque mask helpers)', () => {
    const brand = /^linear-gradient\((?:\d+deg,\s*)?#1dba3c,\s*#35d445\)$/i;
    const ink = /^linear-gradient\((?:\d+deg,\s*)?#0b0f0e,\s*#121a16\)$/i;
    const maskHelper = /^linear-gradient\(#fff 0 0\)$/i;
    for (const { file, text } of styles) {
      expect(text, file).not.toMatch(/#22c55e|#16a34a|#4ade80/i);
      expect(text, file).not.toMatch(/#000(?![0-9a-f])|#000000|rgb\(0 0 0|rgba\(0,\s*0,\s*0/i);
      expect(text, file).not.toMatch(/radial-gradient|conic-gradient/i);
      for (const g of text.match(/linear-gradient\([^)]*\)/gi) ?? []) {
        expect(brand.test(g) || ink.test(g) || maskHelper.test(g), `${file}: ${g}`).toBe(true);
      }
    }
  });

  it('never logs to the console (the form handles personal data)', () => {
    for (const { file, text } of sources) expect(text, file).not.toMatch(/console\.(log|info|warn|error|debug)/);
  });

  it('makes no third-party requests and loads no third-party scripts', () => {
    for (const { file, text } of sources) {
      expect(text, file).not.toMatch(/recaptcha|hcaptcha|turnstile|googletagmanager|google-analytics|facebook\.net|hotjar/i);
      expect(text, file).not.toMatch(/document\.createElement\(['"]script['"]\)/);
      if (file !== 'registration/submit.ts') expect(text, file).not.toMatch(/\bfetch\(/);
    }
  });

  it('keeps personal data out of browser storage', () => {
    for (const { file, text } of sources.filter((s) => s.file.startsWith('registration/'))) {
      expect(text, file).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie/);
    }
  });

  it('keeps every file under the 700-line budget', () => {
    for (const { file, text } of [...sources, ...styles]) expect(text.split('\n').length, file).toBeLessThan(700);
  });
});
