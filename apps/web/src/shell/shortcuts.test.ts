import { describe, expect, it } from 'vitest';
import { createShortcutMatcher, isTypingTarget, toToken, type ShortcutBinding } from './shortcuts';

const bindings: ShortcutBinding[] = [
  { id: 'palette', sequence: ['mod+k'], allowWhileTyping: true },
  { id: 'palette', sequence: ['/'] },
  { id: 'help', sequence: ['?'] },
  { id: 'go:/tables', sequence: ['g', 't'] },
  { id: 'go:/kitchen', sequence: ['g', 'k'] },
];

describe('toToken', () => {
  it('maps plain keys, case-insensitively', () => {
    expect(toToken({ key: 'g' })).toBe('g');
    expect(toToken({ key: 'G', shiftKey: true })).toBe('g');
    expect(toToken({ key: '?', shiftKey: true })).toBe('?');
  });
  it('maps Ctrl and Cmd chords to mod+', () => {
    expect(toToken({ key: 'k', ctrlKey: true })).toBe('mod+k');
    expect(toToken({ key: 'K', metaKey: true })).toBe('mod+k');
  });
  it('ignores bare modifiers and Alt combos', () => {
    expect(toToken({ key: 'Shift', shiftKey: true })).toBeNull();
    expect(toToken({ key: 'Control', ctrlKey: true })).toBeNull();
    expect(toToken({ key: 'g', altKey: true })).toBeNull();
  });
});

describe('createShortcutMatcher', () => {
  it('matches single-key and chord bindings', () => {
    const m = createShortcutMatcher(bindings);
    expect(m.feed('?', 0).match?.id).toBe('help');
    expect(m.feed('mod+k', 10).match?.id).toBe('palette');
    expect(m.feed('/', 20).match?.id).toBe('palette');
  });

  it('matches a two-key sequence within the timeout', () => {
    const m = createShortcutMatcher(bindings, 1000);
    const first = m.feed('g', 0);
    expect(first.match).toBeNull();
    expect(first.pending).toBe(true);
    expect(m.feed('t', 500).match?.id).toBe('go:/tables');
  });

  it('drops a sequence after the timeout', () => {
    const m = createShortcutMatcher(bindings, 1000);
    m.feed('g', 0);
    expect(m.feed('t', 1500).match).toBeNull();
  });

  it('restarts after a dead end so a later sequence still works', () => {
    const m = createShortcutMatcher(bindings);
    m.feed('x', 0);
    m.feed('g', 10);
    expect(m.feed('k', 20).match?.id).toBe('go:/kitchen');
    // "g g k": the second g restarts the sequence
    m.feed('g', 30);
    m.feed('g', 40);
    expect(m.feed('k', 50).match?.id).toBe('go:/kitchen');
  });

  it('does not fire the second key alone', () => {
    const m = createShortcutMatcher(bindings);
    expect(m.feed('t', 0).match).toBeNull();
    expect(m.feed('t', 0).pending).toBe(false);
  });

  it('reset clears a pending sequence', () => {
    const m = createShortcutMatcher(bindings);
    m.feed('g', 0);
    m.reset();
    expect(m.feed('t', 10).match).toBeNull();
  });
});

describe('isTypingTarget', () => {
  it('detects text fields and editable content', () => {
    const input = document.createElement('input');
    expect(isTypingTarget(input)).toBe(true);
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    expect(isTypingTarget(checkbox)).toBe(false);
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true);
    expect(isTypingTarget(document.createElement('select'))).toBe(true);
    const div = document.createElement('div');
    div.contentEditable = 'true';
    // jsdom does not compute isContentEditable; emulate the browser
    Object.defineProperty(div, 'isContentEditable', { value: true });
    expect(isTypingTarget(div)).toBe(true);
    expect(isTypingTarget(document.createElement('button'))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
