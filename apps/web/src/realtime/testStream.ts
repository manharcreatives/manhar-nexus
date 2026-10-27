import { vi } from 'vitest';

/** A controllable fake SSE response body for client/provider tests. */
export function mockStream() {
  const enc = new TextEncoder();
  let ctl!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      ctl = c;
    },
  });
  return {
    response: { status: 200, ok: true, body } as unknown as Response,
    send: (text: string) => ctl.enqueue(enc.encode(text)),
    close: () => ctl.close(),
  };
}

export function failure(status: number): { response: Response } {
  return { response: { status, ok: false, body: null } as unknown as Response };
}

export const frame = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
export const hello = () => frame('hello', { serverTime: new Date().toISOString(), heartbeatSeconds: 20 });
export const change = (topic: string, locationId: string | null = null) => frame('change', { topic, locationId, at: new Date().toISOString() });

/** Let pending microtasks (stream reads, promise chains) settle under fake timers. */
export const flush = async (n = 5) => {
  for (let i = 0; i < n; i++) await vi.advanceTimersByTimeAsync(0);
};
