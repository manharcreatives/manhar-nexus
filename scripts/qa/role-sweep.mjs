#!/usr/bin/env node
/**
 * DEV-ONLY role sweep. Logs in as every role in a fresh headless-Edge context,
 * visits every nav page plus restricted deep links at desktop and phone width
 * (client-side navigation, no reloads), and records console errors/warnings,
 * page errors, HTTP >= 400, visible alerts, raw i18n keys and axe-core
 * violations. Writes JSON + screenshots to NX_OUT (default scripts/qa/out).
 *
 * Setup:  cd scripts/qa && npm i
 * Run:    NX_OWNER_PASSWORD=... NX_CASHIER_PASSWORD=... node role-sweep.mjs [--roles owner,waiter] [--explore]
 *
 * Config (env, no secrets in this file):
 *   NX_WEB_URL (http://localhost:5173)  NX_API_URL (http://localhost:3000)
 *   NX_EDGE    path to msedge.exe (Windows default used if unset)
 *   NX_<ROLE>_EMAIL / NX_<ROLE>_PASSWORD   ROLE = OWNER CASHIER KITCHEN WAITER PLATFORM
 *   NX_OUT     output dir   NX_SETTLE_MS (1500)   NX_AXE=0 to skip axe
 * Only ever point this at a local/dev stack: it logs in with real credentials.
 */
import puppeteer from 'puppeteer-core';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
// Optional gitignored scripts/qa/.env.local with NX_* lines (never committed).
try {
  for (const line of readFileSync(join(here, '.env.local'), 'utf8').split(/\r?\n/)) {
    const m = /^\s*(NX_[A-Z_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
} catch {
  /* no env file: rely on the environment */
}
const env = process.env;
const WEB = env.NX_WEB_URL ?? 'http://localhost:5173';
const EDGE = env.NX_EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUT = env.NX_OUT ?? join(here, 'out');
const SETTLE = Number(env.NX_SETTLE_MS ?? 1500);
const USE_AXE = env.NX_AXE !== '0';
const axeSource = USE_AXE ? readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8') : '';

const ROLES = {
  owner: { email: 'demo.owner@pilot.nexus', nav: ['/', '/modules', '/config', '/reports', '/team', '/activity', '/tables', '/kitchen', '/bills', '/costs'] },
  cashier: { email: 'demo.cashier@pilot.nexus', nav: ['/', '/tables', '/bills'] },
  kitchen: { email: 'demo.kitchen@pilot.nexus', nav: ['/', '/kitchen'] },
  waiter: { email: 'demo.waiter@pilot.nexus', nav: ['/', '/tables', '/kitchen'] },
  platform: { email: 'platform@manhar.local', nav: ['/', '/commercial', '/onboarding'] },
  // Not seeded by the demo: create these three via Team (or POST /admin/users) before sweeping them.
  manager: { email: 'qa.manager@pilot.nexus', nav: ['/', '/modules', '/config', '/reports', '/team', '/activity', '/tables', '/kitchen', '/bills', '/costs'], optional: true },
  accountant: { email: 'qa.accountant@pilot.nexus', nav: ['/'], optional: true },
  host: { email: 'qa.host@pilot.nexus', nav: ['/', '/tables'], optional: true },
};
const ALL_PATHS = ['/', '/modules', '/config', '/reports', '/team', '/activity', '/tables', '/kitchen', '/bills', '/costs', '/commercial', '/onboarding', '/no-such-page'];
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'phone', width: 390, height: 844, isMobile: true, hasTouch: true },
];
// Namespaces of the i18n tree; a visible token like "home.foo.bar" is a missing key.
const KEY_RE = /\b(?:app|shell|auth|home|modules|config|reports|notifications|activity|commercial|costs|onboarding|charts|people|bills|restaurant|platformHome)\.[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)*\b/g;

const argRoles = process.argv.includes('--roles') ? process.argv[process.argv.indexOf('--roles') + 1].split(',') : Object.keys(ROLES).filter((r) => !ROLES[r].optional);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function creds(role) {
  const R = role.toUpperCase();
  return { email: env[`NX_${R}_EMAIL`] ?? ROLES[role].email, password: env[`NX_${R}_PASSWORD`] };
}

// The API rate-limits /auth/login (AUTH_RATE_LIMIT, default 10 per minute per IP): stay under it.
const loginTimes = [];
async function throttleLogin() {
  const limit = Number(env.NX_LOGINS_PER_MIN ?? 8);
  for (;;) {
    const now = Date.now();
    while (loginTimes.length && now - loginTimes[0] > 61000) loginTimes.shift();
    if (loginTimes.length < limit) break;
    await sleep(61000 - (now - loginTimes[0]));
  }
  loginTimes.push(Date.now());
}

async function login(page, { email, password }) {
  await throttleLogin();
  await page.goto(WEB, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type=email]', { timeout: 15000 });
  await page.type('input[type=email]', email);
  await page.type('input[type=password]', password);
  await page.click('button[type=submit]');
  await page.waitForSelector('nav, [role=navigation], main', { timeout: 20000 });
  await sleep(SETTLE);
}

async function visit(page, path) {
  await page.evaluate((p) => {
    history.pushState({}, '', p);
    dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await sleep(SETTLE);
}

async function snapshot(page) {
  return page.evaluate((keyReSrc) => {
    const text = document.body.innerText;
    const alerts = [...document.querySelectorAll('[role=alert]')].map((e) => e.textContent.trim()).filter(Boolean);
    const rawKeys = [...new Set(text.match(new RegExp(keyReSrc, 'g')) ?? [])];
    const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    const h1 = document.querySelector('h1')?.textContent?.trim() ?? null;
    return { alerts, rawKeys, overflow, h1, bodyHead: text.slice(0, 160).replace(/\s+/g, ' ') };
  }, KEY_RE.source);
}

const SAFE = /(add|new|record|manage|filter|export|verify|refresh|detail|open|edit|view|show|more|tab|alert|setting|categor|expense|summary|today|week|month|shortcut|search|help)/i;
const DANGER = /(delete|remove|suspend|approve|reject|void|refund|deactivate|disable|reset|cancel order|sign out|log ?out|activate|resume|pay|finali|send|close|serve|accept|prepare|ready|save|submit|create|confirm)/i;

/** Clicks every safe-looking tab/button once (dialogs are dismissed with Escape) and returns what it clicked and any alert it surfaced. */
async function explore(page, path) {
  const clicked = [];
  const seen = new Set();
  for (let pass = 0; pass < 25; pass++) {
    const handles = await page.$$('main [role=tab], main button:not([disabled])');
    let did = false;
    for (const h of handles) {
      const label = await h.evaluate((e) => (e.getAttribute('aria-label') || e.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60)).catch(() => '');
      const visible = await h.evaluate((e) => !!(e.offsetWidth || e.offsetHeight)).catch(() => false);
      if (!label || !visible || seen.has(label) || DANGER.test(label) || !SAFE.test(label)) continue;
      seen.add(label);
      await h.click().catch(() => {});
      await sleep(700);
      const alerts = await page.evaluate(() => [...document.querySelectorAll('[role=alert]')].map((e) => e.textContent.trim()).filter(Boolean));
      clicked.push({ label, alerts });
      await page.keyboard.press('Escape');
      await sleep(200);
      if (new URL(page.url()).pathname !== path) await visit(page, path);
      did = true;
      break; // DOM may have changed: re-query
    }
    if (!did) break;
  }
  return clicked;
}

async function sweepRole(browser, role) {
  const results = [];
  for (const vp of VIEWPORTS) {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport(vp);
    let current = 'login';
    const log = new Map();
    const bucket = () => { if (!log.has(current)) log.set(current, { console: [], pageErrors: [], http: [] }); return log.get(current); };
    page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) bucket().console.push(`${m.type()}: ${m.text().slice(0, 300)}`); });
    page.on('pageerror', (e) => bucket().pageErrors.push(String(e.message).slice(0, 300)));
    page.on('response', (r) => { if (r.status() >= 400) bucket().http.push(`${r.status()} ${r.request().method()} ${r.url().replace(/^https?:\/\/[^/]+/, '')}`); });
    try {
      await login(page, creds(role));
    } catch (e) {
      results.push({ role, viewport: vp.name, path: 'login', fatal: String(e.message) });
      await page.screenshot({ path: join(OUT, `${role}-${vp.name}-login-FAIL.png`) }).catch(() => {});
      await ctx.close();
      continue;
    }
    for (const path of [...new Set([...ROLES[role].nav, ...ALL_PATHS])]) {
      current = path;
      bucket();
      await visit(page, path);
      const snap = await snapshot(page);
      let axe = [];
      if (USE_AXE) {
        await page.evaluate(axeSource);
        axe = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ["violations"] })).violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, target: v.nodes.map((n) => n.target.join(" ") + " <" + (n.html || "").slice(0, 90) + ">").join(" | ") })));
      }
      const explored = process.argv.includes('--explore') && ROLES[role].nav.includes(path) ? await explore(page, path) : [];
      const b = bucket();
      const inNav = ROLES[role].nav.includes(path);
      const rec = { role, viewport: vp.name, path, inNav, ...snap, ...b, axe, explored };
      for (const x of explored) for (const a of x.alerts) rec.alerts.push(`after "${x.label}": ${a}`);
      const bad = b.console.length || b.pageErrors.length || b.http.length || snap.alerts.length || snap.rawKeys.length || axe.length || (snap.overflow && vp.name === 'phone');
      if (bad && inNav) await page.screenshot({ path: join(OUT, `${role}-${vp.name}-${path.replace(/\W+/g, '_') || 'home'}.png`) }).catch(() => {});
      results.push(rec);
    }
    await ctx.close();
  }
  return results;
}

mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--no-sandbox'] });
const all = [];
for (const role of argRoles) {
  if (!creds(role).password) { console.error(`skip ${role}: set NX_${role.toUpperCase()}_PASSWORD`); continue; }
  console.error(`sweeping ${role}...`);
  all.push(...(await sweepRole(browser, role)));
}
await browser.close();
writeFileSync(join(OUT, 'sweep.json'), JSON.stringify(all, null, 2));
for (const r of all) {
  if (r.fatal) { console.log(`${r.role}/${r.viewport} LOGIN FAILED ${r.fatal}`); continue; }
  const issues = [
    ...r.console.map((x) => `console ${x}`), ...r.pageErrors.map((x) => `pageerror ${x}`), ...r.http.map((x) => `http ${x}`),
    ...r.alerts.map((x) => `alert "${x.slice(0, 100)}"`), ...r.rawKeys.map((x) => `rawkey ${x}`),
    ...r.axe.map((a) => `axe ${a.id}(${a.impact}) x${a.n} ${a.target}`),
    ...(r.overflow && r.viewport === 'phone' ? ['horizontal-overflow'] : []),
  ];
  console.log(`${r.role}/${r.viewport} ${r.path}${r.inNav ? '' : ' [deep]'}${r.explored?.length ? ` (clicked ${r.explored.length})` : ''} :: ${r.h1 ?? r.bodyHead.slice(0, 50)} :: ${issues.length ? '\n   ' + issues.join('\n   ') : 'ok'}`);
}
