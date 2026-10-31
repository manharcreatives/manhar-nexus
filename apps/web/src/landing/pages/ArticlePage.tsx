import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Link, useParams } from 'react-router-dom';
import '../styles/w2-base.css';
import '../styles/pages.css';
import { Button, Icon, PolicyLayout, SectionButton } from '../components';
import { INSIGHTS_HEADER, POSTS, blogPostingJsonLd, getPost, type Post } from '../content';
import { useDocumentMeta, useJsonLd } from '../hooks/useDocumentMeta';
import { SITE } from '../site';
import { copyText } from '../sectionsC/clipboard';
import { formatIsoDay } from '../sectionsC/format';
import { Link2, MessageCircle, Share2 } from '../sectionsC/icons';
import { ArticleBody, headingAnchors } from './ArticleBody';
import { Toc } from './Toc';

/** Writes 0..1 into --p on the bar as the article scrolls past. Passive listener, one rAF per frame, no state. */
function useReadingProgress(articleRef: RefObject<HTMLElement>, barRef: RefObject<HTMLDivElement>): void {
  useEffect(() => {
    const article = articleRef.current;
    const bar = barRef.current;
    if (!article || !bar) return;
    let frame = 0;
    const update = (): void => {
      frame = 0;
      const rect = article.getBoundingClientRect();
      const start = rect.top + window.scrollY;
      const end = start + rect.height - window.innerHeight;
      const p = end <= start ? (window.scrollY > start ? 1 : 0) : (window.scrollY - start) / (end - start);
      bar.style.setProperty('--p', String(Math.min(1, Math.max(0, p))));
    };
    const onScroll = (): void => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [articleRef, barRef]);
}

function ShareRow({ post }: { post: Post }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const url = `${window.location.origin}${post.path}`;
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useEffect(() => {
    if (state === 'idle') return;
    const t = window.setTimeout(() => setState('idle'), 2800);
    return () => window.clearTimeout(t);
  }, [state]);

  const onCopy = async (): Promise<void> => {
    setState((await copyText(url)) ? 'copied' : 'failed');
  };
  const onShare = async (): Promise<void> => {
    try {
      await navigator.share({ title: post.title, text: post.dek, url });
    } catch {
      /* the visitor dismissed the share sheet */
    }
  };
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${post.title} ${url}`)}`;

  return (
    <div className="lp-share">
      <p className="lp-share__label">Share this article</p>
      <div className="lp-share__buttons">
        <Button variant="secondary" size="sm" onClick={() => void onCopy()}>
          <Icon icon={Link2} size={16} /> Copy link
        </Button>
        {canShare ? (
          <Button variant="secondary" size="sm" onClick={() => void onShare()}>
            <Icon icon={Share2} size={16} /> Share…
          </Button>
        ) : null}
        <Button href={whatsapp} variant="secondary" size="sm" external>
          <Icon icon={MessageCircle} size={16} /> WhatsApp
          <span className="lp-visually-hidden"> (opens in a new tab)</span>
        </Button>
        <span className="lp-share__status" aria-live="polite">
          {state === 'copied' ? 'Link copied.' : state === 'failed' ? 'Could not copy. Copy it from the address bar.' : ''}
        </span>
      </div>
    </div>
  );
}

function PrevNext({ post }: { post: Post }) {
  const at = POSTS.findIndex((p) => p.slug === post.slug);
  const prev = at > 0 ? POSTS[at - 1] : undefined;
  const next = at >= 0 && at < POSTS.length - 1 ? POSTS[at + 1] : undefined;
  if (!prev && !next) return null;
  return (
    <nav className="lp-pn" aria-label="More articles">
      {prev ? (
        <Link to={prev.path} rel="prev" className="lp-pn__item">
          <span className="lp-pn__dir">← Previous</span>
          <span className="lp-pn__title">{prev.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link to={next.path} rel="next" className="lp-pn__item lp-pn__item--next">
          <span className="lp-pn__dir">Next →</span>
          <span className="lp-pn__title">{next.title}</span>
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

function ArticleView({ post }: { post: Post }) {
  const articleRef = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useDocumentMeta({
    title: post.seoTitle,
    description: post.seoDescription,
    path: post.path,
    ogType: 'article',
  });
  const jsonLd = useMemo(() => blogPostingJsonLd(post, SITE.origin), [post]);
  useJsonLd('article', jsonLd);
  useReadingProgress(articleRef, barRef);

  const anchors = useMemo(() => headingAnchors(post.body), [post]);

  return (
    <>
      <div ref={barRef} className="lp-progress" aria-hidden="true" />
      <PolicyLayout
        eyebrow={post.category}
        title={post.title}
        meta={
          <>
            <time dateTime={post.publishedAt}>{formatIsoDay(post.publishedAt)}</time> · {post.readMinutes} {INSIGHTS_HEADER.readLabel} ·{' '}
            {post.author}
          </>
        }
        lede={post.dek}
        back={{ to: '/#insights', label: 'All insights' }}
      >
        <article ref={articleRef} className="lp-article">
          <Toc title="In this article" items={anchors} />
          <ArticleBody post={post} />
          <p className="lp-article__note">{INSIGHTS_HEADER.generalInfoNote}</p>
          <ShareRow post={post} />
          <aside className="lp-article__cta lp-on-dark" aria-labelledby="article-cta-title">
            <p className="lp-eyebrow">FROM THE PASS TO YOUR PAGE</p>
            <h2 id="article-cta-title">Want your next Saturday to end with numbers that agree?</h2>
            <p>
              Nexus is built around the problems this piece describes. Register your restaurant and we will reply within one working day.
            </p>
            <SectionButton section="register" size="lg" arrow>
              Register your restaurant
            </SectionButton>
          </aside>
          <PrevNext post={post} />
        </article>
      </PolicyLayout>
    </>
  );
}

function ArticleNotFound({ slug }: { slug: string }) {
  useDocumentMeta({
    title: 'Article not found – Manhar Nexus',
    description: 'We couldn’t find that article.',
    path: `/insights/${slug}`,
    robots: 'noindex,follow',
  });
  return (
    <PolicyLayout eyebrow="INSIGHTS" title="We couldn’t find that article" back={{ to: '/#insights', label: 'All insights' }}>
      <p>The link may be old or mistyped. The articles we have published are all in Insights.</p>
      <p className="lp-article__links">
        <SectionButton section="insights" arrow>
          See all insights
        </SectionButton>{' '}
        <Link to="/" className="lp-link">
          Back to Manhar Nexus
        </Link>
      </p>
    </PolicyLayout>
  );
}

/** /insights/:slug. Unknown slugs get a calm 404 state (and noindex) instead of a redirect. */
export default function ArticlePage() {
  const { slug = '' } = useParams();
  const post = getPost(slug);
  return post ? <ArticleView post={post} /> : <ArticleNotFound slug={slug} />;
}
