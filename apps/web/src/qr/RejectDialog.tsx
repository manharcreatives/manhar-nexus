import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Textarea } from '../ui/Textarea';
import type { GuestOrder } from './types';

export const REJECT_REASONS = ['unavailable', 'busy', 'wrongTable', 'other'] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];

/** The reason sent to the API (and shown to the guest): a preset sentence plus optional detail. */
export function buildRejectReason(preset: RejectReason, detail: string, presetText: string): string {
  const d = detail.trim();
  if (preset === 'other') return d;
  return d ? `${presetText}: ${d}` : presetText;
}

export function RejectDialog({ order, busy, onConfirm, onClose }: { order: GuestOrder; busy: boolean; onConfirm: (reason: string) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const formId = useId();
  const [preset, setPreset] = useState<RejectReason>('unavailable');
  const [detail, setDetail] = useState('');
  const [error, setError] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    const reason = buildRejectReason(preset, detail, t(`qr.orders.rejectReasons.${preset}`));
    if (!reason) return setError(t('qr.orders.rejectNeedsDetail'));
    onConfirm(reason);
  }

  return (
    <Dialog
      open
      onClose={() => !busy && onClose()}
      title={t('qr.orders.rejectTitle', { table: order.tableCode })}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t('qr.common.cancel')}
          </Button>
          <Button variant="danger" type="submit" form={formId} loading={busy}>
            {t('qr.orders.rejectConfirm')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-4">
        <p className="text-sm text-muted">{t('qr.orders.rejectBody')}</p>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">{t('qr.orders.rejectReason')}</legend>
          <div className="grid gap-2">
            {REJECT_REASONS.map((r) => (
              <label
                key={r}
                className={cn(
                  'flex min-h-11 cursor-pointer items-center gap-3 rounded-control border px-3 text-sm transition-colors',
                  preset === r ? 'border-accent/60 bg-accent/10' : 'border-white/10 hover:border-white/25',
                )}
              >
                <input type="radio" name="qr-reject" value={r} checked={preset === r} onChange={() => setPreset(r)} className="size-4 accent-(--color-accent)" />
                {t(`qr.orders.rejectReasons.${r}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <Textarea label={preset === 'other' ? t('qr.orders.rejectDetailRequired') : t('qr.orders.rejectDetail')} value={detail} maxLength={200} onChange={(e) => setDetail(e.target.value)} />
        <p role="alert" className="text-sm text-bad">{error}</p>
      </form>
    </Dialog>
  );
}
