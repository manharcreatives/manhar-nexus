/**
 * Client-side image helpers: validation, crop geometry and export. Pure maths is kept apart
 * from the canvas call so it can be unit-tested. Re-encoding through a canvas also strips
 * EXIF/GPS metadata before the picture leaves the browser (the server strips it again).
 */
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const ACCEPT_ATTR = ACCEPTED_TYPES.join(',');
/** Largest file we will even try to decode. */
export const MAX_INPUT_BYTES = 12 * 1024 * 1024;
/** Largest blob we send (after crop + re-encode). */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MIN_SIDE_PX = 240;

export type ImageKind = 'dish' | 'logo' | 'cover' | 'category';
export const ASPECT: Record<ImageKind, number> = { dish: 4 / 5, logo: 1, cover: 16 / 9, category: 1 };
/** Output pixel size (never upscaled past the source). */
export const OUTPUT: Record<ImageKind, { w: number; h: number }> = {
  dish: { w: 1200, h: 1500 },
  logo: { w: 512, h: 512 },
  cover: { w: 1600, h: 900 },
  category: { w: 800, h: 800 },
};

export type ImageProblem = 'empty' | 'type' | 'size';

export function validateImageFile(file: { type: string; size: number }): ImageProblem | null {
  if (file.size <= 0) return 'empty';
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) return 'type';
  if (file.size > MAX_INPUT_BYTES) return 'size';
  return null;
}

export interface Size {
  w: number;
  h: number;
}
export interface Point {
  x: number;
  y: number;
}
export interface Rect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 4;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Source rectangle for a crop of `aspect` (w/h). `zoom` 1 is the largest rectangle that fits
 * the image; `center` is where the window sits, as fractions of the image (0..1).
 */
export function cropRect(img: Size, aspect: number, zoom: number, center: Point = { x: 0.5, y: 0.5 }): Rect {
  const z = clamp(zoom, ZOOM_MIN, ZOOM_MAX);
  let sw: number;
  let sh: number;
  if (img.w / img.h > aspect) {
    sh = img.h;
    sw = img.h * aspect;
  } else {
    sw = img.w;
    sh = img.w / aspect;
  }
  sw /= z;
  sh /= z;
  return {
    sx: clamp(center.x * img.w - sw / 2, 0, img.w - sw),
    sy: clamp(center.y * img.h - sh / 2, 0, img.h - sh),
    sw,
    sh,
  };
}

/** New window centre after the picture is dragged by `deltaPx` inside a frame `frameWidthPx` wide. */
export function panCenter(center: Point, deltaPx: Point, frameWidthPx: number, rect: Rect, img: Size): Point {
  if (frameWidthPx <= 0) return center;
  const srcPerPx = rect.sw / frameWidthPx;
  return {
    x: clamp(center.x - (deltaPx.x * srcPerPx) / img.w, 0, 1),
    y: clamp(center.y - (deltaPx.y * srcPerPx) / img.h, 0, 1),
  };
}

/** Output canvas size: the preset, shrunk (same aspect) when the source crop is smaller. */
export function outputSize(kind: ImageKind, rect: Rect): Size {
  const o = OUTPUT[kind];
  const k = Math.min(1, rect.sw / o.w);
  return { w: Math.max(1, Math.round(o.w * k)), h: Math.max(1, Math.round(o.h * k)) };
}

/** True when the source is too small to look good at the target aspect. */
export function isTooSmall(img: Size): boolean {
  return Math.min(img.w, img.h) < MIN_SIDE_PX;
}

/** Draws the crop and encodes WebP (JPEG where WebP is unsupported). Browsers only. */
export async function exportCrop(source: CanvasImageSource, rect: Rect, kind: ImageKind): Promise<Blob> {
  const out = outputSize(kind, rect);
  const canvas = document.createElement('canvas');
  canvas.width = out.w;
  canvas.height = out.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas-unavailable');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, out.w, out.h);
  const encode = (type: string, q: number) => new Promise<Blob | null>((res) => canvas.toBlob(res, type, q));
  const webp = await encode('image/webp', 0.88);
  const blob = webp && webp.type === 'image/webp' ? webp : await encode('image/jpeg', 0.9);
  if (!blob) throw new Error('encode-failed');
  return blob;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
