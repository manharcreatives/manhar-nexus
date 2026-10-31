import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Tag, cx } from '../components';
import { INSIGHTS_HEADER, img, imgSrcSet, type Post } from '../content';
import { formatIsoDay } from '../sectionsC/format';

/**
 * Typographic cover. The panel always renders (big number, category), so the cards look finished with no photos.
 * If the manifest image exists it fades in on top; if it is missing the <img> removes itself on error.
 */
function Cover({ post, index, featured }: { post: Post; index: number; featured: boolean }) {
  const [failed, setFailed] = useState(false);
  const image = img(post.cover);
  return (
    <div className={cx('lp-post__cover', featured && 'lp-post__cover--featured')} aria-hidden="true">
      <span className="lp-post__numeral">{String(index + 1).padStart(2, '0')}</span>
      {failed ? null : (
        <img
          className="lp-post__photo"
          src={image.file800}
          srcSet={imgSrcSet(post.cover)}
          sizes={featured ? '(min-width: 1024px) 760px, 100vw' : '(min-width: 1024px) 380px, 100vw'}
          width={image.width}
          height={image.height}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

export interface PostCardProps {
  post: Post;
  index: number;
  featured?: boolean;
}

/** One article card. The title is the single link (its ::after covers the card), so each card is one tab stop. */
export function PostCard({ post, index, featured = false }: PostCardProps) {
  return (
    <article className={cx('lp-post', featured && 'lp-post--featured')}>
      <Cover post={post} index={index} featured={featured} />
      <div className="lp-post__body">
        <div className="lp-post__meta">
          <Tag>{post.category}</Tag>
          <span className="lp-post__read">
            {post.readMinutes} {INSIGHTS_HEADER.readLabel}
          </span>
        </div>
        <h3 className="lp-post__title">
          <Link to={post.path} className="lp-post__link">
            {post.title}
          </Link>
        </h3>
        <p className="lp-post__dek">{post.dek}</p>
        <p className="lp-post__foot">
          <time dateTime={post.publishedAt}>{formatIsoDay(post.publishedAt)}</time>
          <span className="lp-post__cta" aria-hidden="true">
            Read article →
          </span>
        </p>
      </div>
    </article>
  );
}
