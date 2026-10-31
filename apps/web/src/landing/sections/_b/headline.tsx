import type { ReactNode } from 'react';
import { AccentWord } from '../../components';
import type { Headline } from '../../content';

/** Renders a content `Headline` with its ONE accent word wrapped (Forest on light, #1DBA3C on dark via CSS). */
export function headlineNode(h: Headline): ReactNode {
  const i = h.text.indexOf(h.accent);
  if (i < 0) return h.text;
  return (
    <>
      {h.text.slice(0, i)}
      <AccentWord>{h.accent}</AccentWord>
      {h.text.slice(i + h.accent.length)}
    </>
  );
}

