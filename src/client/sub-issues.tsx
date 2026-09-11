import React, { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Entity } from "../shared/types";
import { useAppStore } from "./store";
import {
  Avatar,
  Dropdown,
  Icon,
  MenuItem,
  PriorityIcon,
  StatusIcon,
} from "./components/ui";
import {
  IssueActions,
  PropertyPicker,
  issueName,
  openComposer,
} from "./issues";
import "./sub-issues.css";

const properties = [
  "Status",
  "ID",
  "Priority",
  "Assignee",
  "Estimate",
  "Labels",
  "Project",
  "Due date",
];
type Display = {
  order: string;
  descending: boolean;
  hideCompleted: boolean;
  properties: string[];
};
const defaultDisplay: Display = {
  order: "Manual",
  descending: false,
  hideCompleted: false,
  properties: ["Status", "ID", "Assignee"],
};

export function SubIssues({ parent }: { parent: Entity }) {
  const store = useAppStore(),
    navigate = useNavigate(),
    scroll = useRef<HTMLDivElement>(null);
  const storageKey = `parabolic:sub-issues:${store.data.workspaceId}:${store.user?.id}`;
  const [display, setDisplay] = useState<Display>(() => {
    try {
      return {
        ...defaultDisplay,
        ...JSON.parse(localStorage.getItem(storageKey) || "{}"),
      };
    } catch {
      return defaultDisplay;
    }
  });
  const [collapsed, setCollapsed] = useState(false),
    [dragged, setDragged] = useState<string | null>(null);
  const change = (patch: Partial<Display>) =>
    setDisplay((old) => {
      const next = { ...old, ...patch };
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  const statuses = useMemo(
    () =>
      new Map(
        [
          ...store.data.statuses,
          ...store.data.issues.flatMap((i) => i.sharedStatuses ?? []),
        ].map((s) => [s.id, s]),
      ),
    [store.data.statuses, store.data.issues],
  );
  const children = useMemo(
    () =>
      store.data.issues.filter(
        (i) => !i.deletedAt && !i.archivedAt && i.parentId === parent.id,
      ),
    [store.data.issues, parent.id],
  );
  const complete = (issue: Entity) =>
    ["completed", "canceled", "duplicate"].includes(
      statuses.get(issue.statusId)?.type,
    );
  const ordered = useMemo(() => {
    const rank: Record<string, number> = {
      started: 0,
      unstarted: 1,
      backlog: 2,
      triage: 3,
      completed: 4,
      canceled: 5,
      duplicate: 6,
    };
    const value = (i: Entity): string | number =>
      display.order === "Priority"
        ? i.priority || 5
        : display.order === "Status"
          ? (rank[statuses.get(i.statusId)?.type] ?? 9)
          : display.order === "Title"
            ? i.title.toLowerCase()
            : display.order === "Created"
              ? i.createdAt
              : display.order === "Updated"
                ? i.updatedAt
                : display.order === "Estimate"
                  ? (i.estimate ?? -1)
                  : display.order === "Due date"
                    ? (i.dueDate ?? "9999")
                    : Number(
                        i.subIssueSortOrder ?? i.sortOrder ?? i.number ?? 0,
                      );
    return children
      .filter((i) => !display.hideCompleted || !complete(i))
      .sort((a, b) => {
        const av = value(a),
          bv = value(b),
          order =
            typeof av === "number" && typeof bv === "number"
              ? av - bv
              : String(av).localeCompare(String(bv));
        return (
          (order || a.id.localeCompare(b.id)) * (display.descending ? -1 : 1)
        );
      });
  }, [
    children,
    display.order,
    display.hideCompleted,
    display.descending,
    statuses,
  ]);
  const virtual = useVirtualizer({
    count: collapsed ? 0 : ordered.length,
    getScrollElement: () => scroll.current,
    estimateSize: () => 38,
    overscan: 4,
  });
  const reorder = async (id: string, targetId: string, after = false) => {
    const rest = ordered.filter((i) => i.id !== id),
      index = rest.findIndex((i) => i.id === targetId) + (after ? 1 : 0);
    if (index < 0) return;
    const ids = rest.map((i) => i.id);
    ids.splice(index, 0, id);
    change({ order: "Manual", descending: false });
    if (ids.length <= 1000)
      await store.batch(
        ids.map((id, index) => ({
          kind: "issues",
          id,
          data: { subIssueSortOrder: (index + 1) * 1024 },
        })),
      );
    else {
      const manual = children
          .filter((i) => i.id !== id)
          .sort(
            (a, b) =>
              Number(a.subIssueSortOrder ?? a.sortOrder ?? a.number) -
              Number(b.subIssueSortOrder ?? b.sortOrder ?? b.number),
          ),
        at = manual.findIndex((i) => i.id === targetId) + (after ? 1 : 0),
        value = (i: Entity | undefined) =>
          i
            ? Number(i.subIssueSortOrder ?? i.sortOrder ?? i.number)
            : undefined,
        previous = value(manual[at - 1]),
        next = value(manual[at]);
      await store.update("issues", id, {
        subIssueSortOrder:
          previous === undefined
            ? (next ?? 1024) - 1024
            : next === undefined
              ? previous + 1024
              : (previous + next) / 2,
      });
    }
  };
  if (!children.length) return null;
  return (
    <section
      className="sub-issues sub-issues-configurable"
      aria-label="Sub-issues"
    >
      <div className="sub-issues-heading">
        <button
          className="text-button"
          aria-label={collapsed ? "Expand sub-issues" : "Collapse sub-issues"}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed(!collapsed)}
        >
          <Icon name={collapsed ? "ChevronRight" : "ChevronDown"} size={13} />
          <strong>Sub-issues</strong>
          <span className="muted">
            {children.filter(complete).length}/{children.length}
          </span>
        </button>
        <span className="spacer" />
        <Dropdown
          align="right"
          trigger={
            <button
              className="icon-button"
              aria-label="Sub-issue display options"
            >
              <Icon name="SlidersHorizontal" size={14} />
            </button>
          }
        >
          <div className="sub-issue-display-menu" data-keep-open>
            <h4>Display options</h4>
            <label>
              Order by
              <select
                className="input"
                aria-label="Sub-issue order"
                value={display.order}
                onChange={(e) => change({ order: e.target.value })}
              >
                {[
                  "Manual",
                  "Priority",
                  "Status",
                  "Title",
                  "Created",
                  "Updated",
                  "Estimate",
                  "Due date",
                ].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={display.descending}
                onChange={(e) => change({ descending: e.target.checked })}
              />
              Reverse order
            </label>
            <label>
              <input
                type="checkbox"
                checked={display.hideCompleted}
                onChange={(e) => change({ hideCompleted: e.target.checked })}
              />
              Always hide completed sub-issues
            </label>
            <div className="menu-separator" />
            <h4>Properties</h4>
            {properties.map((property) => (
              <label key={property}>
                <input
                  type="checkbox"
                  checked={display.properties.includes(property)}
                  onChange={(e) =>
                    change({
                      properties: e.target.checked
                        ? [...display.properties, property]
                        : display.properties.filter((p) => p !== property),
                    })
                  }
                />
                {property}
              </label>
            ))}
          </div>
        </Dropdown>
        {!parent.sharedAccess && (
          <button
            className="icon-button"
            aria-label="Create sub-issue"
            onClick={() =>
              openComposer({ parentId: parent.id, teamId: parent.teamId })
            }
          >
            <Icon name="Plus" size={14} />
          </button>
        )}
      </div>
      {!collapsed && (
        <div
          ref={scroll}
          className="sub-issues-scroll"
          style={{ height: Math.min(ordered.length * 38, 380) }}
        >
          <div style={{ height: virtual.getTotalSize(), position: "relative" }}>
            {virtual.getVirtualItems().map((row) => {
              const child = ordered[row.index],
                assignee = store.data.users.find(
                  (u) => u.id === child.assigneeId,
                ),
                status = statuses.get(child.statusId),
                shown = (key: string) => display.properties.includes(key);
              return (
                <div
                  key={child.id}
                  data-sub-issue-id={child.id}
                  className={`sub-issue-row ${dragged === child.id ? "dragging" : ""}`}
                  style={{
                    position: "absolute",
                    top: 0,
                    transform: `translateY(${row.start}px)`,
                    height: row.size,
                    width: "100%",
                  }}
                  tabIndex={0}
                  role="group"
                  aria-label={`${issueName(child)} ${child.title}`}
                  draggable={!parent.sharedAccess}
                  onDragStart={(e) => {
                    setDragged(child.id);
                    e.dataTransfer.setData(
                      "application/x-parabolic-subissue",
                      child.id,
                    );
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => setDragged(null)}
                  onDragOver={(e) => {
                    if (dragged && dragged !== child.id) {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData(
                      "application/x-parabolic-subissue",
                    );
                    if (id && id !== child.id)
                      void reorder(
                        id,
                        child.id,
                        e.clientY >
                          e.currentTarget.getBoundingClientRect().top + 19,
                      );
                    setDragged(null);
                  }}
                  onClick={() => navigate(`/issues/${child.id}`)}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === "Enter") {
                      e.preventDefault();
                      navigate(`/issues/${child.id}`);
                    } else if (["ArrowUp", "ArrowDown"].includes(e.key)) {
                      e.preventDefault();
                      const delta = e.key === "ArrowDown" ? 1 : -1,
                        target = ordered[row.index + delta];
                      if (
                        target &&
                        e.altKey &&
                        e.shiftKey &&
                        !parent.sharedAccess
                      )
                        void reorder(child.id, target.id, delta > 0);
                      else if (target) {
                        virtual.scrollToIndex(row.index + delta);
                        requestAnimationFrame(() =>
                          scroll.current
                            ?.querySelector<HTMLElement>(
                              `[data-sub-issue-id="${target.id}"]`,
                            )
                            ?.focus(),
                        );
                      }
                    }
                  }}
                >
                  {shown("Status") && (
                    <span onClick={(e) => e.stopPropagation()}>
                      <PropertyPicker
                        field="statusId"
                        value={child.statusId}
                        teamId={child.teamId}
                        optionsOverride={child.sharedStatuses}
                        compact
                        onChange={(statusId) =>
                          void store.update("issues", child.id, { statusId })
                        }
                      >
                        <StatusIcon status={status} />
                      </PropertyPicker>
                    </span>
                  )}
                  {shown("ID") && (
                    <span className="issue-identifier">{issueName(child)}</span>
                  )}
                  {shown("Priority") && (
                    <PriorityIcon priority={child.priority} />
                  )}
                  <strong className={complete(child) ? "sub-issue-closed" : ""}>
                    {child.title}
                  </strong>
                  <span className="spacer" />
                  {shown("Project") && child.projectId && (
                    <span className="sub-issue-meta">
                      {
                        store.data.projects.find(
                          (p) => p.id === child.projectId,
                        )?.name
                      }
                    </span>
                  )}
                  {shown("Labels") &&
                    (child.labelIds ?? []).map((id: string) => {
                      const label =
                        store.data.labels.find((l) => l.id === id) ??
                        child.sharedLabels?.find((l: any) => l.id === id);
                      return label ? (
                        <span key={id} className="badge sub-issue-meta" data-tooltip={label.description||undefined}>
                          <span style={{ color: label.color }}>●</span>
                          {label.name}
                        </span>
                      ) : null;
                    })}
                  {shown("Due date") && child.dueDate && (
                    <span className="sub-issue-meta">
                      {child.dueDate.slice(0, 10)}
                    </span>
                  )}
                  {shown("Estimate") && child.estimate != null && (
                    <span className="sub-issue-meta">
                      <Icon name="Diamond" size={12} />
                      {child.estimate}
                    </span>
                  )}
                  {shown("Assignee") && (
                    <span onClick={(e) => e.stopPropagation()}>
                      <PropertyPicker
                        field="assigneeId"
                        value={child.assigneeId}
                        compact
                        onChange={(assigneeId) =>
                          void store.update("issues", child.id, { assigneeId })
                        }
                      >
                        <Avatar user={assignee} />
                      </PropertyPicker>
                    </span>
                  )}
                  <span
                    className="sub-issue-actions"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <IssueActions issue={child} />
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {!collapsed && !ordered.length && (
        <p className="sub-issues-hidden muted">All sub-issues are completed.</p>
      )}
    </section>
  );
}
