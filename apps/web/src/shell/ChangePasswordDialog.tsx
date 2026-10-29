import { useTranslation } from 'react-i18next';
import { Dialog } from '../ui/Dialog';
import { ChangePasswordForm } from './ChangePasswordForm';

/** Account-menu entry: change your own password. */
export function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Dialog open onClose={onClose} title={t('account.password.title')}>
      <p className="mb-4 text-sm text-muted">{t('account.password.intro')}</p>
      <ChangePasswordForm onCancel={onClose} />
    </Dialog>
  );
}
