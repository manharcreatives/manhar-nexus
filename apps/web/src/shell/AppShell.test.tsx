import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import '../i18n';

// jsdom has no modal dialog support; emulate the bits the shell relies on.
beforeAll(() => {
  const proto = HTMLDialogElement.prototype as HTMLDialogElement & { __patched?: boolean };
  if (proto.__patched) return;
  proto.__patched = true;
  proto.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  proto.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});

const me = {
  id: 'u-1',
  email: 'asha@cafe.in',
  displayName: 'Asha Mehta',
  realm: 'BUSINESS',
  businessId: 'b-1',
  roles: [{ key: 'owner', name: 'Owner' }],
};
const allLocations = [
  { id: 'l-1', name: 'Bandra', code: 'BND', timezone: null, status: 'ACTIVE' },
  { id: 'l-2', name: 'Colaba', code: null, timezone: null, status: 'ACTIVE' },
  { id: 'l-3', name: 'Closed one', code: null, timezone: null, status: 'INACTIVE' },
];

let locations = [...allLocations];

function json(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
}

beforeEach(() => {
  locations = [...allLocations];
  window.localStorage.clear();
  window.history.pushState({}, '', '/');
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) return json({ accessToken: 'tok' });
      if (url.endsWith('/auth/me')) return json(me);
      if (url.endsWith('/admin/locations')) return json(locations);
      if (url.endsWith('/admin/business')) return json({ id: 'b-1', name: 'Cafe Ember' });
      return json({ error: { message: 'not mocked' } }, 404);
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
});

async function renderShell() {
  render(<App />);
  return screen.findByRole('button', { name: /Working location/ });
}

describe('AppShell header', () => {
  it('shows business, location switcher and switches without reload', async () => {
    const switcher = await renderShell();
    expect(await screen.findByText('Cafe Ember')).toBeTruthy();
    expect(switcher.textContent).toContain('All locations');

    fireEvent.click(switcher);
    const list = screen.getByRole('listbox');
    const options = within(list).getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([
      expect.stringContaining('All locations'),
      expect.stringContaining('Bandra'),
      expect.stringContaining('Colaba'),
    ]); // inactive location hidden

    fireEvent.keyDown(list, { key: 'ArrowDown' });
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    fireEvent.keyDown(list, { key: 'Enter' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(switcher.textContent).toContain('Colaba');
    expect(document.activeElement).toBe(switcher);
    expect(window.localStorage.getItem('nexus.workLocation.v1:u-1')).toBe('l-2');
  });

  it('shows no switcher (and no chevron) when the business has a single location', async () => {
    locations = [allLocations[0]];
    render(<App />);
    expect(await screen.findByText('Bandra')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Working location/ })).toBeNull();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('closes the switcher on Escape and returns focus', async () => {
    const switcher = await renderShell();
    fireEvent.keyDown(switcher, { key: 'ArrowDown' });
    const list = screen.getByRole('listbox');
    fireEvent.keyDown(list, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(switcher);
  });

  it('user menu shows identity, role, version and signs out', async () => {
    await renderShell();
    fireEvent.click(screen.getByRole('button', { name: /Account menu for Asha Mehta/ }));
    const menu = screen.getByRole('menu');
    expect(screen.getByText('asha@cafe.in')).toBeTruthy();
    expect(screen.getByText('Owner')).toBeTruthy();
    expect(screen.getByText(/Version \d+\.\d+\.\d+/)).toBeTruthy();
    const items = within(menu).getAllByRole('menuitem');
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(menu, { key: 'End' });
    expect(document.activeElement).toBe(items[items.length - 1]);
    await act(async () => {
      fireEvent.click(within(menu).getByRole('menuitem', { name: 'Sign out' }));
    });
    expect(await screen.findByText('Sign in to Manhar Nexus')).toBeTruthy();
  });

  it('opens the command palette with Ctrl+K and navigates', async () => {
    await renderShell();
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'kds' } });
    const options = screen.getAllByRole('option');
    expect(options[0].textContent).toContain('Kitchen Display');
    vi.useFakeTimers();
    try {
      fireEvent.keyDown(input, { key: 'Enter' });
      act(() => {
        vi.runAllTimers();
      });
    } finally {
      vi.useRealTimers();
    }
    expect(window.location.pathname).toBe('/kitchen');
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('g t goes to Tables, but not while typing', async () => {
    await renderShell();
    const field = document.createElement('input');
    document.body.appendChild(field);
    fireEvent.keyDown(field, { key: 'g' });
    fireEvent.keyDown(field, { key: 't' });
    expect(window.location.pathname).toBe('/');
    field.remove();

    fireEvent.keyDown(window, { key: 'g' });
    fireEvent.keyDown(window, { key: 't' });
    expect(window.location.pathname).toBe('/tables');
  });

  it('? opens the shortcut help', async () => {
    await renderShell();
    fireEvent.keyDown(window, { key: '?', shiftKey: true });
    expect(screen.getByText('Go to Kitchen Display')).toBeTruthy();
  });
});
