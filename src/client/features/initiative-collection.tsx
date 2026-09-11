import { ViewOwner } from "./view-owner";
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon, Dropdown } from "../components/ui";
import { NativeControlIcon } from "../components/sidebar-icons";
import type { FilterSpec } from "../query";
import {
  Action,
  SearchBox,
  optionList,
  priorities,
  useActions,
  live,
  type Row,
} from "./shared";
import { InitiativeFilterBuilder } from "./initiative-filters";
import { InitiativeTree } from "./initiative-tree";
import { ViewForm } from "./view-builder";
export const initiativeTabFilters = (tab: string): FilterSpec => ({
  match: "all",
  conditions:
    tab === "Active"
      ? [
          {
            field: "status",
            operator: "in",
            value: ["active", "started", "in progress", "paused"],
          },
        ]
      : tab === "Planned"
        ? [
            {
              field: "status",
              operator: "in",
              value: ["proposed", "planned", "backlog"],
            },
          ]
        : tab === "Completed"
          ? [
              {
                field: "status",
                operator: "in",
                value: ["completed", "canceled"],
              },
            ]
          : [],
});

const initiativeDisplayProperties = [
  ["description", "Description"],
  ["owner", "Owner"],
  ["status", "Status"],
  ["priority", "Priority"],
  ["teams", "Contributing teams"],
  ["health", "Health"],
  ["projects", "Projects"],
  ["activeProjects", "Active projects"],
  ["targetDate", "Target date"],
  ["created", "Created"],
  ["updated", "Updated"],
  ["completed", "Completed"],
  ["labels", "Labels"],
] as const;
const defaultInitiativeProperties = initiativeDisplayProperties
  .filter(
    ([key]) =>
      !["activeProjects", "created", "updated", "completed", "labels"].includes(
        key,
      ),
  )
  .map(([key]) => key);

