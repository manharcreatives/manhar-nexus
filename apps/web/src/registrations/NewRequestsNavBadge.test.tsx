import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../i18n';

// A plain function (not vi.fn) so a rejected result is not also tracked by the mock's own bookkeeping.
let reply: () => Promise<{ total: number }> = () => Promise.resolve({ total: 0 });
const calls: unknown[] = [];
vi.mock('./api', () => ({
  listRegistrations: (arg: unknown) => {
    calls.push(arg);
    return reply();
  },
}));

import { NEW_REQUESTS_REFRESH_MS, NewRequestsNavBadge } from './NewRequestsNavBadge';

const total = (n: number) => () => Promise.resolve({ total: n });

beforeEach(() => {
  calls.length = 0;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('NewRequestsNavBadge', () => {
  it('asks only for the NEW count (take=1) and shows it', async () => {
    reply = total(3);
    render(<NewRequestsNavBadge />);
    expect(await screen.findByText('3')).toBeTruthy();
    expect(calls[0]).toEqual({ status: 'NEW', take: 1 });
    expect(screen.getByLabelText('3 new requests')).toBeTruthy();
  });

  it('shows nothing when there are none', async () => {
    reply = total(0);
    const { container } = render(<NewRequestsNavBadge />);
    await waitFor(() => expect(calls.length).toBe(1));
    await act(async () => undefined);
    expect(container.textContent).toBe('');
  });

  it('shows nothing when the call fails', async () => {
    reply = () => Promise.reject(new Error('offline'));
    const { container } = render(<NewRequestsNavBadge />);
    await waitFor(() => expect(calls.length).toBe(1));
    await act(async () => undefined);
    expect(container.textContent).toBe('');
  });

  it('caps at 99+', async () => {
    reply = total(250);
    render(<NewRequestsNavBadge />);
    expect(await screen.findByText('99+')).toBeTruthy();
  });

  it('refreshes on tab focus and once a minute', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    reply = total(1);
    render(<NewRequestsNavBadge />);
    expect(await screen.findByText('1')).toBeTruthy();
    reply = total(2);
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(await screen.findByText('2')).toBeTruthy();
    reply = total(4);
    await act(async () => {
      vi.advanceTimersByTime(NEW_REQUESTS_REFRESH_MS);
    });
    expect(await screen.findByText('4')).toBeTruthy();
  });
});
