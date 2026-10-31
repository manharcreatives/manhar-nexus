import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeAuthServer, MemStorage, activateStorage, installBrowser, uninstallBrowser } from './testing/fakeAuthServer';

/**
 * ADR-034: two simulated tabs of ONE browser profile (shared cookie jar and localStorage, separate
 * sessionStorage and separate module state, exactly as in a real browser) run different users at once.
 */
type Api = typeof import('./api');
type Ts = typeof import('./tabSession');
interface Tab {
  name: string;
  storage: MemStorage;
  api: Api;
  ts: Ts;
  lost: string[];
}

let server: FakeAuthServer;

/** Load a fresh copy of the auth modules = a new JS context, attached to the given tab storage. */
async function loadTab(name: string, storage = new MemStorage()): Promise<Tab> {
  vi.resetModules();
  activateStorage(storage);
  const api = await import('./api');
  const ts = await import('./tabSession');
  const tab: Tab = { name, storage, api, ts, lost: [] };
  api.setAuthLostHandler((reason) => tab.lost.push(reason));
  return tab;
}
/** Run something "inside" a tab (points window.sessionStorage at it). */
async function inTab<T>(tab: Tab, fn: () => Promise<T> | T): Promise<T> {
  activateStorage(tab.storage);
  return fn();
}
async function whoAmI(tab: Tab): Promise<string> {
  const me = await inTab(tab, () => tab.api.api<{ email: string }>('/auth/me'));
  return me.email;
}
/** A page reload: same sessionStorage, brand new module state and no access token. */
async function reload(tab: Tab): Promise<Tab> {
  return loadTab(tab.name, tab.storage);
}

beforeEach(() => {
  window.localStorage.clear();
  server = new FakeAuthServer();
  installBrowser(server);
});
afterEach(() => {
  uninstallBrowser();
  activateStorage(new MemStorage());
});

describe('two tabs, two users in one browser profile', () => {
  it('each tab signs in on its own slot and keeps its own identity through reloads and refreshes', async () => {
    const t1 = await loadTab('owner-tab');
    const t2 = await loadTab('cashier-tab');
    await inTab(t1, () => t1.api.login('owner@cafe.test', 'pw', { remember: false }));
    await inTab(t2, () => t2.api.login('cashier@cafe.test', 'pw', { remember: false }));

    // Two different cookies live side by side in the same jar; no device cookie exists.
    const cookies = [...server.jar.keys()];
    expect(cookies).toHaveLength(2);
    expect(cookies.every((c) => c.startsWith('nexus_rt_'))).toBe(true);
    expect(server.jar.has('nexus_refresh')).toBe(false);
    expect(window.localStorage.getItem('nx.session')).toBeNull(); // the device hint is untouched
    expect(t1.storage.getItem('nx.slot')).toBeTruthy();
    expect(t1.storage.getItem('nx.slot')).not.toBe(t2.storage.getItem('nx.slot'));

    expect(await whoAmI(t1)).toBe('owner@cafe.test');
    expect(await whoAmI(t2)).toBe('cashier@cafe.test');

    // Both tabs "reload" (silent refresh from their own cookie) in alternating order, several times.
    let a = t1;
    let b = t2;
    for (let i = 0; i < 3; i++) {
      a = await reload(a);
      b = await reload(b);
      expect(await inTab(a, () => a.api.hasSessionHint())).toBe(true);
      expect(await inTab(a, () => a.api.tryRefresh())).toBe(true);
      expect(await inTab(b, () => b.api.tryRefresh())).toBe(true);
      expect(await whoAmI(a)).toBe('owner@cafe.test');
      expect(await whoAmI(b)).toBe('cashier@cafe.test');
    }
    expect(server.refreshFailures()).toBe(0);
    expect(t1.lost).toEqual([]);
    // Every refresh named its slot; none fell back to the device cookie.
    expect(server.calls.filter((c) => c.path === '/auth/refresh').every((c) => c.slot !== null)).toBe(true);
  });

  it('signing out in one tab ends only that tab\'s session', async () => {
    const t1 = await loadTab('owner-tab');
    const t2 = await loadTab('cashier-tab');
    await inTab(t1, () => t1.api.login('owner@cafe.test', 'pw', { remember: false }));
    await inTab(t2, () => t2.api.login('cashier@cafe.test', 'pw', { remember: false }));
    const slot2 = t2.storage.getItem('nx.slot');

    await inTab(t1, async () => {
      await t1.api.api('/auth/logout', { method: 'POST' });
      t1.api.endLocalSession();
    });
    expect(t1.storage.getItem('nx.slot')).toBeNull();
    expect(t1.storage.getItem('nx.detached')).toBe('1'); // this tab must not slip into some other session
    expect(server.jar.has(`nexus_rt_${slot2}`)).toBe(true);
    expect(window.localStorage.getItem('nx.session')).toBeNull();

    // The cashier tab is fine, even after a reload.
    expect(await whoAmI(t2)).toBe('cashier@cafe.test');
    const t2b = await reload(t2);
    expect(await inTab(t2b, () => t2b.api.tryRefresh())).toBe(true);
    expect(await whoAmI(t2b)).toBe('cashier@cafe.test');
    // The signed-out tab cannot come back by itself.
    const t1b = await reload(t1);
    expect(await inTab(t1b, () => t1b.api.hasSessionHint())).toBe(false);
  });

  it('the same user in two tabs has two sessions; logging one out leaves the other', async () => {
    const t1 = await loadTab('a');
    const t2 = await loadTab('b');
    await inTab(t1, () => t1.api.login('owner@cafe.test', 'pw', { remember: false }));
    await inTab(t2, () => t2.api.login('owner@cafe.test', 'pw', { remember: false }));
    await inTab(t1, async () => {
      await t1.api.api('/auth/logout', { method: 'POST' });
      t1.api.endLocalSession();
    });
    expect(await whoAmI(t2)).toBe('owner@cafe.test');
  });

  it('a tab-only sign-in never disturbs the device session of another tab, and vice versa', async () => {
    const device = await loadTab('device-tab');
    const own = await loadTab('own-tab');
    await inTab(device, () => device.api.login('owner@cafe.test', 'pw', { remember: true }));
    expect(server.jar.has('nexus_refresh')).toBe(true);
    expect(window.localStorage.getItem('nx.session')).toBe('1');

    await inTab(own, () => own.api.login('waiter@cafe.test', 'pw', { remember: false }));
    expect(server.jar.has('nexus_refresh')).toBe(true);

    const device2 = await reload(device);
    const own2 = await reload(own);
    expect(await inTab(device2, () => device2.api.tryRefresh())).toBe(true);
    expect(await inTab(own2, () => own2.api.tryRefresh())).toBe(true);
    expect(await whoAmI(device2)).toBe('owner@cafe.test');
    expect(await whoAmI(own2)).toBe('waiter@cafe.test');
  });
});

