import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PAGE_STEPS, stepsFor } from './content';
import { readLang, readOutcome } from './storage';
import { TourGuide, type TourGuideProps } from './TourGuide';

// The real avatar paints on every animation frame; a stand-in that just records the mood keeps these tests fast.
vi.mock('./TourBotFace', () => ({
  TourBotFace: ({ mood }: { mood: string }) => <div data-testid="bot" data-mood={mood} />,
}));

const PATHS = ['/', '/tables', '/menu', '/bills'];

const tick = (ms: number): void => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};
const status = (): string => screen.getByRole('status').textContent ?? '';
const mood = (): string | null => screen.getByTestId('bot').getAttribute('data-mood');
const click = (name: string | RegExp): void => {
  fireEvent.click(screen.getByRole('button', { name }));
};

function setup(props: Partial<TourGuideProps> = {}) {
  const onNavOpen = vi.fn();
  const utils = render(
    <TourGuide userId="u-1" displayName="Asha Mehta" visiblePaths={PATHS} onNavOpen={onNavOpen} {...props} />,
  );
  // First visit: the question appears after a short delay.
  tick(800);
  return { ...utils, onNavOpen };
}

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

describe('TourGuide: the question', () => {
  it('first asks which language, in all three languages at once', () => {
    setup();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Which language do you prefer?')).toBeTruthy();
    expect(screen.getByText(/आप कौन-सी भाषा पसंद करेंगे/)).toBeTruthy();
    expect(screen.getByText(/તમને કઈ ભાષા ગમશે/)).toBeTruthy();
    expect(mood()).toBe('ask');
  });

  it('then asks, in the chosen language, whether a tour is wanted', () => {
    setup();
    click('हिन्दी');
    expect(screen.getByText('क्या आप अपने डैशबोर्ड का छोटा-सा टूर देखना चाहेंगे?')).toBeTruthy();
    expect(screen.queryByText('Would you like a quick tour of your dashboard?')).toBeNull();
    expect(mood()).toBe('hello');
    expect(readLang()).toBe('hi');
  });

  it('can be put off from the language screen too, in all three languages, without being remembered', () => {
    setup();
    click(/Ask me later/);
    expect(screen.getByText(/ask again next time/)).toBeTruthy();
    expect(screen.getByText(/मैं अगली बार फिर पूछूँगा/)).toBeTruthy();
    expect(readOutcome('u-1')).toBeNull();
    tick(3300);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('is just the bot and a thought bubble, not a boxed card', () => {
    setup();
    expect(document.querySelector('.nx-tb')).not.toBeNull();
    expect(document.querySelector('.nx-tour-panel')).toBeNull();
    expect(document.querySelector('.nx-tour-card')).toBeNull();
  });

  it('does not appear for a user who already finished or skipped it', () => {
    window.localStorage.setItem('nexus.tour.v1:u-1', 'skipped');
    setup();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('"No thanks" says a friendly goodbye, remembers, then leaves', () => {
    setup();
    click('English');
    click(/No thanks/);
    expect(readOutcome('u-1')).toBe('skipped');
    expect(screen.getByText(/Find me any time/)).toBeTruthy();
    expect(mood()).toBe('nudge');
    tick(3300);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('"Ask me later" says goodbye without remembering, so the question returns next time', () => {
    setup();
    click('English');
    click('Ask me later');
    expect(screen.getByText(/ask again next time/)).toBeTruthy();
    expect(screen.queryByText(/मैं अगली बार/)).toBeNull(); // said in the chosen language only
    expect(readOutcome('u-1')).toBeNull();
    tick(3300);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Escape on the question means later, not never', () => {
    setup();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(readOutcome('u-1')).toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('stays quiet while disabled (e.g. a forced password change is on screen)', () => {
    setup({ enabled: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('TourGuide: the walk-through', () => {
  it('yes -> language -> walks through exactly the visible pages in Gujarati, with changing faces, then finishes', () => {
    const { onNavOpen } = setup();
    expect(screen.getByText('Which language do you prefer?')).toBeTruthy();
    expect(mood()).toBe('ask');
    click('ગુજરાતી');
    expect(readLang()).toBe('gu');
    expect(screen.getByText('શું તમે તમારા ડેશબોર્ડનો નાનકડો ટૂર જોવા માંગો છો?')).toBeTruthy();
    click('હા, બતાવો');

    expect(status()).toContain('નમસ્તે Asha, હું મનહર બોટ છું!');
    expect(mood()).toBe('hello');
    const next = (): void => click('આગળ');
    next();
    tick(800); // the bot has landed
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
    expect(mood()).toBe('done');

    click('Nexus વાપરવાનું શરૂ કરો');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(readOutcome('u-1')).toBe('done');
    expect(onNavOpen).not.toHaveBeenCalledWith(true); // jsdom has no matchMedia: treated as desktop
  });

  it('changes its face as it explains, not the same one all the way through', () => {
    setup();
    click('English');
    click('Yes, show me');
    const seen = new Set<string>();
    for (let i = 0; i < 4; i++) {
      click('Next');
      tick(800); // landed: the flying face gives way to the explaining one
      seen.add(mood() ?? '');
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('can go back and skip part-way, remembering the skip', () => {
    setup();
    click('हिन्दी');
    click('हाँ, दिखाइए');
    click('आगे');
    click('पीछे');
    expect(status()).toContain('नमस्ते Asha');
    click('टूर छोड़ें');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(readOutcome('u-1')).toBe('skipped');
  });

  it('spotlights the menu item being explained and lands the bot to its right with the bubble beside it', () => {
    const nav = document.createElement('aside');
    nav.innerHTML = '<nav><a href="/tables">Tables</a></nav>';
    document.body.appendChild(nav);
    const link = nav.querySelector('a') as HTMLElement;
    link.getBoundingClientRect = () =>
      ({ left: 16, right: 240, top: 200, bottom: 244, width: 224, height: 44, x: 16, y: 200, toJSON: () => ({}) }) as DOMRect;

    setup();
    click('English');
    click('Yes, show me');
    const spot = (): HTMLElement => document.querySelector('[data-tour-spot]') as HTMLElement;
    const bot = (): HTMLElement => document.querySelector('.nx-tbot') as HTMLElement;
    const bubble = (): HTMLElement => screen.getByRole('dialog');

    click('Next'); // Home: nothing to point at, so the bot waits bottom-right with the bubble to its left
    expect(spot().getAttribute('data-active')).toBe('false');
    expect(bubble().getAttribute('data-pos')).toBe('out-left');
    click('Next'); // Tables: ring around the item, bot just to its right (item's right edge 240 + 16)
    expect(spot().getAttribute('data-active')).toBe('true');
    expect(spot().style.transform).toContain('12px'); // item left 16 minus 4px padding
    expect(bot().style.transform).toContain('256px');
    expect(bubble().getAttribute('data-pos')).toBe('out-right');
    click('Next'); // Bills is not in this sidebar
    expect(spot().getAttribute('data-active')).toBe('false');
    nav.remove();
  });

  it('replays straight into the steps in the remembered language', () => {
    window.localStorage.setItem('nexus.tour.v1:u-1', 'done');
    window.localStorage.setItem('nexus.tour.lang', 'hi');
    const onNavOpen = vi.fn();
    const { rerender } = render(<TourGuide userId="u-1" visiblePaths={PATHS} onNavOpen={onNavOpen} replayToken={0} />);
    tick(800);
    expect(screen.queryByRole('dialog')).toBeNull();
    rerender(<TourGuide userId="u-1" visiblePaths={PATHS} onNavOpen={onNavOpen} replayToken={1} />);
    expect(status()).toContain('नमस्ते, मैं मनहर बॉट हूँ!');
  });
});
