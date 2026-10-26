import React, { useEffect, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  groupPathKey,
  type IssueSwimlane,
  type NestedIssueGroup,
} from "./issue-groups";
import { Icon } from "./components/ui";
import type { useSectionReorder } from "./section-reorder";

/** Virtualize both row groups and card columns, then let each cell virtualize its cards. */
export function IssueSwimlaneBoard({
  columns,
  rows,
  secondary,
  scrollRef,
  focusedId,
  renderHeader,
  renderCell,
  onDrop,
  countBy,
  sectionReorder,
}: {
  columns: NestedIssueGroup[];
  rows: IssueSwimlane[];
  secondary: string;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  focusedId: string;
  renderHeader: (group: NestedIssueGroup) => React.ReactNode;
  renderCell: (group: NestedIssueGroup) => React.ReactNode;
  onDrop: (event: React.DragEvent, group: NestedIssueGroup) => void;
  countBy: "issues" | "estimate";
  sectionReorder?: ReturnType<typeof useSectionReorder>;
}) {
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const rowVirtual = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => (collapsed.includes(rows[index].id) ? 40 : 360),
    overscan: 1,
    scrollMargin: 40,
    getItemKey: (index) => rows[index].id,
  });
  const columnVirtual = useVirtualizer({
    count: columns.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 300,
    overscan: 1,
    horizontal: true,
    getItemKey: (index) => columns[index].key,
  });
  useEffect(() => {
    rowVirtual.measure();
  }, [collapsed]);
  useEffect(() => {
    if (!focusedId) return;
    // Hover also updates focus. Keep a visible card stationary under the pointer;
    // scrolling its entire swimlane into view can interrupt the start of a drag.
    const viewport = scrollRef.current;
    const card = viewport?.querySelector<HTMLElement>(`.board-card[data-issue-id="${CSS.escape(focusedId)}"]`);
    if (viewport && card) {
      const bounds = viewport.getBoundingClientRect(), rect = card.getBoundingClientRect();
      if (rect.top >= bounds.top && rect.bottom <= bounds.bottom && rect.left >= bounds.left && rect.right <= bounds.right) return;
    }
    const row = rows.findIndex((g) => g.issues.some((i) => i.id === focusedId)),
      column = columns.findIndex((g) =>
        g.issues.some((i) => i.id === focusedId),
      );
    if (row >= 0) {
      setCollapsed((ids) => ids.filter((id) => id !== rows[row].id));
      rowVirtual.scrollToIndex(row, { align: "auto" });
    }
    if (column >= 0) columnVirtual.scrollToIndex(column, { align: "auto" });
  }, [focusedId]);
  useEffect(() => {
    const listener = (event: Event) => {
      const e = event as CustomEvent;
      if (e.defaultPrevented) return;
      const command = e.detail?.command;
      if (command === "toggle-group") {
        const row =
          rows.find((g) => g.issues.some((i) => i.id === focusedId)) ?? rows[0];
        if (!row) return;
        setCollapsed((ids) =>
          ids.includes(row.id)
            ? ids.filter((id) => id !== row.id)
            : [...ids, row.id],
        );
        e.preventDefault();
      } else if (command === "toggle-all-groups") {
        setCollapsed((ids) => (ids.length ? [] : rows.map((row) => row.id)));
        e.preventDefault();
      }
    };
    window.addEventListener("workspace-command", listener);
    return () => window.removeEventListener("workspace-command", listener);
  }, [rows, focusedId]);
  const width = Math.max(
    columnVirtual.getTotalSize(),
    scrollRef.current?.clientWidth || 0,
  );
  return (
    <div
      className="issue-swimlane-board"
      data-swimlane-count={rows.length}
      style={{ width }}
    >
      <div className="swimlane-column-headers" style={{ width }}>
        {columnVirtual.getVirtualItems().map((col) => (
          <div
            key={columns[col.index].key}
            style={{ position: "absolute", left: col.start, width: col.size }}
          >
            {renderHeader(columns[col.index])}
          </div>
        ))}
      </div>
      <div
        className="swimlane-rows"
        style={{ height: rowVirtual.getTotalSize(), position: "relative" }}
      >
        {rowVirtual.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index],
            isCollapsed = collapsed.includes(row.id);
          return (
            <section
              key={row.id}
              className="issue-swimlane"
              data-row-id={row.id}
              data-row-field={secondary}
              aria-label={row.name}
              style={{
                position: "absolute",
                top: virtualRow.start - 40,
                height: virtualRow.size,
                width,
              }}
            >
              <div
                className="swimlane-row-label reorderable-section"
                {...sectionReorder?.headerProps(secondary, row.id)}
                style={{ width: scrollRef.current?.clientWidth }}
              >
                {sectionReorder?.handle(secondary, row.id, row.name)}
                <button
                  type="button"
                  className="icon-button"
                  aria-label={"Toggle row " + row.name}
                  aria-expanded={!isCollapsed}
                  onClick={() =>
                    setCollapsed((ids) =>
                      ids.includes(row.id)
                        ? ids.filter((id) => id !== row.id)
                        : [...ids, row.id],
                    )
                  }
                >
                  <Icon
                    name={isCollapsed ? "ChevronRight" : "ChevronDown"}
                    size={12}
                  />
                </button>
                {row.color && (
                  <span
                    className="group-color-dot"
                    style={{ background: row.color }}
                  />
                )}
                <strong>{row.name}</strong>
                <span className="muted">
                  {countBy === "estimate"
                    ? row.issues.reduce(
                        (sum, i) => sum + (Number(i.estimate) || 0),
                        0,
                      )
                    : row.issues.length}
                </span>
              </div>
              {!isCollapsed && (
                <div className="swimlane-cells">
                  {columnVirtual.getVirtualItems().map((col) => {
                    const column = columns[col.index],
                      path = [...column.path, { field: secondary, id: row.id }],
                      cell = row.cells.get(column.id) ?? {
                        ...row,
                        issues: [],
                        path,
                        key: groupPathKey(path),
                      };
                    return (
                      <div
                        key={cell.key}
                        className="swimlane-cell"
                        data-column-id={column.id}
                        data-row-id={row.id}
                        aria-label={column.name + " / " + row.name}
                        style={{
                          position: "absolute",
                          left: col.start,
                          width: col.size,
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => onDrop(e, cell)}
                      >
                        {renderCell(cell)}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
