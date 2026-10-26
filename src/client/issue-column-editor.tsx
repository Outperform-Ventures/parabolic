import React, { Children, Fragment, isValidElement, useEffect, useId, useRef, useState } from 'react';
import { Icon } from './components/ui';
import { moveIssueColumn, issueColumnGrid, issueColumnDefaultWidth, issueColumnMinWidth, clampIssueColumnWidth, ISSUE_COLUMN_MAX_WIDTH, type IssueColumnWidths, type IssueColumnDefinition } from './issue-column-order';
import './issue-column-editor.css';

export const ISSUE_COLUMN_HEADER_HEIGHT = 40;

// Editing and custom-width lists use explicit slots, including empty cells,
// so every row and its header use exactly the same grid tracks.
export function IssueColumn({ children }: { id: string; children: React.ReactNode }) {
  return <>{children}</>;
}

export function OrderedIssueColumns({ order, visibleFields, children }: { order?: string[]; visibleFields?: string[]; children: React.ReactNode }) {
  if (!order?.length && !visibleFields) return <>{children}</>;
  const cells: React.ReactElement<{ id: string; children: React.ReactNode }>[] = [];
  const visit = (nodes: React.ReactNode) => Children.forEach(nodes, node => {
    if (!isValidElement<{ id: string; children: React.ReactNode }>(node)) return;
    if (node.type === Fragment) visit(node.props.children);
    // The children are logical columns identified by their stable field IDs.
    // Fast Refresh can keep elements from the previous IssueColumn function
    // while refreshing this renderer; comparing function references drops them.
    else if (typeof node.props.id === 'string') cells.push(node);
  });
  visit(children);
  const positions = new Map(order?.map((id, index) => [id, index]));
  const ordered = cells.sort((a, b) => (positions.get(a.props.id) ?? cells.length) - (positions.get(b.props.id) ?? cells.length));
  if (visibleFields) return <>{(order || visibleFields).filter(id => visibleFields.includes(id)).map((id, index) =>
    <div role="cell" aria-colindex={index + 2} className="issue-column-cell" data-column-cell={id} key={id}>{cells.find(cell => cell.props.id === id)?.props.children}</div>
  )}</>;
  return <>{ordered.map(cell => React.cloneElement(cell, { key: cell.props.id }))}</>;
}

