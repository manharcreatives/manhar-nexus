import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n';
import { ToastProvider } from '../../ui/Toast';
import { orderApi } from '../api';
import { OrderEditDialog } from './OrderEditDialog';
import { orderEditApi } from './orderEditApi';
import { MENU_CATEGORIES, MENU_ITEMS, apiError, line, makeOrder, patchDialog } from './testFixtures';

vi.mock('../api', async (orig) => ({
  ...(await orig<typeof import('../api')>()),
  orderApi: { get: vi.fn() },
  catalogApi: { listModifierGroups: vi.fn(() => Promise.resolve([])) },
}));
vi.mock('./orderEditApi', async (orig) => ({
  ...(await orig<typeof import('./orderEditApi')>()),
  orderEditApi: { edit: vi.fn(), state: vi.fn() },
}));

patchDialog();

const allowed = { editable: { allowed: true }, edits: [] as never[] };
const locked = (reason: string) => ({ editable: { allowed: false, reason, message: 'server text' }, edits: [] as never[] });

beforeEach(() => {
  vi.mocked(orderApi.get).mockReset().mockResolvedValue(makeOrder());
  vi.mocked(orderEditApi.state).mockReset().mockResolvedValue(allowed as never);
  vi.mocked(orderEditApi.edit).mockReset().mockImplementation((_id, body) =>
    Promise.resolve({ ...makeOrder({ version: body.expectedVersion + 1, editCount: 1 }), edit: { id: 'e-1', editNumber: 1, replayed: false } }),
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function open(order = makeOrder()) {
  const onSaved = vi.fn();
  const onClose = vi.fn();
  render(
    <ToastProvider>
      <OrderEditDialog order={order} tableCode="T4" categories={MENU_CATEGORIES} items={MENU_ITEMS} onSaved={onSaved} onClose={onClose} />
    </ToastProvider>,
  );
  await screen.findByRole('region', { name: 'Added to order' });
  const menu = () => screen.getByRole('region', { name: 'Menu items' });
  const added = () => screen.getByRole('region', { name: 'Added to order' });
  const save = () => screen.getByRole('button', { name: 'Save changes' }) as HTMLButtonElement;
  return { onSaved, onClose, menu, added, save };
}

describe('OrderEditDialog: edit before the kitchen starts', () => {
  it('loads the latest order and its edit state, with the saved lines as "Sent to kitchen" in their own zone', async () => {
    const { added, menu, save } = await open();
    expect(orderApi.get).toHaveBeenCalledWith('o-1');
    expect(orderEditApi.state).toHaveBeenCalledWith('o-1');
    expect(within(added()).getByText('Masala Dosa')).toBeTruthy();
    expect(within(added()).getAllByText('Sent to kitchen')).toHaveLength(2);
    expect(within(menu()).getByRole('button', { name: 'Add one Sweet Lassi' })).toBeTruthy();
    expect(screen.getByText(/marked as edited/)).toBeTruthy();
    expect(save().disabled).toBe(true); // nothing changed yet
    expect(screen.getByText('No changes yet')).toBeTruthy();
  });

  it('saves one append-only edit: version + idempotency key + only the differences', async () => {
    const { added, menu, save, onSaved } = await open();
    fireEvent.click(within(added()).getByRole('button', { name: 'Add one Masala Dosa' })); // 2 -> 3
    fireEvent.click(within(menu()).getByRole('button', { name: 'Add one Sweet Lassi' })); // new line
    fireEvent.click(within(added()).getByRole('button', { name: 'Remove Paneer Tikka from the order' }));
    expect(within(added()).getByText('Removing')).toBeTruthy();
    expect(within(added()).getByText('New')).toBeTruthy();
    expect(screen.getByText('3 changes')).toBeTruthy();

    expect(save().disabled).toBe(false);
    fireEvent.click(save());
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));

    expect(orderEditApi.edit).toHaveBeenCalledTimes(1);
    const [id, body] = vi.mocked(orderEditApi.edit).mock.calls[0] ?? [];
    expect(id).toBe('o-1');
    expect(body?.expectedVersion).toBe(3);
    expect(body?.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
    expect(body?.ops).toEqual([
      { op: 'update', lineId: 'l-1', quantity: 3 },
      { op: 'remove', lineId: 'l-2' },
      { op: 'add', line: { catalogItemId: 'i-lassi', quantity: 1, modifiers: [] } },
    ]);
    expect(body).not.toHaveProperty('notes');
    expect(onSaved.mock.calls[0]?.[0]).toMatchObject({ version: 4 });
  });

  it('notes: line notes and the order note go out only when changed; a reason is optional', async () => {
    const { added, save, onSaved } = await open();
    fireEvent.click(within(added()).getByRole('button', { name: 'Add note: Masala Dosa' }));
    const box = within(added()).getByRole('textbox', { name: 'Note for Masala Dosa' });
    fireEvent.change(box, { target: { value: 'extra crispy' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    fireEvent.change(screen.getByLabelText('Order note'), { target: { value: 'Birthday' } });
    fireEvent.change(screen.getByLabelText('Reason for the change (optional)'), { target: { value: 'guest asked' } });
    fireEvent.click(save());
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const body = vi.mocked(orderEditApi.edit).mock.calls[0]?.[1];
    expect(body?.ops).toEqual([{ op: 'update', lineId: 'l-1', notes: 'extra crispy' }]);
    expect(body?.notes).toBe('Birthday');
    expect(body?.reason).toBe('guest asked');
  });

  it('removing is undoable until saved', async () => {
    const { added, save } = await open();
    fireEvent.click(within(added()).getByRole('button', { name: 'Remove Paneer Tikka from the order' }));
    expect(save().disabled).toBe(false);
    fireEvent.click(within(added()).getByRole('button', { name: 'Undo remove Paneer Tikka' }));
    expect(save().disabled).toBe(true);
    expect(within(added()).queryByText('Removing')).toBeNull();
  });

  it('refuses to empty the order: Save is disabled with the reason (that is a cancellation)', async () => {
    const { added, save } = await open();
    fireEvent.click(within(added()).getByRole('button', { name: 'Remove Masala Dosa from the order' }));
    fireEvent.click(within(added()).getByRole('button', { name: 'Remove Paneer Tikka from the order' }));
    expect(save().disabled).toBe(true);
    expect(screen.getByText(/must keep at least one item/)).toBeTruthy();
    expect(orderEditApi.edit).not.toHaveBeenCalled();
  });

  it('a dropped connection keeps the idempotency key, so pressing Save again can never apply twice', async () => {
    const { added, save, onSaved } = await open();
    vi.mocked(orderEditApi.edit).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    fireEvent.click(within(added()).getByRole('button', { name: 'Add one Masala Dosa' }));
    fireEvent.click(save());
    expect(await screen.findByText(/Cannot reach the server/)).toBeTruthy();
    expect(onSaved).not.toHaveBeenCalled();
    fireEvent.click(save());
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const [first, second] = vi.mocked(orderEditApi.edit).mock.calls;
    expect(first?.[1].idempotencyKey).toBe(second?.[1].idempotencyKey);
    expect(first?.[1].expectedVersion).toBe(second?.[1].expectedVersion);
  });

  it('a different edit gets a new key (the old one belongs to the old edit)', async () => {
    const { added, save } = await open();
    vi.mocked(orderEditApi.edit).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    fireEvent.click(within(added()).getByRole('button', { name: 'Add one Masala Dosa' }));
    fireEvent.click(save());
    await screen.findByText(/Cannot reach the server/);
    fireEvent.click(within(added()).getByRole('button', { name: 'Add one Masala Dosa' }));
    fireEvent.click(save());
    await waitFor(() => expect(orderEditApi.edit).toHaveBeenCalledTimes(2));
    const [a, b] = vi.mocked(orderEditApi.edit).mock.calls;
    expect(a?.[1].idempotencyKey).not.toBe(b?.[1].idempotencyKey);
  });

  it('is single-flight: a double tap on Save sends one request', async () => {
    const { added, save, onSaved } = await open();
    let release: (v: never) => void = () => undefined;
    vi.mocked(orderEditApi.edit).mockReturnValueOnce(new Promise((r) => (release = r as never)));
    fireEvent.click(within(added()).getByRole('button', { name: 'Add one Masala Dosa' }));
    const button = save();
    fireEvent.click(button);
    fireEvent.click(button); // still the same node: it now reads "Saving" and is disabled
    expect(orderEditApi.edit).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(true);
    await act(async () => {
      release({ ...makeOrder({ version: 4 }), edit: { id: 'e', editNumber: 1, replayed: false } } as never);
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });
});

describe('OrderEditDialog: conflicts and locks', () => {
  it('409 VERSION_CONFLICT: reloads the order, keeps the user\'s change, explains, and the next save uses the new version and key', async () => {
    const { added, save, onSaved } = await open();
    fireEvent.click(within(added()).getByRole('button', { name: 'Add one Masala Dosa' })); // user: dosa 2 -> 3
    vi.mocked(orderEditApi.edit).mockRejectedValueOnce(apiError(409, 'VERSION_CONFLICT', 'This order was changed by someone else.'));
    // meanwhile somebody else bumped paneer to 4 (version 4)
    vi.mocked(orderApi.get).mockResolvedValue(
      makeOrder({ version: 4, lines: [line('l-1', 'Masala Dosa', 2, 14000), line('l-2', 'Paneer Tikka', 4, 28000, { catalogItemId: 'i-paneer' })] }),
    );
    fireEvent.click(save());

    const alert = await screen.findByText(/Someone else changed this order while you were editing/);
    expect(alert.closest('[role="alert"]')).toBeTruthy();
    // latest server value is shown, and the user's pending change survived
    const paneer = within(added()).getByText('Paneer Tikka').closest('li') as HTMLElement;
    expect(within(paneer).getByText('4')).toBeTruthy();
    const dosa = within(added()).getByText('Masala Dosa').closest('li') as HTMLElement;
    expect(within(dosa).getByText('3')).toBeTruthy();
    expect(onSaved).not.toHaveBeenCalled();

    fireEvent.click(save());
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const [first, second] = vi.mocked(orderEditApi.edit).mock.calls;
    expect(first?.[1].expectedVersion).toBe(3);
    expect(second?.[1].expectedVersion).toBe(4);
    expect(first?.[1].idempotencyKey).not.toBe(second?.[1].idempotencyKey);
    expect(second?.[1].ops).toEqual([{ op: 'update', lineId: 'l-1', quantity: 3 }]); // diffed against the new base
  });

  it('409 VERSION_CONFLICT where the touched line vanished: says how many changes no longer apply', async () => {
    const { added, save } = await open();
    fireEvent.click(within(added()).getByRole('button', { name: 'Add one Paneer Tikka' }));
    vi.mocked(orderEditApi.edit).mockRejectedValueOnce(apiError(409, 'VERSION_CONFLICT'));
    vi.mocked(orderApi.get).mockResolvedValue(
      makeOrder({ version: 4, lines: [line('l-1', 'Masala Dosa', 2, 14000), line('l-2', 'Paneer Tikka', 1, 28000, { status: 'CANCELLED' })] }),
    );
    fireEvent.click(save());
    expect(await screen.findByText(/1 of your changes no longer applies/)).toBeTruthy();
    expect(within(added()).queryByText('Paneer Tikka')).toBeNull();
  });

  it('409 ORDER_EDIT_LOCKED (the kitchen got there first): switches to a read-only explanation and discards nothing silently', async () => {
    const { added, save, onSaved } = await open();
    fireEvent.click(within(added()).getByRole('button', { name: 'Add one Masala Dosa' }));
    vi.mocked(orderEditApi.edit).mockRejectedValueOnce(apiError(409, 'ORDER_EDIT_LOCKED'));
    vi.mocked(orderEditApi.state).mockResolvedValue(locked('KITCHEN_STARTED') as never);
    vi.mocked(orderApi.get).mockResolvedValue(makeOrder({ status: 'ACCEPTED', version: 4, lines: makeOrder().lines.map((l) => ({ ...l, status: 'PREPARING' as const })) }));
    fireEvent.click(save());

    expect(await screen.findByText('This order can no longer be edited')).toBeTruthy();
    expect(screen.getByText(/kitchen has started this order/)).toBeTruthy();
    expect(screen.getByText(/your changes were not saved/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Menu items' })).toBeNull();
    expect(screen.getAllByText('Preparing').length).toBeGreaterThan(0);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it.each([
    ['ORDER_SERVED', /already been served|has been served/],
    ['ORDER_CANCELLED', /was cancelled/],
    ['SESSION_NOT_OPEN', /session is closed/],
    ['INVOICE_EXISTS', /bill has been generated/],
  ])('opens read-only with a clear reason when the server says %s', async (reason, text) => {
    vi.mocked(orderEditApi.state).mockResolvedValue(locked(reason) as never);
    render(
      <ToastProvider>
        <OrderEditDialog order={makeOrder()} tableCode="T4" categories={MENU_CATEGORIES} items={MENU_ITEMS} onSaved={vi.fn()} onClose={vi.fn()} />
      </ToastProvider>,
    );
    expect(await screen.findByText('This order can no longer be edited')).toBeTruthy();
    expect(screen.getByText(text)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull();
  });

  it('a failed load shows a retry instead of a broken editor', async () => {
    vi.mocked(orderApi.get).mockRejectedValueOnce(apiError(500));
    render(
      <ToastProvider>
        <OrderEditDialog order={makeOrder()} tableCode="T4" categories={MENU_CATEGORIES} items={MENU_ITEMS} onSaved={vi.fn()} onClose={vi.fn()} />
      </ToastProvider>,
    );
    expect(await screen.findByText('Could not open the order')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('region', { name: 'Added to order' })).toBeTruthy();
  });

  it('other server errors keep the work and say nothing was changed', async () => {
    const { added, save, onSaved } = await open();
    fireEvent.click(within(added()).getByRole('button', { name: 'Add one Masala Dosa' }));
    vi.mocked(orderEditApi.edit).mockRejectedValueOnce(apiError(500));
    fireEvent.click(save());
    expect(await screen.findByText(/Nothing was changed/)).toBeTruthy();
    expect(onSaved).not.toHaveBeenCalled();
    expect(save().disabled).toBe(false);
  });
});

describe('OrderEditDialog: realtime', () => {
  it('follows the order live: a pristine editor silently takes the new version and says so', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { added } = await open();
    vi.mocked(orderApi.get).mockResolvedValue(
      makeOrder({ version: 4, lines: [line('l-1', 'Masala Dosa', 6, 14000), line('l-2', 'Paneer Tikka', 1, 28000, { catalogItemId: 'i-paneer' })] }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_100); // safety-net poll (no SSE provider in this test)
    });
    const dosa = within(added()).getByText('Masala Dosa').closest('li') as HTMLElement;
    expect(within(dosa).getByText('6')).toBeTruthy();
    expect(screen.getByText(/updated by someone else/)).toBeTruthy();
  });

  it('when the kitchen starts the order while the dialog is open, it flips to read-only and warns about unsaved changes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { added } = await open();
    fireEvent.click(within(added()).getByRole('button', { name: 'Add one Masala Dosa' }));
    vi.mocked(orderEditApi.state).mockResolvedValue(locked('KITCHEN_STARTED') as never);
    vi.mocked(orderApi.get).mockResolvedValue(makeOrder({ status: 'PREPARING', version: 4 }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_100);
    });
    expect(screen.getByText('This order can no longer be edited')).toBeTruthy();
    expect(screen.getByText(/your changes were not saved/)).toBeTruthy();
  });
});
