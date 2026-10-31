import type { ReactNode } from 'react';

export interface DisclosureProps {
  /** Short, plain title shown in the closed row. */
  title: string;
  /** One quiet line under the title. */
  hint?: string;
  /** Anchor/test hook. */
  id?: string;
  children: ReactNode;
}

/**
 * A native <details> row with a round plus/minus control. Keyboard and screen-reader behaviour come from the
 * browser; the content stays in the DOM while closed (crawlable) and is skipped by assistive tech until opened.
 */
export function Disclosure({ title, hint, id, children }: DisclosureProps) {
  return (
    <details className="w2-disc" id={id}>
      <summary>
        <span className="w2-disc__title">{title}</span>
        {hint ? <span className="w2-disc__hint">{hint}</span> : null}
        <span className="w2-disc__chev" aria-hidden="true" />
      </summary>
      <div className="w2-disc__body">{children}</div>
    </details>
  );
}