export function InitiativeCollection({
  view,
  scopeId,
  teamId,
  tab = "All initiatives",
}: {
  view?: Row;
  scopeId?: string;
  teamId?: string;
  tab?: string;
}) {
  const { data, user, update, act } = useActions(),
    navigate = useNavigate();
  const [query, setQuery] = useState(view?.searchQuery || ""),
    [group, setGroup] = useState(view?.display?.grouping || "none"),
    [ordering, setOrdering] = useState(view?.display?.ordering || "manual"),
    [properties, setProperties] = useState<string[]>(
      view?.display?.properties || defaultInitiativeProperties,
    ),
    [owner, setOwner] = useState(""),
    [team, setTeam] = useState(teamId || ""),
    [priority, setPriority] = useState(""),
    [label, setLabel] = useState(""),
    [filters, setFilters] = useState<FilterSpec>(
      view?.filters?.conditions ? view.filters : initiativeTabFilters(tab),
    ),
    [filterOpen, setFilterOpen] = useState(false),
    [filterMenuQuery, setFilterMenuQuery] = useState(""),
    [saving, setSaving] = useState(false);
  const collapseKey = `parabolic:initiatives:collapsed:${user?.id}:${data.workspaceId}:${scopeId || "workspace"}`;
  const [collapsed, setCollapsed] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(collapseKey) || "[]");
    } catch {
      return [];
    }
  });
  useEffect(() => {
    localStorage.setItem(collapseKey, JSON.stringify(collapsed));
  }, [collapsed, collapseKey]);
  useEffect(() => {
    if (!view) setFilters(initiativeTabFilters(tab));
  }, [tab, view]);
  useEffect(() => {
    if (!view) return;
    setFilters(
      view.filters?.conditions
        ? view.filters
        : { match: "all", conditions: [] },
    );
    setGroup(view.display?.grouping || "none");
    setOrdering(view.display?.ordering || "manual");
    setProperties(view.display?.properties || defaultInitiativeProperties);
    setQuery(view.searchQuery || "");
    setOwner("");
    setTeam("");
    setPriority("");
    setLabel("");
  }, [view?.id, view?.filters, view?.display, view?.searchQuery]);
  const activeFilters = useMemo<FilterSpec>(() => {
    const extras = [
      ...(owner ? [{ field: "ownerId", operator: "eq", value: owner }] : []),
      ...(team ? [{ field: "leadTeamId", operator: "eq", value: team }] : []),
      ...(priority !== ""
        ? [{ field: "priority", operator: "eq", value: Number(priority) }]
        : []),
      ...(label ? [{ field: "labelIds", operator: "eq", value: label }] : []),
    ];
    return extras.length
      ? { match: "all", conditions: extras, groups: [filters] }
      : filters;
  }, [filters, owner, team, priority, label]);
  const viewFilters = activeFilters;
  const builtinFiltersUnchanged =
    !view &&
    !owner &&
    !team &&
    priority === "" &&
    !label &&
    JSON.stringify(filters) === JSON.stringify(initiativeTabFilters(tab));
  const nativePlannedEmpty =
    builtinFiltersUnchanged && tab === "Planned" && !query.trim();
  const changed =
    !!view &&
    (JSON.stringify(viewFilters) !== JSON.stringify(view.filters) ||
      group !== (view.display?.grouping || "none") ||
      ordering !== (view.display?.ordering || "manual") ||
      JSON.stringify(properties) !==
        JSON.stringify(
          view.display?.properties || defaultInitiativeProperties,
        ) ||
      query !== (view.searchQuery || ""));
  const collapseAll = () =>
    setCollapsed((current) =>
      current.length ? [] : live(data.initiatives).map((item) => item.id),
    );
  const openFilter = (field?: string) => {
    if (
      field &&
      !filters.conditions.some((condition) => condition.field === field)
    )
      setFilters({
        ...filters,
        conditions: [
          ...filters.conditions,
          { field, operator: "eq", value: "" },
        ],
      });
    setFilterOpen(true);
  };
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.key.toLowerCase() !== "t" ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey ||
        (event.target as Element)?.closest(
          "input,textarea,select,[contenteditable=true]",
        ) ||
        document.querySelector("[role=dialog],dialog[open]")
      )
        return;
      event.preventDefault();
      collapseAll();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [data.initiatives]);
  return (
    <div className="initiative-collection">
      {view && <ViewOwner view={view} />}
      <div className="initiative-filter-bar">
        <Dropdown
          align="right"
          onOpenChange={(open) => {
            if (!open) {
              setFilterOpen(false);
              setFilterMenuQuery("");
            }
          }}
          trigger={
            <button className="icon-button" aria-label="Add filter">
              <NativeControlIcon name="Add filter" size={14} />
            </button>
          }
        >
          {filterOpen ? (
            <div className="initiative-options" data-keep-open>
              <button
                type="button"
                className="menu-item"
                role="menuitem"
                onClick={() => setFilterOpen(false)}
              >
                <Icon name="ChevronLeft" size={13} />
                <span>Advanced filter</span>
              </button>
              <SearchBox value={query} onChange={setQuery} />
              <InitiativeFilterBuilder filters={filters} onChange={setFilters} />
            </div>
          ) : (
            <div className="initiative-filter-root" data-keep-open>
              <label className="feature-search">
                <Icon name="Search" size={14} />
                <input
                  autoFocus
                  aria-label="Add Filter…"
                  placeholder="Add Filter…"
                  value={filterMenuQuery}
                  onChange={(event) => setFilterMenuQuery(event.target.value)}
                />
              </label>
              {[
                ["", "Advanced filter", "ListFilter"],
                ["status", "Status", "CircleDashed"],
                ["priority", "Priority", "Signal"],
                ["ownerId", "Owner", "User"],
                ["creatorId", "Creator", "UserRound"],
                ["leadTeamId", "Contributing teams", "Users"],
                ["labelIds", "Labels", "Tag"],
                ["health", "Health", "Activity"],
                ["targetDate", "Dates", "CalendarDays"],
              ]
                .filter(([, label]) =>
                  label.toLowerCase().includes(filterMenuQuery.toLowerCase()),
                )
                .map(([field, label, icon], index) => (
                <React.Fragment key={field || "advanced"}>
                {index === 1 && !filterMenuQuery && <div className="menu-separator" />}
                <button
                  type="button"
                  role="menuitem"
                  className="menu-item"
                  aria-haspopup={field ? "menu" : undefined}
                  onClick={() => openFilter(field || undefined)}
                >
                  <Icon name={icon} size={14} />
                  <span>{label}</span>
                  <span className="spacer" />
                  {field && <Icon name="ChevronRight" size={12} />}
                </button>
                </React.Fragment>
              ))}
            </div>
          )}
        </Dropdown>
        <Dropdown
          align="right"
          trigger={
            <button className="icon-button" aria-label="Display options">
              <NativeControlIcon name="Display options" size={14} />
            </button>
          }
        >
          <div className="initiative-options" data-keep-open>
            <label>
              Grouping
              <select
                aria-label="Group initiatives"
                value={group}
                onChange={(event) => setGroup(event.target.value)}
              >
                {[
                  ["none", "No grouping"],
                  ["status", "Status"],
                  ["owner", "Owner"],
                  ["team", "Lead team"],
                  ["priority", "Priority"],
                ].map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ordering
              <select
                aria-label="Order initiatives"
                value={ordering}
                onChange={(event) => setOrdering(event.target.value)}
              >
                {[
                  ["name", "Name"],
                  ["status", "Status"],
                  ["manual", "Manual"],
                  ["healthUpdated", "Health updated"],
                  ["updated", "Updated"],
                  ["targetDate", "Target date"],
                  ["priority", "Priority"],
                ].map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <div
              className="initiative-display-properties"
              aria-label="Display properties"
            >
              <span>Display properties</span>
              {initiativeDisplayProperties.map(([key, label]) => (
                <button
                  type="button"
                  key={key}
                  aria-pressed={properties.includes(key)}
                  onClick={() =>
                    setProperties((current) =>
                      current.includes(key)
                        ? current.filter((value) => value !== key)
                        : [...current, key],
                    )
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <Action onClick={collapseAll}>
              {collapsed.length ? "Expand all" : "Collapse all"}
            </Action>
            {changed && (
              <Action
                onClick={() =>
                  void act(() =>
                    update("views", view!.id, {
                      filters: viewFilters,
                      searchQuery: query,
                      display: {
                        ...view!.display,
                        grouping: group,
                        ordering,
                        properties,
                      },
                    }),
                  )
                }
              >
                Save changes
              </Action>
            )}
            <Action onClick={() => setSaving(true)}>
              {view ? "Save as new view" : "Save view"}
            </Action>
          </div>
        </Dropdown>
      </div>
      {view?.description && (
        <p className="initiative-view-description">{view.description}</p>
      )}
      <InitiativeTree
        emptyCreate={() =>
          navigate(
            (teamId ? "/team/" + teamId + "/initiatives" : "/initiatives") +
              "?new=1",
          )
        }
        filters={activeFilters}
        query={query}
        group={group}
        ordering={ordering}
        properties={properties}
        scopeId={scopeId || view?.initiativeId}
        collapsed={collapsed}
        onCollapsed={setCollapsed}
        emptyTitle={nativePlannedEmpty ? "Upcoming initiatives" : undefined}
        emptyDescription={
          nativePlannedEmpty
            ? "Initiatives are larger, strategic product efforts that set the direction of your company. They are comprised of all projects that align with the goals of the initiative and allow you to monitor their progress at scale. Once you create an upcoming initiative that hasn’t started yet, it will show up here."
            : undefined
        }
      />
      {saving && (
        <ViewForm
          initialEntityType="initiatives"
          initialFilters={viewFilters}
          initialSearchQuery={query}
          initialDisplay={{ grouping: group, ordering, properties }}
          teamId={teamId}
          initiativeId={scopeId || view?.initiativeId}
          onClose={() => setSaving(false)}
          onSaved={(saved) =>
            navigate(
              saved.initiativeId
                ? `/initiative/${saved.initiativeId}/view-${saved.id}`
                : `/view/${saved.id}`,
            )
          }
        />
      )}
    </div>
  );
}
