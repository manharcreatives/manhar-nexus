import { NexusMark } from '../components/NexusMark';
import { DeviceFrame, LiveBadge, type DeviceProps } from './DeviceFrame';

const NAV = ['Home', 'Tables', 'Kitchen', 'Bills', 'Reports', 'Costs'] as const;

/** Net revenue per day, last 7 days, in thousands of rupees. The last value is today (₹48,260). Sample data. */
const SERIES = [31.2, 36.4, 29.8, 42.1, 39.6, 52.3, 48.26] as const;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Today'] as const;

const VB_W = 120;
const VB_H = 46;
const PAD_X = 4;
const point = (v: number, i: number): [number, number] => {
  const x = PAD_X + (i * (VB_W - PAD_X * 2)) / (SERIES.length - 1);
  const y = VB_H - 6 - ((v - 25) / 30) * (VB_H - 14);
  return [x, y];
};
const PTS = SERIES.map(point);
const LINE = PTS.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
const AREA = `${LINE} L${PTS[PTS.length - 1][0].toFixed(1)} ${VB_H} L${PTS[0][0].toFixed(1)} ${VB_H} Z`;
const [END_X, END_Y] = PTS[PTS.length - 1];

type TableState = 'occupied' | 'cleaning' | 'available';
const STATE_LABEL: Record<TableState, string> = { occupied: 'Occupied', cleaning: 'Cleaning', available: 'Available' };
const TABLES: readonly TableState[] = [
  'occupied', 'available', 'occupied', 'occupied',
  'cleaning', 'available', 'occupied', 'available',
  'occupied', 'cleaning', 'occupied', 'occupied',
];

const DISHES = [
  { name: 'Filter Coffee', n: 61 },
  { name: 'Masala Dosa', n: 38 },
  { name: 'Paneer Tikka', n: 29 },
  { name: 'Gujarati Thali', n: 22 },
] as const;

/**
 * Owner "Today" home: net revenue ledger figure, paid bills, average bill, 7-day revenue line, live table board
 * (state shown in words) and top dishes. Series use only #1DBA3C / #0B0F0E / #9AA5A0. Sample data, not a claim.
 */
export function OwnerDashboard({ className, animate = false, decorative = false, label }: DeviceProps) {
  return (
    <DeviceFrame
      kind="laptop"
      className={className}
      animate={animate}
      decorative={decorative}
      label={label ?? 'Owner dashboard preview: net revenue today ₹48,260 from 74 paid bills, a seven-day revenue line, live table status and top dishes. Sample data.'}
    >
      <div className="lp-od">
        <aside className="lp-od__side">
          <div className="lp-od__brand">
            <NexusMark size={20} />
            <span>Saffron Table</span>
          </div>
          <ul className="lp-od__nav">
            {NAV.map((n, i) => (
              <li key={n} aria-current={i === 0 ? 'page' : undefined}>
                {n}
              </li>
            ))}
          </ul>
          <div className="lp-od__who">
            <span className="lp-od__avatar">O</span>
            Owner
          </div>
        </aside>
        <div className="lp-od__main">
          <div className="lp-od__head">
            <div>
              <p className="lp-od__title">Today</p>
              <p className="lp-od__sub">Saturday · Visnagar · Main floor</p>
            </div>
            <LiveBadge />
          </div>
          <div className="lp-od__kpis">
            <div className="lp-od__card">
              <p className="lp-dev__label">Net revenue today</p>
              <p className="lp-od__fig">₹48,260</p>
              <p className="lp-od__note">Today is still in progress. Refunds are subtracted.</p>
            </div>
            <div className="lp-od__card">
              <p className="lp-dev__label">Paid bills</p>
              <p className="lp-od__fig lp-od__fig--sm">74</p>
            </div>
            <div className="lp-od__card">
              <p className="lp-dev__label">Average bill</p>
              <p className="lp-od__fig lp-od__fig--sm">₹652</p>
            </div>
          </div>
          <div className="lp-od__row">
            <div className="lp-od__card">
              <p className="lp-dev__label">Last 7 days</p>
              <svg className="lp-od__spark" viewBox={`0 0 ${VB_W} ${VB_H}`} aria-hidden="true" focusable="false">
                {[12, 24, 36].map((y) => (
                  <line key={y} x1="0" x2={VB_W} y1={y} y2={y} stroke="#9AA5A0" strokeOpacity="0.35" strokeWidth="0.5" strokeDasharray="1.5 2" />
                ))}
                <g className="lp-od__line">
                  <path d={AREA} fill="#1DBA3C" fillOpacity="0.12" />
                  <path d={LINE} fill="none" stroke="#1DBA3C" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
                  <circle cx={END_X} cy={END_Y} r="2.4" fill="#0B0F0E" stroke="#FFFFFF" strokeWidth="1" />
                </g>
              </svg>
              <div className="lp-od__days">
                {DAYS.map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
            </div>
            <div className="lp-od__card">
              <p className="lp-dev__label">Right now · Tables</p>
              <ul className="lp-od__tbls">
                {TABLES.map((s, i) => (
                  <li key={i} className={`lp-od__tbl lp-od__tbl--${s}`}>
                    <b>T{i + 1}</b>
                    <span>{STATE_LABEL[s]}</span>
                  </li>
                ))}
              </ul>
              <p className="lp-od__kline">7 tables occupied · 2 being cleaned · 2 tickets waiting, oldest 3 min</p>
            </div>
            <div className="lp-od__card">
              <p className="lp-dev__label">Top dishes</p>
              <ul className="lp-od__dish">
                {DISHES.map((d, i) => (
                  <li key={d.name} style={{ ['--i' as string]: i, ['--r' as string]: d.n / DISHES[0].n }}>
                    <div className="lp-od__dishrow">
                      <span>{d.name}</span>
                      <b>{d.n}</b>
                    </div>
                    <div className="lp-od__track">
                      <div className="lp-od__bar" style={{ ['--i' as string]: i, ['--r' as string]: d.n / DISHES[0].n }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </DeviceFrame>
  );
}
