import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import '../i18n';

// The live stream is not under test here.
vi.mock('../realtime/RealtimeProvider', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../realtime/RealtimeProvider')>()),
  RealtimeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const me = { id: 'u-1', email: 'asha@cafe.in', displayName: 'Asha Mehta', realm: 'BUSINESS', businessId: 'b-1', roles: [{ key: 'owner', name: 'Owner' }] };

function json(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.localStorage.setItem('nx.session', '1'); // a previous sign-in: allows the silent refresh
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) return json({ accessToken: 'tok' });
      if (url.endsWith('/auth/me')) return json(me);
      if (url.endsWith('/admin/locations')) return json([{ id: 'l-1', name: 'Bandra', code: 'BND', timezone: null, status: 'ACTIVE' }, { id: 'l-2', name: 'Colaba', code: null, timezone: null, status: 'ACTIVE' }]);
      if (url.endsWith('/admin/business')) return json({ id: 'b-1', name: 'Cafe Ember' });
      return json({ error: { message: 'not mocked' } }, 404);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('signed-in routing', () => {
  it('redirects /login to the app instead of showing an in-app 404', async () => {
    window.history.pushState({}, '', '/login');
    render(<App />);
    expect(await screen.findByRole('button', { name: /Working location/ })).toBeTruthy();
    expect(window.location.pathname).toBe('/');
  });

  it('shows policy pages (public documents) in the website shell, not the app', async () => {
    window.history.pushState({}, '', '/privacy');
    render(<App />);
    expect((await screen.findByRole('heading', { level: 1 }, { timeout: 8000 })).textContent).toMatch(/Privacy/i);
    expect(screen.queryByRole('button', { name: /Working location/ })).toBeNull();
  });
});
