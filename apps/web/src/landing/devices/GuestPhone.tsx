import { Check, ChevronLeft } from 'lucide-react';
import { Icon } from '../components/Icon';
import { DeviceFrame, type DeviceProps } from './DeviceFrame';

/**
 * The waiter's handheld: a Service Request for Table 7 with the item sheet open (Size or portion = Variant,
 * Add-ons, Note for the kitchen). Named GuestPhone for the section API; guest-side QR ordering is roadmap-only,
 * so this shows the staff flow that exists today. Sample data.
 */
export function GuestPhone({ className, animate = false, decorative = false, label }: DeviceProps) {
  return (
    <DeviceFrame
      kind="phone"
      className={className}
      animate={animate}
      decorative={decorative}
      label={label ?? 'Phone preview: a Service Request for Table 7 with the Masala Dosa options sheet open, portion and add-ons selected. Sample data.'}
    >
      <div className="lp-gp">
        <span className="lp-gp__island" />
        <div className="lp-gp__top">
          <Icon icon={ChevronLeft} size="1.4em" />
          <div>
            <p className="lp-gp__title">Service Request</p>
            <p className="lp-gp__meta">Table 7 · Guest Session · 4 guests</p>
          </div>
        </div>
        <div className="lp-gp__tabs">
          <span className="lp-gp__tab lp-gp__tab--on">All</span>
          <span className="lp-gp__tab">Dosa</span>
          <span className="lp-gp__tab">Starters</span>
          <span className="lp-gp__tab">Drinks</span>
        </div>
        <ul className="lp-gp__menu">
          <li className="lp-gp__item">
            <div>
              <p className="lp-gp__name">Masala Dosa</p>
              <p className="lp-gp__from">from ₹90</p>
            </div>
            <span className="lp-gp__choose">Choose</span>
          </li>
          <li className="lp-gp__item">
            <div>
              <p className="lp-gp__name">Paneer Tikka</p>
              <p className="lp-gp__from">from ₹180</p>
            </div>
            <span className="lp-gp__choose">Choose</span>
          </li>
          <li className="lp-gp__item">
            <div>
              <p className="lp-gp__name">Filter Coffee</p>
              <p className="lp-gp__from">₹60</p>
            </div>
            <span className="lp-gp__choose">Add</span>
          </li>
        </ul>
        <div className="lp-gp__scrim" />
        <section className="lp-gp__sheet" aria-label="Options">
          <span className="lp-gp__grab" />
          <p className="lp-gp__stitle">Choose options for Masala Dosa</p>
          <div className="lp-gp__group">
            <p className="lp-gp__ghead">
              Size or portion <span>Required · choose 1</span>
            </p>
            <div className="lp-gp__opt">
              <span className="lp-gp__mark" />
              Half <em>₹90</em>
            </div>
            <div className="lp-gp__opt lp-gp__opt--on">
              <span className="lp-gp__mark">
                <Icon icon={Check} size="0.8em" strokeWidth={3} />
              </span>
              Full <em>₹140</em>
            </div>
          </div>
          <div className="lp-gp__group">
            <p className="lp-gp__ghead">
              Add-ons <span>Optional · up to 2</span>
            </p>
            <div className="lp-gp__opt lp-gp__opt--on">
              <span className="lp-gp__mark lp-gp__mark--box">
                <Icon icon={Check} size="0.8em" strokeWidth={3} />
              </span>
              Extra butter <em>+₹20</em>
            </div>
            <div className="lp-gp__opt">
              <span className="lp-gp__mark lp-gp__mark--box" />
              Cheese <em>+₹30</em>
            </div>
          </div>
          <p className="lp-gp__note">Note for the kitchen: no onion</p>
          <p className="lp-gp__cta">Add to order · ₹160</p>
        </section>
      </div>
    </DeviceFrame>
  );
}
