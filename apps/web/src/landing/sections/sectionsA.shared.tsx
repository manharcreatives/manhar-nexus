import { Fragment, type ReactNode } from 'react';
import { AccentWord } from '../components';

/** '/#register?plan=x' | '#register' -> 'register?plan=x' (what SectionLink / SectionButton expect). */
export function sectionIdOf(href: string): string {
  return href.replace(/^\/?#/, '');
}

/** Content labels end in a decorative arrow ('See how a night runs ↓'); the buttons draw their own. */
export function stripArrow(label: string): string {
  return label.replace(/\s*[→↓↑←]\s*$/, '');
}

/**
 * Splits `text` into words and calls `render` for each (so a section can wrap every word in its own span for
 * a reveal), wrapping the ONE accent word in <AccentWord>. Words stay real text nodes separated by real spaces,
 * so copy/paste, search and screen readers see the plain sentence.
 */
export function mapWords(text: string, accent: string, render: (node: ReactNode, index: number) => ReactNode): ReactNode[] {
  const start = accent ? text.indexOf(accent) : -1;
  const end = start < 0 ? -1 : start + accent.length;
  const out: ReactNode[] = [];
  let i = 0;
  for (const m of text.matchAll(/\S+/g)) {
    const ws = m.index ?? 0;
    const we = ws + m[0].length;
    let node: ReactNode = m[0];
    if (start >= 0 && ws < end && we > start) {
      const a = Math.max(start, ws);
      const b = Math.min(end, we);
      node = (
        <>
          {text.slice(ws, a)}
          <AccentWord>{text.slice(a, b)}</AccentWord>
          {text.slice(b, we)}
        </>
      );
    }
    out.push(
      <Fragment key={i}>
        {i > 0 ? ' ' : null}
        {render(node, i)}
      </Fragment>,
    );
    i += 1;
  }
  return out;
}

export function countWords(text: string): number {
  return (text.match(/\S+/g) ?? []).length;
}
