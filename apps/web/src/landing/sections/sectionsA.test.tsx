import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ABOUT, HERO, INTRO } from '../content';
import { CheckoutTablet, GuestPhone, KitchenScreen, MiniTicket, OwnerDashboard } from '../devices';
import About from './About';
import Hero from './Hero';
import Intro from './Intro';

const inRouter = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);
const flat = (s: string) => s.replace(/\s+/g, ' ').trim();

afterEach(() => {
  vi.useRealTimers();
});

describe('Hero', () => {
  it('renders exactly one h1 (the headline) and no other heading', () => {
    const { container } = inRouter(<Hero />);
    const h1s = container.querySelectorAll('h1');
    expect(h1s).toHaveLength(1);
    expect(flat(h1s[0].textContent ?? '')).toBe(HERO.headline.text);
    expect(container.querySelectorAll('h2, h3, h4')).toHaveLength(0);
    expect(h1s[0].querySelectorAll('.lp-accent')).toHaveLength(1);
    expect(h1s[0].querySelector('.lp-accent')?.textContent).toBe(HERO.headline.accent);
  });

  it('is the #hero section named by its h1', () => {
    const { container } = inRouter(<Hero />);
    const section = container.querySelector('section#hero');
    expect(section).toBeTruthy();
    expect(section?.getAttribute('aria-labelledby')).toBe('hero-title');
    expect(section?.querySelector('#hero-title')?.tagName).toBe('H1');
  });

  it('has a primary CTA to #register and a secondary one to #why, both real links', () => {
    inRouter(<Hero />);
    const primary = screen.getByRole('link', { name: HERO.primaryCta.label });
    expect(primary.getAttribute('href')).toBe('#register');
    const secondary = screen.getByRole('link', { name: /See how a night runs/ });
    expect(secondary.getAttribute('href')).toBe('#why');
    const cue = screen.getByRole('link', { name: HERO.scrollCue });
    expect(cue.getAttribute('href')).toBe('#intro');
  });

  it('shows the three true proof points from the content module', () => {
    inRouter(<Hero />);
    const list = screen.getByRole('list', { name: 'What Nexus guarantees' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    for (const p of HERO.proofPoints) {
      expect(within(list).getByText(p.title)).toBeTruthy();
      expect(within(list).getByText(p.body)).toBeTruthy();
    }
  });

  it('describes the 3D stage once and hides the decorative photo', () => {
    const { container } = inRouter(<Hero />);
    const stage = screen.getByRole('img', { name: /Preview of the Manhar Nexus owner dashboard/ });
    expect(stage).toBeTruthy();
    // the dashboard inside is decorative: no nested role="img"
    expect(stage.querySelectorAll('[role="img"]')).toHaveLength(0);
    const photo = container.querySelector('.lp-hero__bg');
    expect(photo?.getAttribute('aria-hidden')).toBe('true');
    expect(photo?.querySelector('img')?.getAttribute('alt')).toBe('');
    expect(photo?.querySelector('img')?.getAttribute('fetchpriority')).toBe('high');
  });

  it('floats three ticket stubs with a PAID stamp', () => {
    const { container } = inRouter(<Hero />);
    expect(container.querySelectorAll('.lp-hero__tk .lp-tk')).toHaveLength(3);
    expect(container.querySelector('.lp-hero__tk .lp-stamp')?.textContent).toBe('Paid');
  });
});

describe('Intro', () => {
  it('has one h2 named by the full headline and keeps all copy in the DOM', () => {
    const { container } = inRouter(<Intro />);
    expect(container.querySelectorAll('h1')).toHaveLength(0);
    const h2s = container.querySelectorAll('h2');
    expect(h2s).toHaveLength(1);
    expect(flat(h2s[0].textContent ?? '')).toBe(INTRO.headline.text);
    expect(container.querySelector('section#intro')?.getAttribute('aria-labelledby')).toBe('intro-title');
    const text = flat(container.textContent ?? '');
    for (const p of INTRO.paragraphs) expect(text).toContain(p);
    expect(text).toContain(INTRO.closingQuestion.text);
  });

  it('wraps every word in an indexed span with one accent word per headline', () => {
    const { container } = inRouter(<Intro />);
    const h2 = container.querySelector('h2');
    expect(h2?.querySelectorAll('.lp-accent')).toHaveLength(1);
    expect(h2?.querySelector('.lp-accent')?.textContent).toBe(INTRO.headline.accent);
    const words = container.querySelectorAll('.lp-lit__w');
    expect(words.length).toBeGreaterThan(80);
    expect((words[3] as HTMLElement).style.getPropertyValue('--i')).toBe('3');
    // reduced-motion / no-IO final state: the block progress is 1, i.e. everything lit
    const lit = container.querySelector('.lp-lit') as HTMLElement;
    expect(lit.style.getPropertyValue('--p')).toBe('1');
  });

  it('ends with a link to the product story and a decorative slip', () => {
    const { container } = inRouter(<Intro />);
    expect(screen.getByRole('link', { name: 'Follow one night, start to finish' }).getAttribute('href')).toBe('#why');
    const slip = container.querySelector('.lp-intro__slipwrap');
    expect(slip?.getAttribute('aria-hidden')).toBe('true');
    expect(slip?.querySelector('.lp-stamp')?.textContent).toBe('Unreconciled');
  });
});

describe('About', () => {
  it('has one h2, the studio panel and the three principles', () => {
    const { container } = inRouter(<About />);
    expect(container.querySelectorAll('h1')).toHaveLength(0);
    expect(container.querySelectorAll('h2')).toHaveLength(1);
    expect(container.querySelectorAll('h2 .lp-accent')).toHaveLength(1);
    expect(container.querySelector('section#about')?.getAttribute('aria-labelledby')).toBe('about-title');
    expect(screen.getByText(ABOUT.studioLine)).toBeTruthy();
    expect(screen.getByText(ABOUT.studioLabel)).toBeTruthy();
    const list = screen.getByRole('list', { name: ABOUT.beliefsTitle });
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
  });

  it('does not publish what the content module flags as unconfirmed', () => {
    const { container } = inRouter(<About />);
    const text = flat(container.textContent ?? '');
    for (const p of ABOUT.paragraphs.filter((x) => x.ownerConfirm)) {
      expect(text).not.toContain(p.text.slice(0, 40));
    }
    expect(ABOUT.signature.ownerApproved).toBe(false);
    expect(text).not.toContain(ABOUT.signature.name);
    expect(text).not.toContain('Utsav');
    expect(text).not.toContain(ABOUT.internalNote.slice(0, 30));
    // the unflagged paragraph and honest note are shown
    expect(text).toContain('Then make each one boring, visible and hard to get wrong.');
    expect(text).toContain(ABOUT.honestNote.body);
  });

  it('links out to the studio safely and offers contact details', () => {
    const { container } = inRouter(<About />);
    const external = Array.from(container.querySelectorAll('a[target="_blank"]'));
    expect(external.length).toBeGreaterThanOrEqual(3);
    for (const a of external) expect(a.getAttribute('rel')).toContain('noopener');
    expect(screen.getByRole('link', { name: /Visit manharcreatives\.com/ }).getAttribute('href')).toBe('https://www.manharcreatives.com');
    expect(screen.getByRole('link', { name: 'info@manharcreatives.com' }).getAttribute('href')).toBe('mailto:info@manharcreatives.com');
    expect(screen.getByRole('link', { name: '+91 97145 71522' }).getAttribute('href')).toBe('tel:+919714571522');
    expect(container.querySelector('img[src="/landing/brand/manhar-creatives-on-ink.jpg"]')).toBeTruthy();
  });
});

describe('devices', () => {
  it('KitchenScreen shows New / Preparing / Ready tickets, mono numbers, timers and the Sold-Out chip', () => {
    render(<KitchenScreen />);
    const img = screen.getByRole('img', { name: /Kitchen display preview/ });
    expect(img).toBeTruthy();
    for (const t of ['Kitchen display', 'New', 'Preparing', 'Ready', '0412', '0409', '0407', 'Sold-Out · Rasmalai', 'Waiting for pickup']) {
      expect(screen.getAllByText(t).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText('Accept').length).toBe(2);
    expect(screen.getAllByText('Mark ready').length).toBe(2);
    expect(screen.getByText(/Late · 07:12/)).toBeTruthy();
  });

  it('KitchenScreen timers tick only when animated', () => {
    vi.useFakeTimers();
    const { unmount } = render(<KitchenScreen animate />);
    expect(screen.getByText('00:48')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText('00:51')).toBeTruthy();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('KitchenScreen stays still without animate', () => {
    vi.useFakeTimers();
    render(<KitchenScreen />);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText('00:48')).toBeTruthy();
  });

  it('OwnerDashboard shows the ledger figure, bills, sparkline, table words and top dishes', () => {
    const { container } = render(<OwnerDashboard />);
    expect(screen.getByRole('img', { name: /Owner dashboard preview/ })).toBeTruthy();
    for (const t of ['Today', '₹48,260', 'Paid bills', 'Average bill', 'Last 7 days', 'Top dishes', 'Masala Dosa', 'Filter Coffee', 'Paneer Tikka']) {
      expect(screen.getAllByText(t).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText('Occupied').length).toBe(7);
    expect(screen.getAllByText('Cleaning').length).toBe(2);
    expect(screen.getAllByText('Available').length).toBe(3);
    const colours = Array.from(container.querySelectorAll('svg [stroke], svg [fill]')).flatMap((n) => [n.getAttribute('stroke'), n.getAttribute('fill')]).filter((c): c is string => !!c && c !== 'none');
    for (const c of colours) expect(['#1DBA3C', '#0B0F0E', '#9AA5A0', '#FFFFFF']).toContain(c);
  });

  it('GuestPhone shows the Service Request sheet with a portion, add-ons and a note (no invented guest features)', () => {
    render(<GuestPhone />);
    expect(screen.getByRole('img', { name: /Phone preview/ })).toBeTruthy();
    for (const t of ['Service Request', 'Choose options for Masala Dosa', 'Size or portion', 'Extra butter', 'Add-ons', 'Add to order · ₹160']) {
      expect(screen.getAllByText(t).length).toBeGreaterThan(0);
    }
    expect(screen.queryByText(/call waiter/i)).toBeNull();
  });

  it('CheckoutTablet shows GST lines and the PAID stamp, or the Collect state when unpaid', () => {
    const { unmount } = render(<CheckoutTablet />);
    for (const t of ['Check out · Table 7', 'Subtotal', 'GST 5%', 'Total due', 'Paid', 'Change given: ₹7.00', 'Close table']) {
      expect(screen.getAllByText(t).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText('₹693.00').length).toBeGreaterThan(0);
    unmount();
    render(<CheckoutTablet paid={false} />);
    expect(screen.getByText('Collect ₹693.00')).toBeTruthy();
    expect(screen.getByText('UPI')).toBeTruthy();
    expect(screen.queryByText('Paid')).toBeNull();
  });

  it('every device can be marked decorative (hidden from assistive tech) and takes a className', () => {
    const { container } = render(
      <>
        <KitchenScreen decorative className="x-k" />
        <OwnerDashboard decorative className="x-o" />
        <GuestPhone decorative className="x-g" />
        <CheckoutTablet decorative className="x-c" />
      </>,
    );
    expect(screen.queryAllByRole('img')).toHaveLength(0);
    for (const c of ['x-k', 'x-o', 'x-g', 'x-c']) {
      const el = container.querySelector(`.${c}`);
      expect(el?.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('MiniTicket renders number, table, lines, total and stamp', () => {
    const { container } = render(<MiniTicket number="0412" table="Table 7" lines={[{ qty: 2, name: 'Masala Dosa', sub: 'Full' }]} total="₹693.00" stamp="Paid" status="Waiting" />);
    expect(container.textContent).toContain('0412');
    expect(container.textContent).toContain('Masala Dosa');
    expect(container.textContent).toContain('₹693.00');
    expect(container.querySelector('.lp-stamp')?.textContent).toBe('Paid');
  });
});

describe('brand rules in SECTIONS-A styles', () => {
  const files = ['hero', 'intro', 'about', 'devices'].map((n) => ({ n, css: readFileSync(resolve(process.cwd(), 'src/landing/styles', `${n}.css`), 'utf8') }));
  it('never uses the old greens, pure black, or colour gradients', () => {
    for (const { n, css } of files) {
      expect(css, n).not.toMatch(/#22c55e|#16a34a|#4ade80/i);
      expect(css, n).not.toMatch(/#000(000)?\b/i);
      // gradients are allowed only as alpha masks (ink/transparent) or radial notch masks, never as backgrounds
      expect(css, n).not.toMatch(/background(-image)?\s*:[^;]*gradient/i);
    }
  });
  it('only animates transform/opacity (no layout properties in keyframes or transitions)', () => {
    for (const { n, css } of files) {
      for (const m of css.matchAll(/transition\s*:\s*([^;]+);/g)) {
        for (const part of m[1].split(',')) {
          const prop = part.trim().split(/\s+/)[0];
          expect(['opacity', 'transform', 'color', 'border-color', 'box-shadow', 'none'], `${n}: ${part}`).toContain(prop);
        }
      }
    }
  });
});
