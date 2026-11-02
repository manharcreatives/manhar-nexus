import { GuestOrderDecision, ServiceLineStatus, ServiceRequestStatus } from '@prisma/client';
import { guestStatusOf, isEditDropped } from './guest-status';

describe('guestStatusOf', () => {
  const S = ServiceRequestStatus;
  it('maps kitchen statuses to the five guest stages', () => {
    expect(guestStatusOf({ status: S.DRAFT, guestOrder: { decision: GuestOrderDecision.PENDING } })).toBe('AWAITING_CONFIRMATION');
    expect(guestStatusOf({ status: S.SENT })).toBe('CONFIRMED');
    expect(guestStatusOf({ status: S.ACCEPTED })).toBe('PREPARING');
    expect(guestStatusOf({ status: S.PREPARING })).toBe('PREPARING');
    expect(guestStatusOf({ status: S.READY })).toBe('READY');
    expect(guestStatusOf({ status: S.SERVED })).toBe('SERVED');
    expect(guestStatusOf({ status: S.CLOSED })).toBe('SERVED');
    expect(guestStatusOf({ status: S.CANCELLED })).toBe('CANCELLED');
  });
  it('a rejected guest order is REJECTED whatever the request status says', () => {
    expect(guestStatusOf({ status: S.CANCELLED, guestOrder: { decision: GuestOrderDecision.REJECTED } })).toBe('REJECTED');
  });
});

describe('isEditDropped', () => {
  const C = ServiceLineStatus.CANCELLED;
  it('is true only for lines an order edit removed or replaced', () => {
    expect(isEditDropped({ status: C, cancelReason: 'Removed by order edit' })).toBe(true);
    expect(isEditDropped({ status: C, cancelReason: 'Replaced by order edit' })).toBe(true);
    expect(isEditDropped({ status: C, cancelReason: 'Out of buns' })).toBe(false);
    expect(isEditDropped({ status: C, cancelReason: null })).toBe(false);
    expect(isEditDropped({ status: ServiceLineStatus.PENDING, cancelReason: 'Removed by order edit' })).toBe(false);
  });
});
