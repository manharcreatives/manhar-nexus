import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('QR_MOCK can never be on in a production build', () => {
  it('is off in production even when VITE_QR_MOCK=1 is set', async () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_QR_MOCK', '1');
    vi.resetModules();
    const mod = await import('./api');
    expect(mod.QR_MOCK).toBe(false);
  });
  it('is on in dev / test only when explicitly requested', async () => {
    vi.stubEnv('PROD', false);
    vi.stubEnv('VITE_QR_MOCK', '1');
    vi.resetModules();
    expect((await import('./api')).QR_MOCK).toBe(true);
    vi.stubEnv('VITE_QR_MOCK', '');
    vi.resetModules();
    expect((await import('./api')).QR_MOCK).toBe(false);
  });
  it('the mock module refuses to load in production', async () => {
    vi.stubEnv('PROD', true);
    vi.resetModules();
    await expect(import('./mock')).rejects.toThrow(/production/);
  });
});
