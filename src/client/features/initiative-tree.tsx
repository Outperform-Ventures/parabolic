import { DirectoryEmpty } from "./directory-empty";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  initiativeDescendantIds,
  initiativeParentIds,
  initiativeProjectRollup,
  INITIATIVE_STATUSES,
} from "../../shared/initiatives";
import { Dropdown, Icon, MenuItem } from "../components/ui";
import { matchesFilter, type FilterSpec } from "../query";
import { displayNameFor } from "../display-name";
import { EntityIcon } from "./entity-icon";
import { formatTargetDate } from "./date-picker";
import { projectStatusCategory } from "./project-statuses";
import {
  Person,
  Progress,
  Status,
  live,
  priorityName,
  useActions,
  type Row,
} from "./shared";

type Occurrence = { id: string; parentId?: string; rootId: string };
type Destination = {
  parentId?: string;
  targetId?: string;
  after?: boolean;
  mode: "before" | "after" | "nest" | "root";
};
type PointerMove = {
  source: Occurrence;
  x: number;
  y: number;
  moved: boolean;
  cancelled?: boolean;
  destination?: Destination;
  root: HTMLElement;
};
export const initiativePosition = (item: Row, parentId?: string) =>
  Number(
    parentId
      ? (item.parentPositions?.[parentId] ?? Date.parse(item.createdAt))
      : (item.position ?? Date.parse(item.createdAt)),
  ) || 0;
export function orderInitiatives(items: Row[], parentId?: string) {
  return [...items].sort(
    (a, b) =>
      initiativePosition(a, parentId) - initiativePosition(b, parentId) ||
      a.id.localeCompare(b.id),
  );
}

