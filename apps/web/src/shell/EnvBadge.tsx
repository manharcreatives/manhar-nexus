import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';
import { KNOWN_ENVS, appEnvironment, isProductionEnv } from './identity';

/** Small "not production" marker so a demo or staging screen is never mistaken for the live one. */
export function EnvBadge({ className }: { className?: string }) {
  const { t } = useTranslation();
  const env = appEnvironment();
  if (isProductionEnv(env)) return null;
  const label = (KNOWN_ENVS as readonly string[]).includes(env) ? t(`shell.env.${env}`) : env;
  return (
    <span
      title={t('shell.env.label', { env: label })}
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-control border border-warn/30 bg-warn-soft px-2 text-[0.6875rem] font-semibold tracking-wider text-warn uppercase',
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-warn" />
      <span className="sr-only">{t('shell.env.prefix')} </span>
      {label}
    </span>
  );
}
