import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PAGE_STEPS, stepsFor } from './content';
import { readLang, readOutcome } from './storage';
import { TourGuide, type TourGuideProps } from './TourGuide';

const PATHS = ['/', '/tables', '/menu', '/bills'];

function setup(props: Partial<TourGuideProps> = {}) {
  const onNavOpen = vi.fn();
  const utils = render(
    <TourGuide userId="u-1" displayName="Asha Mehta" visiblePaths={PATHS} onNavOpen={onNavOpen} {...props} />,
  );
  // First visit: the question appears after a short delay.
  act(() => {
    vi.advanceTimersByTime(800);
  });
  return { ...utils, onNavOpen };
}

const status = (): string => screen.getByRole('status').textContent ?? '';

beforeEach(() => {
  window.localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('tour content', () => {
  it('only includes pages the user can see, in tour order', () => {
    expect(stepsFor(['/menu', '/bills', '/', '/tables']).map((s) => s.path)).toEqual(['/', '/tables', '/bills', '/menu']);
    expect(stepsFor([])).toEqual([]);
  });

  it('has a title and body in every language for every page', () => {
    for (const step of PAGE_STEPS) {
      for (const lang of ['en', 'hi', 'gu'] as const) {
        expect(step.copy[lang].title.length, `${step.path} ${lang} title`).toBeGreaterThan(0);
        expect(step.copy[lang].body.length, `${step.path} ${lang} body`).toBeGreaterThan(0);
      }
    }
  });
});

describe('TourGuide', () => {
  it('first asks whether a tour is wanted, in all three languages', () => {
    setup();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Would you like a quick tour of your dashboard?')).toBeTruthy();
    expect(screen.getByText(/क्या आप अपने डैशबोर्ड/)).toBeTruthy();
    expect(screen.getByText(/શું તમે તમારા ડેશબોર્ડ/)).toBeTruthy();
  });

  it('does not appear for a user who already finished or skipped it', () => {
    window.localStorage.setItem('nexus.tour.v1:u-1', 'skipped');
    setup();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('"No thanks" closes it and remembers, so it is not asked again', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /No thanks/ }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(readOutcome('u-1')).toBe('skipped');
  });

  it('"Ask me later" closes it without remembering', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Ask me later/ }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(readOutcome('u-1')).toBeNull();
  });

  it('Escape on the question means later, not never', () => {
    setup();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(readOutcome('u-1')).toBeNull();
  });

  it('yes -> language -> walks through exactly the visible pages in Gujarati, then finishes', () => {
    const { onNavOpen } = setup();
    fireEvent.click(screen.getByRole('button', { name: /^Yes/ }));
    expect(screen.getByText('Which language do you prefer?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'ગુજરાતી' }));
    expect(readLang()).toBe('gu');

    expect(status()).toContain('નમસ્તે Asha, હું મનહર બોટ છું!');
    const next = (): void => {
      fireEvent.click(screen.getByRole('button', { name: 'આગળ' }));
    };
    next();
    expect(status()).toContain('હોમ');
    expect(screen.getByText('પગલું 1 / 4')).toBeTruthy();
    next();
    expect(status()).toContain('ટેબલ અને સેશન');
    next();
    expect(status()).toContain('બિલ');
    next();
    expect(status()).toContain('મેનુ');
    expect(screen.getByText('પગલું 4 / 4')).toBeTruthy();
    next();
    expect(status()).toContain('બધું તૈયાર છે!');

    fireEvent.click(screen.getByRole('button', { name: 'Nexus વાપરવાનું શરૂ કરો' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(readOutcome('u-1')).toBe('done');
    expect(onNavOpen).not.toHaveBeenCalledWith(true); // jsdom has no matchMedia: treated as desktop
  });

  it('can go back and skip part-way, remembering the skip', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /^Yes/ }));
    fireEvent.click(screen.getByRole('button', { name: 'हिन्दी' }));
    fireEvent.click(screen.getByRole('button', { name: 'आगे' }));
    fireEvent.click(screen.getByRole('button', { name: 'पीछे' }));
    expect(status()).toContain('नमस्ते Asha');
    fireEvent.click(screen.getByRole('button', { name: 'टूर छोड़ें' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(readOutcome('u-1')).toBe('skipped');
  });

  it('highlights the sidebar item being explained and clears it afterwards', () => {
    const nav = document.createElement('aside');
    nav.innerHTML = '<nav><a href="/tables">Tables</a></nav>';
    document.body.appendChild(nav);
    const link = nav.querySelector('a') as HTMLElement;

    setup();
    fireEvent.click(screen.getByRole('button', { name: /^Yes/ }));
    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    const next = (): void => {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    };
    next(); // Home
    expect(link.classList.contains('nx-tour-spot')).toBe(false);
    next(); // Tables
    expect(link.classList.contains('nx-tour-spot')).toBe(true);
    next(); // Menu
    expect(link.classList.contains('nx-tour-spot')).toBe(false);
    nav.remove();
  });

  it('replays straight into the steps in the remembered language', () => {
    window.localStorage.setItem('nexus.tour.v1:u-1', 'done');
    window.localStorage.setItem('nexus.tour.lang', 'hi');
    const onNavOpen = vi.fn();
    const { rerender } = render(
      <TourGuide userId="u-1" visiblePaths={PATHS} onNavOpen={onNavOpen} replayToken={0} />,
    );
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    rerender(<TourGuide userId="u-1" visiblePaths={PATHS} onNavOpen={onNavOpen} replayToken={1} />);
    expect(status()).toContain('नमस्ते, मैं मनहर बॉट हूँ!');
  });

  it('stays quiet while disabled (e.g. a forced password change is on screen)', () => {
    setup({ enabled: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
