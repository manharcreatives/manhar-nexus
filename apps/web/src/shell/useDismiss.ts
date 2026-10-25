import { useEffect, useRef, type RefObject } from 'react';

/** Close a popover when the pointer goes down outside of it (and its trigger). */
export function useDismiss(open: boolean, refs: Array<RefObject<HTMLElement | null>>, onDismiss: () => void): void {
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
