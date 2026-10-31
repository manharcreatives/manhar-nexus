import { Check, Equal, Minus } from 'lucide-react';
import { COMPARE, type ScorecardStatus } from '../../content';

const STATUS_ICON: Readonly<Record<ScorecardStatus, typeof Check>> = {
  ahead: Check,
  equal: Equal,
  'not-yet': Minus,
};

/**
 * The honest scorecard, behind a disclosure. A real <table> (caption, th scope), qualitative only: every Nexus cell
 * carries a text status (Ahead / Equal / Not yet) plus an icon, so meaning never rests on colour alone. No numbers.
 */
export function CompareScorecard() {
  const { scorecardColumns: cols, statusLabels } = COMPARE;
  return (
    <details className="lp-cs__score">
      <summary className="lp-cs__summary" id="lp-cs-score-title">
        <span>{COMPARE.scorecardHeader.headline.text}</span>
        <span className="lp-cs__summary-note lp-mono">Illustrative, not measured</span>
      </summary>
      <div className="lp-cs__scorebody">
        <p className="lp-cs__intro">{COMPARE.scorecardIntro}</p>
        <div className="lp-cs__tablewrap" role="region" aria-labelledby="lp-cs-score-title" tabIndex={0}>
          {/* Explicit ARIA roles keep the table semantics when CSS turns the rows into cards on phones. */}
          <table className="lp-cs__table" role="table">
            <caption>Illustrative, not measured: Nexus beside paper and typical cloud POS</caption>
            <thead role="rowgroup">
              <tr role="row">
                <th scope="col" role="columnheader">
                  {cols.criterion}
                </th>
                <th scope="col" role="columnheader">
                  {cols.paper}
                </th>
                <th scope="col" role="columnheader">
                  {cols.typicalPos}
                </th>
                <th scope="col" role="columnheader" className="lp-cs__nexus-col">
                  {cols.nexus}
                </th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              {COMPARE.scorecard.map((r) => {
                const Glyph = STATUS_ICON[r.status];
                return (
                  <tr key={r.id} role="row">
                    <th scope="row" role="rowheader">
                      {r.criterion}
                    </th>
                    <td role="cell" data-label={cols.paper}>
                      {r.paper}
                    </td>
                    <td role="cell" data-label={cols.typicalPos}>
                      {r.typicalPos}
                    </td>
                    <td role="cell" data-label={cols.nexus} className="lp-cs__nexus-col">
                      <span className={`lp-cs__badge lp-cs__badge--${r.status}`}>
                        <Glyph size={12} strokeWidth={3} aria-hidden="true" focusable="false" />
                        {statusLabels[r.status]}
                      </span>
                      <span className="lp-cs__nexus-text">{r.nexus}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="lp-cs__basis">{COMPARE.basisNote}</p>
        <p className="lp-cs__footnote">{COMPARE.footnote}</p>
      </div>
    </details>
  );
}
