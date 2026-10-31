import { useMemo } from 'react';
import { QR_DARK, QR_LIGHT, qrGeometry, type QrOptions } from './qrCode';

/** A scannable code as inline SVG: always near-black on white, whatever the surrounding theme. */
export function QrSvg({ text, label, className, ...opts }: { text: string; label: string; className?: string } & QrOptions) {
  const { ecl, quiet } = opts;
  const g = useMemo(() => qrGeometry(text, { ecl, quiet }), [text, ecl, quiet]);
  return (
    <svg viewBox={`0 0 ${g.size} ${g.size}`} role="img" aria-label={label} shapeRendering="crispEdges" className={className}>
      <rect width={g.size} height={g.size} fill={QR_LIGHT} />
      <path d={g.path} fill={QR_DARK} />
    </svg>
  );
}
