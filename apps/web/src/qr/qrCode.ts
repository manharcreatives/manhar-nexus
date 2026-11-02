import { create, type QRCodeErrorCorrectionLevel } from 'qrcode';

/**
 * Client-side QR generation from the `qrcode` package. The SVG is built from the module
 * matrix (no innerHTML of library output), so the same path drives the on-screen card,
 * the print sheet, the SVG download and the PNG download.
 */

/** Origin guests open. Override for LAN/staging with VITE_PUBLIC_MENU_ORIGIN. */
export function menuOrigin(): string {
  const configured = (import.meta.env.VITE_PUBLIC_MENU_ORIGIN as string | undefined)?.replace(/\/+$/, '');
  if (configured) return configured;
  return typeof window !== 'undefined' ? window.location.origin : '';
}

/** The public guest-menu URL for a table token. */
export function menuUrl(token: string, origin: string = menuOrigin()): string {
  return `${origin.replace(/\/+$/, '')}/m/${encodeURIComponent(token)}`;
}

/**
 * The URL printed in a table's QR code: the API's absolute `url` when the server knows the public origin
 * (QR_PUBLIC_BASE_URL), otherwise the guest path on this page's origin (or VITE_PUBLIC_MENU_ORIGIN).
 */
export function tableMenuUrl(table: { token: string; url: string | null }, origin: string = menuOrigin()): string {
  return table.url ?? menuUrl(table.token, origin);
}

/** True when the URL cannot be opened from a guest's phone (localhost / loopback). */
export function isLocalOrigin(origin: string = menuOrigin()): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]' || host.endsWith('.local');
  } catch {
    return true;
  }
}

export interface QrOptions {
  /** Error correction; M balances density and damage tolerance for printed cards. */
  ecl?: QRCodeErrorCorrectionLevel;
  /** Quiet zone in modules (spec minimum is 4). */
  quiet?: number;
}

export interface QrGeometry {
  /** Side length in modules including the quiet zone (the SVG viewBox). */
  size: number;
  /** Module count without the quiet zone. */
  modules: number;
  /** SVG path data of all dark modules, merged per row run. */
  path: string;
  /** Row-major dark/light bits (without the quiet zone). */
  data: Uint8Array;
}

export function qrGeometry(text: string, { ecl = 'M', quiet = 4 }: QrOptions = {}): QrGeometry {
  const { modules } = create(text, { errorCorrectionLevel: ecl });
  const n = modules.size;
  const parts: string[] = [];
  for (let y = 0; y < n; y++) {
    let x = 0;
    while (x < n) {
      if (!modules.data[y * n + x]) {
        x++;
        continue;
      }
      let run = 1;
      while (x + run < n && modules.data[y * n + x + run]) run++;
      parts.push(`M${x + quiet} ${y + quiet}h${run}v1h-${run}z`);
      x += run;
    }
  }
  return { size: n + quiet * 2, modules: n, path: parts.join(''), data: modules.data };
}

export const QR_DARK = '#0b0f0e';
export const QR_LIGHT = '#ffffff';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/** Standalone SVG file content (white background, near-black modules). */
export function qrSvgString(text: string, label: string, opts?: QrOptions): string {
  const g = qrGeometry(text, opts);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${g.size} ${g.size}" width="1024" height="1024" shape-rendering="crispEdges" role="img" aria-label="${esc(label)}">` +
    `<title>${esc(label)}</title><rect width="${g.size}" height="${g.size}" fill="${QR_LIGHT}"/><path fill="${QR_DARK}" d="${g.path}"/></svg>`
  );
}

/** Safe file name part from a table code ("T 4/b" -> "T-4-b"). */
export function fileSlug(text: string): string {
  return text.trim().replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'table';
}

/** PNG with the table label under the code. Needs a real canvas (browsers); rejects in jsdom. */
export async function qrPngBlob(text: string, caption: string, opts?: QrOptions & { px?: number }): Promise<Blob> {
  const g = qrGeometry(text, opts);
  const px = opts?.px ?? 1024;
  const scale = Math.max(1, Math.floor(px / g.size));
  const side = g.size * scale;
  const band = Math.round(side * 0.14);
  const canvas = document.createElement('canvas');
  canvas.width = side;
  canvas.height = side + band;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas-unavailable');
  ctx.fillStyle = QR_LIGHT;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = QR_DARK;
  const off = Math.round((g.size - g.modules) / 2);
  for (let y = 0; y < g.modules; y++) {
    for (let x = 0; x < g.modules; x++) {
      if (g.data[y * g.modules + x]) ctx.fillRect((x + off) * scale, (y + off) * scale, scale, scale);
    }
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.round(band * 0.5)}px Satoshi, Inter, system-ui, sans-serif`;
  ctx.fillText(caption, side / 2, side + band * 0.46);
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('png-failed'))), 'image/png');
  });
}

/** Triggers a browser download of a blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
