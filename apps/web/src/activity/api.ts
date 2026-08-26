import { api } from '../auth/api';

export interface AuditEvent {
  id: string;
  businessId: string;
  sequence: string;
  actorType: string;
  actorId: string | null;
  actorLabel: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  locationId: string | null;
  metadata: Record<string, unknown>;
  prevHash: string | null;
  hash: string;
  createdAt: string;
}

export interface AuditListResponse {
  events: AuditEvent[];
  total: number;
}

export interface ChainVerification {
  valid: boolean;
  count: number;
  brokenAtSequence?: number;
  reason?: string;
}

export interface AuditFilters {
  action?: string;
  resourceType?: string;
  from?: string;
  to?: string;
  skip?: number;
  take?: number;
}

export const activityApi = {
  list: (filters: AuditFilters = {}) => {
    const qs = new URLSearchParams();
    if (filters.action) qs.set('action', filters.action);
    if (filters.resourceType) qs.set('resourceType', filters.resourceType);
    if (filters.from) qs.set('from', filters.from);
    if (filters.to) qs.set('to', filters.to);
    if (filters.skip !== undefined) qs.set('skip', String(filters.skip));
    if (filters.take !== undefined) qs.set('take', String(filters.take));
    const query = qs.toString();
    return api<AuditListResponse>(`/admin/audit${query ? `?${query}` : ''}`);
  },
  verify: () => api<ChainVerification>('/admin/audit/verify'),
};
