import { useEffect, useMemo, useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';

/**
 * Shared dismissal logic for every overlay (ADR-034 companion, owner item A6).
 *
 * THE BUG THIS REPLACES: a backdrop that closes on `click` alone also closes when the user presses the
 * pointer INSIDE the card (to select text, to drag a slider, to start a text-field drag) and releases it
 * over the backdrop. Browsers dispatch that `click` on the nearest common ancestor of the press and the
 * release targets, which is the backdrop element, so `event.target === backdrop` looks like a backdrop click.
 *
 * THE RULE: an overlay closes from a backdrop gesture only when the gesture BEGAN on the backdrop itself
 * (pointerdown target is the backdrop element) AND ENDED there (pointerup target and click target are the
 * backdrop element). A gesture that started inside the content, or that ended inside the content, never closes.
 * A `click` with no preceding pointer events at all (keyboard / assistive-technology activation, or a script)
 * is not a drag and is honoured, so it stays accessible.
 *
 * Escape and explicit close buttons are unaffected: they are handled by the overlay itself (native <dialog>
 * `cancel`, a keydown handler, a Close button) and must keep working.
 */
export interface BackdropDismissHandlers {
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => void;
  onClick: (e: ReactMouseEvent<HTMLElement>) => void;
}

interface Gesture {
  startedOnBackdrop: boolean;
  /** null until a pointerup is seen. */
  endedOnBackdrop: boolean | null;
}

/**
 * Handlers to spread onto the backdrop element itself (for a native <dialog> that is the dialog element,
 * whose `::backdrop` and padding report the dialog as the event target; for a custom overlay it is the
 * full-screen scrim element that CONTAINS the card).
 *
 *   const backdrop = useBackdropDismiss(onClose);
 *   <dialog {...backdrop}>…content…</dialog>
 */
export function useBackdropDismiss(onDismiss: () => void, enabled = true): BackdropDismissHandlers {
  const gesture = useRef<Gesture | null>(null);
  const latest = useRef({ onDismiss, enabled });
  latest.current = { onDismiss, enabled };

  return useMemo<BackdropDismissHandlers>(
    () => ({
      onPointerDown(e) {
        // Only the primary button starts a "click"; a right/middle press must not arm anything.
        if ((e.button ?? 0) !== 0) {
          gesture.current = null;
          return;
        }
        gesture.current = { startedOnBackdrop: e.target === e.currentTarget, endedOnBackdrop: null };
      },
      onPointerUp(e) {
        if (gesture.current) gesture.current.endedOnBackdrop = e.target === e.currentTarget;
      },
      onPointerCancel() {
        gesture.current = null;
      },
      onClick(e) {
        const g = gesture.current;
        gesture.current = null; // one gesture, one decision: a stale press never leaks into the next click
        if (!latest.current.enabled) return;
        if (e.target !== e.currentTarget) return; // a click on the content (or any descendant)
        if (g !== null && (!g.startedOnBackdrop || g.endedOnBackdrop === false)) return; // began or ended inside
        latest.current.onDismiss();
      },
    }),
    [],
  );
}

/**
 * For non-modal popovers and menus (user menu, location switcher, notifications): dismiss when a pointer
 * goes DOWN outside the given elements. A press that starts inside (text selection, scrollbar drag) and
 * ends outside never dismisses, because only the press origin is considered.
 */
export function useOutsideDismiss(open: boolean, refs: Array<RefObject<HTMLElement | null>>, onDismiss: () => void): void {
  const latest = useRef({ refs, onDismiss });
  latest.current = { refs, onDismiss };

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (target && latest.current.refs.some((r) => r.current?.contains(target))) return;
      latest.current.onDismiss();
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);
}
