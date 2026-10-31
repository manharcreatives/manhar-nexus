import { ArrowRight } from 'lucide-react';
import { Heading, ImageSlot, Reveal, Tag } from '../../components';
import { cx } from '../../components/cx';
import { PLATFORM, img, type PlatformModule } from '../../content';
import { useTilt } from '../../hooks/useTilt';
import { SectionLink } from '../../components/SectionLink';
import { iconFor } from './icons';
import { Icon } from '../../components/Icon';

export interface ModuleCardProps {
  module: PlatformModule;
  /** Visual slot in the bento grid. */
  slot: 'feature' | 'wide' | 'std';
  delay?: number;
  /** Link to another section (the feature card points at the Nexus Menu showcase). */
  moreTo?: string;
  moreLabel?: string;
}

/** One headline module: glass card with an icon, one line of curiosity and a two-line summary. Pointer-tilts on desktop. */
export function ModuleCard({ module: m, slot, delay = 0, moreTo, moreLabel }: ModuleCardProps) {
  const tiltRef = useTilt<HTMLDivElement>(2.5);
  const photo = m.image ? img(m.image) : null;
  const live = m.status === 'live';
  return (
    <Reveal as="li" delay={delay} className={cx('lp-pfc', `lp-pfc--${slot}`)}>
      <div ref={tiltRef} className="lp-pfc__tilt lp-tilt">
        <div className="lp-pfc__card lp-glass">
          {photo ? (
            <div className="lp-pfc__photo" aria-hidden="true">
              <ImageSlot
                src={photo.file}
                srcSet={`${photo.file800} 800w, ${photo.file} ${photo.width}w`}
                sizes={slot === 'feature' ? '(min-width: 960px) 40vw, 90vw' : '(min-width: 960px) 28vw, 90vw'}
                alt=""
                decorative
                width={photo.width}
                height={photo.height}
                fallback="ink"
                style={{ aspectRatio: undefined }}
              />
            </div>
          ) : null}
          <div className="lp-pfc__top">
            <span className="lp-icon-tile">
              <Icon icon={iconFor(m.icon)} size={22} />
            </span>
            <Tag tone={live ? 'mint' : 'outline'}>{live ? PLATFORM.liveTag : PLATFORM.comingSoonTag}</Tag>
          </div>
          <div className="lp-pfc__body">
            <p className="lp-pfc__curious lp-mono">{m.curiousLine}</p>
            <Heading level={3} size="h3" className="lp-pfc__title">
              {m.title}
            </Heading>
            <p className="lp-pfc__summary">{m.summary}</p>
            {moreTo ? (
              <SectionLink to={moreTo} className="lp-pfc__more">
                {moreLabel ?? 'See more'}
                <ArrowRight size={16} strokeWidth={2} aria-hidden="true" focusable="false" />
              </SectionLink>
            ) : null}
          </div>
        </div>
      </div>
    </Reveal>
  );
}
