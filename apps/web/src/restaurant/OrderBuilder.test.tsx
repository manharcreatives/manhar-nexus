import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../i18n';
import { OrderBuilder } from './OrderBuilder';
import { catalogApi, orderApi } from './api';
import { MENU_CATEGORIES, MENU_ITEMS, apiError, item, makeOrder, patchDialog } from './order/testFixtures';

vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  orderApi: { create: vi.fn(), send: vi.fn() },
  catalogApi: { listModifierGroups: vi.fn(() => Promise.resolve([])) },
}));

patchDialog();
beforeEach(() => {
  vi.mocked(orderApi.create).mockReset().mockResolvedValue(makeOrder({ id: 'draft-1', status: 'DRAFT' }));
  vi.mocked(orderApi.send).mockReset().mockResolvedValue(makeOrder({ id: 'draft-1' }));
  vi.mocked(catalogApi.listModifierGroups).mockClear();
});
afterEach(cleanup);

function setup(items = MENU_ITEMS) {
  const onSent = vi.fn();
  const onCancel = vi.fn();
  render(<OrderBuilder sessionId="s-1" tableCode="T4" categories={MENU_CATEGORIES} items={items} onSent={onSent} onCancel={onCancel} />);
  const menu = () => screen.getByRole('region', { name: 'Menu items' });
  const added = () => screen.getByRole('region', { name: 'Added to order' });
  return { onSent, onCancel, menu, added };
}

