import React, { useEffect, useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';
import { moveSection } from './section-order';
import './section-reorder.css';

export const SECTION_DRAG_TYPE = 'application/x-parabolic-section';
type Target = { field: string; id: string };

/** Separate payload and handlers from issue/project dragging: reordering is presentation only. */
export function useSectionReorder(scope: string, groups: Record<string, string[]>, onOrder: (field: string, ids: string[]) => void) {
  const source = useRef<Target | null>(null);
  const [dragging, setDragging] = useState<Target | null>(null);
  const [drop, setDrop] = useState<(Target & { edge: 'before' | 'after' }) | null>(null);
  const clear = () => { source.current = null; setDragging(null); setDrop(null); };
  useEffect(() => {
    clear();
    const cancel = (event: KeyboardEvent) => { if (event.key === 'Escape') clear(); };
    window.addEventListener('dragend', clear);
    window.addEventListener('drop', clear);
    window.addEventListener('blur', clear);
    window.addEventListener('keydown', cancel, true);
    return () => {
      window.removeEventListener('dragend', clear);
      window.removeEventListener('drop', clear);
      window.removeEventListener('blur', clear);
      window.removeEventListener('keydown', cancel, true);
    };
  }, [scope]);
  const matches = (target: Target | null, field: string, id: string) => target?.field === field && target.id === id;
  const headerProps = (field: string, id: string, horizontal = false, onItemDrop?: (event: React.DragEvent<HTMLElement>) => void) => ({
    draggable: (groups[field]?.length ?? 0) > 1,
    'data-section-id': id,
    'data-section-field': field,
    'data-section-axis': horizontal ? 'horizontal' : 'vertical',
    'data-section-dragging': matches(dragging, field, id) || undefined,
    'data-section-drop': matches(drop, field, id) ? drop?.edge : undefined,
    onDragStart(event: React.DragEvent<HTMLElement>) {
      const control = (event.target as HTMLElement).closest('button,a,input,select,textarea');
      if (control && !control.classList.contains('section-reorder-handle')) { event.preventDefault(); return; }
      event.stopPropagation();
      source.current = { field, id };
      setDragging({ field, id });
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData(SECTION_DRAG_TYPE, JSON.stringify({ scope, field, id }));
      event.dataTransfer.setDragImage(event.currentTarget, 24, 16);
    },
    onDragOver(event: React.DragEvent<HTMLElement>) {
      if (!event.dataTransfer.types.includes(SECTION_DRAG_TYPE)) {
        if (onItemDrop) event.preventDefault();
        return;
      }
      event.preventDefault();
      if (source.current?.field !== field) { event.dataTransfer.dropEffect = 'none'; setDrop(null); return; }
      event.dataTransfer.dropEffect = 'move';
      const box = event.currentTarget.getBoundingClientRect();
      const before = horizontal ? event.clientX < box.left + box.width / 2 : event.clientY < box.top + box.height / 2;
      setDrop({ field, id, edge: before ? 'before' : 'after' });
      // Bubble so the scrolling container can auto-scroll at its edges.
    },
    onDragLeave(event: React.DragEvent<HTMLElement>) {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDrop(null);
    },
    onDrop(event: React.DragEvent<HTMLElement>) {
      if (!event.dataTransfer.types.includes(SECTION_DRAG_TYPE)) { onItemDrop?.(event); return; }
      event.preventDefault();
      event.stopPropagation();
      try {
        const payload = JSON.parse(event.dataTransfer.getData(SECTION_DRAG_TYPE));
        if (payload.scope === scope && payload.field === field && matches(source.current, field, payload.id)) {
          const box = event.currentTarget.getBoundingClientRect();
          const before = horizontal ? event.clientX < box.left + box.width / 2 : event.clientY < box.top + box.height / 2;
          onOrder(field, moveSection(groups[field] || [], payload.id, id, before ? 'before' : 'after'));
        }
      } catch { /* Ignore foreign or malformed payloads. */ }
      clear();
    },
    onDragEnd: clear,
  });
  const handle = (field: string, id: string, name: string, kind = 'section') => (groups[field]?.length ?? 0) > 1 ? (
    <button type="button" className="section-reorder-handle" draggable
      aria-label={`Reorder ${name} ${kind}`}
      aria-description="Drag to reorder. Or use Alt/Option and arrow keys."
      onClick={event => event.stopPropagation()}
      onKeyDown={event => {
        if (!event.altKey || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        const ids = groups[field] || [], backwards = ['ArrowUp', 'ArrowLeft'].includes(event.key);
        const target = ids[ids.indexOf(id) + (backwards ? -1 : 1)];
        if (target) onOrder(field, moveSection(ids, id, target, backwards ? 'before' : 'after'));
      }}><GripVertical size={14} /></button>
  ) : null;
  return { headerProps, handle };
}
