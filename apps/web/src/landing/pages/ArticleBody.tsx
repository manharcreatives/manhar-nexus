import type { ReactNode } from 'react';
import type { ListItem, Post, PostBlock } from '../content';
import { uniqueSlugs } from '../sectionsC/format';

/** Anchor ids for the h2 blocks of a post, in order (used by the table of contents and the renderer). */
export function headingAnchors(body: readonly PostBlock[]): { id: string; label: string }[] {
  const h2s = body.flatMap((b) => (b.type === 'h2' ? [b.text] : []));
  const ids = uniqueSlugs(h2s);
  return h2s.map((label, i) => ({ id: ids[i] ?? `section-${i + 1}`, label }));
}

function Items({ items }: { items: readonly ListItem[] }): ReactNode {
  return items.map((item, i) =>
    typeof item === 'string' ? (
      <li key={i}>{item}</li>
    ) : (
      <li key={i}>
        <strong>{item.lead}</strong> {item.text}
      </li>
    ),
  );
}

/** The article body: h2 (anchored), h3, p, ul, ol, quote and callout blocks. The post title is the page h1. */
export function ArticleBody({ post }: { post: Post }) {
  const anchors = headingAnchors(post.body);
  let h2 = 0;
  return (
    <div className="lp-article__body">
      {post.body.map((block, i) => {
        switch (block.type) {
          case 'h2': {
            const id = anchors[h2]?.id;
            h2 += 1;
            return (
              <h2 key={i} id={id}>
                {block.text}
              </h2>
            );
          }
          case 'h3':
            return <h3 key={i}>{block.text}</h3>;
          case 'p':
            return <p key={i}>{block.text}</p>;
          case 'ul':
            return (
              <ul key={i}>
                <Items items={block.items} />
              </ul>
            );
          case 'ol':
            return (
              <ol key={i}>
                <Items items={block.items} />
              </ol>
            );
          case 'quote':
            return (
              <blockquote key={i}>
                <p>{block.text}</p>
              </blockquote>
            );
          case 'callout':
            return (
              <aside key={i} className="lp-callout">
                {block.title ? <strong className="lp-callout__title">{block.title}</strong> : null}
                <p>{block.text}</p>
              </aside>
            );
        }
      })}
    </div>
  );
}
