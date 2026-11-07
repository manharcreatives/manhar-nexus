import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { errorMessage } from '../commercial/helpers';
import { FormError } from '../commercial/Shared';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Field } from '../ui/Field';
import { acceptMismatchedPayment, formatRupees, type PaymentLink, type RegistrationRequest } from './api';

/**
 * A payment came in for a different amount than the link. Staff check it in Cashfree first; accepting it marks the
 * request paid (and starts the account), with a written reason that the server audits.
 */
export function AcceptMismatchDialog({
  request,
  payment,
  onClose,
  onDone,
}: {
  request: RegistrationRequest;
  payment: PaymentLink;
  onClose: () => void;
  onDone: (payment: PaymentLink) => void;
}) {
  const { t } = useTranslation();
  const formId = useId();
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (reason.trim().length < 3) {
      setReasonError(t('registrations.payment.reasonInvalid'));
      return;
    }
    setReasonError(null);
    setError(null);
    setBusy(true);
    try {
      onDone(await acceptMismatchedPayment(request.id, payment.id, reason.trim()));
    } catch (err) {
      setError(errorMessage(err, t('registrations.accept.failed')));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onClose={() => !busy && onClose()}
      title={t('registrations.accept.title', { name: request.restaurantName })}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t('onboarding.cancel')}
          </Button>
          <Button type="submit" form={formId} loading={busy}>
            {t('registrations.accept.confirm')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-4">
        <p className="text-sm text-muted">
          {t('registrations.accept.intro', { paid: formatRupees(payment.paidAmountPaise ?? 0), expected: formatRupees(payment.amountPaise) })}
        </p>
        <Field
          label={t('registrations.accept.reasonLabel')}
          hint={t('registrations.accept.reasonHint')}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          error={reasonError}
          maxLength={200}
          autoComplete="off"
          autoFocus
          data-autofocus
        />
        <FormError message={error} />
      </form>
    </Dialog>
  );
}
