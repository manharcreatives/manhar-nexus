import { useTranslation } from 'react-i18next';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { LoginScreen } from './auth/LoginScreen';
import { AppShell } from './shell/AppShell';

function Gate() {
  const { t } = useTranslation();
  const { status, notice } = useAuth();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper text-sm text-muted">
        {t('auth.loading')}
      </div>
    );
  }
  return status === 'authenticated' ? <AppShell /> : <LoginScreen notice={notice} />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Gate />
      </BrowserRouter>
    </AuthProvider>
  );
}
