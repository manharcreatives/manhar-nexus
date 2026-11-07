import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { errorMessage } from '../commercial/helpers';
import { FormError } from '../commercial/Shared';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Field } from '../ui/Field';
import { updateRegistration, type RegistrationRequest } from './api';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Fix a typo in the owner's name, email or mobile number before the account exists (the phone is part of their sign-in proof). */
export function EditContactDialog({
  request,
  onClose,
  onSaved,
}: {
  request: RegistrationRequest;
  onClose: () => void;
  onSaved: (updated: RegistrationRequest) => void;
}) {
  const { t } = useTranslation();
  const formId = useId();
  const [name, setName] = useState(request.contactName);
  const [email, setEmail] = useState(request.email);
  const [phone, setPhone] = useState(request.phone);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = t('provision.errors.ownerName');
    if (!EMAIL.test(email.trim())) next.email = t('provision.errors.email');
    if (phone.replace(/\D/g, '').length < 10) next.phone = t('registrations.edit.phoneInvalid');
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    const patch: { contactName?: string; email?: string; phone?: string } = {};
    if (name.trim() !== request.contactName) patch.contactName = name.trim();
    if (email.trim().toLowerCase() !== request.email) patch.email = email.trim().toLowerCase();
    if (phone.trim() !== request.phone) patch.phone = phone.trim();
    if (Object.keys(patch).length === 0) return onClose();
    setBusy(true);
    setError(null);
    try {
      onSaved(await updateRegistration(request.id, patch));
    } catch (err) {
      setError(errorMessage(err, t('registrations.edit.failed')));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onClose={() => !busy && onClose()}
      title={t('registrations.edit.title', { name: request.restaurantName })}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t('onboarding.cancel')}
          </Button>
          <Button type="submit" form={formId} loading={busy}>
            {t('registrations.edit.save')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-4">
        <p className="text-sm text-muted">{t('registrations.edit.intro')}</p>
        <Field label={t('provision.ownerName')} value={name} onChange={(e) => setName(e.target.value)} error={errors.name} autoComplete="off" autoFocus data-autofocus />
        <Field label={t('provision.ownerEmail')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} autoComplete="off" />
        <Field label={t('registrations.field.phone')} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone} autoComplete="off" />
        <FormError message={error} />
      </form>
    </Dialog>
  );
}
