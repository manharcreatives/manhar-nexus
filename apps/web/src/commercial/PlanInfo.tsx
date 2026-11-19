import { useTranslation } from 'react-i18next';
import { StatusPill } from '../ui/StatusPill';
import { daysUntil, formatDate, renewalState } from './helpers';

/** The billing facts the server copies onto a client when its registration was paid (all optional: older clients have none). */
export interface BillingFacts {
  planKey?: string | null;
  billingCycle?: string | null;
  paidUntil?: string | null;
  billingSource?: string | null;
  registrationId?: string | null;
  subscriptionId?: string | null;
}

const PLAN_NAME: Record<string, string> = { counter: 'Counter', floor: 'Floor', pass: 'Pass' };

/** Where the "view registration" link goes: the Registrations page opens on the converted tab for this request. */
export const registrationHref = (registrationId: string): string => `/registrations#reg-${registrationId}`;

const isPast = (iso: string, now: number): boolean => Date.parse(iso) < now;

/** Plan chip, paid-until date (red when past), how they pay, and a link to the registration they came from. */
export function PlanInfo({ client, now = Date.now(), compact = false }: { client: BillingFacts; now?: number; compact?: boolean }) {
  const { t } = useTranslation();
  if (!client.planKey) return <span className="text-muted">{t('commercial.plan.none')}</span>;
  const name = PLAN_NAME[client.planKey] ?? client.planKey;
  const cycle = client.billingCycle ? t(`commercial.plan.cycle.${client.billingCycle}`, { defaultValue: client.billingCycle }) : '';
  const overdue = client.paidUntil ? isPast(client.paidUntil, now) : false;
  const date = client.paidUntil ? formatDate(client.paidUntil) : '';
  const state = renewalState(client.paidUntil, now);
  const days = daysUntil(client.paidUntil, now);
  // "Renews in 6 days" / "Paid until passed 3 days ago" beside the date, so a renewal is visible without doing the maths.
  const hint =
    days === null
      ? ''
      : state === 'overdue'
        ? t('commercial.clients.renewal.overdue', { count: Math.abs(days) })
        : state === 'soon'
          ? days === 0
            ? t('commercial.clients.renewal.today')
            : t('commercial.clients.renewal.soon', { count: days })
          : '';
  return (
    <div className="space-y-1 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone="accent">{cycle ? `${name} · ${cycle}` : name}</StatusPill>
        {client.billingSource ? (
          <span className="text-xs text-muted">{t(`commercial.plan.source.${client.billingSource}`, { defaultValue: client.billingSource })}</span>
        ) : null}
      </div>
      <p className={overdue ? 'text-bad' : state === 'soon' ? 'text-warn' : 'text-muted'}>
        {client.paidUntil ? (overdue ? t('commercial.plan.overdue', { date }) : t('commercial.plan.paidUntil', { date })) : t('commercial.plan.notPaid')}
        {hint ? <span className="block text-xs">{hint}</span> : null}
      </p>
      {!compact && client.registrationId ? (
        <a className="text-xs underline" href={registrationHref(client.registrationId)}>
          {t('commercial.plan.viewRegistration')}
        </a>
      ) : null}
    </div>
  );
}
