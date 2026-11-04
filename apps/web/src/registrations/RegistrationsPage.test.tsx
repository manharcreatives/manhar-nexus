import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import '../i18n';
import { ToastProvider } from '../ui/Toast';
import type { RegistrationRequest } from './api';

const row: RegistrationRequest = {
  id: '11111111-1111-4111-8111-111111111111',
  referenceCode: 'NX-7K2Q9M',
  status: 'NEW',
  restaurantName: 'Ananda Cafe',
  contactName: 'Asha Patel',
  email: 'asha@example.com',
  phone: '+919714571522',
  city: 'Visnagar',
  businessKind: 'cafe',
  outlets: 2,
  planKey: 'not-sure',
  billingCycle: 'yearly',
  message: null,
  assignedTo: null,
  internalNotes: null,
  businessId: null,
  createdAt: '2026-11-04T10:00:00.000Z',
  updatedAt: '2026-11-04T10:00:00.000Z',
};

const listRegistrations = vi.fn();
const updateRegistration = vi.fn();
vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  listRegistrations: (...a: unknown[]) => listRegistrations(...a),
  updateRegistration: (...a: unknown[]) => updateRegistration(...a),
}));

import { RegistrationsPage } from './RegistrationsPage';

function renderPage() {
  return render(
    <ToastProvider>
      <RegistrationsPage />
    </ToastProvider>,
  );
}

// jsdom has no modal dialog support; emulate the bits the shared Dialog relies on.
beforeAll(() => {
  const proto = HTMLDialogElement.prototype;
  proto.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  proto.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});

beforeEach(() => {
  listRegistrations.mockReset();
  updateRegistration.mockReset();
  listRegistrations.mockImplementation(({ status }: { status: string }) =>
    Promise.resolve({ items: status === 'NEW' ? [row] : [], total: status === 'NEW' ? 1 : 0, skip: 0, take: 100 }),
  );
});

describe('RegistrationsPage', () => {
  it('lists open requests with the reference code and contact details', async () => {
    renderPage();
    expect(await screen.findByText('Ananda Cafe')).toBeTruthy();
    expect(screen.getByText('NX-7K2Q9M')).toBeTruthy();
    expect(screen.getByText('+919714571522')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create restaurant account' })).toBeTruthy();
  });

  it('opens the create dialog prefilled from the request', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Create restaurant account' }));
    expect((await screen.findByDisplayValue('Ananda Cafe')) as HTMLInputElement).toBeTruthy();
    expect(screen.getByDisplayValue('Asha Patel')).toBeTruthy();
    expect(screen.getByDisplayValue('asha@example.com')).toBeTruthy();
  });

  it('marks a request contacted through the API', async () => {
    updateRegistration.mockResolvedValue({ ...row, status: 'CONTACTED' });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Mark contacted' }));
    await waitFor(() => expect(updateRegistration).toHaveBeenCalledWith(row.id, { status: 'CONTACTED' }));
  });

  it('shows an error state with retry when loading fails', async () => {
    listRegistrations.mockRejectedValue(new Error('boom'));
    renderPage();
    expect(await screen.findByText('Could not load requests')).toBeTruthy();
  });
});
