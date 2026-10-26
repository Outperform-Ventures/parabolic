import { useLayoutEffect, type RefObject } from 'react';

/** Anchor small field menus to the clicked value and keep them inside the window. */
export function useInlineMenuPosition(open: boolean, anchor: RefObject<HTMLElement | null>, menu: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    if (!open || !menu.current || !anchor.current) return;
    const place = () => {
      if (!menu.current || !anchor.current) return;
      const a = anchor.current.getBoundingClientRect(), m = menu.current.getBoundingClientRect();
      const left = Math.max(8, Math.min(a.left, innerWidth - m.width - 8));
      const below = a.bottom + 4, above = a.top - m.height - 4;
      const top = below + m.height <= innerHeight - 8 ? below : above >= 8 ? above : Math.max(8, innerHeight - m.height - 8);
      Object.assign(menu.current.style, { left: `${Math.round(left)}px`, top: `${Math.round(top)}px` });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(menu.current);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { observer.disconnect(); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open, anchor, menu]);
}
