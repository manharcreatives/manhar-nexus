import { useEffect, useRef } from 'react';
import { createShortcutMatcher, isTypingTarget, toToken, type ShortcutBinding } from './shortcuts';

/**
 * Window-level shortcuts. Plain keys never fire while the user is typing; no
 * shortcut fires while any modal <dialog> is open or while focus is inside a
 * menu/listbox (those own their keys). Handlers are read through a ref, so
 * callers may pass fresh closures each render.
 */
export function useGlobalShortcuts(bindings: ShortcutBinding[], onShortcut: (id: string) => void): void {
  const handler = useRef(onShortcut);
  handler.current = onShortcut;
  const signature = bindings.map((b) => `${b.id}=${b.sequence.join(' ')}${b.allowWhileTyping ? '*' : ''}`).join('|');

  useEffect(() => {
    const matcher = createShortcutMatcher(bindings);
    const typingSafe = bindings.filter((b) => b.allowWhileTyping);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || e.repeat) return;
      const token = toToken(e);
      if (!token) return;
      if (document.querySelector('dialog[open]')) {
        matcher.reset();
        return;
      }
      const target = e.target as Element | null;
      if (target && typeof target.closest === 'function' && target.closest('[role="menu"],[role="listbox"]')) return;

      if (isTypingTarget(e.target)) {
        matcher.reset();
        const chord = typingSafe.find((b) => b.sequence.length === 1 && b.sequence[0] === token);
        if (chord) {
          e.preventDefault();
          handler.current(chord.id);
        }
        return;
      }

      const { match } = matcher.feed(token, performance.now());
      if (match) {
        e.preventDefault();
        handler.current(match.id);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // Re-bind only when the set of bindings actually changes.
  }, [signature]);
}
