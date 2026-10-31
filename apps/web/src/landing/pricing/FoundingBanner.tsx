import { FOUNDING_OFFER } from '../content';
import { foundingEyebrow, foundingWindowLabel, type FoundingState } from './pricingMath';

/**
 * Founding Restaurants offer. Renders nothing once the window has closed (31 Jan 2027, 23:59 IST), and says
 * "opens" instead of "until" before it begins, so it can never advertise an offer that is not running.
 */
export function FoundingBanner({ state }: { state: FoundingState }) {
  if (state === 'closed') return null;
  const open = state === 'open';
  return (
    <aside className="lp-founding" aria-labelledby="founding-title" data-state={state}>
      <div className="lp-founding__main">
        <p className="lp-eyebrow">{foundingEyebrow(state)}</p>
        <h3 id="founding-title" className="lp-founding__title">
          {FOUNDING_OFFER.title}
        </h3>
        <p className="lp-founding__body">{FOUNDING_OFFER.body}</p>
        <p className="lp-founding__window">
          <strong>{open ? 'Open now' : 'Opens soon'}</strong>
          <span aria-hidden="true"> · </span>
          <span>{foundingWindowLabel()}</span>
          <span aria-hidden="true"> · </span>
          <span>
            Code <code>{FOUNDING_OFFER.code}</code>
          </span>
        </p>
      </div>
      <details className="lp-founding__more">
        <summary>What’s in it, and what we ask in return</summary>
        <div className="lp-founding__cols">
          <div>
            <h4>You get</h4>
            <ul>
              {FOUNDING_OFFER.perks.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4>We ask</h4>
            <ul>
              {FOUNDING_OFFER.asks.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="lp-founding__honest">{FOUNDING_OFFER.honestFraming}</p>
      </details>
    </aside>
  );
}