export function InitiativeTree({
  filters,
  query = "",
  group = "none",
  ordering = "manual",
  properties = [],
  scopeId,
  collapsed,
  onCollapsed,
  emptyCreate,
  emptyTitle,
  emptyDescription,
}: {
  emptyCreate?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  filters: FilterSpec;
  query?: string;
  group?: string;
  ordering?: string;
  properties?: string[];
  scopeId?: string;
  collapsed: string[];
  onCollapsed: (ids: string[]) => void;
}) {
  const { data, batch, act, toast } = useActions(),
    drag = useRef<Occurrence | null>(null),
    pointerDrag = useRef<PointerMove | null>(null),
    suppressClick = useRef(false),
    altPressed = useRef(false),
    [target, setTarget] = useState<{
      id: string;
      destination: Destination;
    } | null>(null);
  useEffect(() => {
    const clear = () => {
        altPressed.current = false;
        if (pointerDrag.current) {
          pointerDrag.current.root.style.userSelect = "";
          pointerDrag.current = null;
          drag.current = null;
          setTarget(null);
        }
      },
      press = (event: KeyboardEvent) => {
        if (event.key === "Alt") altPressed.current = event.type === "keydown";
        if (event.key === "Escape" && pointerDrag.current) {
          event.preventDefault();
          event.stopPropagation();
          pointerDrag.current.cancelled = true;
          pointerDrag.current.destination = undefined;
          pointerDrag.current.root.style.userSelect = "";
          setTarget(null);
        }
      };
    window.addEventListener("keydown", press, true);
    window.addEventListener("keyup", press, true);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", press, true);
      window.removeEventListener("keyup", press, true);
      window.removeEventListener("blur", clear);
      clear();
    };
  }, []);
  const list = useMemo(() => live(data.initiatives), [data.initiatives]),
    byId = useMemo(() => new Map(list.map((item) => [item.id, item])), [list]);
  const latest = new Map<string, Row>();
  for (const update of live(data.updates)) {
    if (!update.initiativeId) continue;
    const previous = latest.get(update.initiativeId);
    if (!previous || update.createdAt > previous.createdAt)
      latest.set(update.initiativeId, update);
  }
  const displayOrder = (items: Row[], parentId?: string) => {
    if (ordering === "manual") return orderInitiatives(items, parentId);
    const value = (item: Row) =>
      ordering === "name"
        ? item.name || ""
        : ordering === "status"
          ? INITIATIVE_STATUSES.findIndex(
              (status) => status.value === item.status,
            )
          : ordering === "priority"
            ? Number(item.priority) || 0
            : ordering === "healthUpdated"
              ? latest.get(item.id)?.createdAt || ""
              : ordering === "targetDate"
                ? item.targetDate || "9999-12-31"
                : item.updatedAt || "";
    return [...items].sort((a, b) => {
      const left = value(a),
        right = value(b);
      return typeof left === "number" && typeof right === "number"
        ? left - right || a.id.localeCompare(b.id)
        : String(left).localeCompare(String(right), undefined, {
            numeric: true,
          }) || a.id.localeCompare(b.id);
    });
  };
  const scope = useMemo(
    () => (scopeId ? initiativeDescendantIds(list, scopeId) : null),
    [list, scopeId],
  );
  const children = useMemo(() => {
    const result = new Map<string, Row[]>();
    for (const item of list)
      for (const parentId of initiativeParentIds(item)) {
        const values = result.get(parentId) || [];
        values.push(item);
        result.set(parentId, values);
      }
    return result;
  }, [list]);
  const matches = useMemo(
    () =>
      new Set(
        list
          .filter(
            (item) =>
              (!scope || scope.has(item.id)) &&
              matchesFilter(
                {
                  ...item,
                  leadTeamId: item.leadTeamId || item.teamId,
                  parentIds: initiativeParentIds(item),
                  health: latest.get(item.id)?.health,
                },
                filters,
              ) &&
              `${item.name} ${item.summary || ""}`
                .toLowerCase()
                .includes(query.toLowerCase()),
          )
          .map((item) => item.id),
      ),
    [list, filters, query, scope],
  );
  const visible = new Set(matches);
  const addAncestors = (id: string) => {
    for (const parentId of initiativeParentIds(byId.get(id) || { id })) {
      if (
        parentId !== scopeId &&
        (!scope || scope.has(parentId)) &&
        !visible.has(parentId) &&
        byId.has(parentId)
      ) {
        visible.add(parentId);
        addAncestors(parentId);
      }
    }
  };
  for (const id of matches) addAncestors(id);
  const roots = displayOrder(
    list.filter(
      (item) =>
        visible.has(item.id) &&
        !initiativeParentIds(item).some((parentId) => visible.has(parentId)),
    ),
    scopeId,
  );
  const toggle = (id: string) =>
    onCollapsed(
      collapsed.includes(id)
        ? collapsed.filter((value) => value !== id)
        : [...collapsed, id],
    );
  const move = async (source: Occurrence, destination: Destination) => {
    const item = byId.get(source.id);
    if (!item) return;
    if (
      destination.parentId &&
      (destination.parentId === source.id ||
        initiativeDescendantIds(list, source.id).has(destination.parentId))
    ) {
      toast("An initiative cannot be nested inside itself or its descendants.");
      return;
    }
    if (destination.targetId === source.id && destination.mode !== "nest")
      return;
    const parentIds = initiativeParentIds(item).filter(
      (id) => id !== source.parentId,
    );
    if (destination.parentId && !parentIds.includes(destination.parentId))
      parentIds.push(destination.parentId);
    const siblings = orderInitiatives(
      list.filter(
        (row) =>
          row.id !== source.id &&
          (destination.parentId
            ? initiativeParentIds(row).includes(destination.parentId)
            : !initiativeParentIds(row).length),
      ),
      destination.parentId,
    );
    const targetIndex = destination.targetId
        ? siblings.findIndex((row) => row.id === destination.targetId)
        : -1,
      index =
        targetIndex < 0
          ? siblings.length
          : targetIndex + (destination.after ? 1 : 0);
    siblings.splice(index, 0, item);
    const previous = siblings[index - 1],
      next = siblings[index + 1],
      left = previous
        ? initiativePosition(previous, destination.parentId)
        : undefined,
      right = next ? initiativePosition(next, destination.parentId) : undefined;
    const rank =
      left === undefined
        ? right === undefined
          ? 1024
          : right - 1024
        : right === undefined
          ? left + 1024
          : (left + right) / 2;
    const positionData = (
      row: Row,
      value: number,
      parents = initiativeParentIds(row),
    ) =>
      destination.parentId
        ? {
            parentPositions: {
              ...Object.fromEntries(
                Object.entries(row.parentPositions || {}).filter(([id]) =>
                  parents.includes(id),
                ),
              ),
              [destination.parentId]: value,
            },
          }
        : { position: value };
    const sourceData = { parentIds, ...positionData(item, rank, parentIds) };
    const changes =
      Math.abs(rank) > 1e15 ||
      (left !== undefined &&
        right !== undefined &&
        (rank <= left || rank >= right))
        ? siblings.map((row, position) => ({
            kind: "initiatives" as const,
            id: row.id,
            data: {
              ...(row.id === item.id ? { parentIds } : {}),
              ...positionData(
                row,
                position * 1024,
                row.id === item.id ? parentIds : undefined,
              ),
            },
          }))
        : [{ kind: "initiatives" as const, id: item.id, data: sourceData }];
    const result = await act(() => batch(changes));
    if (result && destination.parentId)
      onCollapsed(collapsed.filter((id) => id !== destination.parentId));
  };
  const destinationAt = (
    y: number,
    alt: boolean,
    occurrence: Occurrence,
    box: DOMRect,
  ): Destination => {
    const source = drag.current;
    if (alt || altPressed.current)
      return { parentId: occurrence.id, mode: "nest" };
    const sameParent = source?.parentId === occurrence.parentId;
    const parentId = sameParent ? occurrence.parentId : scopeId;
    const targetId = sameParent ? occurrence.id : occurrence.rootId;
    const after = y > box.top + box.height / 2;
    return { parentId, targetId, after, mode: after ? "after" : "before" };
  };
  const destinationFor = (event: React.DragEvent, occurrence: Occurrence) =>
    destinationAt(
      event.clientY,
      event.altKey,
      occurrence,
      event.currentTarget.getBoundingClientRect(),
    );
  const beginPointer = (
    event: React.PointerEvent<HTMLElement>,
    source: Occurrence,
  ) => {
    if (
      event.button !== 0 ||
      !(event.altKey || altPressed.current) ||
      (event.target as Element).closest("button,input,select,textarea")
    )
      return;
    const root = event.currentTarget.closest<HTMLElement>(".initiative-tree");
    if (!root) return;
    event.preventDefault();
    event.stopPropagation();
    root.style.userSelect = "none";
    drag.current = source;
    pointerDrag.current = {
      source,
      x: event.clientX,
      y: event.clientY,
      moved: false,
      root,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const movePointer = (event: React.PointerEvent<HTMLElement>) => {
    const pending = pointerDrag.current;
    if (!pending || pending.cancelled) return;
    if (
      !pending.moved &&
      Math.hypot(event.clientX - pending.x, event.clientY - pending.y) < 4
    )
      return;
    pending.moved = true;
    event.preventDefault();
    const element = document.elementFromPoint(event.clientX, event.clientY),
      row = element?.closest<HTMLElement>("[data-initiative-id]");
    if (!element || !pending.root.contains(element)) {
      pending.destination = undefined;
      setTarget(null);
      return;
    }
    if (row) {
      const occurrence = {
          id: row.dataset.initiativeId!,
          parentId: row.dataset.parentId || undefined,
          rootId: row.dataset.rootId!,
        },
        destination = destinationAt(
          event.clientY,
          event.altKey,
          occurrence,
          row.getBoundingClientRect(),
        );
      pending.destination = destination;
      setTarget({ id: row.dataset.occurrenceKey!, destination });
    } else {
      pending.destination = { parentId: scopeId, mode: "root" };
      setTarget({ id: "root", destination: pending.destination });
    }
    const scroll = pending.root.closest<HTMLElement>(".feature-page");
    if (scroll) {
      const bounds = scroll.getBoundingClientRect(),
        edge = 30;
      scroll.scrollTop +=
        event.clientY > bounds.bottom - edge
          ? 16
          : event.clientY < bounds.top + edge
            ? -16
            : 0;
    }
  };
  const finishPointer = (event: React.PointerEvent<HTMLElement>) => {
    const pending = pointerDrag.current;
    if (!pending) return;
    pointerDrag.current = null;
    drag.current = null;
    pending.root.style.userSelect = "";
    setTarget(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (pending.moved) {
      suppressClick.current = true;
      setTimeout(() => {
        suppressClick.current = false;
      }, 0);
      if (event.type !== "pointercancel" && pending.destination)
        void move(pending.source, pending.destination);
    }
  };
  const sourceFor = (event: React.DragEvent) => {
    if (drag.current) return drag.current;
    try {
      return JSON.parse(
        event.dataTransfer.getData("application/x-parabolic-initiative"),
      ) as Occurrence;
    } catch {
      return null;
    }
  };
  const drop = (event: React.DragEvent, destination: Destination) => {
    event.preventDefault();
    event.stopPropagation();
    const source = sourceFor(event);
    setTarget(null);
    drag.current = null;
    if (source) void move(source, destination);
  };
  const renderRow = (
    item: Row,
    depth = 0,
    parentId?: string,
    path = "",
  ): React.ReactNode => {
    if (depth > 4 || !visible.has(item.id)) return null;
    const occurrence = {
        id: item.id,
        parentId,
        rootId: path.split("/").filter(Boolean)[0] || item.id,
      },
      key = `${path}/${item.id}`,
      rollup = initiativeProjectRollup(
        data.initiatives,
        data.projects,
        item.id,
      ),
      childList = displayOrder(
        (children.get(item.id) || []).filter((child) => visible.has(child.id)),
        item.id,
      ),
      health = latest.get(item.id)?.health;
    const siblings = orderInitiatives(
        list.filter((row) =>
          parentId
            ? initiativeParentIds(row).includes(parentId)
            : !initiativeParentIds(row).length,
        ),
        parentId,
      ),
      index = siblings.findIndex((row) => row.id === item.id);
    return (
      <React.Fragment key={key}>
        <div
          data-initiative-id={item.id}
          data-parent-id={parentId || ""}
          data-root-id={occurrence.rootId}
          data-occurrence-key={key}
          onPointerDown={(event) => beginPointer(event, occurrence)}
          onPointerMove={movePointer}
          onPointerUp={finishPointer}
          onPointerCancel={finishPointer}
          className={`feature-initiative-row initiative-tree-row ${matches.has(item.id) ? "" : "initiative-context"} ${target?.id === key ? "initiative-drop-" + target.destination.mode : ""}`}
          style={{ paddingLeft: 16 + depth * 28 }}
          draggable
          onDragStart={(event) => {
            if (pointerDrag.current) {
              event.preventDefault();
              return;
            }
            drag.current = occurrence;
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData(
              "application/x-parabolic-initiative",
              JSON.stringify(occurrence),
            );
          }}
          tabIndex={0}
          aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
          onKeyDown={(event) => {
            if (
              event.target !== event.currentTarget ||
              !event.altKey ||
              !["ArrowUp", "ArrowDown"].includes(event.key)
            )
              return;
            event.preventDefault();
            event.stopPropagation();
            const next = index + (event.key === "ArrowUp" ? -1 : 1);
            if (next >= 0 && next < siblings.length)
              void move(occurrence, {
                parentId,
                targetId: siblings[next].id,
                after: next > index,
                mode: next > index ? "after" : "before",
              });
          }}
          onDragEnd={() => {
            drag.current = null;
            setTarget(null);
          }}
          onDragOver={(event) => {
            if (
              !event.dataTransfer.types.includes(
                "application/x-parabolic-initiative",
              )
            )
              return;
            event.preventDefault();
            event.stopPropagation();
            setTarget({
              id: key,
              destination: destinationFor(event, occurrence),
            });
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node))
              setTarget(null);
          }}
          onDrop={(event) => drop(event, destinationFor(event, occurrence))}
        >
          <button
            className="feature-icon-button initiative-collapse"
            aria-label={`${collapsed.includes(item.id) ? "Expand" : "Collapse"} ${item.name}`}
            disabled={!childList.length}
            onClick={() => toggle(item.id)}
          >
            <Icon
              name={
                collapsed.includes(item.id) ? "ChevronRight" : "ChevronDown"
              }
              size={14}
            />
          </button>
          <Link className="initiative-row-main" to={`/initiative/${item.id}`}>
            <span className="feature-initiative-icon">
              <EntityIcon entity={item} fallback="Layers" size={20} />
            </span>
            <div>
              <strong>{item.name}</strong>
              {properties.includes("description") && (
                <p>{item.summary || "No summary"}</p>
              )}
              <div className="feature-inline-properties">
                {properties.includes("status") && (
                  <Status value={item.status} />
                )}
                {properties.includes("projects") && (
                  <span>{rollup.projects.length} projects</span>
                )}
                {properties.includes("activeProjects") && (
                  <span>
                    {
                      rollup.projects.filter(
                        (project) =>
                          projectStatusCategory(project.status, data) !==
                            "completed" &&
                          projectStatusCategory(project.status, data) !==
                            "canceled",
                      ).length
                    }{" "}
                    active projects
                  </span>
                )}
                {properties.includes("owner") && <Person id={item.ownerId} />}
                {properties.includes("priority") && item.priority > 0 && (
                  <span>{priorityName(item.priority)}</span>
                )}
                {properties.includes("teams") &&
                  (item.leadTeamId || item.teamId) && (
                    <span>
                      {
                        data.teams.find(
                          (team) =>
                            team.id === (item.leadTeamId || item.teamId),
                        )?.name
                      }
                    </span>
                  )}
                {properties.includes("targetDate") && (
                  <span>
                    {formatTargetDate(item.targetDate, item.datePrecision)}
                  </span>
                )}
                {properties.includes("health") && health && (
                  <span
                    className={`feature-health ${health.toLowerCase().replace(/\s/g, "-")}`}
                  >
                    {health}
                  </span>
                )}
                {properties.includes("created") && (
                  <span>
                    Created{" "}
                    {formatTargetDate(item.createdAt?.slice(0, 10), "day")}
                  </span>
                )}
                {properties.includes("updated") && (
                  <span>
                    Updated{" "}
                    {formatTargetDate(item.updatedAt?.slice(0, 10), "day")}
                  </span>
                )}
                {properties.includes("completed") && item.completedAt && (
                  <span>
                    Completed{" "}
                    {formatTargetDate(item.completedAt.slice(0, 10), "day")}
                  </span>
                )}
                {properties.includes("labels") &&
                  (item.labelIds || []).map((id: string) => (
                    <span key={id}>
                      {data.labels.find((label) => label.id === id)?.name ||
                        "Unavailable label"}
                    </span>
                  ))}
              </div>
            </div>
          </Link>
          {(properties.includes("projects") ||
            properties.includes("activeProjects")) && (
            <Progress
              label={`${item.name} project completion`}
              value={
                rollup.projects.length
                  ? (rollup.projects.filter(
                      (project) =>
                        projectStatusCategory(project.status, data) ===
                        "completed",
                    ).length /
                      rollup.projects.length) *
                    100
                  : 0
              }
            />
          )}
          <Dropdown
            align="right"
            trigger={
              <button
                className="feature-icon-button"
                aria-label={"Initiative actions: " + item.name}
              >
                <Icon name="MoreHorizontal" size={16} />
              </button>
            }
          >
            <MenuItem
              disabled={index <= 0}
              onClick={() =>
                void move(occurrence, {
                  parentId,
                  targetId: siblings[index - 1]?.id,
                  mode: "before",
                })
              }
            >
              Move up
            </MenuItem>
            <MenuItem
              disabled={index < 0 || index === siblings.length - 1}
              onClick={() =>
                void move(occurrence, {
                  parentId,
                  targetId: siblings[index + 1]?.id,
                  after: true,
                  mode: "after",
                })
              }
            >
              Move down
            </MenuItem>
            {parentId && (
              <MenuItem onClick={() => void move(occurrence, { mode: "root" })}>
                Remove from this parent
              </MenuItem>
            )}
          </Dropdown>
        </div>
        {!collapsed.includes(item.id) &&
          childList.map((child) => renderRow(child, depth + 1, item.id, key))}
      </React.Fragment>
    );
  };
  const groups = new Map<string, Row[]>();
  for (const item of roots) {
    const key =
      group === "status"
        ? INITIATIVE_STATUSES.find((status) => status.value === item.status)
            ?.label || item.status
        : group === "owner"
          ? displayNameFor(
              data.users.find((user) => user.id === item.ownerId),
              data,
              "No owner",
            )
          : group === "team"
            ? data.teams.find(
                (team) => team.id === (item.leadTeamId || item.teamId),
              )?.name || "No lead team"
            : group === "priority"
              ? priorityName(item.priority)
              : "";
    groups.set(key, [...(groups.get(key) || []), item]);
  }
  return (
    <div
      className={
        "feature-initiative-rows initiative-tree " +
        (drag.current ? "dragging" : "")
      }
      role="region"
      aria-label="Initiative hierarchy"
      onClickCapture={(event) => {
        if (suppressClick.current) {
          event.preventDefault();
          event.stopPropagation();
          suppressClick.current = false;
        }
      }}
      onDragOver={(event) => {
        if (
          event.dataTransfer.types.includes(
            "application/x-parabolic-initiative",
          )
        ) {
          event.preventDefault();
          setTarget({
            id: "root",
            destination: { parentId: scopeId, mode: "root" },
          });
        }
      }}
      onDrop={(event) => drop(event, { parentId: scopeId, mode: "root" })}
    >
      {[...groups].map(([name, items]) => (
        <React.Fragment key={name}>
          {name && (
            <h3 className="initiative-group-title">
              {name} <span className="muted">{items.length}</span>
            </h3>
          )}
          {items.map((item) => renderRow(item, 0, scopeId))}
        </React.Fragment>
      ))}
      {!roots.length && (
        <DirectoryEmpty
          kind="initiatives"
          filtered={emptyTitle ? false : !!query || !!list.length}
          onCreate={emptyCreate}
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
        />
      )}
      <div
        className={
          "initiative-root-drop " + (target?.id === "root" ? "active" : "")
        }
        aria-label={scopeId ? "Move to this initiative" : "Move to top level"}
      >
        Drop here to move {scopeId ? "to this initiative" : "to the top level"}.
        Hold Option/Alt over a row to nest.
      </div>
    </div>
  );
}
