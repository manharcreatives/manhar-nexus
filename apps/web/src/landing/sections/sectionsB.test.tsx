import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BUILT_FOR, COMPARE, HOW, PLATFORM, TRUST } from '../content';
import BuiltFor from './BuiltFor';
import Compare from './Compare';
import HowItWorks from './HowItWorks';
import Platform from './Platform';
import Trust from './Trust';

const wrap = (ui: ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('Platform', () => {
  it('has one h2, names the section with it and lists every live module in order', () => {
    const { container } = wrap(<Platform />);
    const section = container.querySelector('section#platform');
    expect(section?.getAttribute('aria-labelledby')).toBe('platform-title');
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
    const cards = within(screen.getByRole('list', { name: /Nexus modules/ })).getAllByRole('listitem');
    expect(cards).toHaveLength(PLATFORM.modules.length);
    PLATFORM.modules.forEach((m, i) => {
      expect(within(cards[i]!).getByRole('heading', { level: 3, name: m.title })).toBeTruthy();
      expect(within(cards[i]!).getByText(m.proof)).toBeTruthy();
    });
  });

  it('marks live modules LIVE and roadmap modules COMING SOON, with no proof line on the roadmap', () => {
    wrap(<Platform />);
    expect(screen.getAllByText(PLATFORM.liveTag)).toHaveLength(PLATFORM.modules.length);
    expect(screen.getAllByText(PLATFORM.comingSoonTag)).toHaveLength(PLATFORM.comingSoon.length);
    PLATFORM.comingSoon.forEach((m) => expect(screen.getByRole('heading', { level: 3, name: m.title })).toBeTruthy());
  });

  it('has an index rail whose buttons jump to a module and mark it current', () => {
    wrap(<Platform />);
    const rail = screen.getByRole('navigation', { name: 'Jump to a module' });
    const buttons = within(rail).getAllByRole('button');
    expect(buttons).toHaveLength(PLATFORM.modules.length);
    expect(buttons[0]!.getAttribute('aria-current')).toBe('true');
    fireEvent.click(buttons[4]!);
    expect(buttons[4]!.getAttribute('aria-current')).toBe('true');
    expect(buttons[0]!.getAttribute('aria-current')).toBeNull();
    expect(window.scrollTo).toHaveBeenCalled();
  });
});

describe('Compare', () => {
  it('has one h2 and keeps all eight moments in the DOM, in order', () => {
    const { container } = wrap(<Compare />);
    expect(container.querySelector('section#why')?.getAttribute('aria-labelledby')).toBe('why-title');
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
    const moments = within(screen.getByRole('list', { name: /moment by moment/ })).getAllByRole('listitem');
    expect(moments).toHaveLength(COMPARE.moments.length);
    COMPARE.moments.forEach((m, i) => {
      expect(within(moments[i]!).getByText(m.clock)).toBeTruthy();
      expect(within(moments[i]!).getByText(m.with)).toBeTruthy();
      expect(within(moments[i]!).getByText(m.without)).toBeTruthy();
    });
  });

  it('exposes the night as a native range whose aria-valuetext follows the time', () => {
    wrap(<Compare />);
    const slider = screen.getByRole('slider', { name: COMPARE.range.sliderLabel }) as HTMLInputElement;
    expect(slider.tagName).toBe('INPUT');
    expect(slider.type).toBe('range');
    expect(slider.getAttribute('aria-valuetext')).toContain('6:30 pm');
    fireEvent.change(slider, { target: { value: '105' } });
    expect(slider.getAttribute('aria-valuetext')).toContain('7:45 pm');
    expect(slider.getAttribute('aria-valuetext')).toContain('Half plate');
    fireEvent.change(slider, { target: { value: '360' } });
    expect(slider.getAttribute('aria-valuetext')).toContain('midnight');
  });

  it('jumps to a moment from the chips', () => {
    wrap(<Compare />);
    const chips = within(screen.getByRole('list', { name: 'Jump to a moment' })).getAllByRole('button');
    expect(chips).toHaveLength(COMPARE.moments.length);
    fireEvent.click(chips[4]!);
    expect(chips[4]!.getAttribute('aria-current')).toBe('true');
    const slider = screen.getByRole('slider');
    expect(slider.getAttribute('aria-valuetext')).toContain('paneer');
  });

  it('renders the scorecard as a proper table, labelled illustrative, with text statuses and no numbers', () => {
    wrap(<Compare />);
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader')).toHaveLength(4);
    expect(within(table).getAllByRole('rowheader')).toHaveLength(COMPARE.scorecard.length);
    expect(table.querySelector('caption')?.textContent).toMatch(/Illustrative, not measured/);
    expect(within(table).getAllByText(COMPARE.statusLabels['not-yet']).length).toBeGreaterThan(3);
    expect(within(table).getAllByText(COMPARE.statusLabels.ahead).length).toBeGreaterThan(0);
    expect(table.textContent ?? '').not.toMatch(/\d+\s*%/);
    expect(screen.getByText(COMPARE.basisNote)).toBeTruthy();
  });
});

describe('HowItWorks', () => {
  it('lists the five steps in order with the honest payment line', () => {
    const { container } = wrap(<HowItWorks />);
    expect(container.querySelector('section#how')?.getAttribute('aria-labelledby')).toBe('how-title');
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(HOW.steps.map((s) => s.title));
    expect(screen.getByText(HOW.payInterim)).toBeTruthy();
    expect(screen.getByText(HOW.guaranteeLine)).toBeTruthy();
  });
});

describe('BuiltFor', () => {
  it('has one h2 and every business type (title, line, status) in the DOM', () => {
    const { container } = wrap(<BuiltFor />);
    expect(container.querySelector('section#builtfor')?.getAttribute('aria-labelledby')).toBe('builtfor-title');
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
    BUILT_FOR.items.forEach((it) => {
      expect(screen.getByRole('heading', { level: 3, name: it.title })).toBeTruthy();
      expect(screen.getAllByText(it.line).length).toBeGreaterThan(0);
    });
  });

  it('announces the type in front when the ring buttons or arrow keys are used', () => {
    wrap(<BuiltFor />);
    const status = screen.getByRole('status');
    expect(status.textContent).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Next business type' }));
    expect(status.textContent).toBe(`Showing ${BUILT_FOR.items[1]!.title}, 2 of ${BUILT_FOR.items.length}`);
    fireEvent.click(screen.getByRole('button', { name: 'Previous business type' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous business type' }));
    const last = BUILT_FOR.items.length - 1;
    expect(status.textContent).toBe(`Showing ${BUILT_FOR.items[last]!.title}, ${last + 1} of ${BUILT_FOR.items.length}`);
    fireEvent.keyDown(screen.getByRole('group', { name: /Business types/ }), { key: 'ArrowRight' });
    expect(status.textContent).toContain(BUILT_FOR.items[0]!.title);
  });

  it('lets the visitor pause the automatic rotation', () => {
    wrap(<BuiltFor />);
    const pause = screen.getByRole('button', { name: 'Pause automatic rotation' });
    expect(pause.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(pause);
    expect(screen.getByRole('button', { name: 'Resume automatic rotation' }).getAttribute('aria-pressed')).toBe('true');
  });
});

describe('Trust', () => {
  it('has one h2, six pillars with an evidence line, the "not yet" box, and no forbidden claims', () => {
    const { container } = wrap(<Trust />);
    const section = container.querySelector('section#trust');
    expect(section?.getAttribute('aria-labelledby')).toBe('trust-title');
    expect(section?.className).toContain('lp-edge-green');
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
    expect(screen.getAllByText(TRUST.backingLabel).length).toBeGreaterThanOrEqual(6);
    expect(screen.getByRole('heading', { level: 3, name: TRUST.notYet.title })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3, name: 'A record that proves itself' })).toBeTruthy();
    expect(screen.getByText(/Verify/, { selector: '.lp-rm__verify' })).toBeTruthy();
    expect(container.textContent ?? '').not.toMatch(/blockchain|data residency|uptime|tamper-proof|bank-grade/i);
  });
});
