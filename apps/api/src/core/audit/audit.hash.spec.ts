import { computeAuditHash, stableStringify, type HashablePayload } from './audit.service';

const base: HashablePayload = {
  businessId: 'b-1',
  sequence: '1',
  actorType: 'INTERNAL_ADMIN',
  actorId: null,
  actorLabel: 'internal-admin',
  action: 'business.created',
  resourceType: 'business',
  resourceId: 'b-1',
  locationId: null,
  metadata: { name: 'Alpha', currencyCode: 'INR' },
  prevHash: null,
  createdAt: '2026-08-23T10:00:00.000Z',
};

describe('stableStringify', () => {
  it('is insensitive to object key order', () => {
    expect(stableStringify({ a: 1, b: 2 })).toBe(stableStringify({ b: 2, a: 1 }));
  });

  it('sorts keys recursively and preserves array order', () => {
    expect(stableStringify({ z: [3, 1], a: { y: 1, x: 2 } })).toBe(
      '{"a":{"x":2,"y":1},"z":[3,1]}',
    );
  });
});

describe('computeAuditHash', () => {
  it('is deterministic for identical payloads', () => {
    expect(computeAuditHash(base)).toBe(computeAuditHash({ ...base }));
  });

  it('ignores metadata key order (stable hashing)', () => {
    const reordered: HashablePayload = {
      ...base,
      metadata: { currencyCode: 'INR', name: 'Alpha' },
    };
    expect(computeAuditHash(reordered)).toBe(computeAuditHash(base));
  });

  it('changes when any field changes (tamper-evident)', () => {
    const original = computeAuditHash(base);
    expect(computeAuditHash({ ...base, action: 'business.updated' })).not.toBe(original);
    expect(computeAuditHash({ ...base, metadata: { name: 'Beta' } })).not.toBe(original);
    expect(computeAuditHash({ ...base, sequence: '2' })).not.toBe(original);
  });

  it('chains: a different prevHash yields a different hash', () => {
    const first = computeAuditHash(base);
    const second = computeAuditHash({ ...base, sequence: '2', prevHash: first });
    const secondTampered = computeAuditHash({ ...base, sequence: '2', prevHash: 'forged' });
    expect(second).not.toBe(secondTampered);
  });
});
