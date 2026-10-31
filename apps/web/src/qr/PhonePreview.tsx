import { useTranslation } from 'react-i18next';
import { hexToRgb, luminance } from '../lib/brand';
import { assetUrl } from './api';
import * as Icons from './icons';
import type { OrderingMode } from './types';

export interface PreviewProps {
  name: string;
  tagline: string;
  logoUrl: string | null;
  coverUrl: string | null;
  accent: string;
  ordering: OrderingMode;
  callWaiter: boolean;
  upi: boolean;
}

/** Text colour that stays readable on the accent (same rule as applyAccent). */
export function onAccent(hex: string): string {
  const rgb = hexToRgb(hex);
  return rgb && luminance(rgb) > 0.4 ? '#04120a' : '#ffffff';
}

/**
 * A phone frame showing the header of the guest menu as the settings currently stand.
 * It is a visual approximation drawn from the same inputs (name, tagline, logo, cover,
 * accent), not the real guest page.
 */
export function PhonePreview({ name, tagline, logoUrl, coverUrl, accent, ordering, callWaiter, upi }: PreviewProps) {
  const { t } = useTranslation();
  const cover = assetUrl(coverUrl);
  const logo = assetUrl(logoUrl);
  const ink = onAccent(accent);
  return (
    <figure className="mx-auto w-[17.5rem]" aria-label={t('qr.preview.label')} data-testid="phone-preview">
      <div className="rounded-[2.4rem] border border-white/15 bg-[#05080a] p-2 shadow-[0_30px_80px_-30px_rgb(0_0_0/0.9),inset_0_0_0_1px_rgb(255_255_255/0.05)]">
        <div className="relative h-[34rem] overflow-hidden rounded-[1.9rem] bg-paper text-ink" style={{ ['--pv-accent' as string]: accent }}>
          <span aria-hidden className="absolute top-2 left-1/2 z-20 h-4 w-20 -translate-x-1/2 rounded-full bg-black" />
          {/* hero */}
          <div className="relative h-52">
            {cover ? (
              <img src={cover} alt="" className="absolute inset-0 size-full object-cover" />
            ) : (
              <span aria-hidden className="absolute inset-0" style={{ background: `radial-gradient(120% 90% at 20% 0%, ${accent}66, transparent 60%), linear-gradient(160deg, #16201c, #070a09)` }} />
            )}
            <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-paper via-paper/40 to-transparent" />
            <div className="absolute inset-x-4 bottom-3 flex items-end gap-3">
              <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/15 bg-black/50 backdrop-blur" data-testid="preview-logo">
                {logo ? <img src={logo} alt="" className="size-full object-cover" /> : <Icons.QrCode className="size-5 text-muted" aria-hidden />}
              </span>
              <div className="min-w-0">
                <p className="truncate font-display text-lg leading-tight font-semibold" data-testid="preview-name">{name}</p>
                <p className="line-clamp-2 min-h-4 text-xs text-ink-2" data-testid="preview-tagline">{tagline}</p>
              </div>
            </div>
          </div>
          {/* category rail */}
          <div className="flex gap-2 overflow-hidden px-4 pt-3" aria-hidden>
            {['Starters', 'Mains', 'Breads'].map((c, i) => (
              <span key={c} className="rounded-full border px-3 py-1 text-[0.7rem] font-medium" style={i === 0 ? { background: accent, color: ink, borderColor: accent } : { borderColor: 'rgb(255 255 255 / 0.14)', color: '#94a09b' }}>
                {c}
              </span>
            ))}
          </div>
          {/* dish cards */}
          <div className="grid grid-cols-2 gap-3 px-4 pt-4" aria-hidden>
            {[0, 1].map((n) => (
              <div key={n} className="rounded-2xl border border-white/10 bg-surface p-2" style={{ transform: `perspective(600px) rotateY(${n ? -4 : 4}deg)` }}>
                <div className="aspect-[4/5] rounded-xl bg-sunken" />
                <div className="mt-2 h-2 w-3/4 rounded bg-white/15" />
                <div className="mt-1.5 flex items-center justify-between">
                  <div className="h-2 w-1/3 rounded bg-white/10" />
                  {ordering !== 'off' && <span className="grid size-5 place-items-center rounded-full text-xs font-bold" style={{ background: accent, color: ink }}>+</span>}
                </div>
              </div>
            ))}
          </div>
          {/* floating actions */}
          <div className="absolute inset-x-4 bottom-4 flex flex-wrap items-center justify-center gap-2">
            {callWaiter && (
              <span data-testid="preview-call" className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/60 px-3 py-1.5 text-[0.7rem] font-medium backdrop-blur">
                <Icons.HandPlatter className="size-3.5" aria-hidden /> {t('qr.preview.call')}
              </span>
            )}
            {ordering !== 'off' && (
              <span data-testid="preview-order" className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.7rem] font-semibold" style={{ background: accent, color: ink }}>
                {t('qr.preview.order')}
              </span>
            )}
            {upi && (
              <span data-testid="preview-upi" className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/60 px-3 py-1.5 text-[0.7rem] font-medium backdrop-blur">
                {t('qr.preview.upi')}
              </span>
            )}
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs text-muted">{t('qr.preview.note')}</figcaption>
    </figure>
  );
}
