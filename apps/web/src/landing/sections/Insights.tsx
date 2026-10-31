import '../styles/insights.css';
import { Reveal, Section } from '../components';
import { SectionHead } from '../sectionsC/SectionHead';
import { INSIGHTS_HEADER, POSTS } from '../content';
import { PostCard } from '../insights/PostCard';
import { renderHeadline } from '../sectionsC/headline';

/**
 * Insights: the six articles as a featured card plus a grid. Cards are typographic by default; photos from the
 * images manifest fade in only if the files exist. Every card links to a real /insights/:slug page.
 */
export default function Insights() {
  return (
    <Section id="insights" tone="canvas" labelledBy="insights-title" className="lp-insights">
      <SectionHead
        eyebrow={INSIGHTS_HEADER.eyebrow}
        title={renderHeadline(INSIGHTS_HEADER.headline)}
        titleId="insights-title"
        lede={INSIGHTS_HEADER.subhead}
      />
      <div className="lp-posts">
        {POSTS.map((post, i) => (
          <Reveal key={post.slug} delay={Math.min(i, 3) * 60} className={i === 0 ? 'lp-posts__item lp-posts__item--featured' : 'lp-posts__item'}>
            <PostCard post={post} index={i} featured={i === 0} />
          </Reveal>
        ))}
      </div>
      <p className="lp-insights__note">{INSIGHTS_HEADER.generalInfoNote}</p>
    </Section>
  );
}
