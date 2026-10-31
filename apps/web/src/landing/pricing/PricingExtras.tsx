import { Icon, Tag } from '../components';
import { ADD_ONS, ONBOARDING, PRICING } from '../content';
import { Check } from '../sectionsC/icons';
import { foundingAwareText, type FoundingState } from './pricingMath';

/** “Included, where others charge extra”. */
export function IncludedList() {
  return (
    <div className="lp-extra">
      <h3 className="lp-extra__title">{PRICING.includedTitle}</h3>
      <ul className="lp-included">
        {PRICING.included.map((item) => (
          <li key={item}>
            <Icon icon={Check} size={16} strokeWidth={2.5} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const TRY_OPTIONS = [
  {
    id: 'demo',
    tag: 'FREE',
    title: 'Live demo',
    body: 'A walkthrough on a call, with your own menu in mind. Choose “Live demo first” in the form.',
  },
  {
    id: 'pilot',
    tag: 'BY APPROVAL',
    title: '14-day pilot',
    body: 'For Founding Restaurants, after a short call. We set up each Workspace by hand, so we can only take a few at a time.',
  },
  {
    id: 'pay',
    tag: '14 DAYS',
    title: 'Pay and start',
    body: 'Use Nexus knowing you can ask for a full refund of your first payment within 14 days of your Workspace being activated.',
  },
] as const;

/** Honest replacement for a self-serve free trial (Workspaces are provisioned by hand). */
export function TryBeforePaying() {
  return (
    <div className="lp-extra">
      <h3 className="lp-extra__title">Three honest ways to try before you commit</h3>
      <p className="lp-extra__lede">There is no instant self-serve trial, because a person sets up every Workspace.</p>
      <ul className="lp-try">
        {TRY_OPTIONS.map((o) => (
          <li key={o.id} className="lp-try__item">
            <Tag>{o.tag}</Tag>
            <h4>{o.title}</h4>
            <p>{o.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One-time onboarding fees (ex-GST). */
export function OnboardingTable({ state }: { state: FoundingState }) {
  return (
    <div className="lp-extra">
      <h3 className="lp-extra__title">{PRICING.onboardingTitle}</h3>
      <p className="lp-extra__lede">{foundingAwareText(PRICING.onboardingIntro, state)}</p>
      <div className="lp-ptable-wrap">
        <table className="lp-ptable">
          <caption className="lp-visually-hidden">{PRICING.onboardingTitle}, prices exclude GST</caption>
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col">Price (ex-GST)</th>
            </tr>
          </thead>
          <tbody>
            {ONBOARDING.map((item) => (
              <tr key={item.id}>
                <th scope="row">
                  <span className="lp-ptable__name">{item.name}</span>
                  <span className="lp-ptable__detail">{foundingAwareText(item.detail, state)}</span>
                </th>
                <td className="lp-ptable__price">{item.price}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="lp-extra__fine">{PRICING.onboardingRefund}</p>
    </div>
  );
}

/** Recurring add-ons, then the “coming soon, not sold” list with tags. */
export function AddOnsTable() {
  const available = ADD_ONS.filter((a) => a.status === 'available');
  const soon = ADD_ONS.filter((a) => a.status === 'coming-soon');
  return (
    <div className="lp-extra">
      <h3 className="lp-extra__title">{PRICING.addOnsTitle}</h3>
      <div className="lp-ptable-wrap">
        <table className="lp-ptable">
          <caption className="lp-visually-hidden">{PRICING.addOnsTitle}, prices exclude GST</caption>
          <thead>
            <tr>
              <th scope="col">Add-on</th>
              <th scope="col">Price (ex-GST)</th>
            </tr>
          </thead>
          <tbody>
            {available.map((a) => (
              <tr key={a.id}>
                <th scope="row">
                  <span className="lp-ptable__name">{a.name}</span>
                  <span className="lp-ptable__detail">{a.note}</span>
                </th>
                <td className="lp-ptable__price">{a.price}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h4 className="lp-extra__sub">{PRICING.comingSoonTitle}</h4>
      <ul className="lp-soon">
        {soon.map((a) => (
          <li key={a.id}>
            <Tag tone="outline">Coming soon</Tag>
            <div>
              <span className="lp-ptable__name">{a.name}</span>
              <span className="lp-ptable__detail">{a.note}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
