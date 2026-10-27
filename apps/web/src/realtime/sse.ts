/** One parsed Server-Sent Event. Comment lines (": ping") yield no event. */
export interface SseMessage {
  event: string;
  data: string;
  id?: string;
}

/**
 * Incremental SSE parser. Feed it decoded text in whatever chunk sizes the
 * network delivers; it buffers partial lines, accepts LF / CRLF / CR line
 * endings, joins multi-line `data:` fields with "\n", ignores comments and
 * returns the events completed by each chunk.
 */
export function createSseParser(): { push: (chunk: string) => SseMessage[] } {
  let buffer = '';
  let started = false;
  let event = '';
  let data: string[] = [];
  let id: string | undefined;
  let sawCr = false;

  function dispatch(out: SseMessage[]) {
    if (data.length > 0 || event) {
      out.push({ event: event || 'message', data: data.join('\n'), ...(id !== undefined ? { id } : {}) });
    }
    event = '';
    data = [];
  }

  function line(l: string, out: SseMessage[]) {
    if (l === '') return dispatch(out);
    if (l.startsWith(':')) return;
    const i = l.indexOf(':');
    const field = i === -1 ? l : l.slice(0, i);
    let value = i === -1 ? '' : l.slice(i + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') event = value;
    else if (field === 'data') data.push(value);
    else if (field === 'id') id = value;
  }

  return {
    push(chunk: string): SseMessage[] {
      const out: SseMessage[] = [];
      if (!started) {
        started = true;
        if (chunk.charCodeAt(0) === 0xfeff) chunk = chunk.slice(1);
      }
      // A "\r\n" split across two chunks must not read as two line breaks.
      if (sawCr && chunk.startsWith('\n')) chunk = chunk.slice(1);
      sawCr = false;
      buffer += chunk;
      let start = 0;
      for (let i = 0; i < buffer.length; i++) {
        const c = buffer[i];
        if (c === '\n' || c === '\r') {
          line(buffer.slice(start, i), out);
          if (c === '\r') {
            if (buffer[i + 1] === '\n') i++;
            else if (i + 1 === buffer.length) sawCr = true;
          }
          start = i + 1;
        }
      }
      buffer = buffer.slice(start);
      return out;
    },
  };
}
