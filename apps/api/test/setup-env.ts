// Runs once before EACH e2e test file's module loads (jest `setupFiles`), so a
// value set by one spec can't bleed into another. Individual specs may override
// after this (e.g. the rate-limit spec lowers AUTH_RATE_LIMIT at its module top).
process.env.AUTH_RATE_LIMIT = '100000';
process.env.AUTH_RATE_TTL_MS = '60000';
