import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';

/** A small "are you sure?" box for actions that are easy to click by mistake. */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  busy = false,
  onConfirm,
  onClose,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog
      open
      onClose={() => !busy && onClose()}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy} data-autofocus>
            {t('onboarding.cancel')}
          </Button>
          <Button loading={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted">{body}</p>
    </Dialog>
  );
}
