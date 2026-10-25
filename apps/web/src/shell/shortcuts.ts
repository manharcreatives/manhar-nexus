/**
 * Keyboard shortcut matching (pure, framework-free). A binding is a sequence of
 * tokens: plain keys ("g", "t", "?", "/") or modifier chords ("mod+k", where
 * mod is Ctrl or Cmd). Sequences such as "g t" must be typed within a timeout.
 */

export interface ShortcutBinding<Id extends string = string> {
  id: Id;
  sequence: readonly string[];
  /** Chords like mod+k may fire while focus is in a text field; plain keys never do. */
  allowWhileTyping?: boolean;
}

export interface KeyLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}

const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'AltGraph', 'Fn', 'OS']);

/** Turn a keyboard event into a token, or null for keys that never take part in shortcuts. */
export function toToken(e: KeyLike): string | null {
  if (!e.key || MODIFIER_KEYS.has(e.key)) return null;
  if (e.altKey) return null; // Alt combos are reserved for text input (e.g. AltGr layouts)
  if (e.ctrlKey || e.metaKey) return `mod+${e.key.toLowerCase()}`;
  // Shift is already reflected in e.key ("?" rather than "/"); letters are matched case-insensitively.
  return e.key.length === 1 ? e.key.toLowerCase() : e.key;
}

export interface FeedResult<Id extends string> {
  match: ShortcutBinding<Id> | null;
  /** True when the keys so far are the start of a longer binding. */
  pending: boolean;
}

export interface ShortcutMatcher<Id extends string> {
  feed: (token: string, now: number) => FeedResult<Id>;
  reset: () => void;
}

const equals = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
const startsWith = (seq: readonly string[], prefix: readonly string[]) =>
  seq.length > prefix.length && prefix.every((x, i) => seq[i] === x);

export function createShortcutMatcher<Id extends string>(
  bindings: readonly ShortcutBinding<Id>[],
  timeoutMs = 1200,
): ShortcutMatcher<Id> {
  let buffer: string[] = [];
  let last = -Infinity;

  const attempt = (keys: string[]): FeedResult<Id> => {
    const match = bindings.find((b) => equals(b.sequence, keys)) ?? null;
    if (match) return { match, pending: false };
    return { match: null, pending: bindings.some((b) => startsWith(b.sequence, keys)) };
  };

  return {
    feed(token, now) {
      if (now - last > timeoutMs) buffer = [];
      last = now;
      buffer.push(token);
      let result = attempt(buffer);
      // A dead end: start over from this key alone (so "x g t" still triggers "g t").
      if (!result.match && !result.pending && buffer.length > 1) {
        buffer = [token];
        result = attempt(buffer);
      }
      if (result.match || !result.pending) buffer = [];
      return result;
    },
    reset() {
      buffer = [];
    },
  };
}

/** True when keystrokes should go to a text field rather than to shortcuts. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).closest !== 'function') return false;
  const el = target as HTMLElement;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (el as HTMLInputElement).type;
    return !['button', 'checkbox', 'radio', 'submit', 'reset', 'range', 'color', 'file', 'image'].includes(type);
  }
  return false;
}

export function isMacLike(): boolean {
  if (typeof navigator === 'undefined') return false;
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform ?? '';
  return /mac|iphone|ipad|ipod/i.test(platform);
}

/** Display label for the primary modifier key. */
export function modKeyLabel(): string {
  return isMacLike() ? '⌘' : 'Ctrl';
}
