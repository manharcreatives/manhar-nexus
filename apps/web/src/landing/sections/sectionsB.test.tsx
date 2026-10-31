import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BUILT_FOR, COMPARE, HOW, NEXUS_MENU, PLATFORM, QR_MENU_LIVE, TRUST } from '../content';
import BuiltFor from './BuiltFor';
import Compare from './Compare';
import HowItWorks from './HowItWorks';
import NexusMenu from './NexusMenu';
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
  it('has one h2 and highlights 4 to 6 modules as cards, in the planned order', () => {
    const { container } = wrap(<Platform />);
    const section = container.querySelector('section#platform');
    expect(section?.getAttribute('aria-labelledby')).toBe('platform-title');
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
    const cards = within(screen.getByRole('list', { name: 'Headline modules' })).getAllByRole('listitem');
    expect(cards.length).toBeGreaterThanOrEqual(4);
    expect(cards.length).toBeLessThanOrEqual(6);
    expect(cards).toHaveLength(PLATFORM.headlineIds.length);
    PLATFORM.headlineIds.forEach((id, i) => {
      const m = PLATFORM.modules.find((x) => x.id === id) ?? PLATFORM.comingSoon.find((x) => x.id === id);
      expect(m, id).toBeTruthy();
      expect(within(cards[i]!).getByRole('heading', { level: 3, name: m!.title })).toBeTruthy();
      expect(within(cards[i]!).getByText(m!.summary)).toBeTruthy();
    });
  });

  it('keeps every card summary short and puts the other live modules in the "and also" strip', () => {
    wrap(<Platform />);
    for (const m of PLATFORM.modules) expect(m.summary.length, m.id).toBeLessThanOrEqual(120);
    const also = within(screen.getByRole('list', { name: PLATFORM.alsoTitle })).getAllByRole('listitem');
    expect(also).toHaveLength(PLATFORM.modules.length - PLATFORM.headlineIds.filter((id) => PLATFORM.modules.some((m) => m.id === id)).length);
  });

  it('marks live modules LIVE and lists the roadmap as one muted line, never as live', () => {
    const { container } = wrap(<Platform />);
    const liveCards = PLATFORM.headlineIds.filter((id) => PLATFORM.modules.some((m) => m.id === id)).length;
    expect(screen.getAllByText(PLATFORM.liveTag)).toHaveLength(liveCards);
    const soon = container.querySelector('.lp-pf__soonlist')?.textContent ?? '';
    PLATFORM.comingSoon.forEach((m) => expect(soon).toContain(m.title));
    expect(container.querySelector('.lp-pf__soontag')?.textContent).toBe(PLATFORM.comingSoonTitle);
  });

  it('leads with Nexus Menu when it is live and links to its showcase', () => {
    wrap(<Platform />);
    if (QR_MENU_LIVE) {
      expect(PLATFORM.headlineIds[0]).toBe('nexus-menu');
      expect(screen.getByRole('link', { name: /See Nexus Menu/ }).getAttribute('href')).toBe('#nexus-menu');
    } else {
      expect(PLATFORM.modules.some((m) => m.id === 'nexus-menu')).toBe(false);
    }
  });
});

