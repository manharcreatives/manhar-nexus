import type { ReactNode } from 'react';
import { AccentWord } from '../components';
import type { Headline } from '../content';

/** Split a content Headline around its single accent word and wrap that word in <AccentWord>. */
export function renderHeadline(headline: Headline): ReactNode {
  const at = headline.text.indexOf(headline.accent);
  if (at < 0 || headline.accent.length === 0) return headline.text;
  return (
    <>
      {headline.text.slice(0, at)}
      <AccentWord>{headline.accent}</AccentWord>
      {headline.text.slice(at + headline.accent.length)}
    </>
  );
}
