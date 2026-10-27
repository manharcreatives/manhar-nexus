import { describe, expect, it } from 'vitest';
import { createSseParser } from './sse';

describe('createSseParser', () => {
  it('parses a complete event', () => {
    const p = createSseParser();
    expect(p.push('event: change\ndata: {"topic":"orders"}\n\n')).toEqual([{ event: 'change', data: '{"topic":"orders"}' }]);
  });

  it('reassembles events split at arbitrary chunk boundaries', () => {
    const p = createSseParser();
    const wire = 'event: hello\ndata: {"a":1}\n\nevent: change\ndata: {"b":2}\n\n';
    const out = [];
    for (const ch of wire) out.push(...p.push(ch));
    expect(out).toEqual([
      { event: 'hello', data: '{"a":1}' },
      { event: 'change', data: '{"b":2}' },
    ]);
  });

  it('accepts CRLF, including a CRLF split across chunks, and bare CR', () => {
    const p = createSseParser();
    expect(p.push('event: a\r\ndata: 1\r')).toEqual([]);
    expect(p.push('\n\r\n')).toEqual([{ event: 'a', data: '1' }]);
    expect(p.push('event: b\rdata: 2\r\r')).toEqual([{ event: 'b', data: '2' }]);
  });

  it('ignores comments (keep-alive pings) and emits nothing for them', () => {
    const p = createSseParser();
    expect(p.push(': ping\n\n')).toEqual([]);
    expect(p.push(': ping\nevent: change\ndata: x\n\n')).toEqual([{ event: 'change', data: 'x' }]);
  });

  it('joins multi-line data with newlines and strips one leading space only', () => {
    const p = createSseParser();
    expect(p.push('data: one\ndata:  two\ndata:three\n\n')).toEqual([{ event: 'message', data: 'one\n two\nthree' }]);
  });

  it('returns several events from one chunk and keeps a trailing partial for later', () => {
    const p = createSseParser();
    expect(p.push('event: a\ndata: 1\n\nevent: b\ndata: 2\n\nevent: c\nda')).toHaveLength(2);
    expect(p.push('ta: 3\n\n')).toEqual([{ event: 'c', data: '3' }]);
  });

  it('strips a leading byte order mark', () => {
    const p = createSseParser();
    expect(p.push('﻿event: hello\ndata: {}\n\n')).toEqual([{ event: 'hello', data: '{}' }]);
  });
});
