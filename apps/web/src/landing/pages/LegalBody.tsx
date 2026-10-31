import type { ReactNode } from 'react';
import type { LegalBlock } from '../content';

/** A bracketed owner placeholder such as [REGISTERED ADDRESS] or [30]. */
export const PLACEHOLDER_RE = /(\[[^\]]+\])/g;

/** Split text into plain strings and highlighted placeholder tokens (Mint Wash, with a hover/tap title hint). */
export function renderWithPlaceholders(text: string): ReactNode[] {
  return text.split(PLACEHOLDER_RE).map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="lp-ph" title="Placeholder: the owner or the lawyer completes this before launch">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

/** Count of placeholder tokens in a piece of text (used by tests and the owner checklist). */
export function countPlaceholders(text: string): number {
  return (text.match(PLACEHOLDER_RE) ?? []).length;
}

/** One legal block -> semantic HTML. `internalNote` is never part of a block, so it can never be rendered here. */
export function LegalBlockView({ block }: { block: LegalBlock }) {
  switch (block.type) {
    case 'p':
      return <p>{renderWithPlaceholders(block.text)}</p>;
    case 'clause':
      return (
        <p className="lp-clause">
          <span className="lp-clause__num">{block.number}</span>
          <span>{renderWithPlaceholders(block.text)}</span>
        </p>
      );
    case 'ul':
      return (
        <ul>
          {block.items.map((item, i) => (
            <li key={i}>{renderWithPlaceholders(item)}</li>
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol>
          {block.items.map((item, i) => (
            <li key={i}>{renderWithPlaceholders(item)}</li>
          ))}
        </ol>
      );
    case 'table':
      return (
        <div className="lp-legal__table" role="region" tabIndex={0} aria-label="Table (scrolls sideways on small screens)">
          <table>
            <thead>
              <tr>
                {block.headers.map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c}>{renderWithPlaceholders(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'callout':
      return <aside className="lp-callout">{renderWithPlaceholders(block.text)}</aside>;
  }
}
