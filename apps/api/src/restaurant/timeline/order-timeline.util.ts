/**
 * Order timeline (KOS card popover): the ordered list of everything that happened to one
 * Service Request, built from the append-only Activity History (audit chain, ADR-016) so it
 * can never disagree with the record of truth. Requests created before auditing existed
 * (or whose events were pruned from a test DB) fall back to the timestamps on the row.
 */

export type TimelineKind =
  | 'created'
  | 'items_changed'
  | 'sent'
  | 'edited'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'cancelled'
  | 'item_cancelled'
  | 'other';

export interface AuditRowLike {
  id: string;
  sequence: bigint | number;
  action: string;
  actorType: 'INTERNAL_ADMIN' | 'USER' | 'SYSTEM';
  actorId: string | null;
  actorLabel: string | null;
  metadata: unknown;
  createdAt: Date;
}

export interface RequestRowLike {
  createdAt: Date;
  sentAt: Date | null;
  acceptedAt: Date | null;
  preparedAt: Date | null;
  servedAt: Date | null;
  status: string;
}

export interface TimelineStep {
  /** Audit event id, or `row:<kind>` for a step reconstructed from the row. */
  id: string;
  kind: TimelineKind;
  /** The raw audit action (`service_request.sent`), for steps this API version does not know yet. */
  action: string;
  at: string;
  actor: { type: 'staff' | 'system' | 'unknown'; label: string | null };
  /** Milliseconds since the previous step (0 for the first). */
  sincePreviousMs: number;
  /** Milliseconds since the first step. */
  sinceStartMs: number;
  /** Small, whitelisted facts (never prices or free-form metadata). */
  detail: { reason?: string; lineCount?: number; editNumber?: number; changeCount?: number; requestNumber?: string; statusAtEdit?: string };
  source: 'activity' | 'record';
}

export interface OrderTimeline {
  steps: TimelineStep[];
  /** True when the request has reached a final state, so the total stops growing. */
  finished: boolean;
  startedAt: string | null;
  endedAt: string | null;
  /** First step to last step (or to `now` while still open). */
  totalMs: number;
}

const PREFIX = 'service_request.';

const KIND_BY_ACTION: Record<string, TimelineKind> = {
  draft_created: 'created',
  lines_added: 'items_changed',
  line_updated: 'items_changed',
  line_removed: 'items_changed',
  sent: 'sent',
  edited: 'edited',
  accepted: 'accepted',
  preparation_started: 'preparing',
  marked_ready: 'ready',
  served: 'served',
  cancelled: 'cancelled',
  line_cancelled: 'item_cancelled',
};

export function kindOfAction(action: string): TimelineKind {
  if (!action.startsWith(PREFIX)) return 'other';
  const name = action.slice(PREFIX.length);
  const known = KIND_BY_ACTION[name];
  if (known) return known;
  // Future audit actions from the order-edit / guest-order flows still read sensibly.
  if (/edit/.test(name)) return 'edited';
  return 'other';
}

const asRecord = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown, max = 200): string | undefined => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);
const int = (v: unknown): number | undefined => (typeof v === 'number' && Number.isInteger(v) ? v : undefined);

export function safeDetail(metadata: unknown): TimelineStep['detail'] {
  const m = asRecord(metadata);
  const out: TimelineStep['detail'] = {};
  const reason = str(m.reason);
  if (reason) out.reason = reason;
  const lineCount = int(m.lineCount);
  if (lineCount !== undefined) out.lineCount = lineCount;
  const editNumber = int(m.editNumber);
  if (editNumber !== undefined) out.editNumber = editNumber;
  const changeCount = int(m.changeCount);
  if (changeCount !== undefined) out.changeCount = changeCount;
  const requestNumber = str(m.requestNumber, 40);
  if (requestNumber) out.requestNumber = requestNumber;
  const statusAtEdit = str(m.statusAtEdit, 20);
  if (statusAtEdit) out.statusAtEdit = statusAtEdit;
  return out;
}

function actorOf(row: Pick<AuditRowLike, 'actorType' | 'actorLabel'>): TimelineStep['actor'] {
  if (row.actorType === 'USER') return { type: 'staff', label: row.actorLabel };
  if (row.actorType === 'SYSTEM') return { type: 'system', label: row.actorLabel };
  // Manhar support acting inside a workspace is shown as such, not as an anonymous event.
  return { type: row.actorLabel ? 'staff' : 'unknown', label: row.actorLabel };
}

interface RawStep extends Omit<TimelineStep, 'sincePreviousMs' | 'sinceStartMs'> {
  ts: number;
}

/** Steps reconstructed from the request row, used only when no activity exists at all. */
export function stepsFromRecord(request: RequestRowLike): RawStep[] {
  const rows: Array<[TimelineKind, Date | null]> = [
    ['created', request.createdAt],
    ['sent', request.sentAt],
    ['accepted', request.acceptedAt],
    ['preparing', request.preparedAt],
    ['served', request.servedAt],
  ];
  return rows
    .filter((r): r is [TimelineKind, Date] => r[1] !== null)
    .map(([kind, at]) => ({
      id: `row:${kind}`,
      kind,
      action: `${PREFIX}${kind}`,
      at: at.toISOString(),
      ts: at.getTime(),
      actor: { type: 'unknown' as const, label: null },
      detail: {},
      source: 'record' as const,
    }));
}

const FINAL_STATUSES: ReadonlySet<string> = new Set(['SERVED', 'CLOSED', 'CANCELLED']);

export function buildOrderTimeline(audit: AuditRowLike[], request: RequestRowLike, now: Date): OrderTimeline {
  const fromAudit: RawStep[] = [...audit]
    .sort((a, b) => Number(a.sequence) - Number(b.sequence))
    .map((e) => ({
      id: e.id,
      kind: kindOfAction(e.action),
      action: e.action,
      at: e.createdAt.toISOString(),
      ts: e.createdAt.getTime(),
      actor: actorOf(e),
      detail: safeDetail(e.metadata),
      source: 'activity' as const,
    }));

  const raw = fromAudit.length > 0 ? fromAudit : stepsFromRecord(request).sort((a, b) => a.ts - b.ts);

  const first = raw[0]?.ts;
  let prev = first;
  const steps: TimelineStep[] = raw.map((r) => {
    const { ts, ...rest } = r;
    const step: TimelineStep = {
      ...rest,
      sincePreviousMs: prev === undefined ? 0 : Math.max(0, ts - prev),
      sinceStartMs: first === undefined ? 0 : Math.max(0, ts - first),
    };
    prev = ts;
    return step;
  });

  const finished = FINAL_STATUSES.has(request.status);
  const lastTs = raw.length > 0 ? raw[raw.length - 1].ts : undefined;
  const endTs = finished && lastTs !== undefined ? lastTs : now.getTime();
  return {
    steps,
    finished,
    startedAt: steps[0]?.at ?? null,
    endedAt: finished && steps.length > 0 ? steps[steps.length - 1].at : null,
    totalMs: first === undefined ? 0 : Math.max(0, endTs - first),
  };
}
