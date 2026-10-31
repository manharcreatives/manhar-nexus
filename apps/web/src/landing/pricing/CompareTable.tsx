import { Icon, Tag } from '../components';
import { PLANS } from '../content';
import { Check } from '../sectionsC/icons';
import { COMING_SOON_ROWS, COMPARE_GROUPS, type CompareCell } from './compareRows';

function Cell({ value }: { value: CompareCell }) {
  if (value === true) {
    return (
      <td className="lp-cmp__yes">
        <Icon icon={Check} size={18} strokeWidth={2.25} />
        <span className="lp-visually-hidden">Included</span>
      </td>
    );
  }
  if (value === false) {
    return (
      <td className="lp-cmp__no">
        <span aria-hidden="true">–</span>
        <span className="lp-visually-hidden">Not included</span>
      </td>
    );
  }
  return <td className="lp-cmp__text">{value}</td>;
}

/**
 * Side-by-side plan comparison. Real table semantics (caption, column headers, row headers, row groups).
 * The wrapper scrolls horizontally on narrow screens and the first column stays pinned (position: sticky).
 */
export function CompareTable({ title }: { title: string }) {
  return (
    <div className="lp-cmp" role="region" aria-label={`${title} (scrolls sideways on small screens)`} tabIndex={0}>
      <table className="lp-cmp__table">
        <caption className="lp-visually-hidden">{title}</caption>
        <thead>
          <tr>
            <th scope="col" className="lp-cmp__corner">
              <span className="lp-visually-hidden">Feature</span>
            </th>
            {PLANS.map((plan) => (
              <th scope="col" key={plan.key} className={plan.highlight ? 'is-featured' : undefined}>
                {plan.name}
              </th>
            ))}
          </tr>
        </thead>
        {COMPARE_GROUPS.map((group) => (
          <tbody key={group.id}>
            <tr className="lp-cmp__group">
              <th scope="rowgroup" colSpan={5}>
                <span>{group.title}</span>
              </th>
            </tr>
            {group.rows.map((row) => (
              <tr key={row.id}>
                <th scope="row">{row.label}</th>
                {row.cells.map((cell, i) => (
                  <Cell key={PLANS[i]?.key ?? i} value={cell} />
                ))}
              </tr>
            ))}
          </tbody>
        ))}
        <tbody>
          <tr className="lp-cmp__group">
            <th scope="rowgroup" colSpan={5}>
              <span>Coming soon — not sold yet</span>
            </th>
          </tr>
          {COMING_SOON_ROWS.map((row) => (
            <tr key={row.id}>
              <th scope="row">{row.label}</th>
              <td colSpan={4} className="lp-cmp__soon">
                <Tag tone="outline">Coming soon</Tag> <span>{row.note}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
