import { Injectable, Logger } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { mkdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Readable } from 'node:stream';
import { mediaDir } from '../guestmenu.config';
import { MediaUnavailableError } from '../guestmenu.errors';

/** `<40 hex sha1>[-<width>].<ext>` — the only file names the store accepts or serves. */
export const MEDIA_FILE_RE = /^[0-9a-f]{40}(?:-\d{3,4})?\.(?:webp|jpg|png)$/;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface StoredFile {
  stream: Readable;
  size: number;
}

/**
 * Pluggable picture storage (ADR-035). Files are content-addressed (name = sha1 of the bytes), so storing the same
 * bytes twice is a no-op and every URL is immutable (long-cache). A Postgres-bytea or object-storage adapter only has
 * to implement this interface and be provided under IMAGE_STORE.
 */
export interface ImageStore {
  /** False when no storage location is configured (uploads answer 503). */
  readonly available: boolean;
  put(businessId: string, file: string, data: Buffer): Promise<void>;
  open(businessId: string, file: string): Promise<StoredFile | null>;
  remove(businessId: string, file: string): Promise<void>;
}

export const IMAGE_STORE = Symbol('IMAGE_STORE');

/** Local-disk store under MEDIA_DIR (a Docker volume in production). */
@Injectable()
export class LocalDiskImageStore implements ImageStore {
  private readonly log = new Logger(LocalDiskImageStore.name);

  get available(): boolean {
    return mediaDir() !== null;
  }

  private path(businessId: string, file: string): string {
    const root = mediaDir();
    if (!root) throw new MediaUnavailableError('Picture uploads are not configured on this server (MEDIA_DIR).');
    if (!UUID_RE.test(businessId) || !MEDIA_FILE_RE.test(file)) throw new Error('invalid media path');
    return join(root, businessId, file);
  }

  async put(businessId: string, file: string, data: Buffer): Promise<void> {
    const target = this.path(businessId, file);
    try {
      const st = await stat(target);
      if (st.size === data.length) return; // content-addressed: same name = same bytes
    } catch {
      /* not there yet */
    }
    await mkdir(dirname(target), { recursive: true });
    const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, data, { mode: 0o644 });
    await rename(tmp, target);
  }

  async open(businessId: string, file: string): Promise<StoredFile | null> {
    if (!UUID_RE.test(businessId) || !MEDIA_FILE_RE.test(file) || !this.available) return null;
    const target = this.path(businessId, file);
    try {
      const st = await stat(target);
      if (!st.isFile()) return null;
      return { stream: createReadStream(target), size: st.size };
    } catch {
      return null;
    }
  }

  async remove(businessId: string, file: string): Promise<void> {
    try {
      await unlink(this.path(businessId, file));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') this.log.warn(`could not remove ${file}: ${(err as Error).message}`);
    }
  }
}
