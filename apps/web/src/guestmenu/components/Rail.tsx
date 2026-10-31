import { useEffect, useRef } from 'react';
import { Leaf, Search, X } from 'lucide-react';
import { T } from '../strings';
import type { MenuCategory } from '../types';

export interface RailProps {
  categories: MenuCategory[];
  active: string | null;
  onPick: (id: string) => void;
  query: string;
  onQuery: (q: string) => void;
  searchOpen: boolean;
  onSearchOpen: (o: boolean) => void;
  vegOnly: boolean;
  onVegOnly: (v: boolean) => void;
}

export function Rail({ categories, active, onPick, query, onQuery, searchOpen, onSearchOpen, vegOnly, onVegOnly }: RailProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  // Keep the active chip centred as the page scrolls (manual scrollTo: never moves the page itself).
  useEffect(() => {
    const sc = scroller.current;
    const chip = sc?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!sc || !chip) return;
    const left = chip.offsetLeft - (sc.clientWidth - chip.offsetWidth) / 2;
    sc.scrollTo({ left, behavior: 'smooth' });
  }, [active]);
  useEffect(() => {
    if (searchOpen) input.current?.focus({ preventScroll: true });
  }, [searchOpen]);

  return (
    <div className="gm-rail">
      <div className="gm-rail__row">
        <nav ref={scroller} className="gm-rail__scroll" aria-label={T.menuRail}>
          {categories.map((c) => (
            <button key={c.id} type="button" className="gm-pill gm-press" aria-current={active === c.id ? 'true' : undefined} onClick={() => onPick(c.id)}>
              {c.name}
            </button>
          ))}
        </nav>
        <div className="gm-rail__tools">
          <button type="button" className="gm-tool gm-press" aria-pressed={vegOnly} onClick={() => onVegOnly(!vegOnly)} aria-label={T.vegOnly} title={T.vegOnly}>
            <Leaf size={17} aria-hidden="true" />
          </button>
          <button type="button" className="gm-tool gm-press" aria-pressed={searchOpen} aria-expanded={searchOpen} onClick={() => onSearchOpen(!searchOpen)} aria-label={T.search} title={T.search}>
            <Search size={17} aria-hidden="true" />
          </button>
        </div>
      </div>
      {searchOpen ? (
        <div className="gm-search" role="search">
          <Search size={16} aria-hidden="true" />
          <input ref={input} type="search" value={query} onChange={(e) => onQuery(e.target.value)} placeholder={T.searchPlaceholder} aria-label={T.search} enterKeyHint="search" autoComplete="off" />
          {query ? (
            <button type="button" className="gm-tool gm-press" onClick={() => { onQuery(''); input.current?.focus(); }} aria-label={T.clear}><X size={16} aria-hidden="true" /></button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
