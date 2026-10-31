import { GuestOrderDecision, ServiceRequestStatus } from '@prisma/client';
import { guestStatusOf } from './guest-status';

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