describe('Nexus Menu', () => {
  it('is the #nexus-menu section with one h2, three features and an honest payment note', () => {
    const { container } = wrap(<NexusMenu />);
    expect(container.querySelector('section#nexus-menu')?.getAttribute('aria-labelledby')).toBe('nexus-menu-title');
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
    expect(container.querySelector('h2 .lp-accent')?.textContent).toBe(NEXUS_MENU.headline.accent);
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(NEXUS_MENU.features.length);
    expect(screen.getByText(NEXUS_MENU.note)).toBeTruthy();
    expect(screen.getByText(NEXUS_MENU.statusTag)).toBeTruthy();
    expect(container.textContent ?? '').not.toMatch(/\d+\s*%|customers love|rated|guarantee[sd]? uptime/i);
  });

  it('describes the layered scene once and hides the decorative parts from assistive tech', () => {
    const { container } = wrap(<NexusMenu />);
    const stage = container.querySelector('.lp-nm__stage');
    expect(stage?.getAttribute('role')).toBe('img');
    expect(stage?.getAttribute('aria-label') ?? '').toMatch(/Sample data/);
    expect(container.querySelector('.lp-nm__scene')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('offers a demo request and a link to pricing', () => {
    wrap(<NexusMenu />);
    expect(screen.getByRole('link', { name: NEXUS_MENU.primaryCta }).getAttribute('href')).toBe('#register?begin=demo');
    expect(screen.getByRole('link', { name: NEXUS_MENU.secondaryCta }).getAttribute('href')).toBe('#pricing');
  });
});

describe('Compare', () => {
  it('has one h2 and keeps all five moments in the DOM, in order', () => {
    const { container } = wrap(<Compare />);
    expect(container.querySelector('section#why')?.getAttribute('aria-labelledby')).toBe('why-title');
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
    expect(COMPARE.moments).toHaveLength(5);
    const moments = within(screen.getByRole('list', { name: /moment by moment/ })).getAllByRole('listitem');
    expect(moments).toHaveLength(COMPARE.moments.length);
    COMPARE.moments.forEach((m, i) => {
      expect(within(moments[i]!).getByText(m.clock)).toBeTruthy();
      expect(within(moments[i]!).getByText(m.with)).toBeTruthy();
      expect(within(moments[i]!).getByText(m.without)).toBeTruthy();
    });
  });

  it('opens one moment at a time from the timeline buttons', () => {
    const { container } = wrap(<Compare />);
    const stops = within(screen.getByRole('list', { name: 'Pick a moment of the night' })).getAllByRole('button');
    expect(stops).toHaveLength(COMPARE.moments.length);
    expect(stops[0]!.getAttribute('aria-current')).toBe('true');
    fireEvent.click(stops[4]!);
    expect(stops[4]!.getAttribute('aria-current')).toBe('true');
    expect(stops[0]!.getAttribute('aria-current')).toBeNull();
    const current = container.querySelectorAll('.lp-cs__m[data-state="current"]');
    expect(current).toHaveLength(1);
    expect(current[0]!.textContent).toContain(COMPARE.moments[4]!.title);
  });

  it('keeps the scorecard behind a disclosure; it is a proper table, labelled illustrative, with text statuses and no numbers', () => {
    const { container } = wrap(<Compare />);
    const details = container.querySelector('details.lp-cs__score') as HTMLDetailsElement;
    expect(details).toBeTruthy();
    expect(details.open).toBe(false);
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
  it('lists the four steps in order with the honest payment line', () => {
    const { container } = wrap(<HowItWorks />);
    expect(container.querySelector('section#how')?.getAttribute('aria-labelledby')).toBe('how-title');
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
    expect(HOW.steps).toHaveLength(4);
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
  it('has one h2, four pillars with an evidence line, the "not yet" box, and no forbidden claims', () => {
    const { container } = wrap(<Trust />);
    const section = container.querySelector('section#trust');
    expect(section?.getAttribute('aria-labelledby')).toBe('trust-title');
    expect(section?.className).toContain('lp-edge-green');
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
    expect(TRUST.blocks).toHaveLength(4);
    expect(screen.getAllByText(TRUST.backingLabel)).toHaveLength(4);
    expect(screen.getByRole('heading', { level: 3, name: TRUST.notYet.title })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3, name: 'A record that proves itself' })).toBeTruthy();
    expect(screen.getByText(/Verify/, { selector: '.lp-rm__verify' })).toBeTruthy();
    expect(container.textContent ?? '').not.toMatch(/blockchain|data residency|uptime|tamper-proof|bank-grade/i);
  });
});

describe('dark theme rules in the W1 styles', () => {
  const names = ['landing', 'ui', 'chrome', 'hero', 'intro', 'about', 'platform', 'nexusmenu', 'compare', 'how', 'builtfor', 'trust', 'cta'];
  const css = names.map((n) => ({ n, text: readFileSync(resolve(process.cwd(), 'src/landing', n === 'landing' ? 'landing.css' : `styles/${n}.css`), 'utf8') }));

  it('never uses the old greens, pure black, gold or a light canvas', () => {
    for (const { n, text } of css) {
      expect(text, n).not.toMatch(/#22c55e|#16a34a|#4ade80/i);
      expect(text, n).not.toMatch(/#000(000)?(?![0-9a-f])/i);
      expect(text, n).not.toMatch(/#f7f9f7|#eef2ef|gold|#d4af37/i);
    }
  });

  it('uses gradients only as alpha masks, white-alpha edges, or the two brand pairs', () => {
    const ok = /(#1dba3c|#35d445|#0b0f0e|#121a16|transparent|content-box|linear-gradient|radial-gradient|exclude|[0-9]+|deg|%|currentColor|var\(--lp-(ink|fg|canvas|surface|green|night)\)|#0000|rgb\(255 255 255 \/ [0-9.]+\)|[0-9.]+(%|deg|em|px|rem)|to (top|bottom|left|right)|at \S+( \S+)?|circle|[0-9]+%)/gi;
    for (const { n, text } of css) {
      for (const m of text.matchAll(/(?:linear|radial)-gradient\(([^;]*)\)/g)) {
        const rest = m[1]!.replace(/var\(--[a-z-]+\)|rgb\([^)]*\)|[,\s]+|calc\([^)]*\)/gi, ' ').replace(ok, '').replace(/[()\s,/]+/g, '');
        expect(rest, `${n}: ${m[0]}`).toBe('');
      }
    }
  });
});
