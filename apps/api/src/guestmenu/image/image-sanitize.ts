import { PayloadTooLargeError, UnsupportedMediaError } from '../guestmenu.errors';

/**
 * Pure helpers that make an uploaded picture safe to serve publicly without a native image library:
 *   - the real type comes from the magic bytes (never the file name or the client's Content-Type),
 *   - metadata that can leak (EXIF GPS/camera, XMP, text chunks, comments) is dropped,
 *   - the pixel size is read from the header so absurd images (decompression bombs) are refused up front.
 * When `sharp` is installed ImageService re-encodes and resizes instead; this file is the dependency-free fallback
 * and the validator in front of both paths.
 */

export type ImageKind = 'jpeg' | 'png' | 'webp';

export const MIME_BY_KIND: Record<ImageKind, string> = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
export const EXT_BY_KIND: Record<ImageKind, string> = { jpeg: 'jpg', png: 'png', webp: 'webp' };

export const MAX_SIDE_PX = 6000;
export const MAX_PIXELS = 24_000_000;
export const MIN_SIDE_PX = 64;

export function sniffImage(buf: Buffer): ImageKind | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length >= 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  return null;
}

export interface ImageInfo {
  kind: ImageKind;
  width: number;
  height: number;
  /** JPEG EXIF orientation 1..8 (1 = upright / not present). */
  orientation: number;
  animated: boolean;
}

const bad = (msg: string): never => {
  throw new UnsupportedMediaError(msg);
};

/** Reads dimensions (and JPEG orientation) from the container header. Throws UnsupportedMediaError when malformed. */
export function inspectImage(buf: Buffer, kind: ImageKind): ImageInfo {
  if (kind === 'png') return inspectPng(buf);
  if (kind === 'jpeg') return inspectJpeg(buf);
  return inspectWebp(buf);
}

function inspectPng(buf: Buffer): ImageInfo {
  if (buf.length < 33 || buf.toString('latin1', 12, 16) !== 'IHDR') return bad('This PNG file is damaged.');
  return { kind: 'png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), orientation: 1, animated: hasPngChunk(buf, 'acTL') };
}

function hasPngChunk(buf: Buffer, name: string): boolean {
  let p = 8;
  while (p + 12 <= buf.length) {
    const len = buf.readUInt32BE(p);
    const n = buf.toString('latin1', p + 4, p + 8);
    if (n === name) return true;
    if (n === 'IDAT') return false; // animation control precedes the first IDAT
    p += 12 + len;
  }
  return false;
}

function inspectJpeg(buf: Buffer): ImageInfo {
  let p = 2;
  let orientation = 1;
  while (p + 4 <= buf.length) {
    if (buf[p] !== 0xff) return bad('This JPEG file is damaged.');
    const marker = buf[p + 1] as number;
    if (marker === 0xff) {
      p += 1;
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      p += 2;
      continue;
    }
    if (marker === 0xd9) break;
    const len = buf.readUInt16BE(p + 2);
    if (len < 2 || p + 2 + len > buf.length) return bad('This JPEG file is damaged.');
    if (marker === 0xe1 && buf.toString('latin1', p + 4, p + 10) === 'Exif\0\0') {
      orientation = exifOrientation(buf.subarray(p + 10, p + 2 + len));
    }
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      if (len < 8) return bad('This JPEG file is damaged.');
      return { kind: 'jpeg', width: buf.readUInt16BE(p + 7), height: buf.readUInt16BE(p + 5), orientation, animated: false };
    }
    p += 2 + len;
  }
  return bad('This JPEG file is damaged.');
}

/** Orientation tag (0x0112) of an EXIF TIFF block; 1 when absent or unreadable. */
export function exifOrientation(tiff: Buffer): number {
  try {
    if (tiff.length < 8) return 1;
    const le = tiff.toString('latin1', 0, 2) === 'II';
    const u16 = (o: number): number => (le ? tiff.readUInt16LE(o) : tiff.readUInt16BE(o));
    const u32 = (o: number): number => (le ? tiff.readUInt32LE(o) : tiff.readUInt32BE(o));
    const ifd = u32(4);
    if (ifd < 8 || ifd + 2 > tiff.length) return 1;
    const n = u16(ifd);
    for (let i = 0; i < n && ifd + 2 + i * 12 + 12 <= tiff.length; i++) {
      const o = ifd + 2 + i * 12;
      if (u16(o) === 0x0112) {
        const v = u16(o + 8);
        return v >= 1 && v <= 8 ? v : 1;
      }
    }
  } catch {
    /* unreadable EXIF = treat as upright */
  }
  return 1;
}

function inspectWebp(buf: Buffer): ImageInfo {
  if (buf.length < 30) return bad('This WebP file is damaged.');
  const fourcc = buf.toString('latin1', 12, 16);
  if (fourcc === 'VP8X') {
    const flags = buf[20] as number;
    return { kind: 'webp', width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3), orientation: 1, animated: (flags & 0x02) !== 0 };
  }
  if (fourcc === 'VP8L') {
    if (buf[20] !== 0x2f) return bad('This WebP file is damaged.');
    const b = buf.readUInt32LE(21);
    return { kind: 'webp', width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1, orientation: 1, animated: false };
  }
  if (fourcc === 'VP8 ') {
    if (buf[23] !== 0x9d || buf[24] !== 0x01 || buf[25] !== 0x2a) return bad('This WebP file is damaged.');
    return { kind: 'webp', width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff, orientation: 1, animated: false };
  }
  return bad('This WebP file is damaged.');
}

