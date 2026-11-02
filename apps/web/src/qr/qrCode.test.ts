import { describe, expect, it } from 'vitest';
import { fileSlug, isLocalOrigin, menuUrl, qrGeometry, qrSvgString, tableMenuUrl } from './qrCode';

describe('menuUrl', () => {
  it('joins origin and token under /m/', () => {
    expect(menuUrl('abc123', 'https://nexus.example.com')).toBe('https://nexus.example.com/m/abc123');
    expect(menuUrl('abc123', 'https://nexus.example.com/')).toBe('https://nexus.example.com/m/abc123');
  });
  it('percent-encodes anything that is not url safe, so a token can never break out of the path', () => {
    expect(menuUrl('a/b?c#d', 'https://x.test')).toBe('https://x.test/m/a%2Fb%3Fc%23d');
  });
  it('flags loopback origins that a guest phone could not open', () => {
    expect(isLocalOrigin('http://localhost:5173')).toBe(true);
    expect(isLocalOrigin('http://127.0.0.1:5173')).toBe(true);
    expect(isLocalOrigin('https://nexus.example.com')).toBe(false);
  });
});

describe('qrGeometry', () => {
  const url = 'https://nexus.example.com/m/Xk3pQ9vL2mTz7RwB1nHcY8dFaE4sJ6uG0iOqV5tZ';
  it('is deterministic and square with the quiet zone included', () => {
    const a = qrGeometry(url);
    const b = qrGeometry(url);
    expect(a.path).toBe(b.path);
    expect(a.size).toBe(a.modules + 8);
    expect(a.data.length).toBe(a.modules * a.modules);
    expect(a.path.startsWith('M')).toBe(true);
  });
  it('finder patterns are present in three corners', () => {
    const { modules, data } = qrGeometry(url);
    const at = (x: number, y: number) => data[y * modules + x];
    for (const [cx, cy] of [[0, 0], [modules - 7, 0], [0, modules - 7]]) {
      expect(at(cx, cy)).toBe(1);
      expect(at(cx + 6, cy + 6)).toBe(1);
      expect(at(cx + 3, cy + 3)).toBe(1);
      expect(at(cx + 1, cy + 1)).toBe(0);
    }
    expect(at(modules - 1, modules - 1)).toBeDefined();
  });
  it('longer text yields a denser code', () => {
    expect(qrGeometry(url + '/x'.repeat(40)).modules).toBeGreaterThan(qrGeometry('a').modules);
  });
});

describe('qrSvgString', () => {
  it('is a standalone dark-on-light svg with an escaped accessible label', () => {
    const svg = qrSvgString('https://x.test/m/t', 'Table "T<4>"');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('fill="#ffffff"');
    expect(svg).toContain('fill="#0b0f0e"');
    expect(svg).toContain('aria-label="Table &quot;T&lt;4&gt;&quot;"');
    expect(svg).not.toContain('<4>');
  });
});

describe('fileSlug', () => {
  it('makes file safe names', () => {
    expect(fileSlug('T 4/b')).toBe('T-4-b');
    expect(fileSlug('  ')).toBe('table');
  });
});

describe('tableMenuUrl', () => {
  it('prefers the absolute url the API knows (QR_PUBLIC_BASE_URL)', () => {
    expect(tableMenuUrl({ token: 'abc', url: 'https://menu.example.com/m/abc' }, 'http://localhost:5173')).toBe('https://menu.example.com/m/abc');
  });
  it('otherwise builds /m/<token> on the page origin', () => {
    expect(tableMenuUrl({ token: 'abc', url: null }, 'https://nexus.example.com')).toBe('https://nexus.example.com/m/abc');
  });
});
