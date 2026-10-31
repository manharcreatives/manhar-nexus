import type { CSSProperties } from 'react';
import { AccentWord, Icon, ImageSlot, Reveal, Section, SectionButton, SectionHead, Tag } from '../components';
import { NEXUS_MENU, img } from '../content';
import { MenuPhone, QrTent, StatusPhone } from '../devices/NexusMenuPhone';
import { useScrollProgress } from '../hooks/useScrollProgress';
import { iconFor } from './_b/icons';
import '../styles/nexusmenu.css';

function headline() {
  const { text, accent } = NEXUS_MENU.headline;
  const i = text.indexOf(accent);
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <AccentWord>{accent}</AccentWord>
      {text.slice(i + accent.length)}
    </>
  );
}

/**
 * Nexus Menu showcase: copy on the left, a layered 3D scene on the right (guest phone, live-status phone, table tent,
 * dish photograph, a staff-side "Guest order" ping). Flat images and HTML in CSS 3D; scroll writes --p, the layers
 * move at different speeds. Phones and reduced motion get the flat arrangement. No metrics, no customers.
 */
export default function NexusMenu() {
  const stageRef = useScrollProgress<HTMLDivElement>('view');
  const plate = img('chef-hands-plating');
  return (
    <Section id="nexus-menu" tone="canvas" labelledBy="nexus-menu-title" className="lp-nm">
      <span className="lp-orb lp-nm__orb" aria-hidden="true" />
      <div className="lp-nm__grid">
        <div className="lp-nm__copy">
          <SectionHead eyebrow={NEXUS_MENU.eyebrow} title={headline()} titleId="nexus-menu-title" lede={NEXUS_MENU.lede} />
          <p className="lp-nm__status">
            <Tag tone={NEXUS_MENU.statusTag === 'LIVE' ? 'mint' : 'outline'}>{NEXUS_MENU.statusTag}</Tag>
          </p>
          <ul className="lp-nm__features">
            {NEXUS_MENU.features.map((f, i) => (
              <Reveal as="li" key={f.id} delay={i * 90} className="lp-nm__feature">
                <span className="lp-icon-tile">
                  <Icon icon={iconFor(f.icon)} size={20} />
                </span>
                <div>
                  <h3 className="lp-nm__ftitle">{f.title}</h3>
                  <p className="lp-nm__fbody">{f.body}</p>
                </div>
              </Reveal>
            ))}
          </ul>
          <ul className="lp-nm__chips" aria-label="Also included">
            {NEXUS_MENU.chips.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <p className="lp-nm__note">{NEXUS_MENU.note}</p>
          <div className="lp-nm__ctas">
            <SectionButton section="register?begin=demo" size="lg" arrow>
              {NEXUS_MENU.primaryCta}
            </SectionButton>
            <SectionButton section="pricing" variant="ghost" arrow>
              {NEXUS_MENU.secondaryCta}
            </SectionButton>
          </div>
        </div>

        <div className="lp-nm__stage" ref={stageRef} role="img" aria-label="Illustration: a guest phone showing the live menu with dish photos, a second phone showing live order status and the bill, and a table tent with a QR code. Sample data.">
          <div className="lp-nm__scene" aria-hidden="true">
            <div className="lp-nm__layer lp-nm__plate" style={{ '--z': '-90px', '--par': '-70' } as CSSProperties}>
              <div className="lp-photo">
                <ImageSlot src={plate.file800} alt="" decorative width={plate.width} height={plate.height} fallback="ink" fallbackLabel=" " />
              </div>
            </div>
            <div className="lp-nm__layer lp-nm__main" style={{ '--z': '0px', '--par': '-30' } as CSSProperties}>
              <MenuPhone decorative animate />
            </div>
            <div className="lp-nm__layer lp-nm__side" style={{ '--z': '70px', '--par': '-60' } as CSSProperties}>
              <StatusPhone decorative animate />
            </div>
            <div className="lp-nm__layer lp-nm__tent" style={{ '--z': '120px', '--par': '-95' } as CSSProperties}>
              <QrTent />
            </div>
            <div className="lp-nm__layer lp-nm__ping" style={{ '--z': '150px', '--par': '-120' } as CSSProperties}>
              <span className="lp-nm__pingdot" />
              <span>
                <b>Guest order</b> · Table 7
                <em>Awaiting your waiter’s confirmation</em>
              </span>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
