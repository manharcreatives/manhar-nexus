import { ArrowDown, Receipt } from 'lucide-react';
import { BlurImage } from './ui';
import { T } from '../strings';
import type { MenuPayload } from '../types';

function Monogram({ name, logo, size }: { name: string; logo?: string | null; size: 'lg' | 'sm' }) {
  return (
    <span className="gm-logo" data-size={size} aria-hidden="true">
      {logo ? <BlurImage src={logo} className="gm-logo__img" priority={size === 'lg'} /> : <span className="gm-logo__mono">{name.trim().slice(0, 1).toUpperCase()}</span>}
    </span>
  );
}

export function Hero({ menu, onExplore }: { menu: MenuPayload; onExplore: () => void }) {
  const b = menu.business;
  const t = menu.table;
  return (
    <section className="gm-hero" aria-labelledby="gm-name">
      <div className="gm-hero__bg" aria-hidden="true">
        {b.coverUrl ? <BlurImage src={b.coverUrl} priority className="gm-hero__img" width={1600} height={1000} /> : <span className="gm-hero__aurora" />}
      </div>
      <div className="gm-hero__veil" aria-hidden="true" />
      <div className="gm-hero__content">
        <Monogram name={b.name} logo={b.logoUrl} size="lg" />
        <p className="gm-hero__table">
          <span className="gm-live" data-open={t.open || undefined} aria-hidden="true" />
          {t.label}{t.areaName ? <span> · {t.areaName}</span> : null}
        </p>
        <h1 id="gm-name" className="gm-hero__name">{b.name}</h1>
        {b.tagline ? <p className="gm-hero__tag">{b.tagline}</p> : null}
        <button type="button" className="gm-hero__cta gm-press" onClick={onExplore}>
          <span>{T.explore}</span>
          <ArrowDown size={16} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

export interface TopBarProps {
  menu: MenuPayload;
  tableOpen: boolean;
  activeOrders: number;
  onTable: () => void;
}

export function TopBar({ menu, tableOpen, activeOrders, onTable }: TopBarProps) {
  const b = menu.business;
  return (
    <header className="gm-bar">
      <div className="gm-bar__brand">
        <Monogram name={b.name} logo={b.logoUrl} size="sm" />
        <div>
          <p className="gm-bar__name">{b.name}</p>
          <p className="gm-bar__table">{menu.table.label}{menu.table.areaName ? ` · ${menu.table.areaName}` : ''}</p>
        </div>
      </div>
      {tableOpen ? (
        <button type="button" className="gm-bar__btn gm-press" onClick={onTable} aria-label={T.yourTable}>
          <Receipt size={18} aria-hidden="true" />
          <span>{T.yourTable}</span>
          {activeOrders > 0 ? <b className="gm-bar__badge tabular" aria-label={`${activeOrders} active`}>{activeOrders}</b> : null}
        </button>
      ) : null}
    </header>
  );
}
