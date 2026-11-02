/** localStorage wrapper: private windows and blocked storage must never break the menu. */
export function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or blocked: the menu works without persistence */
  }
}

export function removeKey(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export const keys = {
  // v2: the menu cache of the first (planned-contract) build had a different shape; never read it.
  menu: (t: string) => `nxm.menu.v2.${t}`,
  cart: (t: string) => `nxm.cart.${t}`,
  guest: (t: string) => `nxm.guest.v2.${t}`,
  idem: (t: string) => `nxm.idem.${t}`,
  /** orderId -> total (paise) this device submitted; lets the table view say "adjusted by your waiter". */
  placed: (t: string) => `nxm.placed.${t}`,
};
