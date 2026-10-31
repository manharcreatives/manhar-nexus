import { Container, Heading, Section, SectionHead } from '../components';
import { Icon } from '../components/Icon';
import { PLATFORM } from '../content';
import '../styles/platform.css';
import { ModuleCard } from './_b/ModuleCard';
import { headlineNode } from './_b/headline';
import { iconFor } from './_b/icons';

const SLOTS = ['feature', 'wide', 'wide', 'std', 'std', 'std'] as const;

/**
 * Platform: SIX highlighted modules in a bento grid (the first, Nexus Menu, is the tall feature card), then a
 * compact "And also" strip for the rest of the live modules and one muted line for what is coming soon.
 */
export default function Platform() {
  const byId = new Map(PLATFORM.modules.map((m) => [m.id, m]));
  const soonById = new Map(PLATFORM.comingSoon.map((m) => [m.id, m]));
  const headline = PLATFORM.headlineIds.map((id) => byId.get(id) ?? soonById.get(id)).filter((m): m is NonNullable<typeof m> => Boolean(m));
  const also = PLATFORM.modules.filter((m) => !PLATFORM.headlineIds.includes(m.id));

  return (
    <Section id="platform" tone="alt" labelledBy="platform-title" className="lp-platform">
      <SectionHead
        eyebrow={PLATFORM.header.eyebrow}
        title={headlineNode(PLATFORM.header.headline)}
        titleId="platform-title"
        lede={PLATFORM.header.subhead}
      />

      <ul className="lp-pf__grid" aria-label="Headline modules">
        {headline.map((m, i) => (
          <ModuleCard
            key={m.id}
            module={m}
            slot={SLOTS[i] ?? 'std'}
            delay={i * 90}
            moreTo={m.id === 'nexus-menu' ? 'nexus-menu' : undefined}
            moreLabel={m.id === 'nexus-menu' ? 'See Nexus Menu' : undefined}
          />
        ))}
      </ul>

      <div className="lp-pf__more">
        <Heading level={3} size="h3" id="platform-also-title" className="lp-pf__moretitle">
          {PLATFORM.alsoTitle}
        </Heading>
        <ul className="lp-pf__also" aria-labelledby="platform-also-title">
          {also.map((m) => (
            <li key={m.id} className="lp-pf__chip">
              <Icon icon={iconFor(m.icon)} size={16} />
              <span>{m.title}</span>
            </li>
          ))}
        </ul>
      </div>

      <Container className="lp-pf__soon" size="wide">
        <p className="lp-pf__soonrow">
          <span className="lp-pf__soontag lp-mono">{PLATFORM.comingSoonTitle}</span>
          <span className="lp-pf__soonlist">{PLATFORM.comingSoon.map((m) => m.title).join(' · ')}</span>
        </p>
        <p className="lp-pf__soonnote">{PLATFORM.comingSoonNote}</p>
      </Container>
    </Section>
  );
}
