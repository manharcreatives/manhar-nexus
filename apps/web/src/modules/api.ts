import { api } from '../auth/api';

export type ModuleStatus =
  | 'AVAILABLE'
  | 'PENDING_SETUP'
  | 'ACTIVE'
  | 'DISABLED'
  | 'SUSPENDED'
  | 'ARCHIVED'
  | 'TRIAL';

export interface ModuleView {
  key: string;
  name: string;
  description: string;
  dependencies: string[];
  setupSteps: { key: string; label: string; description: string; required: boolean }[];
  status: ModuleStatus;
  config: Record<string, unknown>;
  setupCompletedAt: string | null;
  activatedAt: string | null;
  suspendedAt: string | null;
  disabledAt: string | null;
}

export const modulesApi = {
  list: () => api<ModuleView[]>('/admin/modules'),
  get: (key: string) => api<ModuleView>(`/admin/modules/${key}`),
  activate: (key: string) =>
    api<ModuleView>(`/admin/modules/${key}/activate`, { method: 'POST' }),
  completeSetup: (key: string) =>
    api<ModuleView>(`/admin/modules/${key}/complete-setup`, { method: 'POST' }),
  disable: (key: string) =>
    api<ModuleView>(`/admin/modules/${key}/disable`, { method: 'POST' }),
  resume: (key: string) =>
    api<ModuleView>(`/admin/modules/${key}/resume`, { method: 'POST' }),
};
