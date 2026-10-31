import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import '../i18n';
import { setAccessToken } from './api';
import { resetTabSessionForTests } from './tabSession';
import { FakeAuthServer, installBrowser, uninstallBrowser } from './testing/fakeAuthServer';

vi.mock('../realtime/RealtimeProvider', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../realtime/RealtimeProvider')>()),
  RealtimeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

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

let server: FakeAuthServer;
beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  resetTabSessionForTests();
  setAccessToken(null);
  window.history.pushState({}, '', '/login');
  server = new FakeAuthServer();
  installBrowser(server);
});
afterEach(() => {
  cleanup();
  uninstallBrowser();
  setAccessToken(null);
});

async function signInAs(email: string, remember: boolean | null) {
  fireEvent.change(await screen.findByLabelText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pw' } });
  if (remember !== null) {
    const box = screen.getByRole('checkbox', { name: /Keep me signed in/ }) as HTMLInputElement;
    if (box.checked !== remember) fireEvent.click(box);
  }
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  });
}
const menuButton = (name: string) => screen.findByRole('button', { name: new RegExp(`Account menu for ${name}`) });
const loginCall = () => server.calls.find((c) => c.path === '/auth/login')!;

describe('sign-in screen and per-tab sessions (UI)', () => {
  it('offers "keep me signed in" ticked by default, and a normal sign-in is the device session as before', async () => {
    render(<App />);
    const box = (await screen.findByRole('checkbox', { name: /Keep me signed in/ })) as HTMLInputElement;
    expect(box.checked).toBe(true);
    await signInAs('owner@cafe.test', null);
    await menuButton('Owner Olive');
    expect(loginCall().slot).toBeNull();
    expect(window.localStorage.getItem('nx.session')).toBe('1');
    expect(window.sessionStorage.getItem('nx.slot')).toBeNull();
  });

  it('unticked = this tab only: own slot, device hint untouched, survives a reload, sign-out is local', async () => {
    const first = render(<App />);
    await signInAs('cashier@cafe.test', false);
    const btn = await menuButton('Cashier Chen');
    expect(loginCall().slot).toMatch(/^[0-9a-f]{32}$/);
    expect(window.sessionStorage.getItem('nx.slot')).toBe(loginCall().slot);
    expect(window.localStorage.getItem('nx.session')).toBeNull();

    // The menu says so.
    fireEvent.click(btn);
    expect(within(screen.getByRole('menu')).queryByRole('menuitem', { name: 'Switch account in this tab' })).toBeTruthy();
    expect(screen.getByText('This tab only')).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });

    // Reload: a fresh page with no access token silently signs the SAME user back in from the slot cookie.
    first.unmount();
    setAccessToken(null);
    resetTabSessionForTests();
    uninstallBrowser(); // the old page is gone: its Web Locks go with it
    installBrowser(server);
    render(<App />);
    await menuButton('Cashier Chen');
    const refresh = server.calls.filter((c) => c.path === '/auth/refresh');
    expect(refresh).toHaveLength(1);
    expect(refresh[0].slot).toBe(loginCall().slot);
    expect(refresh[0].status).toBe(200);
  });

  it('after a tab-only sign-out the same tab offers a tab-only sign-in (it never grabs the device session)', async () => {
    render(<App />);
    await signInAs('cashier@cafe.test', false);
    fireEvent.click(await menuButton('Cashier Chen'));
    await act(async () => {
      fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Sign out' }));
    });
    expect(await screen.findByText('Sign in to Manhar Nexus')).toBeTruthy();
    expect(window.sessionStorage.getItem('nx.slot')).toBeNull();
    expect(screen.queryByRole('checkbox', { name: /Keep me signed in/ })).toBeNull();
    expect(screen.getByText(/This tab signs in on its own/)).toBeTruthy();
    expect(server.jar.size).toBe(0);
  });

  it('"Switch account in this tab" on a device session leaves the device session running and signs in tab-only', async () => {
    window.localStorage.setItem('nx.session', '1');
    // The device session already exists in the browser (another tab signed in earlier).
    await server.fetch('http://localhost:3000/auth/login', { method: 'POST', body: JSON.stringify({ email: 'owner@cafe.test', password: 'pw' }) });
    server.calls.length = 0;

    render(<App />);
    fireEvent.click(await menuButton('Owner Olive')); // silent device refresh signed us in
    await act(async () => {
      fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Switch account in this tab' }));
    });
    expect(await screen.findByText(/This tab signs in on its own/)).toBeTruthy();
    expect(server.calls.some((c) => c.path === '/auth/logout')).toBe(false); // the device session was NOT ended
    expect(window.localStorage.getItem('nx.session')).toBe('1');

    await signInAs('waiter@cafe.test', null); // no checkbox here: tab-only
    await menuButton('Waiter Wu');
    expect(loginCall().slot).toMatch(/^[0-9a-f]{32}$/);
    expect(server.jar.has('nexus_refresh')).toBe(true); // the owner's device cookie is still there
    expect(window.localStorage.getItem('nx.session')).toBe('1');
  });

  it('shows a clear notice when this browser\'s device account was replaced by another sign-in', async () => {
    render(<App />);
    await signInAs('owner@cafe.test', true);
    await menuButton('Owner Olive');
    // Another tab signs in as someone else on the device, replacing the shared cookie.
    await server.fetch('http://localhost:3000/auth/login', { method: 'POST', body: JSON.stringify({ email: 'cashier@cafe.test', password: 'pw' }) });
    const { tryRefresh } = await import('./api');
    await act(async () => {
      await tryRefresh();
    });
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/different account/));
  });
});
