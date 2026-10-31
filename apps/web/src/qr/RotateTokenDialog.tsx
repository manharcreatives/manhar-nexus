import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import * as Icons from './icons';
import type { QrTable } from './types';

/** Rotating a token kills the printed QR immediately, so the consequence is spelled out first. */
export function RotateTokenDialog({ table, busy, seated, onConfirm, onClose }: { table: QrTable; busy: boolean; seated?: boolean; onConfirm: () => void; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Dialog
      open
      onClose={() => !busy && onClose()}
      title={t('qr.rotate.title', { code: table.code })}
      footer={
        <>
          {/* The safe choice holds the initial focus. */}
          <Button variant="secondary" onClick={onClose} disabled={busy} data-autofocus>
            {t('qr.common.cancel')}
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={busy}>
            <Icons.RotateCw className="size-4" aria-hidden />
            {t('qr.rotate.confirm')}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <p>{t('qr.rotate.body', { code: table.code })}</p>
        <ul className="list-disc space-y-1.5 pl-5 text-muted">
          <li>{t('qr.rotate.effectOld')}</li>
          <li>{t('qr.rotate.effectPrint')}</li>
          {seated && <li className="text-warn">{t('qr.rotate.effectSeated')}</li>}
        </ul>
      </div>
    </Dialog>
  );
}
