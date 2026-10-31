import { createHash } from 'node:crypto';
import { Logger } from '@nestjs/common';
import {
  EXT_BY_KIND,
  assertAcceptableSize,
  inspectImage,
  sniffImage,
  stripMetadata,
  type ImageKind,
} from './image-sanitize';
import { UnsupportedMediaError } from '../guestmenu.errors';

/** One file to store: `file` is the content-addressed name (`<sha1>[-<w>].<ext>`). */
export interface ProcessedFile {
  file: string;
  data: Buffer;
  contentType: string;
}

export interface ProcessedImage {
  main: ProcessedFile;
  /** 480 px variant, only produced when sharp is installed. */
  thumb: ProcessedFile | null;
  /** Server-generated 16 px blur-up data URI (sharp only). */
  blurDataUri: string | null;
  /** Server-computed dominant colour "#rrggbb" (sharp only). */
  color: string | null;
  width: number;
  height: number;
  engine: 'sharp' | 'passthrough';
}

interface SharpLike {
  (input: Buffer, opts?: Record<string, unknown>): SharpInstance;
}
interface SharpInstance {
  rotate(): SharpInstance;
  resize(opts: Record<string, unknown>): SharpInstance;
  webp(opts?: Record<string, unknown>): SharpInstance;
  toBuffer(): Promise<Buffer>;
  stats(): Promise<{ dominant: { r: number; g: number; b: number } }>;
  metadata(): Promise<{ width?: number; height?: number }>;
}

const log = new Logger('ImageProcessing');
let sharpLoaded = false;
let sharpImpl: SharpLike | null = null;

/** `sharp` is an OPTIONAL dependency: used when installed, silently skipped otherwise. */
function loadSharp(): SharpLike | null {
  if (sharpLoaded) return sharpImpl;
  sharpLoaded = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- optional native dependency
    const mod = require('sharp') as SharpLike | { default: SharpLike };
    sharpImpl = typeof mod === 'function' ? mod : mod.default;
  } catch {
    sharpImpl = null;
  }
  return sharpImpl;
}

/** Test seam: forces the pass-through path (or re-detects sharp). */
export function resetSharpForTests(impl: SharpLike | null | undefined): void {
  sharpLoaded = impl !== undefined;
  sharpImpl = impl ?? null;
}

const sha1 = (b: Buffer): string => createHash('sha1').update(b).digest('hex');
const hex = (n: number): string => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');

/**
 * Validates and prepares an upload. Order matters: type and size are checked on the raw bytes BEFORE anything decodes
 * the picture, so a hostile file never reaches the image library.
 */
export async function processUpload(input: Buffer): Promise<ProcessedImage> {
  const kind = sniffImage(input);
  if (!kind) throw new UnsupportedMediaError('Upload a JPEG, PNG or WebP picture.');
  const info = inspectImage(input, kind);
  assertAcceptableSize(info);

  const sharp = loadSharp();
  if (sharp) {
    try {
      return await withSharp(sharp, input, info.width, info.height);
    } catch (err) {
      log.warn(`sharp failed, storing the sanitised original instead: ${(err as Error).message}`);
    }
  }

  // Pass-through: keep the original pixels, drop metadata. A JPEG that relies on an EXIF rotation would show sideways
  // once EXIF is gone and we cannot rotate without a decoder: ask for an upright file instead of storing it wrong.
  if (kind === 'jpeg' && info.orientation !== 1) {
    throw new UnsupportedMediaError('This photo is rotated using hidden camera data. Rotate it in your gallery (or export it as WebP) and upload again.');
  }
  const clean = stripMetadata(input, kind as ImageKind);
  const name = `${sha1(clean)}.${EXT_BY_KIND[kind]}`;
  return {
    main: { file: name, data: clean, contentType: mime(kind) },
    thumb: null,
    blurDataUri: null,
    color: null,
    width: info.width,
    height: info.height,
    engine: 'passthrough',
  };
}

const mime = (k: ImageKind): string => (k === 'jpeg' ? 'image/jpeg' : k === 'png' ? 'image/png' : 'image/webp');

async function withSharp(sharp: SharpLike, input: Buffer, width: number, height: number): Promise<ProcessedImage> {
  const base = { limitInputPixels: 24_000_000, failOn: 'error' };
  const main = await sharp(input, base).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  const thumb = await sharp(input, base).rotate().resize({ width: 480, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
  const tiny = await sharp(input, base).rotate().resize({ width: 16 }).webp({ quality: 40 }).toBuffer();
  const stats = await sharp(input, base).rotate().resize({ width: 64 }).stats();
  const id = sha1(main);
  return {
    main: { file: `${id}.webp`, data: main, contentType: 'image/webp' },
    thumb: { file: `${id}-480.webp`, data: thumb, contentType: 'image/webp' },
    blurDataUri: `data:image/webp;base64,${tiny.toString('base64')}`,
    color: `#${hex(stats.dominant.r)}${hex(stats.dominant.g)}${hex(stats.dominant.b)}`,
    width,
    height,
    engine: 'sharp',
  };
}
