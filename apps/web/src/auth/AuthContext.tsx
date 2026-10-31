import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { applyAccent, brand } from '../lib/brand';
import {
  api,
  currentSessionKind,
  detachFromDeviceSession,
  endLocalSession,
  hasSessionHint,
  login as apiLogin,
  setAccessToken,
  setAuthLostHandler,
  tryRefresh,
} from './api';
import { claimSlot, forgetSlotAndDetach, isDetached, onAuthSignal, readSlot, type SessionKind } from './tabSession';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  realm: 'PLATFORM' | 'BUSINESS';
  businessId: string | null;
  roles: { key: string; name: string }[];
  /** True while the account still has a temporary password. */
  mustChangePassword?: boolean;
  /** The user's own restaurant (name + accent), when they belong to one. */
  business?: { name: string; accentColor: string | null } | null;
}

type Status = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  status: Status;
  user: AuthUser | null;
  notice: string | null;
  /** 'tab' = signed in on this tab only (other tabs may be other users); 'device' = remembered on this browser. */
  sessionKind: SessionKind;
  /** True when the next sign-in in this tab will be tab-only (it was detached from, or never joined, the device session). */
  tabOnlyLogin: boolean;
  /** `remember` (default true unless this tab is detached): keep the session for the whole browser. False = this tab only. */
  signIn: (email: string, password: string, remember?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  /** End every session of this user on every device and tab ("sign out everywhere"). */
  signOutEverywhere: () => Promise<void>;
  /** Leave this tab's account to sign in as someone else here, without disturbing the other tabs. */
  switchAccount: () => Promise<void>;
  /** Re-read the signed-in user (for example after the restaurant profile changed). */
  refreshUser: () => Promise<void>;
  /** The server ended every session after a password change: drop local state and ask for a fresh sign-in. */
  endSessionAfterPasswordChange: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

/** How long a reloaded tab waits for the previous page to release its slot before treating the slot as taken. */
const SLOT_CLAIM_WAIT_MS = 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [kind, setKind] = useState<SessionKind>(() => currentSessionKind());
  const [tabOnlyLogin, setTabOnlyLogin] = useState<boolean>(() => isDetached());
  const statusRef = useRef<Status>('loading');
  statusRef.current = status;

  // Each restaurant sees its own accent colour; signed-out screens use the product default.
  useEffect(() => {
    applyAccent(user?.business?.accentColor ?? brand.accent);
  }, [user]);

  function syncKind(): void {
    setKind(currentSessionKind());
    setTabOnlyLogin(isDetached() || readSlot() !== null);
  }

  async function loadMe(): Promise<void> {
    const me = await api<AuthUser>('/auth/me');
    setUser(me);
    setStatus('authenticated');
  }

  function dropLocalState(nextNotice: string | null): void {
    setUser(null);
    setNotice(nextNotice);
    setStatus('unauthenticated');
    syncKind();
  }

  // On mount: attempt a silent refresh (httpOnly cookie), then load the profile.
  useEffect(() => {
    setAuthLostHandler((reason) => dropLocalState(reason === 'accountChanged' ? 'accountChanged' : 'sessionExpired'));
    let active = true;
    void (async () => {
      // A tab restored from a duplicate of another tab shares its slot: only one live tab may own a session.
      const slot = readSlot();
      if (slot && !(await claimSlot(slot, SLOT_CLAIM_WAIT_MS))) forgetSlotAndDetach();
      // No hint = nobody ever signed in here (or they signed out): skip the doomed refresh call.
      const refreshed = hasSessionHint() ? await tryRefresh().catch(() => false) : false;
      if (!active) return;
      syncKind();
      if (!refreshed) {
        setStatus('unauthenticated');
        return;
      }
      try {
        await loadMe();
      } catch {
        if (active) setStatus('unauthenticated');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Device-session tabs follow each other (non-secret signals only). Tab sessions ignore them entirely.
  useEffect(
    () =>
      onAuthSignal((signal) => {
        if (readSlot() !== null || isDetached()) return;
        if (signal === 'device-signed-out') {
          if (statusRef.current === 'authenticated') {
            setAccessToken(null);
            dropLocalState('signedOutElsewhere');
          }
        } else if (statusRef.current === 'unauthenticated') {
          void (async () => {
            if (!(await tryRefresh().catch(() => false))) return;
            try {
              await loadMe();
            } catch {
              /* stay on the sign-in screen */
            }
          })();
        } else if (statusRef.current === 'authenticated') {
          // Someone signed in on the device: confirm it is still our account (a different one is refused, see api.ts).
          void tryRefresh().catch(() => false);
        }
      }),
    [],
  );

  const value = useMemo<AuthState>(
    () => ({
      status,
      user,
      notice,
      sessionKind: kind,
      tabOnlyLogin,
      async signIn(email, password, remember) {
        setNotice(null);
        await apiLogin(email, password, { remember });
        syncKind();
        await loadMe();
      },
      async refreshUser() {
        await loadMe();
      },
      endSessionAfterPasswordChange() {
        endLocalSession();
        dropLocalState('passwordChanged');
      },
      async signOut() {
        await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
        endLocalSession(); // clear the in-memory token immediately (the server already revoked this session)
        dropLocalState(null);
      },
      async signOutEverywhere() {
        await api('/auth/logout-all', { method: 'POST' }).catch(() => undefined);
        endLocalSession();
        dropLocalState(null);
      },
      async switchAccount() {
        if (currentSessionKind() === 'tab') {
          // A tab session is this tab's own: end it, and the next sign-in stays tab-only.
          await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
          endLocalSession();
        } else {
          // The device session belongs to every tab: leave it running for them and just step out of it here.
          detachFromDeviceSession();
        }
        dropLocalState(null);
      },
    }),
    [status, user, notice, kind, tabOnlyLogin],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
