import { Heading, IconTile, Tag } from '../../components';
import type { PlatformModule } from '../../content';
import { PLATFORM } from '../../content';
import { iconFor } from './icons';

export interface ModuleTicketProps {
  module: PlatformModule;
  /** Total number of LIVE modules, for the "01 / 12" stamp. */
  total: number;
  /** Roadmap cards: muted, no proof line, "Coming soon" tag. */
  muted?: boolean;
}

/** A kitchen-ticket-shaped module card (notched edges via CSS mask). Pure markup, no state. */
export function ModuleTicket({ module: m, total, muted = false }: ModuleTicketProps) {
  const live = m.status === 'live';
  return (
    <div className={muted ? 'lp-pf__ticket lp-pf__ticket--muted' : 'lp-pf__ticket'}>
      <div className="lp-pf__top">
        <IconTile icon={iconFor(m.icon)} />
        <p className="lp-pf__no lp-mono">
          {m.number ? (
            <>
              <span className="lp-num">{m.number}</span> / {String(total).padStart(2, '0')}
            </>
          ) : null}
        </p>
        <Tag tone={live ? 'mint' : 'outline'}>{live ? PLATFORM.liveTag : PLATFORM.comingSoonTag}</Tag>
      </div>
      <div className="lp-pf__perf" aria-hidden="true" />
      <div className="lp-pf__body">
        <Heading level={3} size="h3" className="lp-pf__title">
          {m.title}
        </Heading>
        <p className="lp-pf__curious">{m.curiousLine}</p>
        <p className="lp-pf__desc">{m.description}</p>
        {m.proof ? (
          <p className="lp-pf__proof">
            <span className="lp-pf__proof-label lp-mono">Proof</span>
            {m.proof}
          </p>
        ) : null}
      </div>
    </div>
  );
}
