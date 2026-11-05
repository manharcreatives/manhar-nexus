import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { FormError } from '../commercial/Shared';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Field } from '../ui/Field';
import { createPaymentLink, formatRupees, paymentMessage, whatsappUrl, type PaymentLink, type RegistrationRequest } from './api';

/** Errors the user can act on (not configured, Cashfree refused, already paid) are shown as the server wrote them. */
function messageOf(err: unknown, fallback: string): string {
  const e = err as { status?: number; message?: string } | null;
  return e && [400, 409, 422, 502, 503].includes(e.status ?? 0) && e.message ? e.message : fallback;
}

/** The amount typed, in rupees, or null when it is not a positive number with at most two decimals. */
export function parseRupees(input: string): number | null {
  const text = input.replace(/[,\s₹]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const n = Number(text);
  return n > 0 && n <= 1_000_000 ? n : null;
}

export function PaymentLinkDialog({
  request,
  onClose,
  onCreated,
}: {
  request: RegistrationRequest;
  onClose: () => void;
  /** Called once the link exists, so the page can show it in the list. */
  onCreated: (link: PaymentLink) => void;
}) {
  const { t } = useTranslation();
  const formId = useId();
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<PaymentLink | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const rupees = parseRupees(amount);
    if (rupees === null) {
      setFieldError(t('registrations.payment.amountInvalid'));
      return;
    }
    setFieldError(null);
    setError(null);
    setBusy(true);
    try {
      const created = await createPaymentLink(request.id, { amountRupees: rupees });
      setLink(created);
      onCreated(created);
    } catch (err) {
      setError(messageOf(err, t('registrations.payment.createFailed')));
    } finally {
      setBusy(false);
    }
  }

  function copy(value: string) {
    void navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  const footer = link ? (
    <Button onClick={onClose}>{t('registrations.payment.done')}</Button>
  ) : (
    <>
      <Button variant="secondary" onClick={onClose}>
        {t('onboarding.cancel')}
      </Button>
      <Button type="submit" form={formId} loading={busy}>
        {t('registrations.payment.create')}
      </Button>
    </>
  );

  return (
    <Dialog open onClose={() => !busy && onClose()} title={t('registrations.payment.title', { name: request.restaurantName })} className="w-[min(34rem,calc(100vw-2rem))]" footer={footer}>
      {link ? (
        <div className="space-y-4">
          <p className="text-sm text-muted">{t('registrations.payment.ready', { amount: formatRupees(link.amountPaise) })}</p>
          <p className="nx-glass break-all rounded-panel px-4 py-3 text-sm">{link.linkUrl}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => copy(link.linkUrl)}>
              {copied ? t('registrations.payment.copied') : t('registrations.payment.copy')}
            </Button>
            <a
              className="inline-flex min-h-11 items-center rounded-control border border-white/10 bg-white/[0.04] px-4 text-sm hover:border-accent/40"
              href={whatsappUrl(request.phone, paymentMessage(request, link))}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('registrations.payment.whatsapp')}
            </a>
          </div>
          <p className="text-sm text-muted">{t('registrations.payment.emailed', { email: request.email })}</p>
        </div>
      ) : (
        <form id={formId} onSubmit={submit} noValidate className="space-y-4">
          <p className="text-sm text-muted">{t('registrations.payment.intro')}</p>
          <Field
            label={t('registrations.payment.amountLabel')}
            hint={t('registrations.payment.amountHint')}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            error={fieldError}
            inputMode="decimal"
            autoComplete="off"
            autoFocus
            data-autofocus
          />
          <FormError message={error} />
        </form>
      )}
    </Dialog>
  );
}
