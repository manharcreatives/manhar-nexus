import type { NextFunction, Request, Response } from 'express';

/**
 * Public endpoints return one-time secrets and tokens (payer secret, set-password token) and per-visitor answers, so
 * by default nothing under /public/ may be stored by a browser or a shared cache. This only sets a DEFAULT: a
 * controller that sets its own Cache-Control later (the QR menu's ETag revalidation) overrides it.
 */
export function publicNoStore() {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.path.startsWith('/public/') || req.path === '/public') {
      res.setHeader('Cache-Control', 'no-store');
    }
    next();
  };
}
