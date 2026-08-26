import { api } from '../auth/api';

export type SettingValueType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON';
export type SettingSource = 'location' | 'business' | 'default';
export type AlertChannel = 'IN_APP';

export interface SettingSchema {
  namespace: string;
  key: string;
  valueType: SettingValueType;
  description: string;
  default: unknown;
  sensitive: boolean;
}

export interface EffectiveSetting {
  namespace: string;
  key: string;
  value: unknown;
  valueType: SettingValueType;
  source: SettingSource;
  version?: number;
}

export interface AlertRule {
  id: string;
  businessId: string;
  eventKey: string;
  targetRoleKey: string;
  channel: AlertChannel;
  enabled: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export const configApi = {
  getSchema: (namespace?: string) =>
    api<SettingSchema[]>(
      `/admin/settings/schema${namespace ? `?namespace=${encodeURIComponent(namespace)}` : ''}`,
    ),
  getEffective: (namespace: string, locationId?: string) => {
    const qs = new URLSearchParams({ namespace });
    if (locationId) qs.set('locationId', locationId);
    return api<EffectiveSetting[]>(`/admin/settings/effective?${qs.toString()}`);
  },
  setSetting: (
    namespace: string,
    key: string,
    value: unknown,
    opts: { locationId?: string; expectedVersion?: number } = {},
  ) => {
    const qs = opts.locationId
      ? `?locationId=${encodeURIComponent(opts.locationId)}`
      : '';
    return api<EffectiveSetting>(`/admin/settings/${namespace}/${key}${qs}`, {
      method: 'PUT',
      body: JSON.stringify({ value, expectedVersion: opts.expectedVersion }),
    });
  },
  listAlertRules: () => api<AlertRule[]>('/admin/alerts/rules'),
  createAlertRule: (dto: {
    eventKey: string;
    targetRoleKey: string;
    channel: AlertChannel;
    enabled: boolean;
  }) => api<AlertRule>('/admin/alerts/rules', { method: 'POST', body: JSON.stringify(dto) }),
  updateAlertRule: (id: string, dto: { enabled: boolean; expectedVersion?: number }) =>
    api<AlertRule>(`/admin/alerts/rules/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),
  deleteAlertRule: (id: string) =>
    api<void>(`/admin/alerts/rules/${id}`, { method: 'DELETE' }),
};
