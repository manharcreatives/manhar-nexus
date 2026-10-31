import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Button, Header, ImageSlot, Section } from './components';
import { applyIntentFromHash, getRegistrationIntent, resetRegistrationIntent, useRegistrationIntent } from './hooks';
import { useDocumentMeta, useJsonLd } from './hooks/useDocumentMeta';
import Preloader from './sections/Preloader';

beforeEach(() => {
  window.sessionStorage.clear();
  window.history.pushState({}, '', '/');
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Header', () => {
  it('opens the mobile menu, traps focus, closes on Escape and restores focus', () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    );
    const toggle = screen.getByRole('button', { name: 'Open menu' });
    toggle.focus();
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('dialog', { name: 'Site menu' })).toBeTruthy();
    expect(document.documentElement.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.documentElement.style.overflow).toBe('');
    expect(document.activeElement).toBe(toggle);
  });

  it('exposes landmarks, the six anchors, Sign in and the primary CTA', () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    );
    expect(screen.getByRole('banner')).toBeTruthy();
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(nav.querySelectorAll('a')).toHaveLength(6);
    expect(screen.getAllByRole('link', { name: 'Sign in' })[0].getAttribute('href')).toBe('/login');
    expect(screen.getAllByRole('link', { name: 'Register your restaurant' })[0].getAttribute('href')).toBe('#register');
  });

  it('links to home-page sections through the router from policy pages', () => {
    render(
      <MemoryRouter initialEntries={['/terms']}>
        <Header />
      </MemoryRouter>,
    );
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(nav.querySelector('a')?.getAttribute('href')).toBe('/#platform');
  });
});

describe('Preloader', () => {
  it('shows once per session, then removes itself within the 1.4s cap', () => {
    vi.useFakeTimers();
    const { unmount } = render(<Preloader />);
    const el = screen.getByTestId('lp-preloader');
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.getAttribute('role')).toBe('presentation');
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(el.className).toContain('is-done');
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.queryByTestId('lp-preloader')).toBeNull();
    unmount();
    render(<Preloader />); // second visit in the same session
    expect(screen.queryByTestId('lp-preloader')).toBeNull();
  });

  it('is skipped for deep links with a hash and can be dismissed by a key press', () => {
    vi.useFakeTimers();
    window.history.pushState({}, '', '/#pricing');
    const { unmount } = render(<Preloader />);
    expect(screen.queryByTestId('lp-preloader')).toBeNull();
    unmount();
    window.history.pushState({}, '', '/');
    window.sessionStorage.clear();
    render(<Preloader />);
    fireEvent.keyDown(window, { key: 'Tab' });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.queryByTestId('lp-preloader')).toBeNull();
  });
});

describe('primitives', () => {
  it('Section renders an aria-labelled landmark with tone classes', () => {
    render(
      <Section id="faq" tone="ink" labelledBy="faq-title">
        <h2 id="faq-title">Questions</h2>
      </Section>,
    );
    const sec = screen.getByRole('region', { name: 'Questions' });
    expect(sec.id).toBe('faq');
    expect(sec.className).toContain('lp-section--ink');
    expect(sec.className).toContain('lp-on-dark');
  });

  it('Button renders anchor, router link or button', () => {
    render(
      <MemoryRouter>
        <Button href="#register">Go</Button>
        <Button to="/login">Sign</Button>
        <Button onClick={() => undefined}>Press</Button>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Go' }).getAttribute('href')).toBe('#register');
    expect(screen.getByRole('link', { name: 'Sign' }).getAttribute('href')).toBe('/login');
    expect(screen.getByRole('button', { name: 'Press' }).getAttribute('type')).toBe('button');
  });

  it('ImageSlot reserves its box and swaps to the fallback when the file is missing', () => {
    render(<ImageSlot src="/landing/missing.webp" alt="A dining room" width={1600} height={900} />);
    const img = screen.getByRole('img', { name: 'A dining room' }) as HTMLImageElement;
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('width')).toBe('1600');
    fireEvent.error(img);
    const fallback = screen.getByRole('img', { name: 'A dining room' });
    expect(fallback.className).toContain('lp-img__fallback');
    expect(fallback.textContent).toBe('missing.webp');
  });
});

describe('hooks', () => {
  it('useDocumentMeta sets and restores title, description and canonical', () => {
    document.title = 'Manhar Nexus';
    function Probe() {
      useDocumentMeta({ title: 'Terms – Manhar Nexus', description: 'Terms.', path: '/terms' });
      return null;
    }
    const { unmount } = render(<Probe />);
    expect(document.title).toBe('Terms – Manhar Nexus');
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toMatch(/\/terms$/);
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('Terms.');
    unmount();
    expect(document.title).toBe('Manhar Nexus');
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
  });

  it('useJsonLd injects and removes a ld+json script', () => {
    function Probe() {
      useJsonLd('faq', { '@context': 'https://schema.org', '@type': 'FAQPage' });
      return null;
    }
    const { unmount } = render(<Probe />);
    expect(document.head.querySelector('script[data-lp-ld="faq"]')?.textContent).toContain('FAQPage');
    unmount();
    expect(document.head.querySelector('script[data-lp-ld="faq"]')).toBeNull();
  });

  it('registration intent store: choosePlan, hash params, reset', () => {
    resetRegistrationIntent();
    function Probe() {
      const { plan, cycle, choosePlan } = useRegistrationIntent();
      return (
        <button type="button" onClick={() => choosePlan('floor', 'monthly')}>
          {plan}/{cycle}
        </button>
      );
    }
    render(<Probe />);
    expect(screen.getByRole('button').textContent).toBe('not-sure/yearly');
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button').textContent).toBe('floor/monthly');
    applyIntentFromHash('#register?plan=pass&cycle=yearly&begin=demo');
    expect(getRegistrationIntent()).toEqual({ plan: 'pass', cycle: 'yearly', begin: 'demo' });
    applyIntentFromHash('#register?plan=bogus');
    expect(getRegistrationIntent().plan).toBe('pass');
    resetRegistrationIntent();
  });
});
