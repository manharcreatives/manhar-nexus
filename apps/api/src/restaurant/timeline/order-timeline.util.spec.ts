import { buildOrderTimeline, kindOfAction, safeDetail, type AuditRowLike, type RequestRowLike } from './order-timeline.util';

const T0 = new Date('2026-10-31T12:00:00.000Z').getTime();
const at = (sec: number) => new Date(T0 + sec * 1000);
let n = 0;
const ev = (action: string, sec: number, over: Partial<AuditRowLike> = {}): AuditRowLike => ({
  id: `e${++n}`,
  sequence: n,
  action: `service_request.${action}`,
  actorType: 'USER',
  actorId: 'u1',
  actorLabel: 'Asha',
  metadata: {},
  createdAt: at(sec),
  ...over,
});
const request = (status: string, over: Partial<RequestRowLike> = {}): RequestRowLike => ({
  createdAt: at(0),
  sentAt: at(5),
  acceptedAt: null,
  preparedAt: null,
  servedAt: null,
  status,
  ...over,
});

describe('kindOfAction', () => {
  it('maps the audit actions the order flow writes', () => {
    expect(kindOfAction('service_request.draft_created')).toBe('created');
    expect(kindOfAction('service_request.lines_added')).toBe('items_changed');
    expect(kindOfAction('service_request.sent')).toBe('sent');
    expect(kindOfAction('service_request.edited')).toBe('edited');
    expect(kindOfAction('service_request.accepted')).toBe('accepted');
    expect(kindOfAction('service_request.preparation_started')).toBe('preparing');
    expect(kindOfAction('service_request.marked_ready')).toBe('ready');
    expect(kindOfAction('service_request.served')).toBe('served');
    expect(kindOfAction('service_request.cancelled')).toBe('cancelled');
    expect(kindOfAction('service_request.line_cancelled')).toBe('item_cancelled');
  });
  it('degrades gracefully for actions it does not know yet', () => {
    expect(kindOfAction('service_request.guest_edit_requested')).toBe('edited');
    expect(kindOfAction('service_request.something_new')).toBe('other');
    expect(kindOfAction('invoice.created')).toBe('other');
  });
});

describe('safeDetail', () => {
  it('keeps only whitelisted, well-typed facts and never prices', () => {
    expect(
      safeDetail({ reason: ' Out of naan ', lineCount: 3, editNumber: 2, changeCount: 4, requestNumber: 'K-12', statusAtEdit: 'SENT', totalBeforeMinorUnits: 100, secret: 'x', lineIds: ['a'] }),
    ).toEqual({ reason: 'Out of naan', lineCount: 3, editNumber: 2, changeCount: 4, requestNumber: 'K-12', statusAtEdit: 'SENT' });
    expect(safeDetail(null)).toEqual({});
    expect(safeDetail({ reason: 5, lineCount: 1.5 })).toEqual({});
  });
});

describe('buildOrderTimeline', () => {
  it('orders by sequence, computes the gap to the previous step and to the start', () => {
    const audit = [
      ev('accepted', 125),
      ev('draft_created', 0),
      ev('sent', 5, { metadata: { requestNumber: 'K-7', lineCount: 2 } }),
      ev('preparation_started', 245),
    ];
    // sequence follows creation order in this fixture, so renumber to the real order
    audit[0].sequence = 3;
    audit[1].sequence = 1;
    audit[2].sequence = 2;
    audit[3].sequence = 4;
    const tl = buildOrderTimeline(audit, request('PREPARING'), at(300));
    expect(tl.steps.map((s) => s.kind)).toEqual(['created', 'sent', 'accepted', 'preparing']);
    expect(tl.steps.map((s) => s.sincePreviousMs)).toEqual([0, 5000, 120000, 120000]);
    expect(tl.steps.map((s) => s.sinceStartMs)).toEqual([0, 5000, 125000, 245000]);
    expect(tl.steps[1].detail).toEqual({ requestNumber: 'K-7', lineCount: 2 });
    expect(tl.finished).toBe(false);
    expect(tl.endedAt).toBeNull();
    expect(tl.totalMs).toBe(300000); // runs to "now" while open
  });

  it('stops the total at the last step once served', () => {
    const audit = [ev('draft_created', 0), ev('sent', 5), ev('served', 900)];
    const tl = buildOrderTimeline(audit, request('SERVED'), at(99999));
    expect(tl.finished).toBe(true);
    expect(tl.totalMs).toBe(900000);
    expect(tl.endedAt).toBe(at(900).toISOString());
  });

  it('keeps the actor and tells staff from system', () => {
    const audit = [ev('draft_created', 0), ev('edited', 40, { actorType: 'SYSTEM', actorLabel: 'Guest' })];
    const tl = buildOrderTimeline(audit, request('SENT'), at(60));
    expect(tl.steps[0].actor).toEqual({ type: 'staff', label: 'Asha' });
    expect(tl.steps[1].actor).toEqual({ type: 'system', label: 'Guest' });
  });

  it('falls back to the timestamps on the record when no activity exists', () => {
    const tl = buildOrderTimeline([], request('PREPARING', { acceptedAt: at(60), preparedAt: at(120) }), at(200));
    expect(tl.steps.map((s) => [s.kind, s.source])).toEqual([
      ['created', 'record'],
      ['sent', 'record'],
      ['accepted', 'record'],
      ['preparing', 'record'],
    ]);
    expect(tl.steps.every((s) => s.actor.type === 'unknown')).toBe(true);
    expect(tl.totalMs).toBe(200000);
  });

  it('is empty and zero for a request with nothing to show', () => {
    const tl = buildOrderTimeline([], { createdAt: at(0), sentAt: null, acceptedAt: null, preparedAt: null, servedAt: null, status: 'DRAFT' }, at(10));
    expect(tl.steps.map((s) => s.kind)).toEqual(['created']);
    expect(tl.totalMs).toBe(10000);
  });

  it('never reports a negative gap when clocks disagree', () => {
    const audit = [ev('draft_created', 10), ev('sent', 5)];
    const tl = buildOrderTimeline(audit, request('SENT'), at(60));
    expect(tl.steps.map((s) => s.sincePreviousMs)).toEqual([0, 0]);
  });
});
