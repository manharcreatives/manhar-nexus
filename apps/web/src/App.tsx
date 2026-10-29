import { useTranslation } from 'react-i18next';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { LoginScreen } from './auth/LoginScreen';
import { ToastProvider } from './ui/Toast';
import { AppShell } from './shell/AppShell';
import { WorkLocationProvider } from './context/LocationContext';
import { RealtimeProvider } from './realtime/RealtimeProvider';

function Gate() {
  const { t } = useTranslation();
  const { status, notice } = useAuth();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted">
        {t('auth.loading')}
      </div>
    );
  }
  return status === 'authenticated' ? (
    <WorkLocationProvider>
      <RealtimeProvider>
        <AppShell />
      </RealtimeProvider>
    </WorkLocationProvider>
  ) : (
    <LoginScreen notice={notice} />
  );
}

export default function App() {
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
