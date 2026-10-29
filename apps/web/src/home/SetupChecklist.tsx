import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { peopleApi } from '../people/api';
import { floorApi, menuApi } from '../setup/api';
import { cn } from '../lib/cn';
import * as Icons from '../ui/icons';

interface Counts {
  tables: number;
  dishes: number;
  people: number;
}

/**
 * First-run guide for a new restaurant: tables, menu, team. It shows only to
 * owners and managers, only while something is missing, and quietly hides if any
 * count cannot be read (a hidden helper beats a wrong one).
 */
export function SetupChecklist() {
  const { t } = useTranslation();
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([floorApi.tables(), menuApi.items(), peopleApi.directory({ take: 2 })]).then(
      ([tables, items, dir]) => {
        if (live) setCounts({ tables: tables.filter((x) => x.isActive).length, dishes: items.length, people: dir.total });
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, []);

  if (!counts) return null;
  const steps = [
    { key: 'floor', to: '/floor', done: counts.tables > 0 },
    { key: 'menu', to: '/menu', done: counts.dishes > 0 },
    { key: 'team', to: '/team', done: counts.people > 1 },
  ];
  const left = steps.filter((s) => !s.done).length;
  if (left === 0) return null;
  const next = steps.find((s) => !s.done)!;

  return (
    <section aria-labelledby="setup-h" className="nx-glass mb-10 rounded-panel p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow nx-eyebrow-dot mb-1.5">{t('home.setup.eyebrow', { done: steps.length - left, total: steps.length })}</p>
          <h2 id="setup-h" className="text-xl leading-tight font-semibold">{t('home.setup.title')}</h2>
          <p className="mt-1 max-w-prose text-sm text-muted">{t('home.setup.body')}</p>
        </div>
        <Link to={next.to} className="nx-press nx-primary inline-flex min-h-11 items-center gap-1.5 rounded-control px-4 text-sm font-semibold text-on-accent">
          {t(`home.setup.${next.key}.cta`)}
          <Icons.ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
      <ol className="mt-5 grid gap-3 sm:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.key}>
            <Link
              to={s.to}
              className={cn(
                'flex min-h-16 items-center gap-3 rounded-control border px-4 py-3 transition-colors',
                s.done ? 'border-accent/30 bg-accent/10' : 'border-white/10 bg-white/[0.03] hover:border-accent/40',
              )}
            >
              <span aria-hidden className={cn('grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold', s.done ? 'bg-accent text-on-accent' : 'bg-white/10 text-muted')}>
                {s.done ? <Icons.Check className="size-4" /> : i + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{t(`home.setup.${s.key}.title`)}</span>
                <span className="block text-xs text-muted">{s.done ? t('home.setup.done') : t(`home.setup.${s.key}.body`)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
