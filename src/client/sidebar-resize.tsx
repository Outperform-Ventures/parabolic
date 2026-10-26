import React, { useEffect, useRef, useState } from 'react';
import { normalizeSidebarLayout, sidebarDragLayout, sidebarMaxWidth, SIDEBAR_MAX_WIDTH, SIDEBAR_MIN_WIDTH, type SidebarLayout } from './sidebar-layout';
import './sidebar-resize.css';

function readLayout(key: string): SidebarLayout {
  try { return normalizeSidebarLayout(JSON.parse(localStorage.getItem(key) || 'null')); }
  catch { return normalizeSidebarLayout(null); }
}

export function useSidebarLayout(key: string) {
  const [saved, setSaved] = useState(() => ({ key, layout: readLayout(key) }));
  // Restore the new workspace before its children render, without writing the
  // previous workspace's preferences into the new storage key.
  if (saved.key !== key) setSaved({ key, layout: readLayout(key) });
  const layout = saved.layout;
  const update = (next: SidebarLayout) => {
    const normalized = normalizeSidebarLayout(next);
    setSaved({ key, layout: normalized });
    try { localStorage.setItem(key, JSON.stringify(normalized)); } catch { /* Storage can be unavailable in private windows. */ }
  };
  const setOpen: React.Dispatch<React.SetStateAction<boolean>> = value => {
    const open = typeof value === 'function' ? value(!layout.collapsed) : value;
    update({ ...layout, collapsed: !open });
  };
  return { layout, update, setOpen };
}

type Drag = {
  pointerId: number;
  startX: number;
  startWidth: number;
  available: number;
  previous: SidebarLayout;
  next: SidebarLayout;
  moved: boolean;
  restore: () => void;
};

export function SidebarResizeHandle({ layout, onChange }: {
  layout: SidebarLayout;
  onChange: (layout: SidebarLayout) => void;
}) {
  const handle = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [preview, setPreview] = useState<SidebarLayout | null>(null);
  const [pointerFocus, setPointerFocus] = useState(false);
  const [measuredWidth, setMeasuredWidth] = useState(244);
  const [maximum, setMaximum] = useState(SIDEBAR_MAX_WIDTH);
  const current = preview ?? layout;
  const shell = () => handle.current?.closest<HTMLElement>('.workspace-shell');
  const width = () => shell()?.querySelector<HTMLElement>('.sidebar')?.getBoundingClientRect().width ?? measuredWidth;

  useEffect(() => {
    const root = shell();
    if (!root) return;
    const observer = new ResizeObserver(() => {
      setMeasuredWidth(width());
      setMaximum(sidebarMaxWidth(root.clientWidth));
    });
    observer.observe(root);
    const sidebar = root.querySelector('.sidebar');
    if (sidebar) observer.observe(sidebar);
    return () => observer.disconnect();
  }, []);

  const finish = (commit: boolean) => {
    const active = drag.current;
    if (!active) return;
    drag.current = null;
    active.restore();
    setPreview(null);
    if (handle.current?.hasPointerCapture(active.pointerId)) handle.current.releasePointerCapture(active.pointerId);
    if (commit && active.moved) onChange(active.next);
  };
  useEffect(() => () => {
    drag.current?.restore();
    drag.current = null;
  }, []);

  const move = (clientX: number) => {
    const active = drag.current, root = shell();
    if (!active || !root) return;
    if (Math.abs(clientX - active.startX) > 3) active.moved = true;
    if (!active.moved) return;
    active.next = sidebarDragLayout(active.startWidth + clientX - active.startX, active.available, active.previous);
    // Update just the layout during dragging, not the entire issue tree. Persist
    // once on release; cancel/lost capture restores the exact previous layout.
    root.style.setProperty('--sidebar-preview-width', `${active.next.collapsed ? 0 : active.next.width}px`);
    root.dataset.sidebarPreviewCollapsed = String(active.next.collapsed);
    setPreview(active.next);
  };

  return <div ref={handle} className="sidebar-resize-handle" data-resize-handle data-pointer-focus={pointerFocus || undefined}
    role="separator" tabIndex={0} aria-label="Resize sidebar" aria-orientation="vertical"
    aria-controls="workspace-sidebar" aria-valuemin={0} aria-valuemax={maximum}
    aria-valuenow={current.collapsed ? 0 : Math.round(measuredWidth)}
    aria-valuetext={current.collapsed ? 'Collapsed' : `${Math.round(measuredWidth)} pixels`}
    aria-description="Drag to resize. Drag left to collapse. Use arrow keys to resize or Enter to toggle. Double-click to reset the width."
    onPointerDown={event => {
      if (event.button !== 0 || !event.isPrimary || drag.current) return;
      const root = shell();
      if (!root) return;
      event.preventDefault();
      setPointerFocus(true);
      event.currentTarget.focus();
      const cancelKey = (key: KeyboardEvent) => {
        if (key.key !== 'Escape') return;
        key.preventDefault(); key.stopImmediatePropagation(); finish(false);
      };
      const cancelBlur = () => finish(false);
      drag.current = {
        pointerId: event.pointerId, startX: event.clientX,
        startWidth: layout.collapsed ? 0 : width(), available: root.clientWidth,
        previous: layout, next: layout, moved: false,
        restore: () => {
          root.style.removeProperty('--sidebar-preview-width');
          delete root.dataset.sidebarPreviewCollapsed;
          document.body.classList.remove('sidebar-is-resizing');
          window.removeEventListener('keydown', cancelKey, true);
          window.removeEventListener('blur', cancelBlur);
        },
      };
      document.body.classList.add('sidebar-is-resizing');
      window.addEventListener('keydown', cancelKey, true);
      window.addEventListener('blur', cancelBlur);
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={event => { if (event.pointerId === drag.current?.pointerId) move(event.clientX); }}
    onPointerUp={event => { if (event.pointerId === drag.current?.pointerId) { move(event.clientX); finish(true); } }}
    onPointerCancel={() => finish(false)} onLostPointerCapture={() => finish(false)}
    onBlur={() => setPointerFocus(false)}
    onDoubleClick={() => onChange({ width: null, collapsed: false })}
    onKeyDown={event => {
      if (drag.current || !['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', ' '].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      setPointerFocus(false);
      if (event.key === 'Enter' || event.key === ' ') onChange({ ...layout, collapsed: !layout.collapsed });
      else if (event.key === 'Home') onChange({ ...layout, collapsed: true });
      else if (event.key === 'End') onChange({ width: maximum, collapsed: false });
      else {
        const nextWidth = layout.collapsed ? (layout.width ?? 244) : width() + (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 40 : 16);
        if (event.key === 'ArrowLeft' && (layout.collapsed || nextWidth < SIDEBAR_MIN_WIDTH)) onChange({ ...layout, collapsed: true });
        else onChange(sidebarDragLayout(nextWidth, shell()?.clientWidth ?? window.innerWidth, layout));
      }
    }}
  />;
}
