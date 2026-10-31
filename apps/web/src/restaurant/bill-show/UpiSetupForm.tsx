import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { configApi } from '../../config/api';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import { CHECKOUT_NAMESPACE, UPI_VPA_KEY, UPI_VPA_REGEX } from './billShowApi';

/**
 * Inline setter for the restaurant's UPI ID (Configuration Center setting checkout.upi_vpa), offered to owners and
 * managers on the "UPI not set up" screen. The same setting is always editable in Configuration Center.
 */
export function UpiSetupForm({ onSaved }: { onSaved: () => void }) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const vpa = value.trim();
    if (!UPI_VPA_REGEX.test(vpa)) {
      setError(t('billShow.upiSetup.invalid'));
      return;
    }
    setError('');
    setSaving(true);
    try {
      await configApi.setSetting(CHECKOUT_NAMESPACE, UPI_VPA_KEY, vpa);
      onSaved();
    } catch (err) {
      const status = (err as { status?: number } | null)?.status;
      setError(status === 400 ? t('billShow.upiSetup.invalid') : status === 401 || status === 403 ? t('billShow.upiSetup.noAccess') : t('billShow.upiSetup.failed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="mx-auto mt-5 max-w-sm space-y-3 text-left">
      <Field
        label={t('billShow.upiSetup.label')}
        hint={t('billShow.upiSetup.hint')}
        placeholder="name@bank"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        value={value}
        error={error || null}
        onChange={(e) => setValue(e.target.value)}
        disabled={saving}
      />
      <Button type="submit" loading={saving} className="w-full">
        {t('billShow.upiSetup.save')}
      </Button>
    </form>
  );
}
