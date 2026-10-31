import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import './i18n';

// No backend in the unit environment: make the silent-refresh fetch fail so the
// app resolves to the unauthenticated (sign-in) state deterministically.
beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.pushState({}, '', '/login');
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no network')));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('App auth gate', () => {
  it('shows the sign-in screen when there is no session', async () => {
    render(<App />);
    expect(await screen.findByText('Sign in to Manhar Nexus')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
  });

  it('renders the brand name on the sign-in screen', async () => {
    render(<App />);
    expect(await screen.findAllByText('Manhar Nexus')).toBeTruthy();
  });

  it('shows the public website (one h1, no sign-in form) at "/" when signed out', async () => {
    window.history.pushState({}, '', '/');
    render(<App />);
    const h1 = await screen.findByRole('heading', { level: 1 }, { timeout: 8000 });
    expect(h1.textContent?.length).toBeGreaterThan(10);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.queryByText('Sign in to Manhar Nexus')).toBeNull();
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toBeTruthy();
    expect(screen.getByRole('banner')).toBeTruthy();
    expect(screen.getByRole('contentinfo')).toBeTruthy();
    expect(document.documentElement.dataset.surface).toBe('landing');
  });

  it('shows a policy page at /terms when signed out', async () => {
    window.history.pushState({}, '', '/terms');
    render(<App />);
    expect((await screen.findByRole('heading', { level: 1 }, { timeout: 8000 })).textContent).toMatch(/Terms/i);
    expect(screen.queryByText('Sign in to Manhar Nexus')).toBeNull();
  });

  it('keeps the sign-in screen for unknown or private paths (return-to-view)', async () => {
    window.history.pushState({}, '', '/bills');
    render(<App />);
    expect(await screen.findByText('Sign in to Manhar Nexus')).toBeTruthy();
  });
});
