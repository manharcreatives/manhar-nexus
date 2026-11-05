import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TOUR_LANGS } from '../../../tour/content';
import { REGISTRATION_FIELD_ORDER } from '../../content';
import { reactTo } from './content';
import RegisterBuddy from './RegisterBuddy';
import { emitBuddy, resetBuddy, type BuddyEvent } from './store';

// The real avatar paints on every animation frame, which fake timers would run thousands of times.
vi.mock('../../../tour/TourBotFace', () => ({
  TourBotFace: ({ mood }: { mood: string }) => <div data-testid="bot" data-mood={mood} />,
}));

const EVENTS: BuddyEvent[] = [
  { type: 'welcome' },
  { type: 'nudge' },
  ...REGISTRATION_FIELD_ORDER.map((field) => ({ type: 'focus', field }) as BuddyEvent),
  { type: 'focus', field: 'consent' },
  ...REGISTRATION_FIELD_ORDER.map((field) => ({ type: 'valid', field }) as BuddyEvent),
  ...REGISTRATION_FIELD_ORDER.map((field) => ({ type: 'invalid', field }) as BuddyEvent),
  { type: 'typing', field: 'phone', digits: 0, valid: false },
  { type: 'typing', field: 'phone', digits: 4, valid: false },
  { type: 'typing', field: 'phone', digits: 10, valid: true },
  { type: 'typing', field: 'phone', digits: 12, valid: false },
  { type: 'consent', checked: true },
  { type: 'consent', checked: false },
  { type: 'submit' },
  { type: 'success', referenceCode: 'NX-7K2Q9M' },
  { type: 'failure', kind: 'rate-limit' },
  { type: 'failure', kind: 'network' },
  { type: 'failure', kind: 'server' },
  { type: 'failure', kind: 'validation' },
];

describe('reactTo', () => {
  it('says something for every event in every language', () => {
    for (const event of EVENTS) {
      for (const lang of TOUR_LANGS) {
        const r = reactTo(event, lang, 3);
        expect(r.text.length, `${JSON.stringify(event)} ${lang}`).toBeGreaterThan(0);
      }
    }
  });

  it('feels the right thing about each kind of event', () => {
    expect(reactTo({ type: 'welcome' }, 'en').mood).toBe('hello');
    expect(reactTo({ type: 'focus', field: 'phone' }, 'en').mood).toBe('watch');
    expect(reactTo({ type: 'focus', field: 'message' }, 'en').mood).toBe('think');
    expect(reactTo({ type: 'valid', field: 'email' }, 'en').mood).toBe('cheer');
    expect(reactTo({ type: 'invalid', field: 'email' }, 'en').mood).toBe('worry');
    expect(reactTo({ type: 'submit' }, 'en').mood).toBe('fly');
    expect(reactTo({ type: 'success', referenceCode: 'NX-1' }, 'en').mood).toBe('done');
    expect(reactTo({ type: 'failure', kind: 'network' }, 'en').mood).toBe('worry');
    expect(reactTo({ type: 'nudge' }, 'en').mood).toBe('nudge');
  });

  it('counts phone digits, cheers a valid number and warns about too many digits', () => {
    expect(reactTo({ type: 'typing', field: 'phone', digits: 4, valid: false }, 'en').text).toContain('4 of 10');
    expect(reactTo({ type: 'typing', field: 'phone', digits: 10, valid: true }, 'en').mood).toBe('cheer');
    expect(reactTo({ type: 'typing', field: 'phone', digits: 13, valid: false }, 'en').mood).toBe('worry');
  });

  it('puts the reference code in the success message in every language', () => {
    for (const lang of TOUR_LANGS) {
      expect(reactTo({ type: 'success', referenceCode: 'NX-7K2Q9M' }, lang).text).toContain('NX-7K2Q9M');
    }
  });

  it('rotates the cheer so a run of accepted fields does not repeat one word', () => {
    const texts = new Set([0, 1, 2, 3].map((n) => reactTo({ type: 'valid', field: 'city' }, 'en', n).text));
    expect(texts.size).toBe(4);
  });
});

describe('RegisterBuddy', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetBuddy();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('greets, then explains a field when the form reports focus', async () => {
    render(<RegisterBuddy />);
    expect(screen.getByRole('status').textContent).toContain('Manhar Bot');
    act(() => emitBuddy({ type: 'focus', field: 'email' }));
    expect(await screen.findByText(/payment link and invoice/)).toBeTruthy();
  });

  it('switches language from the chips and remembers it', async () => {
    render(<RegisterBuddy />);
    fireEvent.click(screen.getByRole('button', { name: 'ગુજરાતી' }));
    expect(screen.getByRole('status').textContent).toContain('નમસ્તે');
    expect(window.localStorage.getItem('nexus.tour.lang')).toBe('gu');
  });

  it('keeps a cheer on screen for a moment before the next field hint replaces it', () => {
    vi.useFakeTimers();
    render(<RegisterBuddy />);
    act(() => emitBuddy({ type: 'valid', field: 'city' }));
    act(() => {
      vi.advanceTimersByTime(10);
    });
    const cheer = screen.getByRole('status').textContent;
    act(() => emitBuddy({ type: 'focus', field: 'businessKind' }));
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByRole('status').textContent).toBe(cheer);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole('status').textContent).toContain('closest match');
  });

  it('moves the bot to the mood that matches the event', () => {
    render(<RegisterBuddy />);
    expect(screen.getByTestId('bot').getAttribute('data-mood')).toBe('hello');
    act(() => emitBuddy({ type: 'success', referenceCode: 'NX-1' }));
    return vi.waitFor(() => expect(screen.getByTestId('bot').getAttribute('data-mood')).toBe('done'));
  });

  it('shows an error at once, even over a cheer', () => {
    vi.useFakeTimers();
    render(<RegisterBuddy />);
    act(() => emitBuddy({ type: 'valid', field: 'city' }));
    act(() => {
      vi.advanceTimersByTime(10);
    });
    act(() => emitBuddy({ type: 'failure', kind: 'network' }));
    act(() => {
      vi.advanceTimersByTime(10);
    });
    expect(screen.getByRole('status').textContent).toContain('internet');
  });

  it('offers a human after a quiet moment', () => {
    vi.useFakeTimers();
    render(<RegisterBuddy />);
    act(() => {
      vi.advanceTimersByTime(31_000);
    });
    // The nudge is an event like any other; let the display catch up with it.
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(screen.getByRole('status').textContent).toContain('WhatsApp');
  });

  it('can be hidden for good by the visitor', () => {
    render(<RegisterBuddy />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Hide Manhar Bot' }).slice(-1)[0] as HTMLElement);
    expect(screen.getByRole('complementary', { hidden: true }).getAttribute('data-visible')).toBe('false');
  });
});