export function IssueColumnEditor({ enabled, aligned, fields, visibleFields, order, widths, onWidthsChange, onChange, onVisibilityChange, onCancel, persistence, children }: {
  enabled: boolean;
  aligned: boolean;
  fields: IssueColumnDefinition[];
  visibleFields: string[];
  order: string[];
  widths: IssueColumnWidths;
  onWidthsChange: (widths: IssueColumnWidths) => void;
  onChange: (order: string[]) => void;
  onVisibilityChange: (field: string, visible: boolean) => void;
  onCancel: () => void;
  persistence?: React.ReactNode;
  children: (header: React.ReactNode) => React.ReactNode;
}) {
  const hint = useId();
  const source = useRef<{ id: string; x: number; y: number; active: boolean } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ id: string; edge: 'before' | 'after' } | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const panel = useRef<HTMLElement>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const resize = useRef<{ id: string; x: number; scrollLeft: number; width: number; snapshot: IssueColumnWidths } | null>(null);
  const [previewWidths, setPreviewWidths] = useState<IssueColumnWidths | null>(null);
  const visible = order.filter(id => visibleFields.includes(id));
  const hidden = order.filter(id => !visibleFields.includes(id) && fields.some(([field]) => field === id));
  const label = (id: string) => fields.find(([field]) => field === id)?.[1] || id;
  // Freeze the actual current tracks on the first resize, including the flexible
  // title. Otherwise shrinking an icon column simply grows the title instead of
  // moving the following columns, and closing the editor loses the spacing.
  const measuredWidths = () => ({ ...widths, ...Object.fromEntries(
    Array.from(panel.current?.querySelectorAll<HTMLElement>('[data-column-header]') || [])
      .map(cell => [cell.dataset.columnHeader!, clampIssueColumnWidth(cell.dataset.columnHeader!, cell.getBoundingClientRect().width)]),
  ) });
  const cancelResize = () => { resize.current = null; setPreviewWidths(null); };
  const resizedWidths = (x: number) => {
    const from = resize.current!;
    const scrollLeft = panel.current?.querySelector('.issue-list-scroll')?.scrollLeft || 0;
    return { ...from.snapshot, [from.id]: clampIssueColumnWidth(from.id, from.width + x - from.x + scrollLeft - from.scrollLeft) };
  };
  const commitWidth = (id: string, width: number) => {
    const value = clampIssueColumnWidth(id, width);
    onWidthsChange({ ...measuredWidths(), [id]: value });
    setAnnouncement(`${label(id)} column width ${value} pixels`);
  };
  const setVisible = (id: string, value: boolean) => {
    onVisibilityChange(id, value);
    setAnnouncement(`${label(id)} column ${value ? 'shown' : 'hidden'}`);
    // Hiding removes the active button. Keep keyboard focus inside the panel.
    requestAnimationFrame(() => {
      if (value) Array.from(panel.current?.querySelectorAll<HTMLButtonElement>('[data-column-id]') || []).find(el => el.dataset.columnId === id)?.focus();
      else panel.current?.querySelector<HTMLElement>('summary')?.focus();
    });
  };
  const resetDrag = () => { source.current = null; setDragging(null); setDrop(null); };
  const targetAt = (x: number, y: number) => {
    const chip = document.elementFromPoint(x, y)?.closest<HTMLElement>('.issue-column-chip');
    const target = chip?.querySelector<HTMLButtonElement>('[data-column-id]');
    if (!chip || !target || !panel.current?.contains(chip)) return null;
    const box = chip.getBoundingClientRect();
    return { id: target.dataset.columnId!, edge: x < box.x + box.width / 2 ? 'before' as const : 'after' as const };
  };
  useEffect(() => {
    if (!enabled || !dragging) return;
    let frame = 0;
    const scroll = () => {
      const scroller = panel.current?.querySelector<HTMLElement>('.issue-list-scroll');
      const header = panel.current?.querySelector<HTMLElement>('.issue-column-headers');
      if (scroller && header) {
        const bounds = scroller.getBoundingClientRect(), row = header.getBoundingClientRect();
        const { x, y } = pointer.current;
        if (y >= row.top && y <= row.bottom && x >= bounds.left && x <= bounds.right) {
          const delta = x < bounds.left + 32 ? -12 : x > bounds.right - 32 ? 12 : 0;
          if (delta) { scroller.scrollLeft += delta; setDrop(targetAt(x, y)); }
        }
      }
      frame = requestAnimationFrame(scroll);
    };
    frame = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(frame);
  }, [enabled, dragging]);
  useEffect(() => { if (!enabled) { resetDrag(); cancelResize(); } }, [enabled]);
  const move = (id: string, target: string, edge: 'before' | 'after') => {
    const next = moveIssueColumn(order, id, target, edge);
    onChange(next);
    const position = next.filter(field => visible.includes(field)).indexOf(id) + 1;
    setAnnouncement(`${fields.find(([field]) => field === id)?.[1]} moved to position ${position} of ${visible.length}`);
  };
  const { tracks, minWidth } = issueColumnGrid(visible, previewWidths ?? widths);
  const header = enabled ? <div className="issue-column-headers" role="row" aria-label="Draggable columns">
      <span role="columnheader" aria-label="Selection" />
      {visible.map((id, index) => <div className="issue-column-chip" role="columnheader" aria-colindex={index + 2} data-column-header={id} data-drop-edge={drop?.id === id ? drop.edge : undefined} key={id}>
        <button type="button" draggable={false}
        className="issue-column-handle" data-column-id={id} data-dragging={dragging === id}
        data-drop-edge={drop?.id === id ? drop.edge : undefined}
        aria-label={`${fields.find(([field]) => field === id)?.[1]} column, position ${index + 1} of ${visible.length}`}
        aria-describedby={hint}
        data-tooltip-label={label(id)}
        onPointerDown={event => {
          if (event.button !== 0 || !event.isPrimary) return;
          event.preventDefault(); event.stopPropagation();
          event.currentTarget.focus();
          event.currentTarget.setPointerCapture(event.pointerId);
          source.current = { id, x: event.clientX, y: event.clientY, active: false };
          pointer.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerMove={event => {
          const from = source.current;
          if (!from) return;
          if (!from.active && Math.hypot(event.clientX - from.x, event.clientY - from.y) < 4) return;
          from.active = true;
          pointer.current = { x: event.clientX, y: event.clientY };
          setDragging(from.id); setDrop(targetAt(event.clientX, event.clientY));
        }}
        onPointerUp={event => {
          const from = source.current, target = targetAt(event.clientX, event.clientY);
          if (from?.active && target) move(from.id, target.id, target.edge);
          resetDrag();
        }}
        onPointerCancel={resetDrag}
        onLostPointerCapture={resetDrag}
        onKeyDown={event => {
          if (!event.altKey || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault(); event.stopPropagation();
          const target = event.key === 'Home' ? 0 : event.key === 'End' ? visible.length - 1 : index + (event.key === 'ArrowLeft' ? -1 : 1);
          if (target >= 0 && target < visible.length) {
            const handle = event.currentTarget;
            move(id, visible[target], target < index ? 'before' : 'after');
            requestAnimationFrame(() => handle.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
          }
        }}>
        <Icon name="GripVertical" size={14} /><span>{fields.find(([field]) => field === id)?.[1]}</span>
      </button>
      <button type="button" className="issue-column-visibility" aria-label={`Hide ${label(id)} column`} title={`Hide ${label(id)}`} onClick={() => setVisible(id, false)}>
        <Icon name="Eye" size={14} />
      </button>
      <div className="issue-column-resizer" role="separator" tabIndex={0} aria-orientation="vertical"
        data-column-resize={id} aria-label={`Resize ${label(id)} column`}
        aria-valuemin={issueColumnMinWidth(id)} aria-valuemax={ISSUE_COLUMN_MAX_WIDTH}
        aria-valuenow={(previewWidths ?? widths)[id] ?? issueColumnDefaultWidth(id)}
        aria-valuetext={(previewWidths ?? widths)[id] == null ? 'Automatic width' : `${(previewWidths ?? widths)[id]} pixels`}
        title="Drag to resize · Double-click to reset width" aria-describedby={hint}
        onPointerDown={event => {
          if (event.button !== 0 || !event.isPrimary) return;
          event.preventDefault(); event.stopPropagation(); resetDrag();
          event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId);
          const snapshot = measuredWidths();
          resize.current = { id, x: event.clientX, scrollLeft: panel.current?.querySelector('.issue-list-scroll')?.scrollLeft || 0, width: snapshot[id], snapshot };
        }}
        onPointerMove={event => {
          if (!resize.current) return;
          event.preventDefault(); event.stopPropagation();
          setPreviewWidths(resizedWidths(event.clientX));
        }}
        onPointerUp={event => {
          if (!resize.current) return;
          event.preventDefault(); event.stopPropagation();
          const next = resizedWidths(event.clientX);
          if (next[id] !== resize.current.width) {
            onWidthsChange(next);
            setAnnouncement(`${label(id)} column width ${next[id]} pixels`);
          }
          cancelResize();
        }}
        onPointerCancel={cancelResize} onLostPointerCapture={cancelResize}
        onDoubleClick={event => { event.preventDefault(); event.stopPropagation(); commitWidth(id, issueColumnDefaultWidth(id)); }}
        onKeyDown={event => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault(); event.stopPropagation();
          const current = event.currentTarget.parentElement!.getBoundingClientRect().width;
          commitWidth(id, event.key === 'Home' ? issueColumnMinWidth(id) : event.key === 'End' ? ISSUE_COLUMN_MAX_WIDTH : current + (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 1 : 8));
        }} />
      </div>)}
    </div> : null;
  return <section ref={panel} className={`issue-column-layout${enabled ? ' issue-column-editor' : ''}${aligned ? ' issue-columns-aligned' : ''}`}
    data-column-resizing={!!previewWidths}
    aria-label={enabled ? 'Rearrange issue columns' : undefined}
    style={aligned ? { '--issue-column-tracks': tracks, '--issue-column-min-width': `${minWidth}px` } as React.CSSProperties : undefined}
    onKeyDown={event => {
      if (enabled && event.key === 'Escape' && !(event.target as HTMLElement).closest('[role="dialog"], [role="menu"], [role="listbox"]')) {
        if (resize.current) { event.preventDefault(); event.stopPropagation(); cancelResize(); return; }
        event.preventDefault(); event.stopPropagation(); resetDrag(); onCancel();
      }
    }}>
    {enabled && <div className="issue-column-toolbar">
      <span id={hint} hidden>Drag a header to reorder · Drag its right edge to resize · Click the eye to hide · Alt/Option + ← / → to move · Focus an edge and use arrow keys to resize, Shift for 1 pixel</span>
    {hidden.length > 0 && <details className="issue-columns-hidden">
      <summary>Hidden columns ({hidden.length})</summary>
      <div className="issue-column-handles" role="group" aria-label="Hidden columns">
        {hidden.map(id => <button type="button" className="issue-column-show" key={id} aria-label={`Show ${label(id)} column`} onClick={() => setVisible(id, true)}>
          <Icon name="EyeOff" size={14} /><span>{label(id)}</span>
        </button>)}
      </div>
    </details>}
    <div className="issue-column-toolbar-actions">
      {persistence}
    </div>
    </div>}
    {children(header)}
    <span className="column-order-announcement" role="status" aria-live="polite">{announcement}</span>
  </section>;
}
