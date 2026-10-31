import { useEffect, useState } from 'react';
import { CircleCheck, Clock } from 'lucide-react';
import { Icon } from '../components/Icon';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { DeviceFrame, LiveBadge, type DeviceProps } from './DeviceFrame';

interface Line {
  qty: number;
  name: string;
  sub?: string;
}
interface Ticket {
  no: string;
  table: number;
  lines: Line[];
  note?: string;
  /** Seconds waiting at first paint. */
  sec: number;
  action?: string;
  ready?: boolean;
}
interface Column {
  id: string;
  title: string;
  tickets: Ticket[];
}

/** Real KOS vocabulary: columns New / Preparing / Ready, actions Accept · Start preparing · Mark ready. */
const COLUMNS: Column[] = [
  {
    id: 'new',
    title: 'New',
    tickets: [
      {
        no: '0412',
        table: 7,
        lines: [
          { qty: 2, name: 'Masala Dosa', sub: 'Full · Extra butter' },
          { qty: 1, name: 'Filter Coffee' },
        ],
        sec: 48,
        action: 'Accept',
      },
      { no: '0413', table: 3, lines: [{ qty: 1, name: 'Paneer Tikka', sub: 'Half' }], note: 'No onion', sec: 132, action: 'Accept' },
    ],
  },
  {
    id: 'preparing',
    title: 'Preparing',
    tickets: [
      {
        no: '0409',
        table: 12,
        lines: [
          { qty: 1, name: 'Paneer Tikka', sub: 'Full' },
          { qty: 2, name: 'Butter Naan' },
        ],
        sec: 432,
        action: 'Mark ready',
      },
      {
        no: '0410',
        table: 5,
        lines: [
          { qty: 1, name: 'Gujarati Thali' },
          { qty: 1, name: 'Masala Chaas' },
        ],
        sec: 195,
        action: 'Mark ready',
      },
    ],
  },
  {
    id: 'ready',
    title: 'Ready',
    tickets: [
      {
        no: '0407',
        table: 2,
        lines: [
          { qty: 2, name: 'Medu Vada' },
          { qty: 2, name: 'Filter Coffee' },
        ],
        sec: 255,
        ready: true,
      },
    ],
  },
];

/** A ticket waiting longer than this shows the "Late" flag (text, not just colour). */
const LATE_AFTER_SEC = 420;

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

/** Whole-second counter that only runs while the device is live on screen and motion is allowed. */
function useTicker(active: boolean): number {
  const [n, setN] = useState(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!active || reduced) return;
    const id = window.setInterval(() => setN((v) => v + 1), 1000);
    return () => window.clearInterval(id);
  }, [active, reduced]);
  return n;
}

function KitchenBody({ live }: { live: boolean }) {
  const tick = useTicker(live);
  let order = 0;
  return (
    <div className="lp-kos">
      <div className="lp-kos__bar">
        <div>
          <p className="lp-kos__title">Kitchen display</p>
          <p className="lp-kos__sum">5 active tickets</p>
        </div>
        <div className="lp-kos__tools">
          <span className="lp-dev__chip">
            <i />
            Sold-Out · Rasmalai
          </span>
          <LiveBadge />
        </div>
      </div>
      <div className="lp-kos__cols">
        {COLUMNS.map((col) => (
          <section key={col.id} className="lp-kos__col" aria-label={col.title}>
            <div className="lp-kos__colhead">
              <span>{col.title}</span>
              <span className="lp-kos__count">{col.tickets.length}</span>
            </div>
            {col.tickets.map((t) => {
              const sec = t.ready ? t.sec : t.sec + tick;
              const late = !t.ready && sec >= LATE_AFTER_SEC;
              const i = order++;
              return (
                <div key={t.no} className="lp-tk" style={{ ['--i' as string]: i }}>
                  <div className="lp-tk__head">
                    <span>
                      <b>No.</b> {t.no}
                    </span>
                    <span>Table {t.table}</span>
                  </div>
                  <div className="lp-tk__body">
                    {t.lines.map((l) => (
                      <div key={l.name}>
                        <div className="lp-tk__line">
                          <span className="lp-tk__q">{l.qty}×</span>
                          <span>{l.name}</span>
                        </div>
                        {l.sub ? <div className="lp-tk__sub">{l.sub}</div> : null}
                      </div>
                    ))}
                    {t.note ? <div className="lp-tk__sub">Note: {t.note}</div> : null}
                  </div>
                  <div className="lp-tk__foot">
                    <span className={late ? 'lp-tk__time lp-tk__time--late' : 'lp-tk__time'}>
                      <Icon icon={Clock} size="1em" />
                      {late ? 'Late · ' : ''}
                      {mmss(sec)}
                    </span>
                    {t.ready ? (
                      <span className="lp-tk__act lp-tk__act--ghost">
                        <Icon icon={CircleCheck} size="1em" />
                        Waiting for pickup
                      </span>
                    ) : (
                      <span className="lp-tk__act">{t.action}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}

/** Kitchen display (KOS): tickets in New / Preparing / Ready, mono ticket numbers, waiting timers, a Sold-Out chip. */
export function KitchenScreen({ className, animate = false, decorative = false, label }: DeviceProps) {
  return (
    <DeviceFrame
      kind="tablet"
      className={className}
      animate={animate}
      decorative={decorative}
      label={label ?? 'Kitchen display preview: five order tickets across New, Preparing and Ready, with waiting timers. Sample data.'}
    >
      {(live) => <KitchenBody live={live} />}
    </DeviceFrame>
  );
}
