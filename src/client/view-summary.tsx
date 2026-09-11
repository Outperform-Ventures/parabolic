import { ViewOwner } from "./features/view-owner";
import { plain } from "./features/shared";
import { issueEffort } from "../shared/estimates";
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Entity } from "../shared/types";
import { useAppStore } from "./store";
import { Avatar, Icon, PriorityIcon } from "./components/ui";
import { displayNameFor } from "./display-name";
import { EntityIcon } from "./features/entity-icon";
import { SavedViewIconPicker } from "./saved-view-controls";
import { ViewDetailsMenu } from "./view-subscriptions";
import "./view-summary.css";

const defaultTabs = ["Assignees", "Labels", "Priority", "Projects"] as const;
const savedTeamTabs = ["Assignees", "Labels", "Projects"] as const;
const savedWorkspaceTabs = [
  "Assignees",
  "Labels",
  "Projects",
  "Teams",
] as const;
type SummaryTab = "Assignees" | "Labels" | "Priority" | "Projects" | "Teams";
export type SummarySelection = {
  field: "assigneeId" | "labelIds" | "priority" | "projectId" | "teamId";
  value: string;
};
const fields = {
  Assignees: "assigneeId",
  Labels: "labelIds",
  Priority: "priority",
  Projects: "projectId",
  Teams: "teamId",
} as const;
export function matchesSummary(
  issue: Entity,
  selection: SummarySelection | null,
) {
  if (!selection) return true;
  const values =
    selection.field === "labelIds"
      ? issue.labelIds?.length
        ? issue.labelIds
        : [""]
      : [issue[selection.field] ?? (selection.field === "priority" ? 0 : "")];
  return values.some((value: unknown) => String(value) === selection.value);
}
export function ViewSummary({
  rows,
  selection,
  onSelect,
  measure,
  onMeasureChange,
  onClose,
  view,
  onEditView,
  onDeleteView,
}: {
  view?: Entity;
  rows: Entity[];
  selection: SummarySelection | null;
  onSelect: (value: SummarySelection | null) => void;
  measure: "issues" | "estimate";
  onMeasureChange: () => void;
  onClose: () => void;
  onEditView?: () => void;
  onDeleteView?: () => void;
}) {
  const store = useAppStore(),
    { data } = store,
    [tab, setTab] = useState<SummaryTab>("Assignees"),
    tabList = useRef<HTMLDivElement>(null);
  const localIssueTab =
    !!view &&
    (view.nativePlacement === "localIssueTab" ||
      /\/team\/[^/]+\/view\//.test(String(view.sourceUrl || "")));
  const tabs: readonly SummaryTab[] = view
      ? view.teamId
        ? savedTeamTabs
        : savedWorkspaceTabs
      : defaultTabs,
    field = fields[tab];
  useEffect(() => {
    if (!tabs.includes(tab)) {
      setTab("Assignees");
      onSelect(null);
    }
  }, [tab, tabs, onSelect]);
  const groups = useMemo(() => {
    const map = new Map<
      string,
      {
        value: string;
        count: number;
        estimate: number;
        name: string;
        entity?: Entity;
      }
    >();
    for (const issue of rows) {
      const values =
        field === "labelIds"
          ? issue.labelIds?.length
            ? [...new Set(issue.labelIds)]
            : [""]
          : [issue[field] ?? (field === "priority" ? 0 : "")];
      for (const raw of values) {
        const value = String(raw);
        let group = map.get(value);
        if (!group) {
          const entity = (
            field === "assigneeId"
              ? data.users
              : field === "projectId"
                ? data.projects
                : field === "labelIds"
                  ? data.labels
                  : field === "teamId"
                    ? data.teams
                    : []
          ).find((item) => item.id === value);
          const name =
            field === "priority"
              ? ["No priority", "Urgent", "High", "Medium", "Low"][
                  Number(value)
                ] || "No priority"
              : field === "assigneeId"
                ? value
                  ? displayNameFor(entity, data, "Member")
                  : "No assignee"
                : entity?.name ||
                  (field === "labelIds"
                    ? "No labels"
                    : field === "teamId"
                      ? "No team"
                      : "No project");
          group = { value, count: 0, estimate: 0, name, entity };
          map.set(value, group);
        }
        group.count++;
        group.estimate += issueEffort(
          issue,
          data.teams.find((team) => team.id === issue.teamId),
        );
      }
    }
    return [...map.values()].sort((a, b) =>
      field === "priority"
        ? (Number(a.value) || 5) - (Number(b.value) || 5)
        : (measure === "estimate"
            ? b.estimate - a.estimate
            : b.count - a.count) || a.name.localeCompare(b.name),
    );
  }, [
    rows,
    field,
    data.users,
    data.projects,
    data.labels,
    data.teams,
    measure,
  ]);
  const changeTab = (next: SummaryTab) => {
    setTab(next);
    onSelect(null);
  };
  const favorite = view
    ? data.favorites.find(
        (item) => item.entityId === view.id && item.userId === store.user?.id,
      )
    : undefined;
  return (
    <aside
      className={`view-summary${localIssueTab ? " view-summary-local-tab" : ""}`}
      aria-label="Issue summary"
    >
      {view && (
        <>
          <div className="view-summary-card view-summary-description">
            <div className="view-summary-heading">
              {localIssueTab ? (
                <EntityIcon entity={view} fallback="Layers" size={16} />
              ) : (
                <SavedViewIconPicker view={view} />
              )}
              <strong>{view.name}</strong>
              {!localIssueTab && (
                <>
                  <button
                    className="icon-button"
                    aria-label={favorite ? "Unfavorite view" : "Favorite view"}
                    aria-pressed={!!favorite}
                    onClick={() =>
                      favorite
                        ? void store.remove("favorites", favorite.id)
                        : void store.create("favorites", {
                            type: "view",
                            entityId: view.id,
                            userId: store.user?.id,
                            label: view.name,
                            route: "/view/" + view.id,
                          })
                    }
                  >
                    <Icon
                      name="Star"
                      size={14}
                      style={{ fill: favorite ? "currentColor" : undefined }}
                    />
                  </button>
                  <ViewDetailsMenu
                    view={view}
                    onEdit={onEditView ?? (() => {})}
                    onDelete={onDeleteView ?? (() => {})}
                  />
                </>
              )}
            </div>
            {!localIssueTab && (
              <p>{plain(view.description || view.source?.description || "")}</p>
            )}
          </div>
          <div className="view-summary-card view-summary-properties">
            {!localIssueTab && (
              <div className="view-summary-visibility">
                <span>Visibility</span>
                <span>
                  <Icon
                    name={
                      view.visibility === "private" ||
                      view.visibility === "personal"
                        ? "Lock"
                        : "Users"
                    }
                    size={14}
                  />
                  {view.visibility === "private" ||
                  view.visibility === "personal"
                    ? "Personal"
                    : view.teamId
                      ? "Team"
                      : "Workspace"}
                </span>
              </div>
            )}
            <ViewOwner view={view} />
          </div>
        </>
      )}
      <div className="view-summary-card view-summary-breakdown">
        <div
          className="view-summary-tabs"
          ref={tabList}
          role="tablist"
          aria-label="Summarize issues by"
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
              return;
            event.preventDefault();
            event.stopPropagation();
            const index =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? tabs.length - 1
                  : (tabs.indexOf(tab) +
                      (event.key === "ArrowRight" ? 1 : -1) +
                      tabs.length) %
                    tabs.length;
            changeTab(tabs[index]);
            (
              tabList.current?.querySelectorAll('[role="tab"]')[
                index
              ] as HTMLElement
            )?.focus();
          }}
        >
          {tabs.map((name) => (
            <button
              key={name}
              role="tab"
              aria-selected={tab === name}
              tabIndex={tab === name ? 0 : -1}
              id={"summary-tab-" + name}
              aria-controls="view-summary-panel"
              onClick={() => changeTab(name)}
            >
              {name}
            </button>
          ))}
        </div>
        <div
          className="view-summary-rows"
          role="tabpanel"
          id="view-summary-panel"
          aria-labelledby={"summary-tab-" + tab}
        >
          {groups.map((group) => {
            const active =
              selection?.field === field && selection.value === group.value;
            return (
              <div
                key={group.value}
                className={"view-summary-row " + (active ? "selected" : "")}
              >
                <button
                  className="view-summary-filter"
                  aria-label={`Filter by ${group.name}`}
                  aria-pressed={active}
                  onClick={() =>
                    onSelect(active ? null : { field, value: group.value })
                  }
                >
                  {field === "priority" ? (
                    <PriorityIcon priority={Number(group.value)} />
                  ) : field === "assigneeId" ? (
                    <Avatar user={group.entity} size={16} />
                  ) : field === "projectId" ? (
                    <EntityIcon
                      entity={group.entity}
                      fallback="Box"
                      size={16}
                    />
                  ) : field === "teamId" ? (
                    <EntityIcon
                      entity={group.entity}
                      fallback="Users"
                      size={16}
                    />
                  ) : (
                    <span
                      className="view-summary-label"
                      style={{
                        background: group.entity?.color || "var(--subtle)",
                      }}
                    />
                  )}
                  <span>{group.name}</span>
                  <span
                    className="view-summary-quick-filter"
                    aria-hidden="true"
                  >
                    <Icon name={active ? "X" : "Filter"} size={12} />
                  </span>
                </button>
                <button
                  className="view-summary-count"
                  title={
                    measure === "issues"
                      ? "Show estimate totals"
                      : "Show issue counts"
                  }
                  aria-label={`${group.name}: ${measure === "issues" ? group.count + " issues" : group.estimate + " estimate points"}. ${measure === "issues" ? "Show estimates" : "Show issue counts"}`}
                  onClick={onMeasureChange}
                >
                  {measure === "estimate" && (
                    <EntityIcon entity={{ icon: "Estimate" }} size={12} />
                  )}{" "}
                  {measure === "issues" ? group.count : group.estimate}
                </button>
              </div>
            );
          })}
          {!groups.length && <p className="muted">No issues in this view</p>}
        </div>
      </div>
    </aside>
  );
}