describe('OrderBuilder: two zones that never mix', () => {
  it('renders a Menu zone and a separate Added-to-order zone; an empty order says so', () => {
    const { menu, added } = setup();
    expect(menu()).not.toBe(added());
    expect(menu().contains(added())).toBe(false);
    expect(added().contains(menu())).toBe(false);
    expect(within(menu()).getByText('Masala Dosa')).toBeTruthy();
    expect(within(added()).getByText('Nothing added yet')).toBeTruthy();
    expect(within(added()).queryByText('Masala Dosa')).toBeNull();
  });

  it('adding moves the dish into the order zone as a New line; the menu only shows a quantity badge', () => {
    const { menu, added } = setup();
    fireEvent.click(within(menu()).getByRole('button', { name: 'Add one Masala Dosa' }));
    fireEvent.click(within(menu()).getByRole('button', { name: 'Add one Masala Dosa' }));

    const line = within(added()).getByText('Masala Dosa').closest('li') as HTMLElement;
    expect(line.getAttribute('data-chip')).toBe('new');
    expect(within(line).getByText('New')).toBeTruthy();
    expect(within(line).getByText('2')).toBeTruthy();

    const row = within(menu()).getByText('Masala Dosa').closest('li') as HTMLElement;
    expect(within(row).getByText('2 in order')).toBeTruthy();
    // No quantity controls live in the menu: only add buttons.
    expect(within(menu()).queryByRole('button', { name: /Remove/ })).toBeNull();
    expect(within(menu()).queryByRole('group')).toBeNull();
    // ...and no line leaks from the order zone into the menu list.
    expect(within(menu()).queryByText('New')).toBeNull();
  });

  it('shows a running total in the footer that follows every change', () => {
    const { menu, added } = setup();
    const total = () => document.querySelector('dialog .nx-ledger')?.textContent ?? '';
    fireEvent.click(within(menu()).getByRole('button', { name: 'Add one Masala Dosa' }));
    expect(total()).toContain('140.00');
    fireEvent.click(within(menu()).getByRole('button', { name: 'Add one Paneer Tikka' }));
    expect(total()).toContain('420.00');
    fireEvent.click(within(added()).getByRole('button', { name: 'Add one Masala Dosa' })); // stepper in the ORDER zone
    expect(total()).toContain('560.00');
    expect(screen.getAllByText('3 items').length).toBeGreaterThan(0);
  });

  it('steppers and the trash button change the order; minus at 1 removes and the badge goes away', () => {
    const { menu, added } = setup();
    fireEvent.click(within(menu()).getByRole('button', { name: 'Add one Masala Dosa' }));
    fireEvent.click(within(menu()).getByRole('button', { name: 'Add one Paneer Tikka' }));
    fireEvent.click(within(added()).getByRole('button', { name: 'Remove Masala Dosa from the order' })); // qty 1: x
    expect(within(added()).queryByText('Masala Dosa')).toBeNull();
    expect(within(menu()).queryByText('1 in order', { selector: 'span' })).not.toBeNull(); // paneer remains
    fireEvent.click(within(added()).getByRole('button', { name: 'Remove Paneer Tikka from the order' }));
    expect(within(added()).getByText('Nothing added yet')).toBeTruthy();
    expect(within(menu()).queryByText(/in order/)).toBeNull();
  });

  it('every control is a real button with a name (keyboard and screen reader), and touch targets are 48px', () => {
    const { menu, added } = setup();
    fireEvent.click(within(menu()).getByRole('button', { name: 'Add one Masala Dosa' }));
    const buttons = [...within(menu()).getAllByRole('button'), ...within(added()).getAllByRole('button')];
    for (const b of buttons) expect(b.getAttribute('aria-label') ?? b.textContent).toBeTruthy();
    expect(within(menu()).getByRole('button', { name: 'Add one Masala Dosa' }).className).toContain('size-12');
    expect(within(added()).getByRole('button', { name: 'Add one Masala Dosa' }).className).toContain('size-12');
    expect(screen.getByRole('tablist', { name: 'Menu categories' })).toBeTruthy();
  });

  it('notes are edited in the order zone and travel with the line', async () => {
    const { menu, added, onSent } = setup();
    fireEvent.click(within(menu()).getByRole('button', { name: 'Add one Masala Dosa' }));
    fireEvent.click(within(added()).getByRole('button', { name: 'Add note: Masala Dosa' }));
    const box = within(added()).getByRole('textbox', { name: 'Note for Masala Dosa' });
    fireEvent.change(box, { target: { value: 'no onion' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(within(added()).getByText('no onion')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Send to kitchen' }));
    await waitFor(() => expect(onSent).toHaveBeenCalled());
    const body = vi.mocked(orderApi.create).mock.calls[0]?.[0];
    expect(body?.lines).toEqual([{ catalogItemId: 'i-dosa', quantity: 1, notes: 'no onion', modifiers: [] }]);
    expect(body?.idempotencyKey).toBeTruthy();
    expect(orderApi.send).toHaveBeenCalledWith('draft-1');
  });

  it('search narrows the menu without touching the order', () => {
    const { menu, added } = setup();
    fireEvent.click(within(menu()).getByRole('button', { name: 'Add one Masala Dosa' }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search the menu' }), { target: { value: 'lassi' } });
    expect(within(menu()).queryByText('Masala Dosa')).toBeNull();
    expect(within(menu()).getByText('Sweet Lassi')).toBeTruthy();
    expect(within(added()).getByText('Masala Dosa')).toBeTruthy();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search the menu' }), { target: { value: 'zzz' } });
    expect(within(menu()).getByText(/Nothing on the menu matches/)).toBeTruthy();
  });

  it('items with options open the chooser and land in the order zone with their details', async () => {
    const half = item('i-biryani', 'Biryani', 30000, {
      variants: [
        { id: 'v-half', name: 'Half', priceAdjMinorUnits: -10000, isAvailable: true, sortOrder: 0 },
        { id: 'v-full', name: 'Full', priceAdjMinorUnits: 0, isAvailable: true, sortOrder: 1 },
      ],
    });
    const { menu, added } = setup([half]);
    fireEvent.click(within(menu()).getByRole('button', { name: 'Choose options for Biryani' }));
    fireEvent.click(await screen.findByRole('button', { name: /Add to order/ }));
    const line = within(added()).getByText('Biryani').closest('li') as HTMLElement;
    expect(within(line).getByText('Half')).toBeTruthy();
    expect(within(menu()).getByText('1 in order')).toBeTruthy();
  });

  it('a failed send keeps the saved draft: lines show "Saved, not sent" and a retry never creates a second order', async () => {
    vi.mocked(orderApi.send).mockRejectedValueOnce(apiError(500)).mockResolvedValueOnce(makeOrder({ id: 'draft-1' }));
    const { menu, added, onSent } = setup();
    fireEvent.click(within(menu()).getByRole('button', { name: 'Add one Masala Dosa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send to kitchen' }));
    await waitFor(() => expect(within(added()).getByText('Saved, not sent')).toBeTruthy());
    expect(screen.getByText(/saved but not sent/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Send to kitchen' }));
    await waitFor(() => expect(onSent).toHaveBeenCalledTimes(1));
    expect(orderApi.create).toHaveBeenCalledTimes(1);
    expect(orderApi.send).toHaveBeenCalledTimes(2);
  });
});

describe('OrderBuilder: phone layout (menu with a sticky Order (n) bar)', () => {
  it('the bar opens the added list, and back returns to the menu; both zones stay mounted', () => {
    const { menu, added } = setup();
    const paneOf = (name: 'menu' | 'order') => document.querySelector(`[data-view-pane="${name}"]`) as HTMLElement;
    expect(paneOf('order').className).toContain('hidden'); // phones start on the menu
    expect(paneOf('menu').className).not.toContain('hidden');
    expect(paneOf('order').className).toContain('lg:flex'); // ...while desktop always shows both

    fireEvent.click(within(menu()).getByRole('button', { name: 'Add one Masala Dosa' }));
    fireEvent.click(screen.getByRole('button', { name: /Order \(1\)/ }));
    expect(paneOf('menu').className).toContain('hidden');
    expect(paneOf('order').className).not.toContain('hidden');
    expect(within(added()).getByText('Masala Dosa')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Back to menu/ }));
    expect(paneOf('order').className).toContain('hidden');
    expect(paneOf('menu').className).not.toContain('hidden');
  });

  it('the bar is only for phones (hidden from lg up) and sticks to the bottom', () => {
    setup();
    const bar = screen.getByTestId('zone-bar');
    expect(bar.className).toContain('lg:hidden');
    expect(bar.className).toContain('sticky');
  });
});
