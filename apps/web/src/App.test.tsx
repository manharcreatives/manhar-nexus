import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import './i18n';

// No backend in the unit environment: make the silent-refresh fetch fail so the
// app resolves to the unauthenticated (sign-in) state deterministically.
beforeEach(() => {
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
});
