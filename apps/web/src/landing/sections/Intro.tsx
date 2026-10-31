import { SectionButton } from '../components/Button';
import { Section, SectionHead } from '../components';
import { cx } from '../components/cx';
import { INTRO } from '../content';
import { useInView } from '../hooks/useInView';
import { useScrollProgress } from '../hooks/useScrollProgress';
import { useTilt } from '../hooks/useTilt';
import { countWords, mapWords, sectionIdOf, stripArrow } from './sectionsA.shared';
import '../styles/devices.css';
import '../styles/intro.css';

/**
 * Word-by-word light-up driven by the element's own scroll progress (--p from useScrollProgress('view')).
 * The text is ordinary inline words separated by real spaces: nothing is hidden from search or screen readers,
 * and with reduced motion (or no IntersectionObserver) --p is 1, so every word is fully lit.
 */
function LitText({ text, accent = '', className }: { text: string; accent?: string; className?: string }) {
  const ref = useScrollProgress<HTMLSpanElement>('view');
  return (
    <span ref={ref} className={cx('lp-lit', className)} style={{ ['--n' as string]: countWords(text) }}>
      {mapWords(text, accent, (node, i) => (
        <span className="lp-lit__w" style={{ ['--i' as string]: i }}>
          {node}
        </span>
      ))}
    </span>
  );
}

/** The slip from the narrative: four hand-offs nobody wrote down, then a stamp lands. Decorative. */
function Slip() {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.55, rootMargin: '0px 0px -10% 0px' });
  const tiltRef = useTilt<HTMLDivElement>(4);
  return (
    <div ref={ref} className="lp-intro__slipwrap" data-in={inView ? 'true' : undefined} aria-hidden="true">
      <div ref={tiltRef} className="lp-intro__slipstage">
        <div className="lp-intro__slipback" />
        <div className="lp-tk lp-intro__slip">
          <div className="lp-tk__head">
            <span>Table 6</span>
            <span>
              <b>19:42</b>
            </span>
          </div>
          <div className="lp-intro__sl">
            <span>Masala Dosa</span>
            <em>half or full?</em>
          </div>
          <div className="lp-intro__sl">
            <span>“Less spicy”</span>
            <em>said once</em>
          </div>
          <div className="lp-intro__sl">
            <span>Discount</span>
            <em>not written down</em>
          </div>
          <div className="lp-intro__sl">
            <span>Drawer at midnight</span>
            <em>−₹300</em>
          </div>
          <div className="lp-intro__stamprow">
            <span className="lp-stamp lp-intro__stamp">Unreconciled</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * "Between the chair and the last report": a typographic piece. Headline, five paragraphs and the closing question
 * light up word by word as they scroll through the viewport; a slip stamps UNRECONCILED at the end.
 */
export default function Intro() {
  const railRef = useScrollProgress<HTMLDivElement>('view', '--rp');
  return (
    <Section id="intro" tone="canvas" labelledBy="intro-title" className="lp-intro">
      <SectionHead
        eyebrow={INTRO.eyebrow}
        titleId="intro-title"
        className="lp-intro__head"
        title={<LitText text={INTRO.headline.text} accent={INTRO.headline.accent} />}
      />

      <div ref={railRef} className="lp-intro__narrative">
        <span className="lp-intro__rail" aria-hidden="true" />
        {INTRO.paragraphs.map((p, i) => (
          <div key={i} className="lp-intro__row">
            <span className="lp-intro__no lp-num" aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </span>
            <p className="lp-intro__p">
              <LitText text={p} />
            </p>
          </div>
        ))}
      </div>

      <div className="lp-intro__close">
        <div className="lp-intro__qcol">
          <p className="lp-intro__q">
            <LitText text={INTRO.closingQuestion.text} accent={INTRO.closingQuestion.accent} />
          </p>
          <SectionButton section={sectionIdOf(INTRO.followLink.href)} variant="ghost" arrow>
            {stripArrow(INTRO.followLink.label)}
          </SectionButton>
        </div>
        <Slip />
      </div>
    </Section>
  );
}
