import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import '../i18n';
import { hasSessionHint, setSessionHint } from './api';

function json(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
}

const calls: string[] = [];
beforeEach(() => {
  calls.length = 0;
  window.localStorage.clear();
  window.history.pushState({}, '', '/');
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith('/auth/refresh')) return json({ error: { message: 'no session' } }, 401);
      return json({}, 404);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('silent refresh hint (ADR-024: flag only, never a token)', () => {
  it('does not call /auth/refresh when no session was ever created here', async () => {
    render(<App />);
    await waitFor(() => expect(screen.queryByLabelText(/email/i)).toBeTruthy());
    expect(calls.some((u) => u.endsWith('/auth/refresh'))).toBe(false);
  });

  it('tries the refresh once when a previous sign-in left the hint, and clears it on 401', async () => {
    setSessionHint(true);
    render(<App />);
    await waitFor(() => expect(screen.queryByLabelText(/email/i)).toBeTruthy());
    expect(calls.filter((u) => u.endsWith('/auth/refresh'))).toHaveLength(1);
    expect(hasSessionHint()).toBe(false);
  });
});