/** Size/shape policy shared by every upload. */
export function assertAcceptableSize(info: ImageInfo): void {
  if (info.animated) bad('Animated images are not supported. Upload a still photo.');
  if (info.width < MIN_SIDE_PX || info.height < MIN_SIDE_PX) bad(`The picture is too small (at least ${MIN_SIDE_PX}px on each side).`);
  if (info.width > MAX_SIDE_PX || info.height > MAX_SIDE_PX || info.width * info.height > MAX_PIXELS) {
    throw new PayloadTooLargeError(`The picture is too large (at most ${MAX_SIDE_PX}px per side, ${MAX_PIXELS / 1_000_000} megapixels).`);
  }
}

// ── Metadata stripping ─────────────────────────────────────────────────────────

/** Returns the image without EXIF/XMP/comments/text chunks. Colour profiles (ICC) are kept so colours stay right. */
export function stripMetadata(buf: Buffer, kind: ImageKind): Buffer {
  if (kind === 'jpeg') return stripJpeg(buf);
  if (kind === 'png') return stripPng(buf);
  return stripWebp(buf);
}

// APP0 (JFIF), APP2 (ICC profile) and APP14 (Adobe colour transform) are needed to decode correctly; every other
// non-image segment (APP1 EXIF/XMP, APP3..APP13, APP15, COM) is dropped.
const JPEG_KEEP = new Set([0xe0, 0xe2, 0xee]);

function stripJpeg(buf: Buffer): Buffer {
  const out: Buffer[] = [buf.subarray(0, 2)];
  let p = 2;
  while (p + 2 <= buf.length) {
    if (buf[p] !== 0xff) return bad('This JPEG file is damaged.');
    const marker = buf[p + 1] as number;
    if (marker === 0xff) {
      p += 1;
      continue;
    }
    if (marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      out.push(buf.subarray(p, p + 2));
      p += 2;
      if (marker === 0xd9) break;
      continue;
    }
    if (p + 4 > buf.length) return bad('This JPEG file is damaged.');
    const len = buf.readUInt16BE(p + 2);
    if (len < 2 || p + 2 + len > buf.length) return bad('This JPEG file is damaged.');
    const drop = (marker >= 0xe1 && marker <= 0xef && !JPEG_KEEP.has(marker)) || marker === 0xfe;
    if (!drop) out.push(buf.subarray(p, p + 2 + len));
    p += 2 + len;
    if (marker === 0xda) {
      // Start Of Scan: the entropy-coded data runs to the end of the file (EOI included); copy it untouched.
      out.push(buf.subarray(p));
      return Buffer.concat(out);
    }
  }
  return Buffer.concat(out);
}

const PNG_DROP = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME']);

function stripPng(buf: Buffer): Buffer {
  const out: Buffer[] = [buf.subarray(0, 8)];
  let p = 8;
  let sawEnd = false;
  while (p + 12 <= buf.length) {
    const len = buf.readUInt32BE(p);
    const name = buf.toString('latin1', p + 4, p + 8);
    if (p + 12 + len > buf.length) return bad('This PNG file is damaged.');
    if (!PNG_DROP.has(name)) out.push(buf.subarray(p, p + 12 + len));
    p += 12 + len;
    if (name === 'IEND') {
      sawEnd = true;
      break;
    }
  }
  if (!sawEnd) return bad('This PNG file is damaged.');
  return Buffer.concat(out);
}

function stripWebp(buf: Buffer): Buffer {
  const total = 8 + buf.readUInt32LE(4);
  if (total > buf.length || total < 20) return bad('This WebP file is damaged.');
  const chunks: Buffer[] = [];
  let p = 12;
  while (p + 8 <= total) {
    const name = buf.toString('latin1', p, p + 4);
    const len = buf.readUInt32LE(p + 4);
    const end = p + 8 + len + (len & 1);
    if (end > total + 1) return bad('This WebP file is damaged.');
    let chunk = buf.subarray(p, Math.min(end, buf.length));
    if (name === 'VP8X') {
      chunk = Buffer.from(chunk);
      chunk[8] = (chunk[8] as number) & ~(0x08 | 0x04); // EXIF + XMP flags off
    }
    if (name !== 'EXIF' && name !== 'XMP ') chunks.push(chunk);
    p = end;
  }
  const body = Buffer.concat(chunks);
  const head = Buffer.alloc(12);
  head.write('RIFF', 0, 'latin1');
  head.writeUInt32LE(4 + body.length, 4);
  head.write('WEBP', 8, 'latin1');
  return Buffer.concat([head, body]);
}

// ── Client-supplied placeholders ───────────────────────────────────────────────

export const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const BLUR_RE = /^data:image\/(?:webp|jpeg|png);base64,[A-Za-z0-9+/]{16,2800}={0,2}$/;

export const validColor = (v: unknown): string | null => (typeof v === 'string' && COLOR_RE.test(v) ? v.toLowerCase() : null);
export const validBlur = (v: unknown): string | null => (typeof v === 'string' && BLUR_RE.test(v) ? v : null);
