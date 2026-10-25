import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Field } from '../ui/Field';
import { Button } from '../ui/Button';
import * as Icons from '../ui/icons';
import { suggestPassword, validateConfirm, validatePassword } from './helpers';

interface Props {
  password: string;
  confirm: string;
  onPassword: (v: string) => void;
  onConfirm: (v: string) => void;
  /** Show errors even for untouched fields (after a submit attempt). */
  showErrors: boolean;
  disabled?: boolean;
  label: string;
  confirmLabel: string;
  hint?: string;
}

/** Password + confirmation with show/hide and a "suggest" helper. */
export function PasswordFields({ password, confirm, onPassword, onConfirm, showErrors, disabled, label, confirmLabel, hint }: Props) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [touched, setTouched] = useState({ password: false, confirm: false });

  const pwErr = validatePassword(password);
  const cfErr = password === '' ? null : validateConfirm(password, confirm);
  const showPw = (showErrors || touched.password) && pwErr;
  const showCf = (showErrors || (touched.confirm && confirm !== '')) && cfErr;

  const toggle = (
    <button
      type="button"
      className="grid size-9 place-items-center rounded-control text-muted hover:bg-sunken hover:text-ink"
      aria-label={visible ? t('people.add.hidePassword') : t('people.add.showPassword')}
      aria-pressed={visible}
      onClick={() => setVisible((v) => !v)}
    >
      {visible ? <Icons.EyeOff className="size-4" /> : <Icons.Eye className="size-4" />}
    </button>
  );

  return (
    <div className="space-y-4">
      <Field
        label={label}
        type={visible ? 'text' : 'password'}
        autoComplete="new-password"
        value={password}
        maxLength={200}
        disabled={disabled}
        onChange={(e) => onPassword(e.target.value)}
        onBlur={() => setTouched((s) => ({ ...s, password: true }))}
        error={showPw ? t(`people.err.password.${pwErr}`) : null}
        hint={hint}
        adornment={toggle}
      />
      <Field
        label={confirmLabel}
        type={visible ? 'text' : 'password'}
        autoComplete="new-password"
        value={confirm}
        maxLength={200}
        disabled={disabled}
        onChange={(e) => onConfirm(e.target.value)}
        onBlur={() => setTouched((s) => ({ ...s, confirm: true }))}
        error={showCf ? t(`people.err.confirm.${cfErr}`) : null}
      />
      <Button
        variant="secondary"
        disabled={disabled}
        onClick={() => {
          const pw = suggestPassword();
          onPassword(pw);
          onConfirm(pw);
          setVisible(true);
        }}
      >
        {t('people.add.suggest')}
      </Button>
    </div>
  );
}
