import { useTranslation } from 'react-i18next';
import { LedgerFigure } from '../../ui/LedgerFigure';
import { Stamp } from '../../ui/Stamp';
import { formatMoney } from '../../lib/money';
import type { BillTaxLine, BillView } from './billShowApi';

type ReadyBill = NonNullable<BillView['bill']>;

/** "GST 5%" already says its rate; "Service charge" gets it appended. */
function taxTitle(line: BillTaxLine): string {
  return line.label.includes('%') ? line.label : `${line.label} ${line.ratePercent}%`;
}

const pct = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2).replace(/0+$/, '')}%`;

/**
 * The customer-facing bill: restaurant name, itemised lines (pre-tax), tax lines, and a very large total.
 * Plain content, read from a metre away; no staff chrome, no internal ids.
 */
export function BillBody({ view, bill }: { view: BillView; bill: ReadyBill }) {
  const { t } = useTranslation();
  const money = (n: number) => formatMoney(n, bill.currencyCode);
  const issued = bill.issuedAt ? new Date(bill.issuedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : null;
  const biz = view.business;

  return (
    <article aria-label={t('billShow.billLabel')} className="space-y-6">
      <header className="text-center">
        {biz.logoUrl && <img src={biz.logoUrl} alt="" className="mx-auto mb-3 size-14 rounded-control object-cover" />}
        <p className="font-display text-3xl leading-tight font-semibold tracking-[-0.01em]">{biz.name}</p>
        {(biz.legalName || biz.address) && (
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">{[biz.legalName, biz.address].filter(Boolean).join(' - ')}</p>
        )}
        {biz.gstin && <p className="tabular mt-0.5 text-sm text-muted">{t('billShow.gstin', { gstin: biz.gstin })}</p>}
        <dl className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-base">
          {view.tableCode && (
            <div className="flex gap-2">
              <dt className="text-muted">{t('billShow.table')}</dt>
              <dd className="font-semibold">{view.tableCode}</dd>
            </div>
          )}
          {bill.reference && (
            <div className="flex gap-2">
              <dt className="text-muted">{t('billShow.reference')}</dt>
              <dd className="tabular font-semibold">{bill.reference}</dd>
            </div>
          )}
          {issued && (
            <div className="flex gap-2">
              <dt className="text-muted">{t('billShow.date')}</dt>
              <dd className="tabular">{issued}</dd>
            </div>
          )}
        </dl>
      </header>

      <div className="rounded-panel border border-line bg-white/[0.025]">
        <table className="w-full text-lg">
          <caption className="sr-only">{t('billShow.itemsCaption')}</caption>
          <thead className="sr-only">
            <tr>
              <th scope="col">{t('billShow.colItem')}</th>
              <th scope="col">{t('billShow.colQty')}</th>
              <th scope="col">{t('billShow.colAmount')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/70">
            {bill.lines.map((l) => (
              <tr key={l.id}>
                <td className="py-3 pr-3 pl-4 align-top">
                  <span className="font-medium">{l.name}</span>
                  {l.variant && <span className="block text-sm text-muted">{l.variant}</span>}
                  {l.modifiers && <span className="block text-sm text-muted">{l.modifiers}</span>}
                  {l.quantity > 1 && (
                    <span className="tabular block text-sm text-muted">
                      {l.quantity} x {money(l.unitPriceMinorUnits)}
                    </span>
                  )}
                </td>
                <td className="tabular w-14 py-3 text-center align-top text-muted">
                  <span className="sr-only">{t('billShow.colQty')} </span>
                  {l.quantity}
                </td>
                <td className="tabular py-3 pr-4 pl-2 text-right align-top font-medium">{money(l.amountMinorUnits)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="tabular space-y-1.5 px-1 text-lg">
        <div className="flex justify-between">
          <dt className="text-muted">{t('billShow.subtotal')}</dt>
          <dd>{money(bill.subtotalMinorUnits)}</dd>
        </div>
        {bill.taxLines.flatMap((line) =>
          line.components.length > 0
            ? line.components.map((c) => (
                <div key={`${line.label}-${c.label}`} className="flex justify-between text-muted">
                  <dt>
                    {c.label} {pct(c.ratePercent)}
                  </dt>
                  <dd>{money(c.taxMinorUnits)}</dd>
                </div>
              ))
            : [
                <div key={line.label} className="flex justify-between text-muted">
                  <dt>{taxTitle(line)}</dt>
                  <dd>{money(line.taxMinorUnits)}</dd>
                </div>,
              ],
        )}
        {bill.taxLines.length === 0 && bill.totalTaxMinorUnits > 0 && (
          <div className="flex justify-between text-muted">
            <dt>{t('billShow.tax')}</dt>
            <dd>{money(bill.totalTaxMinorUnits)}</dd>
          </div>
        )}
        {bill.roundingMinorUnits !== 0 && (
          <div className="flex justify-between text-muted">
            <dt>{t('billShow.rounding')}</dt>
            <dd>{money(bill.roundingMinorUnits)}</dd>
          </div>
        )}
      </dl>

      <div className="rounded-panel border border-accent/30 bg-accent-soft/60 px-5 py-5 text-center">
        <p className="eyebrow">{bill.paid ? t('billShow.totalPaid') : t('billShow.totalDue')}</p>
        <p className="mt-1">
          <LedgerFigure minor={bill.grandTotalMinorUnits} currency={bill.currencyCode} rule="double" className="text-[3.5rem] leading-none sm:text-[4.5rem]" />
        </p>
        {bill.paid && (
          <p className="mt-4">
            <Stamp size="lg" label={t('billShow.paidStamp')} />
          </p>
        )}
        {!bill.paid && bill.paymentPending && (
          <p role="status" className="mt-3 text-base text-info">
            {t('billShow.paymentPending')}
          </p>
        )}
      </div>
    </article>
  );
}
