import { Check, ConciergeBell, Wallet } from 'lucide-react';
import { ImageSlot } from '../components/ImageSlot';
import { Icon } from '../components/Icon';
import { img, type ImageName } from '../content';
import { DeviceFrame, type DeviceProps } from './DeviceFrame';
import '../styles/nexusmenu.css';

function Dish({ name: file }: { name: ImageName }) {
  const i = img(file);
  return (
    <ImageSlot
      src={i.file800}
      alt=""
      decorative
      width={i.width}
      height={i.height}
      fallback="ink"
      fallbackLabel=" "
      style={{ aspectRatio: undefined, height: '100%' }}
    />
  );
}

/**
 * The guest's phone, browsing the live menu: a hero dish, a category rail, dish rows with photos and a "view order"
 * bar. Pure HTML/CSS around the shared dish photographs. Sample data (a made-up restaurant), not a customer.
 */
export function MenuPhone({ className, animate = false, decorative = true, label }: DeviceProps) {
  return (
    <DeviceFrame
      kind="phone"
      className={className}
      animate={animate}
      decorative={decorative}
      label={label ?? 'Phone preview of the Nexus Menu: a live QR menu with dish photos, categories and a view order bar. Sample data.'}
    >
      <div className="lp-nmp">
        <span className="lp-nmp__island" />
        <div className="lp-nmp__bar">
          <div>
            <p className="lp-nmp__rest">Saffron Table</p>
            <p className="lp-nmp__sub">Table 7 · open</p>
          </div>
          <span className="lp-nmp__live">
            <i /> Live menu
          </span>
        </div>
        <div className="lp-nmp__hero">
          <Dish name="indian-thali-overhead" />
          <div className="lp-nmp__heroin">
            <p className="lp-nmp__tag">Chef’s pick</p>
            <p className="lp-nmp__hname">Gujarati Thali</p>
            <div className="lp-nmp__hrow">
              <span className="lp-nmp__price">₹320</span>
              <span className="lp-nmp__add">Add</span>
            </div>
          </div>
        </div>
        <div className="lp-nmp__rail">
          <span>Starters</span>
          <span className="is-on">Dosa</span>
          <span>Thali</span>
          <span>Drinks</span>
        </div>
        <ul className="lp-nmp__list">
          <li>
            <span className="lp-nmp__thumb">
              <Dish name="chef-hands-plating" />
            </span>
            <span className="lp-nmp__txt">
              <b>Masala Dosa</b>
              <em>Crisp, potato masala</em>
            </span>
            <span className="lp-nmp__price">₹140</span>
          </li>
          <li>
            <span className="lp-nmp__thumb">
              <Dish name="specialty-cafe-counter" />
            </span>
            <span className="lp-nmp__txt">
              <b>Filter Coffee</b>
              <em>Served hot</em>
            </span>
            <span className="lp-nmp__price">₹60</span>
          </li>
        </ul>
        <p className="lp-nmp__cta">View order · 2 items · ₹200</p>
      </div>
    </DeviceFrame>
  );
}

const STEPS = ['Received', 'Confirmed', 'Preparing', 'Ready', 'Served'] as const;

/** The same guest, later: live order status, the running bill, call-waiter and UPI. Sample data. */
export function StatusPhone({ className, animate = false, decorative = true, label }: DeviceProps) {
  return (
    <DeviceFrame
      kind="phone"
      className={className}
      animate={animate}
      decorative={decorative}
      label={label ?? 'Phone preview of the live table view: order status from received to served, the running bill, call waiter and UPI. Sample data.'}
    >
      <div className="lp-nmp lp-nmp--status">
        <span className="lp-nmp__island" />
        <div className="lp-nmp__bar">
          <div>
            <p className="lp-nmp__rest">Your table</p>
            <p className="lp-nmp__sub">Table 7 · 2 items ordered</p>
          </div>
        </div>
        <ol className="lp-nmp__steps">
          {STEPS.map((s, i) => (
            <li key={s} data-state={i < 2 ? 'done' : i === 2 ? 'now' : 'next'}>
              <span className="lp-nmp__dot">{i < 2 ? <Icon icon={Check} size="0.9em" strokeWidth={3} /> : null}</span>
              {s}
            </li>
          ))}
        </ol>
        <div className="lp-nmp__bill">
          <p className="lp-nmp__billhead">Running bill</p>
          <p className="lp-nmp__bl">
            <span>Masala Dosa</span>
            <span>₹140.00</span>
          </p>
          <p className="lp-nmp__bl">
            <span>Filter Coffee</span>
            <span>₹60.00</span>
          </p>
          <p className="lp-nmp__bl">
            <span>GST</span>
            <span>₹10.00</span>
          </p>
          <p className="lp-nmp__bl lp-nmp__bl--tot">
            <span>Total</span>
            <span>₹210.00</span>
          </p>
        </div>
        <div className="lp-nmp__btns">
          <span className="lp-nmp__btn">
            <Icon icon={ConciergeBell} size="1.1em" /> Call waiter
          </span>
          <span className="lp-nmp__btn lp-nmp__btn--pri">
            <Icon icon={Wallet} size="1.1em" /> Pay by UPI
          </span>
        </div>
      </div>
    </DeviceFrame>
  );
}

/* A decorative QR-shaped pattern (deterministic, NOT a real code and not scannable). */
const N = 21;
function qrPath(): string {
  let seed = 7;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const inFinder = (x: number, y: number) => (x < 8 && y < 8) || (x > N - 9 && y < 8) || (x < 8 && y > N - 9);
  let d = '';
  for (let y = 0; y < N; y += 1) {
    for (let x = 0; x < N; x += 1) {
      if (inFinder(x, y)) continue;
      if (rnd() > 0.52) d += `M${x} ${y}h1v1h-1z`;
    }
  }
  for (const [ox, oy] of [
    [0, 0],
    [N - 7, 0],
    [0, N - 7],
  ]) {
    d += `M${ox} ${oy}h7v7h-7zM${ox + 1} ${oy + 1}v5h5v-5z`;
    d += `M${ox + 2} ${oy + 2}h3v3h-3z`;
  }
  return d;
}
const QR_D = qrPath();

/** The table tent that sits on every table. Decorative pattern; the caption says what a real one does. */
export function QrTent({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden="true">
      <div className="lp-nmt">
        <p className="lp-nmt__top">Scan for the menu</p>
        <svg className="lp-nmt__qr" viewBox={`-1 -1 ${N + 2} ${N + 2}`} shapeRendering="crispEdges" focusable="false">
          <rect x="-1" y="-1" width={N + 2} height={N + 2} fill="#f3f7f5" />
          <path d={QR_D} fill="#0b0f0e" fillRule="evenodd" />
        </svg>
        <p className="lp-nmt__foot">
          <b>Table 7</b>
          <span>No app. No login.</span>
        </p>
      </div>
    </div>
  );
}
