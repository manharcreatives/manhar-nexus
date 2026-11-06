import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface HeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}

const ROOT = join(__dirname, '..', '..', '..', '..');
const vercel = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8')) as { headers: HeaderRule[]; crons: { schedule: string }[] };
const caddy = readFileSync(join(ROOT, 'deploy', 'Caddyfile'), 'utf8');

/** Vercel header sources are path patterns whose groups are regular expressions; anchoring them is how they match. */
const matches = (source: string, path: string): boolean => new RegExp(`^${source}$`).test(path);

function headerValues(path: string, key: string): string[] {
  return vercel.headers
    .filter((rule) => matches(rule.source, path))
    .flatMap((rule) => rule.headers.filter((h) => h.key.toLowerCase() === key.toLowerCase()).map((h) => h.value));
}

const CASHFREE = /cashfree/i;

describe('vercel.json: the Cashfree SDK is allowed only on the AutoPay approval page', () => {
  it.each(['/', '/set-password', '/pay/return', '/login', '/api/public/claim/issue', '/pay/autopay', '/payments/autopay/x'])(
    '%s gets exactly one CSP, and it names no Cashfree origin',
    (path) => {
      const csp = headerValues(path, 'Content-Security-Policy');
      expect(csp).toHaveLength(1);
      expect(csp[0]).not.toMatch(CASHFREE);
      expect(csp[0]).toContain("script-src 'self';");
      expect(csp[0]).toContain("frame-src 'none'");
    },
  );

  it.each(['/pay/autopay/abc', '/pay/autopay/0123456789abcdef'])('%s gets exactly one CSP, and it allows the Cashfree SDK', (path) => {
    const csp = headerValues(path, 'Content-Security-Policy');
    expect(csp).toHaveLength(1);
    expect(csp[0]).toContain('script-src \'self\' https://sdk.cashfree.com');
    expect(csp[0]).toContain('https://payments.cashfree.com');
  });

  it('both policies keep everything else the same (only the Cashfree origins differ)', () => {
    const strip = (csp: string) => csp.replace(/ https:\/\/[a-z-]+\.cashfree\.com/g, '').replace("frame-src 'none'", 'frame-src');
    const strict = headerValues('/', 'Content-Security-Policy')[0] as string;
    const autopay = headerValues('/pay/autopay/abc', 'Content-Security-Policy')[0] as string;
    const norm = (csp: string) => strip(csp).split(';').map((d) => d.trim().replace(/\s+/g, ' ')).filter((d) => d !== 'frame-src').sort();
    expect(norm(autopay)).toEqual(norm(strict));
  });

  it('every path still gets the other security headers', () => {
    for (const path of ['/', '/pay/autopay/abc', '/set-password']) {
      for (const key of ['Strict-Transport-Security', 'X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy', 'Cross-Origin-Opener-Policy']) {
        expect(headerValues(path, key)).toHaveLength(1);
      }
    }
  });

  it('the endpoints that return secrets and tokens are never cacheable at the edge', () => {
    for (const path of ['/api/public/registrations', '/api/public/claim/issue', '/api/public/claim/redeem', '/api/public/payments/pay-link', '/api/public/payments/status']) {
      expect(headerValues(path, 'Cache-Control')).toEqual(['no-store']);
    }
    // The QR menu keeps its own ETag revalidation.
    expect(headerValues('/api/public/menu/abc', 'Cache-Control')).toEqual([]);
  });

  it('the cron schedule is daily, valid on every Vercel plan', () => {
    expect(vercel.crons).toEqual([expect.objectContaining({ schedule: '0 3 * * *' })]);
  });
});

describe('Caddyfile: the same scoping for the self-hosted edge', () => {
  const lines = caddy.split('\n').map((l) => l.trim());

  it('the strict CSP is applied to every path except /pay/autopay/*, and it names no Cashfree origin', () => {
    expect(lines).toContain('@strict not path /pay/autopay/*');
    const strict = lines.find((l) => l.startsWith('header @strict Content-Security-Policy'));
    expect(strict).toBeDefined();
    expect(strict).not.toMatch(CASHFREE);
    expect(strict).toContain("frame-src 'none'");
  });

  it('the Cashfree-aware CSP exists only for /pay/autopay/*', () => {
    expect(lines).toContain('@autopay path /pay/autopay/*');
    const cspLines = lines.filter((l) => /Content-Security-Policy/.test(l) && l.startsWith('header '));
    expect(cspLines).toHaveLength(2);
    expect(cspLines.filter((l) => CASHFREE.test(l)).every((l) => l.startsWith('header @autopay '))).toBe(true);
    expect(lines.some((l) => /^Content-Security-Policy/.test(l))).toBe(false);
  });
});
