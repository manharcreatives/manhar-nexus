import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../i18n';
import ClaimApp from './ClaimApp';
import { claimTokenFromHash, isClaimPath } from './path';

const TOKEN = 'tok_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789';
const reply = (status: number, body?: unknown): Response =>
  ({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body ?? {}) }) as unknown as Response;

function open(hash: string) {
  window.history.replaceState(null, '', `/set-password${hash}`);
}

async function fill(password: string, confirm = password) {
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: confirm } });
  fireEvent.click(screen.getByRole('button', { name: 'Save password' }));
}

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.head.querySelectorAll('meta[name="robots"]').forEach((m) => m.remove());
});

describe('claim path helpers', () => {
  it('recognises only /set-password, with or without a trailing slash', () => {
    expect(isClaimPath('/set-password')).toBe(true);
    expect(isClaimPath('/set-password/')).toBe(true);
    expect(isClaimPath('/set-password-now')).toBe(false);
    expect(isClaimPath('/login')).toBe(false);
  });
  it('reads the token only from a #t= fragment of a sensible size', () => {
    expect(claimTokenFromHash(`#t=${TOKEN}`)).toBe(TOKEN);
    expect(claimTokenFromHash('#t=short')).toBeNull();
    expect(claimTokenFromHash(`#x=${TOKEN}`)).toBeNull();
    expect(claimTokenFromHash('')).toBeNull();
  });
});

describe('ClaimApp: the owner chooses a password', () => {
  it('clears the token from the address bar at once and marks the page noindex', async () => {
    open(`#t=${TOKEN}`);
    render(<ClaimApp />);
    await waitFor(() => expect(window.location.hash).toBe(''));
    expect(window.location.pathname).toBe('/set-password');
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toContain('noindex');
    expect(screen.getByLabelText('New password')).toBeTruthy();
  });

  it('checks the password before calling the server', async () => {
    open(`#t=${TOKEN}`);
    render(<ClaimApp />);
    await fill('short1');
    expect(await screen.findAllByRole('alert')).toBeTruthy();
    await fill('GoodPassword123', 'Different12345');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('redeems the token with the new password, shows the restaurant and a sign-in button', async () => {
    open(`#t=${TOKEN}`);
    fetchMock.mockResolvedValue(reply(200, { email: 'asha@example.com', businessName: 'Ananda Cafe' }));
    render(<ClaimApp />);
    await fill('GoodPassword123');
    expect(await screen.findByText('Your account for Ananda Cafe is ready.')).toBeTruthy();
    expect(screen.getByText(/asha@example.com/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Go to sign in' }).getAttribute('href')).toBe('/login');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/public\/claim\/redeem$/);
    expect(JSON.parse(init.body as string)).toEqual({ token: TOKEN, password: 'GoodPassword123' });
    expect(init.credentials).toBe('omit');
    expect(url).not.toContain(TOKEN);
  });

  it('an invalid link offers a WhatsApp button with a prefilled message', () => {
    open('');
    render(<ClaimApp />);
    const wa = document.querySelector('a[href^="https://wa.me/"]') as HTMLAnchorElement;
    expect(wa).not.toBeNull();
    expect(decodeURIComponent(wa.getAttribute('href') ?? '')).toContain('my set-password link expired');
  });

  it('an expired, used or invalid link (400/404) shows one plain message, and the token is forgotten', async () => {
    open(`#t=${TOKEN}`);
    fetchMock.mockResolvedValue(reply(404));
    render(<ClaimApp />);
    await fill('GoodPassword123');
    expect(await screen.findByText(/no longer valid/)).toBeTruthy();
    expect(screen.queryByLabelText('New password')).toBeNull();
  });

  it('too many tries (429) keeps the form so the owner can wait and retry', async () => {
    open(`#t=${TOKEN}`);
    fetchMock.mockResolvedValue(reply(429));
    render(<ClaimApp />);
    await fill('GoodPassword123');
    expect(await screen.findByText(/Too many tries/)).toBeTruthy();
    expect(screen.getByLabelText('New password')).toBeTruthy();
  });

  it('a network failure keeps the form with a plain message', async () => {
    open(`#t=${TOKEN}`);
    fetchMock.mockRejectedValue(new Error('offline'));
    render(<ClaimApp />);
    await fill('GoodPassword123');
    expect(await screen.findByText(/No connection/)).toBeTruthy();
  });

  it('opening the page with no token says the link is not valid and calls nothing', () => {
    open('');
    render(<ClaimApp />);
    expect(screen.getByRole('alert').textContent).toContain('no longer valid');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
