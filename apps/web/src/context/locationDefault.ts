/**
 * Pure helpers behind LocationContext: which location is "current" when the
 * app starts, and how the choice is persisted. Kept free of React so they can
 * be unit-tested.
 */

/** Stored value meaning "All locations" (the user explicitly chose no filter). */
export const ALL_LOCATIONS = '__all__';

export interface LocationLike {
  id: string;
}

/** localStorage key, one per user so shared terminals don't leak choices across staff. */
export function storageKey(userId: string): string {
  return `nexus.workLocation.v1:${userId}`;
}

/**
 * Resolve the working location.
 * - no locations           → null (nothing to scope by)
 * - exactly one            → that one, always (no picker needed)
 * - several + valid stored → the last one used
 * - several otherwise      → null, i.e. "All locations"
 * A stored id that no longer exists (deactivated, access removed) is ignored.
 */
export function resolveLocationId(locations: readonly LocationLike[], stored: string | null): string | null {
  if (locations.length === 0) return null;
  if (locations.length === 1) return locations[0].id;
  if (stored && stored !== ALL_LOCATIONS && locations.some((l) => l.id === stored)) return stored;
  return null;
}

export function readStored(userId: string): string | null {
  try {
    return window.localStorage.getItem(storageKey(userId));
  } catch {
    return null; // private mode / blocked storage: fall back to defaults
  }
}

export function writeStored(userId: string, locationId: string | null): void {
  try {
    window.localStorage.setItem(storageKey(userId), locationId ?? ALL_LOCATIONS);
  } catch {
    /* storage unavailable: the choice simply lasts for this tab */
  }
}
