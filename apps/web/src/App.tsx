import { lazy, Suspense, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { hasSessionHint } from './auth/api';
import { LoginScreen } from './auth/LoginScreen';
import { PasswordGate } from './auth/PasswordGate';
import { ToastProvider } from './ui/Toast';
import { AppShell } from './shell/AppShell';
import { WorkLocationProvider } from './context/LocationContext';
import { RealtimeProvider } from './realtime/RealtimeProvider';
import { isHomePath, isPublicPath, normalizePath } from './landing/paths';
import { isGuestMenuPath } from './guestmenu/path';
import { isAutopayPath } from './autopay/path';
import { isClaimPath } from './claim/path';

// The marketing site is a separate lazy chunk: the app's entry bundle never includes it.
const LandingApp = lazy(() => import('./landing/LandingApp'));
// The customer QR menu (/m/:tableToken) is public, auth-free and its own lazy chunk (never in the entry bundle).
const GuestMenuApp = lazy(() => import('./guestmenu'));
// The owner's UPI AutoPay approval page (/pay/autopay/:token): public, auth-free, its own lazy chunk.
const AutopayApp = lazy(() => import('./autopay/AutopayApp'));

// The owner's one-time "set your password" page (/set-password#t=...): public, auth-free, its own lazy chunk.
const ClaimApp = lazy(() => import('./claim/ClaimApp'));

function PublicSite() {
  return (
    <Suspense fallback={null}>
      <LandingApp />
    </Suspense>
  );
}

function Gate() {
  const { t } = useTranslation();
  const { status, notice, user } = useAuth();
  const { pathname } = useLocation();
  const publicPath = isPublicPath(pathname);
  const isLogin = normalizePath(pathname) === '/login';
  // Signing out (or an expired session) while on "/" goes to the sign-in screen, not to the marketing page.
  const wasAuthenticated = useRef(false);
  useEffect(() => {
    wasAuthenticated.current = status === 'authenticated';
  }, [status]);

  if (status === 'loading') {
    // First-time visitors (no session hint) on a public path see the website at once, not a "Loading…" flash.
    if (publicPath && !hasSessionHint()) return <PublicSite />;
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted">
        {t('auth.loading')}
      </div>
    );
  }
  if (status === 'authenticated' && user?.mustChangePassword) return <PasswordGate />;
  if (status === 'authenticated') {
    // After signing in at /login the user would otherwise sit on an in-app 404.
    if (isLogin) return <Navigate to="/" replace />;
    // Policy and article pages are public documents: signed-in users read them in the same shell.
    if (publicPath && !isHomePath(pathname)) return <PublicSite />;
    return (
      <WorkLocationProvider>
        <RealtimeProvider>
          <AppShell />
        </RealtimeProvider>
      </WorkLocationProvider>
    );
  }
  if (wasAuthenticated.current && isHomePath(pathname)) return <Navigate to="/login" replace />;
  // Signed out: "/" and the public routes show the website; /login and every other path keep the sign-in
  // screen (so a deep link such as /bills still returns to that view after sign-in).
  return isLogin || !publicPath ? <LoginScreen notice={notice} /> : <PublicSite />;
}

export default function App() {
  // /m/* is for restaurant guests on their own phones: no sign-in, no session refresh, no landing router.
  if (isGuestMenuPath(window.location.pathname)) {
    return (
      <Suspense fallback={null}>
        <GuestMenuApp />
      </Suspense>
    );
  }
  // /pay/autopay/* is opened by the restaurant owner from a link we sent: no sign-in, no session refresh.
  if (isAutopayPath(window.location.pathname)) {
    return (
      <Suspense fallback={null}>
        <AutopayApp />
      </Suspense>
    );
  }
  // /set-password is opened by a new restaurant owner from the link we gave them: no sign-in, no session refresh.
  if (isClaimPath(window.location.pathname)) {
    return (
      <Suspense fallback={null}>
        <ClaimApp />
      </Suspense>
    );
  }
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Gate />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
