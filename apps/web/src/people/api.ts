import { api } from '../auth/api';

export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING';

export interface PersonRole {
  roleId: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  allLocations: boolean;
  /** Empty when allLocations is true. */
  locations: { id: string; name: string }[];
}

export interface Person {
  id: string;
  email: string;
  displayName: string;
  status: UserStatus;
  createdAt: string;
  lastLoginAt: string | null;
  /** Set only while a sign-in lockout is in force. */
  lockedUntil: string | null;
  roles: PersonRole[];
}

export interface ViewerCapabilities {
  canCreate: boolean;
  canEdit: boolean;
  canAssignRoles: boolean;
  canViewRoles: boolean;
}

export interface Directory {
  items: Person[];
  total: number;
  viewer: ViewerCapabilities;
}

export interface DirectoryQuery {
  q?: string;
  status?: UserStatus;
  roleId?: string;
  skip?: number;
  take?: number;
}

export interface Role {
  id: string;
  businessId: string | null;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
}

export interface LocationOption {
  id: string;
  name: string;
  status?: string;
}

export interface CreatePersonBody {
  email: string;
  password: string;
  displayName: string;
  roleKeys?: string[];
}

export interface AssignRoleBody {
  roleId: string;
  allLocations: boolean;
  locationIds?: string[];
}

const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body) });

export const peopleApi = {
  directory: (q: DirectoryQuery) => {
    const qs = new URLSearchParams();
    if (q.q) qs.set('q', q.q);
    if (q.status) qs.set('status', q.status);
    if (q.roleId) qs.set('roleId', q.roleId);
    qs.set('skip', String(q.skip ?? 0));
    qs.set('take', String(q.take ?? 25));
    return api<Directory>(`/admin/users/directory?${qs.toString()}`);
  },
  roles: () => api<Role[]>('/admin/roles?take=200'),
  locations: () => api<LocationOption[]>('/admin/locations'),
  create: (body: CreatePersonBody) => api<{ id: string }>('/admin/users', { method: 'POST', ...json(body) }),
  rename: (id: string, displayName: string) =>
    api<{ id: string }>(`/admin/users/${id}`, { method: 'PATCH', ...json({ displayName }) }),
  setStatus: (id: string, status: 'ACTIVE' | 'SUSPENDED') =>
    api<{ id: string }>(`/admin/users/${id}`, { method: 'PATCH', ...json({ status }) }),
  assignRole: (userId: string, body: AssignRoleBody) =>
    api<void>(`/admin/users/${userId}/roles`, { method: 'POST', ...json(body) }),
  removeRole: (userId: string, roleId: string) =>
    api<void>(`/admin/users/${userId}/roles/${roleId}`, { method: 'DELETE' }),
  resetPassword: (userId: string, password: string) =>
    api<void>(`/admin/users/${userId}/password`, { method: 'POST', ...json({ password }) }),
};
