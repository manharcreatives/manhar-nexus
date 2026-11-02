/**
 * Vercel entry function for the NestJS API.
 *
 * Vercel's non-Next bracket catch-all only matches a single path segment, so
 * vercel.json rewrites /api/* here instead. The browser calls /api/* on the
 * same origin; this handler strips the /api prefix before delegating to the
 * Nest Express instance. Keeping web and API on one origin means the httpOnly
 * refresh cookie works without cross-site cookie rules or a second deployment.
 */
const { createApp } = require('../apps/api/dist/app.factory');

let expressPromise;

function getExpressApp() {
  if (!expressPromise) {
    expressPromise = (async () => {
      const app = await createApp();
      // Vercel owns the HTTP listener. init() builds the router/middleware
      // stack but does not bind a port.
      await app.init();
      return app.getHttpAdapter().getInstance();
    })().catch((error) => {
      // Do not cache a failed boot: the next invocation gets a clean retry.
      expressPromise = undefined;
      throw error;
    });
  }
  return expressPromise;
}

function stripApiPrefix(url) {
  if (!url) return '/';
  if (url === '/api') return '/';
  if (url.startsWith('/api/')) return url.slice(4);
  if (url.startsWith('/api?')) return `/${url.slice(4)}`;
  return url;
}

async function handler(req, res) {
  try {
    const expressApp = await getExpressApp();
    const stripped = stripApiPrefix(req.url);
    req.url = stripped;
    req.originalUrl = stripped;
    res.setHeader('Cache-Control', 'no-store');
    expressApp(req, res);
  } catch (error) {
    console.error('[nexus-api] serverless bootstrap failed', error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'API unavailable' } }));
    }
  }
}

module.exports = handler;
// Express/Nest owns body parsing. Vercel's lazy body helper must not consume
// the stream first; externalResolver silences "unresolved request" warnings
// because Express writes the response asynchronously.
module.exports.config = {
  maxDuration: 60,
  api: { bodyParser: false, externalResolver: true },
};
