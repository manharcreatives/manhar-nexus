import type { ReactNode } from 'react';
import { REGISTRATION_FIELDS, type RegistrationFieldName } from '../content';
import { fieldId } from './validation';

export interface FieldAria {
  id: string;
  name: RegistrationFieldName;
  'aria-invalid': boolean;
  'aria-required': boolean;
  'aria-describedby': string | undefined;
}

export interface FieldProps {
  name: RegistrationFieldName;
  error?: string | undefined;
  /** Overrides the help text from content. Pass '' to hide it. */
  help?: ReactNode;
  className?: string;
  children: (aria: FieldAria) => ReactNode;
}

/** Label + control + help + error, wired together with ids so the error is announced with the field. */
export function Field({ name, error, help, className, children }: FieldProps) {
  const def = REGISTRATION_FIELDS[name];
  const id = fieldId(name);
  const helpText = help ?? def.help;
  const helpId = helpText ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={['lp-field', className].filter(Boolean).join(' ')}>
      <label htmlFor={id} className="lp-label">
        {def.label}
        {def.required ? (
          <span className="lp-field__req" aria-hidden="true">
            {' '}
            *
          </span>
        ) : null}
      </label>
      {children({
        id,
        name,
        'aria-invalid': Boolean(error),
        'aria-required': def.required,
        'aria-describedby': describedBy,
      })}
      {helpText ? (
        <p id={helpId} className="lp-field-help">
          {helpText}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="lp-field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