describe('single-user experience is unchanged', () => {
  it('remember-me (default) uses the device cookie and the localStorage hint, no slot', async () => {
    const t = await loadTab('only');
    await inTab(t, () => t.api.login('owner@cafe.test', 'pw'));
    expect(t.storage.getItem('nx.slot')).toBeNull();
    expect(window.localStorage.getItem('nx.session')).toBe('1');
    expect(server.jar.has('nexus_refresh')).toBe(true);
    const login = server.calls.find((c) => c.path === '/auth/login')!;
    expect(login.slot).toBeNull();

    // A brand-new tab (empty sessionStorage) picks the device session up silently, as before.
    const fresh = await loadTab('new-tab');
    expect(await inTab(fresh, () => fresh.api.hasSessionHint())).toBe(true);
    expect(await inTab(fresh, () => fresh.api.tryRefresh())).toBe(true);
    expect(await whoAmI(fresh)).toBe('owner@cafe.test');
  });

  it('a detached tab (switch account) does not adopt the device session and defaults to tab-only login', async () => {
    const device = await loadTab('device-tab');
    await inTab(device, () => device.api.login('owner@cafe.test', 'pw'));
    const t2 = await loadTab('second');
    expect(await inTab(t2, () => t2.api.hasSessionHint())).toBe(true); // would silently join the device session
    await inTab(t2, () => t2.api.detachFromDeviceSession());
    expect(await inTab(t2, () => t2.api.hasSessionHint())).toBe(false);

    await inTab(t2, () => t2.api.login('cashier@cafe.test', 'pw')); // no explicit remember: detached => tab-only
    expect(t2.storage.getItem('nx.slot')).toBeTruthy();
    expect(await whoAmI(device)).toBe('owner@cafe.test');
    expect(await whoAmI(t2)).toBe('cashier@cafe.test');
    // detaching did NOT sign the device out
    expect(server.calls.filter((c) => c.path === '/auth/logout')).toHaveLength(0);
  });

  it('a refresh that is refused (401) clears the right hint: device hint for the device, slot for a tab', async () => {
    const dev = await loadTab('dev');
    await inTab(dev, () => dev.api.login('owner@cafe.test', 'pw'));
    server.jar.delete('nexus_refresh');
    expect(await inTab(dev, () => dev.api.tryRefresh())).toBe(false);
    expect(window.localStorage.getItem('nx.session')).toBeNull();

    const tab = await loadTab('tab');
    await inTab(tab, () => tab.api.login('cashier@cafe.test', 'pw', { remember: false }));
    window.localStorage.setItem('nx.session', '1'); // an unrelated device hint
    server.jar.clear();
    expect(await inTab(tab, () => tab.api.tryRefresh())).toBe(false);
    expect(tab.storage.getItem('nx.slot')).toBeNull();
    expect(window.localStorage.getItem('nx.session')).toBe('1'); // untouched by the tab's failure
  });
});

describe('identity guard on the shared device cookie', () => {
  it('refuses to adopt a different account that signed in on the device from another tab', async () => {
    const t1 = await loadTab('tab-1');
    const t2 = await loadTab('tab-2');
    await inTab(t1, () => t1.api.login('owner@cafe.test', 'pw'));
    await inTab(t2, () => t2.api.login('cashier@cafe.test', 'pw')); // replaces the device cookie
    expect(await inTab(t1, () => t1.api.tryRefresh())).toBe(false);
    expect(t1.lost).toEqual(['accountChanged']);
    expect(t1.api.getAccessToken()).toBeNull();
  });
});

