import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';

/** Compact, widget-sized error with a retry, so one failing source never takes over the page. */
export function InlineError({ title, onRetry, className }: { title: string; onRetry: () => void; className?: string }) {
  const { t } = useTranslation();
  return (
    <div role="alert" className={cn('flex flex-wrap items-center gap-3 rounded-control bg-bad-soft px-3 py-2 text-sm', className)}>
      <span className="text-bad">{title}</span>
      <button type="button" onClick={onRetry} className="min-h-9 rounded-control px-2 font-medium text-ink underline underline-offset-2 hover:bg-surface/60">
        {t('home.retry')}
      </button>
    </div>
  );
}
