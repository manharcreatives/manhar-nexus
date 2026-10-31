import { Link } from 'react-router-dom';
import '../styles/w2-base.css';
import '../styles/insights.css';
import { Reveal, Section } from '../components';
import { SectionHead } from '../sectionsC/SectionHead';
import { INSIGHTS_FEATURED_SLUGS, INSIGHTS_HEADER, POSTS, getPost, type Post } from '../content';
import { Disclosure } from '../pricing/Disclosure';
import { PostCard } from '../insights/PostCard';
import { renderHeadline } from '../sectionsC/headline';

/**
 * Insights: three cards on the home page; the other articles stay one click away (and in the sitemap) behind a
 * quiet “More articles” row. Cards are typographic by default; photos from the images manifest fade in only if
 * the files exist. Every card links to a real /insights/:slug page.
 */
export default function Insights() {
  const shown: Post[] = [];
  for (const slug of INSIGHTS_FEATURED_SLUGS) {
    const post = getPost(slug);
    if (post) shown.push(post);
  }
  const more = POSTS.filter((p) => !shown.includes(p));

  return (
    <Section id="insights" tone="alt" labelledBy="insights-title" className="lp-insights">
      <SectionHead
        eyebrow={INSIGHTS_HEADER.eyebrow}
        title={renderHeadline(INSIGHTS_HEADER.headline)}
        titleId="insights-title"
        lede={INSIGHTS_HEADER.subhead}
      />
      <div className="lp-posts">
        {shown.map((post, i) => (
          <Reveal key={post.slug} delay={i * 80} className="lp-posts__item">
            <PostCard post={post} index={i} />
          </Reveal>
        ))}
      </div>
      {more.length > 0 ? (
        <div className="lp-insights__more">
          <Disclosure title="More articles" hint={`${more.length} more short reads.`}>
            <ul className="lp-insights__list">
              {more.map((p) => (
                <li key={p.slug}>
                  <Link to={p.path} className="lp-link">
                    {p.title}
                  </Link>
                  <span>
                    {p.category} · {p.readMinutes} {INSIGHTS_HEADER.readLabel}
                  </span>
                </li>
              ))}
            </ul>
          </Disclosure>
        </div>
      ) : null}
      <p className="lp-insights__note">{INSIGHTS_HEADER.generalInfoNote}</p>
    </Section>
  );
}
