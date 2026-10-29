import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { applyAccent, brand } from '../lib/brand';
import { api, hasSessionHint, login as apiLogin, setAccessToken, setAuthLostHandler, setSessionHint, tryRefresh } from './api';

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
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Re-read the signed-in user (for example after the restaurant profile changed). */
  refreshUser: () => Promise<void>;
  /** The server ended every session after a password change: drop local state and ask for a fresh sign-in. */
  endSessionAfterPasswordChange: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Each restaurant sees its own accent colour; signed-out screens use the product default.
  useEffect(() => {
    applyAccent(user?.business?.accentColor ?? brand.accent);
  }, [user]);

  async function loadMe(): Promise<void> {
    const me = await api<AuthUser>('/auth/me');
    setUser(me);
    setStatus('authenticated');
  }

  // On mount: attempt a silent refresh (httpOnly cookie), then load the profile.
  useEffect(() => {
    setAuthLostHandler(() => {
      setUser(null);
      setStatus('unauthenticated');
      setNotice('sessionExpired');
    });
    let active = true;
    void (async () => {
      // No hint = nobody ever signed in here (or they signed out): skip the doomed refresh call.
      const refreshed = hasSessionHint() ? await tryRefresh().catch(() => false) : false;
      if (!active) return;
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

  const value = useMemo<AuthState>(
    () => ({
      status,
      user,
      notice,
      async signIn(email, password) {
        setNotice(null);
        await apiLogin(email, password);
        await loadMe();
      },
      async refreshUser() {
        await loadMe();
      },
      endSessionAfterPasswordChange() {
        setAccessToken(null);
        setSessionHint(false);
        setUser(null);
        setNotice('passwordChanged');
        setStatus('unauthenticated');
      },
      async signOut() {
        await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
        setAccessToken(null); // clear in-memory token immediately (server already revoked)
        setSessionHint(false);
        setUser(null);
        setStatus('unauthenticated');
      },
    }),
    [status, user, notice],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
