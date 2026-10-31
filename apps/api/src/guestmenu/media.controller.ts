import { Controller, Get, Header, Inject, Param, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { NotFoundError } from '../common/errors';
import { Public } from '../iam/principal';
import { WINDOW_MS, lim } from './guestmenu.config';
import { IMAGE_STORE, MEDIA_FILE_RE, UUID_RE, type ImageStore } from './image/image-store';
import { RateLimiter, clientIp } from './rate-limiter.service';

const TYPE: Record<string, string> = { webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png' };

/**
 * Serves stored menu pictures, publicly. File names are content hashes, so a URL never changes meaning: the browser may
 * cache it for a year (immutable). Only `<uuid>/<sha1>[-w].(webp|jpg|png)` is ever resolved: no path traversal is possible.
 */
@Public()
@Controller('media')
export class MediaController {
  constructor(
    @Inject(IMAGE_STORE) private readonly store: ImageStore,
    private readonly limiter: RateLimiter,
  ) {}

  @Get(':businessId/:file')
  @Header('X-Content-Type-Options', 'nosniff')
  async serve(@Param('businessId') businessId: string, @Param('file') file: string, @Req() req: Request, @Res() res: Response): Promise<void> {
    this.limiter.enforce(res, [{ key: `media:ip:${clientIp(req)}`, limit: lim('MEDIA_IP'), windowMs: WINDOW_MS }]);
    if (!UUID_RE.test(businessId) || !MEDIA_FILE_RE.test(file)) throw new NotFoundError('Not found');
    const etag = `"${file.replace(/\.[a-z]+$/, '')}"`;
    if ((req.headers['if-none-match'] ?? '').split(',').some((t) => t.trim() === etag)) {
      res.status(304).setHeader('ETag', etag).setHeader('Cache-Control', 'public, max-age=31536000, immutable').end();
      return;
    }
    const stored = await this.store.open(businessId, file);
    if (!stored) throw new NotFoundError('Not found');
    res.status(200);
    res.setHeader('Content-Type', TYPE[file.split('.').pop() as string] ?? 'application/octet-stream');
    res.setHeader('Content-Length', String(stored.size));
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('ETag', etag);
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    stored.stream.on('error', () => res.destroy());
    stored.stream.pipe(res);
  }
}
