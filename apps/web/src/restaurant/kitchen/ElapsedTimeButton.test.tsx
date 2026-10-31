import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n';
import { ElapsedTimeButton } from './ElapsedTimeButton';
import { timelineApi, type OrderTimelineResponse } from './timelineApi';

vi.mock('./timelineApi', async (orig) => ({ ...(await orig<typeof import('./timelineApi')>()), timelineApi: { get: vi.fn() } }));
const get = vi.mocked(timelineApi.get);

const timeline = (over: Partial<OrderTimelineResponse> = {}): OrderTimelineResponse => ({
  steps: [
    { id: 'a', kind: 'created', action: 'service_request.draft_created', at: '2026-10-31T10:00:00.000Z', actor: { type: 'staff', label: 'Asha' }, sincePreviousMs: 0, sinceStartMs: 0, detail: {}, source: 'activity' },
    { id: 'b', kind: 'sent', action: 'service_request.sent', at: '2026-10-31T10:00:30.000Z', actor: { type: 'staff', label: 'Asha' }, sincePreviousMs: 30_000, sinceStartMs: 30_000, detail: { lineCount: 3 }, source: 'activity' },
    { id: 'c', kind: 'edited', action: 'service_request.edited', at: '2026-10-31T10:02:35.000Z', actor: { type: 'staff', label: 'Ravi' }, sincePreviousMs: 125_000, sinceStartMs: 155_000, detail: { editNumber: 1, changeCount: 2 }, source: 'activity' },
    { id: 'd', kind: 'ready', action: 'service_request.marked_ready', at: '2026-10-31T10:12:00.000Z', actor: { type: 'staff', label: 'Chef Mina' }, sincePreviousMs: 565_000, sinceStartMs: 720_000, detail: {}, source: 'activity' },
  ],
  finished: true,
  startedAt: '2026-10-31T10:00:00.000Z',
  endedAt: '2026-10-31T10:12:00.000Z',
  totalMs: 720_000,
  order: { id: 'o1', status: 'READY', roundNumber: 1, requestNumber: 'K-1', sentAt: '2026-10-31T10:00:30.000Z' },
  serverTime: '2026-10-31T10:12:05.000Z',
  ...over,
});

function mount() {
  return render(<ElapsedTimeButton orderId="o1" ticket="Table T4" label="12 min ago" late={false} refreshKey="SENT" />);
}
const chip = () => screen.getByRole('button', { name: /show order timeline/i });

beforeEach(() => get.mockReset());
afterEach(cleanup);

describe('ElapsedTimeButton (kitchen ticket timeline)', () => {
  it('is a small clickable label that does not fetch until it is opened', () => {
    mount();
    expect(chip().textContent).toContain('12 min ago');
    expect(chip().getAttribute('aria-expanded')).toBe('false');
    expect(get).not.toHaveBeenCalled();
  });

  it('opens a card listing every step with actor, time and the duration since the step before, plus the total', async () => {
    get.mockResolvedValue(timeline());
    mount();
    fireEvent.click(chip());
    const card = await screen.findByRole('dialog', { name: 'Order timeline' });
    expect(get).toHaveBeenCalledWith('o1');
    expect(chip().getAttribute('aria-expanded')).toBe('true');
    await screen.findByText('Sent to the kitchen');
    expect(card.textContent).toContain('Order started');
    expect(card.textContent).toContain('Order edited');
    expect(card.textContent).toContain('Chef Mina');
    expect(screen.getByText('2m 05s after the step before')).toBeTruthy();
    expect(screen.getByText('30s after the step before')).toBeTruthy();
    expect(screen.getByText('Edit 1 - 2 changes')).toBeTruthy();
    expect(screen.getByText('12m 00s')).toBeTruthy(); // total of a finished order
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
  });

  it('shows a loading state, then an empty state when nothing was recorded', async () => {
    let resolve!: (v: OrderTimelineResponse) => void;
    get.mockReturnValue(new Promise((r) => (resolve = r)));
    mount();
    fireEvent.click(chip());
    expect(await screen.findByRole('status', { name: 'Loading the timeline' })).toBeTruthy();
    resolve(timeline({ steps: [], totalMs: 0, startedAt: null, endedAt: null }));
    expect(await screen.findByText('Nothing has been recorded for this order yet.')).toBeTruthy();
  });

  it('shows an error with a retry that recovers', async () => {
    get.mockRejectedValueOnce({ status: 500 }).mockResolvedValueOnce(timeline());
    mount();
    fireEvent.click(chip());
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('Could not load the timeline')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('Sent to the kitchen');
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('closes on Escape and gives focus back to the label', async () => {
    get.mockResolvedValue(timeline());
    mount();
    fireEvent.click(chip());
    await screen.findByText('Sent to the kitchen');
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(chip());
  });

  it('closes with the Close button', async () => {
    get.mockResolvedValue(timeline());
    mount();
    fireEvent.click(chip());
    await screen.findByText('Sent to the kitchen');
    fireEvent.click(screen.getByRole('button', { name: 'Close timeline' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('closes when a press starts outside the card', async () => {
    get.mockResolvedValue(timeline());
    mount();
    fireEvent.click(chip());
    await screen.findByText('Sent to the kitchen');
    fireEvent.pointerDown(document.body, { button: 0 });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('does NOT close when a text selection starts inside the card and the mouse is released outside', async () => {
    get.mockResolvedValue(timeline());
    mount();
    fireEvent.click(chip());
    const text = await screen.findByText('Sent to the kitchen');
    fireEvent.pointerDown(text, { button: 0 }); // start selecting inside
    fireEvent.pointerUp(document.body, { button: 0 }); // release outside
    fireEvent.click(document.body); // the browser's click lands on the common ancestor
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByRole('dialog', { name: 'Order timeline' })).toBeTruthy();
  });

  it('toggles from the label itself', async () => {
    get.mockResolvedValue(timeline());
    mount();
    fireEvent.pointerDown(chip(), { button: 0 });
    fireEvent.click(chip());
    await screen.findByText('Sent to the kitchen');
    fireEvent.pointerDown(chip(), { button: 0 });
    fireEvent.click(chip());
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('re-reads the timeline when the ticket changes while the card is open', async () => {
    get.mockResolvedValue(timeline());
    const { rerender } = mount();
    fireEvent.click(chip());
    await screen.findByText('Sent to the kitchen');
    rerender(<ElapsedTimeButton orderId="o1" ticket="Table T4" label="12 min ago" late={false} refreshKey="PREPARING" />);
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    expect(screen.getByText('Sent to the kitchen')).toBeTruthy(); // last good data stays while refreshing
  });
});