describe('refresh rotation across tabs that share a cookie', () => {
  it('Web Locks serialise concurrent refreshes: both tabs succeed, nobody is logged out', async () => {
    const t1 = await loadTab('tab-1');
    const t2 = await loadTab('tab-2');
    await inTab(t1, () => t1.api.login('owner@cafe.test', 'pw'));
    await inTab(t2, () => t2.api.tryRefresh());
    activateStorage(t1.storage);
    const p1 = t1.api.tryRefresh();
    activateStorage(t2.storage);
    const p2 = t2.api.tryRefresh();
    expect(await Promise.all([p1, p2])).toEqual([true, true]);
    expect(server.refreshFailures()).toBe(0);
    expect(await whoAmI(t1)).toBe('owner@cafe.test');
  });

  it('without the lock the same overlap would look like token theft (documents why the lock exists)', async () => {
    uninstallBrowser();
    installBrowser(server, { webLocks: false });
    const t1 = await loadTab('tab-1');
    const t2 = await loadTab('tab-2');
    await inTab(t1, () => t1.api.login('owner@cafe.test', 'pw'));
    activateStorage(t1.storage);
    const p1 = t1.api.tryRefresh();
    activateStorage(t2.storage);
    const p2 = t2.api.tryRefresh();
    const results = await Promise.all([p1, p2]);
    expect(results).toContain(false);
    expect(server.refreshFailures()).toBeGreaterThan(0);
  });

  it('tab sessions never contend: concurrent refreshes in different slots all succeed', async () => {
    const t1 = await loadTab('tab-1');
    const t2 = await loadTab('tab-2');
    await inTab(t1, () => t1.api.login('owner@cafe.test', 'pw', { remember: false }));
    await inTab(t2, () => t2.api.login('cashier@cafe.test', 'pw', { remember: false }));
    activateStorage(t1.storage);
    const p1 = t1.api.tryRefresh();
    activateStorage(t2.storage);
    const p2 = t2.api.tryRefresh();
    expect(await Promise.all([p1, p2])).toEqual([true, true]);
  });
});

describe('duplicated tabs', () => {
  it('a copy of a tab\'s sessionStorage cannot claim a slot another live tab holds', async () => {
    const t1 = await loadTab('original');
    await inTab(t1, () => t1.api.login('owner@cafe.test', 'pw', { remember: false }));
    const slot = t1.storage.getItem('nx.slot')!;
    await inTab(t1, () => t1.ts.claimSlot(slot, 20)); // the original owns it

    const dup = await loadTab('duplicate');
    dup.storage.setItem('nx.slot', slot); // browsers copy sessionStorage on "Duplicate tab"
    expect(await inTab(dup, () => dup.ts.claimSlot(slot, 30))).toBe(false);
  });

  it('a reloaded tab re-claims its own slot (the old page released it)', async () => {
    const t1 = await loadTab('original');
    await inTab(t1, () => t1.api.login('owner@cafe.test', 'pw', { remember: false }));
    const slot = t1.storage.getItem('nx.slot')!;
    expect(await inTab(t1, () => t1.ts.claimSlot(slot, 20))).toBe(true);
    // Simulate unload: the lock manager of the old document goes away with it.
    uninstallBrowser();
    installBrowser(server);
    const t1b = await reload(t1);
    expect(await inTab(t1b, () => t1b.ts.claimSlot(slot, 30))).toBe(true);
  });
});

describe('non-secret signals', () => {
  it('broadcasts only signal names, never tokens or user data', async () => {
    const t1 = await loadTab('a');
    const t2 = await loadTab('b');
    const seen: unknown[] = [];
    const off = t2.ts.onAuthSignal((s) => seen.push(s));
    await inTab(t1, () => t1.api.login('owner@cafe.test', 'pw'));
    await Promise.resolve();
    await Promise.resolve();
    expect(seen).toEqual(['device-signed-in']);
    off();
  });

  it('tab-only sign-in broadcasts nothing (other tabs are not affected)', async () => {
    const t1 = await loadTab('a');
    const t2 = await loadTab('b');
    const seen: unknown[] = [];
    t2.ts.onAuthSignal((s) => seen.push(s));
    await inTab(t1, () => t1.api.login('owner@cafe.test', 'pw', { remember: false }));
    await Promise.resolve();
    await Promise.resolve();
    expect(seen).toEqual([]);
  });

  it('keeps no token in any browser storage', async () => {
    const t1 = await loadTab('a');
    await inTab(t1, () => t1.api.login('owner@cafe.test', 'pw', { remember: false }));
    const token = t1.api.getAccessToken()!;
    const dump = JSON.stringify([...Array(t1.storage.length).keys()].map((i) => [t1.storage.key(i), t1.storage.getItem(t1.storage.key(i)!)])) + JSON.stringify({ ...window.localStorage });
    expect(dump).not.toContain(token);
    expect(dump).not.toContain('rt-');
  });
});
