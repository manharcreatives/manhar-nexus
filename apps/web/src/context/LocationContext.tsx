import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../auth/api';
import { useAuth } from '../auth/AuthContext';
import { readStored, resolveLocationId, writeStored } from './locationDefault';

/** A location the signed-in user may work in (from GET /admin/locations, already scoped by the API). */
export interface WorkLocation {
  id: string;
  name: string;
  code: string | null;
  timezone: string | null;
  status: 'ACTIVE' | 'INACTIVE';
}

export type WorkLocationStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface WorkLocationState {
  /** Active locations the user may access, in creation order. */
  locations: WorkLocation[];
  /** Current location id, or null for "All locations" / no location context. */
  locationId: string | null;
  /** The current location object (null when locationId is null). */
  location: WorkLocation | null;
  /** Change the current location (null = All locations). Unknown ids are ignored. */
  setLocationId: (id: string | null) => void;
  /** 'idle' = no tenant context (platform realm); 'ready' once the list resolved. */
  status: WorkLocationStatus;
  /** True when the user can choose between several locations. */
  canChoose: boolean;
  /** Business display name when the user is allowed to read it, else null. */
  businessName: string | null;
}

const noop = () => undefined;

const DEFAULT_STATE: WorkLocationState = {
  locations: [],
  locationId: null,
  location: null,
  setLocationId: noop,
  status: 'idle',
  canChoose: false,
  businessName: null,
};

const Ctx = createContext<WorkLocationState>(DEFAULT_STATE);

// Built-in roles known NOT to hold the permission. Anything else (owner, managers,
// custom roles) is attempted; a 403 just leaves the value empty. The API stays the boundary.
const NO_LOCATION_VIEW = new Set(['kitchen-team', 'accountant']);
const NO_BUSINESS_VIEW = new Set(['service-team', 'host', 'kitchen-team', 'stock-control-manager']);

function mayTry(roles: { key: string }[], lacking: Set<string>): boolean {
  return roles.length > 0 && roles.some((r) => !lacking.has(r.key));
}

export function WorkLocationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const isTenant = user?.realm === 'BUSINESS' && Boolean(user.businessId);
  const roles = user?.roles;

  const [locations, setLocations] = useState<WorkLocation[]>([]);
  const [locationId, setCurrent] = useState<string | null>(null);
  const [status, setStatus] = useState<WorkLocationStatus>('idle');
  const [businessName, setBusinessName] = useState<string | null>(
    (user as { businessName?: string } | null)?.businessName ?? null,
  );

  useEffect(() => {
    setLocations([]);
    setCurrent(null);
    if (!isTenant || !userId || !roles) {
      setStatus('idle');
      return;
    }
    let active = true;
    if (!mayTry(roles, NO_LOCATION_VIEW)) {
      setStatus('ready');
    } else {
      setStatus('loading');
      api<WorkLocation[]>('/admin/locations')
        .then((all) => {
          if (!active) return;
          const usable = all.filter((l) => l.status !== 'INACTIVE');
          setLocations(usable);
          setCurrent(resolveLocationId(usable, readStored(userId)));
          setStatus('ready');
        })
        .catch(() => {
          if (active) setStatus('error');
        });
    }
    if (mayTry(roles, NO_BUSINESS_VIEW)) {
      api<{ name?: string }>('/admin/business')
        .then((b) => {
          if (active && b?.name) setBusinessName(b.name);
        })
        .catch(() => undefined);
    }
    return () => {
      active = false;
    };
  }, [isTenant, userId, roles]);

  const setLocationId = useCallback(
    (id: string | null) => {
      if (id !== null && !locations.some((l) => l.id === id)) return;
      if (locations.length === 1) return; // a single location is fixed
      setCurrent(id);
      if (userId) writeStored(userId, id);
    },
    [locations, userId],
  );

  const value = useMemo<WorkLocationState>(
    () => ({
      locations,
      locationId,
      location: locations.find((l) => l.id === locationId) ?? null,
      setLocationId,
      status,
      canChoose: locations.length > 1,
      businessName: isTenant ? businessName : null,
    }),
    [locations, locationId, setLocationId, status, businessName, isTenant],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * The location the user is currently working in. Safe outside the provider
 * (returns an empty, idle state), so pages and tests don't need to wrap it.
 */
export function useWorkLocation(): WorkLocationState {
  return useContext(Ctx);
}
