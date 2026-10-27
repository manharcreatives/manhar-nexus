import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import i18n from './index';

/**
 * Every literal translation key used in the source (t('a.b.c'), i18nKey="a.b.c")
 * must resolve; a missing key renders the raw key to users ("home.foo").
 * Template-literal / computed keys cannot be checked statically and are skipped.
 */
const SRC = resolve(__dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

describe('i18n keys', () => {
  it('every literal key used by the app exists in the merged English resources', () => {
    const re = /\bt\(\s*['"]([A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)+)['"]/g;
    const missing: string[] = [];
    for (const file of walk(SRC)) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(re)) {
        const key = m[1];
        // plural/context suffixed keys resolve through i18next, so use its own lookup
        if (!i18n.exists(key) && !i18n.exists(key, { count: 2 })) missing.push(`${file.slice(SRC.length + 1)}: ${key}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
