import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Entity, EntityKind } from "../../shared/types";
import { useAppStore } from "../store";
import { Button, Dropdown, Icon, MenuItem, StatusIcon } from "../components/ui";
import { Header, SearchBox, Tabs, Blank, date } from "./shared";
import { IssueFilterMenu } from "../issue-filter-menu";
import { FilterBuilder, issueName } from "../issues";
import { IssueActionFilter } from "../issue-action-filter";
import { IssueActionSubmenu } from "../issue-action-submenu";
import { IssueDeleteConfirmation } from "../issue-delete-confirmation";
import { matchesFilter, type FilterSpec } from "../query";
import { filterLabelRecords } from "../../shared/label-filter-values";
import "./archive.css";

const kinds: Record<string, EntityKind> = {
  Issues: "issues",
  Projects: "projects",
  Cycles: "cycles",
  Initiatives: "initiatives",
  Documents: "documents",
};
const routes: Record<string, string> = {
  issues: "issues",
  projects: "project",
  cycles: "cycles",
  initiatives: "initiative",
  documents: "document",
};
export function ArchivePage() {
  const store = useAppStore(),
    navigate = useNavigate(),
    { teamId: pathTeamId, archiveTab } = useParams(),
    [params, setParams] = useSearchParams();
  const teamArchive = !!pathTeamId,
    teamId = pathTeamId ?? params.get("team"),
    team = store.data.teams.find((t) => t.id === teamId),
    nativeTab = archiveTab ?? "issues",
    deleted = teamArchive
      ? nativeTab.startsWith("recently-deleted")
      : params.get("deleted") === "1",
    nativeKind =
      nativeTab === "projects" || nativeTab === "recently-deleted-projects"
        ? "Projects"
        : nativeTab === "cycles"
          ? "Cycles"
          : nativeTab === "recently-deleted-initiatives"
            ? "Initiatives"
            : nativeTab === "recently-deleted-documents"
              ? "Documents"
              : "Issues",
    tab = teamArchive
      ? nativeKind
      : Object.hasOwn(kinds, params.get("type") ?? "")
        ? params.get("type")!
        : "Issues",
    kind = kinds[tab];
  const [query, setQuery] = useState(""),
    [selected, setSelected] = useState<Set<string>>(new Set()),
    [focused, setFocused] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [descending, setDescending] = useState(true),
    [filterOpen, setFilterOpen] = useState(false),
    [advancedFilterOpen, setAdvancedFilterOpen] = useState(false),
    [filter, setFilter] = useState<FilterSpec>({ match: "all", conditions: [] }),
    [context, setContext] = useState<{
      issue: Entity;
      x: number;
      y: number;
    } | null>(null),
    [deleteTarget, setDeleteTarget] = useState<Entity | null>(null);
  const scroll = useRef<HTMLDivElement>(null),
    anchor = useRef(0);
  const candidates = useMemo(() => {
    const projects = new Set(
      store.data.projects
        .filter(
          (p) => !teamId || p.teamId === teamId || p.teamIds?.includes(teamId),
        )
        .map((p) => p.id),
    );
    const belongs = (item: Entity) =>
      !teamId ||
      item.teamId === teamId ||
      item.teamIds?.includes(teamId) ||
      item.leadTeamId === teamId ||
      (item.projectId && projects.has(item.projectId)) ||
      (kind === "initiatives" &&
        store.data.projects.some(
          (p) =>
            projects.has(p.id) &&
            (p.initiativeId === item.id || p.initiativeIds?.includes(item.id)),
        ));
    return store.data[kind].filter(
      (item) =>
        belongs(item) &&
        (deleted ? item.deletedAt : item.archivedAt && !item.deletedAt),
    );
  }, [store.data, kind, deleted, teamId]);
  const rows = useMemo(() => {
    return candidates
      .filter(
        (item) =>
          `${item.identifier ?? ""} ${item.name ?? item.title ?? ""}`
            .toLowerCase()
            .includes(query.toLowerCase()) &&
          (kind !== "issues" ||
            matchesFilter(
              item,
              filter,
              filterLabelRecords(store.data),
              store.data.projects,
              store.data.cycles,
              undefined,
              store.user?.id,
              store.data.issues,
              store.data.milestones,
            )),
      )
      .sort(
        (a, b) =>
          String(a.deletedAt ?? a.archivedAt).localeCompare(
            String(b.deletedAt ?? b.archivedAt),
          ) * (descending ? -1 : 1),
      );
  }, [candidates, kind, query, descending, filter, store.data, store.user?.id]);
  const virtual = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scroll.current,
    estimateSize: () => 44,
    overscan: 6,
  });
  useEffect(() => {
    setSelected(new Set());
    setFocused(0);
    anchor.current = 0;
    setError("");
  }, [kind, deleted, teamId, query, filter]);
  useEffect(() => {
    setFilter({ match: "all", conditions: [] });
    setAdvancedFilterOpen(false);
    setFilterOpen(false);
  }, [kind, deleted, teamId]);
  const param = (key: string, value: string | null) =>
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      value ? next.set(key, value) : next.delete(key);
      return next;
    });
  const select = (index: number, extend = false, toggle = false) => {
    const item = rows[index];
    if (!item) return;
    setFocused(index);
    if (extend) {
      const [from, to] = [anchor.current, index].sort((a, b) => a - b);
      setSelected(
        (old) =>
          new Set([...old, ...rows.slice(from, to + 1).map((i) => i.id)]),
      );
    } else if (toggle) {
      anchor.current = index;
      setSelected((old) => {
        const next = new Set(old);
        next.has(item.id) ? next.delete(item.id) : next.add(item.id);
        return next;
      });
    } else {
      anchor.current = index;
      setSelected(new Set([item.id]));
    }
  };
  const restore = async (ids: string[]) => {
    if (!ids.length || busy) return;
    setBusy(true);
    setError("");
    try {
      await store.batch(
        ids.map((id) => ({
          kind,
          id,
          action: deleted ? ("restore" as const) : ("update" as const),
          ...(deleted ? {} : { data: { archivedAt: null } }),
        })),
      );
      setSelected(new Set());
      store.toast(
        `${ids.length === 1 ? tab.slice(0, -1) : `${ids.length} ${tab.toLowerCase()}`} restored`,
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not restore these items",
      );
    } finally {
      setBusy(false);
    }
  };
  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    store.toast("Copied to clipboard");
    setContext(null);
  };
  const issueUrl = (issue: Entity) =>
    `${location.origin}/issues/${encodeURIComponent(issue.id)}`;
  const openIssueOutside = (issue: Entity, target: "tab" | "window") => {
    const route = `/issues/${issue.id}`;
    if (window.desktop)
      target === "tab"
        ? window.desktop.newTab(route)
        : window.desktop.newWindow(route);
    else window.open(route, "_blank", "noopener,noreferrer");
    setContext(null);
  };
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        (event.target as HTMLElement).closest(
          "input:not([type=checkbox]):not([type=radio]),textarea,select,[contenteditable=true],[role=dialog]",
        )
      )
        return;
      const mod = /Mac|iPhone|iPad/.test(navigator.platform)
        ? event.metaKey
        : event.ctrlKey;
      if (event.key === "#") {
        event.preventDefault();
        event.stopImmediatePropagation();
        void restore(
          selected.size
            ? [...selected]
            : rows[focused]
              ? [rows[focused].id]
              : [],
        );
      } else if (mod && event.key.toLowerCase() === "a") {
        event.preventDefault();
        event.stopImmediatePropagation();
        setSelected(new Set(rows.map((i) => i.id)));
      } else if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        setSelected(new Set());
      } else if (
        ["ArrowDown", "ArrowUp", "j", "k"].includes(event.key) &&
        !mod &&
        !event.altKey
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const index = Math.max(
          0,
          Math.min(
            rows.length - 1,
            focused + (["ArrowDown", "j"].includes(event.key) ? 1 : -1),
          ),
        );
        select(index, event.shiftKey);
        virtual.scrollToIndex(index);
      } else if (event.key === "Enter" && rows[focused]) {
        event.preventDefault();
        event.stopImmediatePropagation();
        navigate(`/${routes[kind]}/${rows[focused].id}`);
      }
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  });
  return (
    <section className="feature-page archive-page">
      <Header
        title={
          teamArchive
            ? deleted
              ? `Recently deleted ${tab.toLowerCase()}`
              : `Archived ${tab.toLowerCase()}`
            : deleted
              ? "Recently deleted"
              : "Archive"
        }
        icon={<Icon name="Archive" />}
        breadcrumb={
          teamArchive && team
            ? { title: "Team overview", to: `/team/${team.id}/overview` }
            : undefined
        }
      >
        {teamId && !teamArchive && (
          <Button
            variant="ghost"
            aria-label="Clear team filter"
            onClick={() => param("team", null)}
          >
            {team?.name ?? "Team"}
            <Icon name="X" size={12} />
          </Button>
        )}
        {teamArchive && kind === "issues" ? (
          <IssueFilterMenu
            value={filter}
            onChange={setFilter}
            teamId={teamId ?? undefined}
            issues={candidates}
            excludeFields={["cycleId", "milestoneId"]}
            onAdvanced={() => setAdvancedFilterOpen(true)}
            trigger={
              <button
                className="icon-button circle-button"
                aria-label="Add filter"
              >
                <Icon name="Filter" size={14} />
              </button>
            }
          />
        ) : teamArchive ? (
          <button
            className="icon-button circle-button"
            aria-label="Add filter"
            aria-expanded={filterOpen}
            onClick={() => setFilterOpen(!filterOpen)}
          >
            <Icon name="Filter" size={14} />
          </button>
        ) : (
          <>
            <SearchBox value={query} onChange={setQuery} />
            <Button onClick={() => param("deleted", deleted ? null : "1")}>
              {deleted ? "View archive" : "Recently deleted"}
            </Button>
          </>
        )}
      </Header>
      {teamArchive && kind !== "issues" && filterOpen && (
        <div className="archive-native-filter">
          <SearchBox value={query} onChange={setQuery} />
        </div>
      )}
      {teamArchive && kind === "issues" && advancedFilterOpen && (
        <div className="archive-native-filter">
          <button
            type="button"
            className="text-button"
            onClick={() => setAdvancedFilterOpen(false)}
          >
            Close advanced filter
          </button>
          <FilterBuilder
            value={filter}
            onChange={setFilter}
            teamId={teamId ?? undefined}
          />
        </div>
      )}
      {teamArchive ? (
        <nav
          className="feature-tabs archive-native-tabs"
          aria-label="Archive views"
        >
          {[
            ["Issues", "issues"],
            ["Projects", "projects"],
            ["Cycles", "cycles"],
            ["Recently deleted issues", "recently-deleted"],
            ["Recently deleted projects", "recently-deleted-projects"],
            ["Recently deleted initiatives", "recently-deleted-initiatives"],
            ["Recently deleted documents", "recently-deleted-documents"],
          ].map(([label, path]) => (
            <Link
              key={path}
              className={nativeTab === path ? "active" : ""}
              aria-current={nativeTab === path ? "page" : undefined}
              to={`/team/${teamId}/archive/${path}`}
            >
              {label}
            </Link>
          ))}
        </nav>
      ) : (
        <Tabs
          items={Object.keys(kinds)}
          active={tab}
          onChange={(value) => param("type", value)}
        />
      )}
      <div className="archive-toolbar">
        <span>
          {rows.length.toLocaleString()} {deleted ? "deleted" : "archived"}{" "}
          {tab.toLowerCase()}
          {selected.size ? ` · ${selected.size.toLocaleString()} selected` : ""}
        </span>
        <span className="spacer" />
        {selected.size > 0 && (
          <Button disabled={busy} onClick={() => void restore([...selected])}>
            {busy ? "Restoring…" : `Restore ${selected.size} selected`}
          </Button>
        )}
      </div>
      {error && (
        <p className="error archive-error" role="alert">
          {error}
        </p>
      )}
      {rows.length ? (
        <>
          <div className="archive-columns">
            <input
              type="checkbox"
              aria-label="Select all archived items"
              checked={!!rows.length && selected.size === rows.length}
              onChange={(e) =>
                setSelected(
                  e.target.checked ? new Set(rows.map((i) => i.id)) : new Set(),
                )
              }
            />
            <span>Name</span>
            <button
              aria-label="Change archive date order"
              onClick={() => setDescending(!descending)}
            >
              {deleted ? "Deleted" : "Archived"}
              <Icon name={descending ? "ArrowDown" : "ArrowUp"} size={12} />
            </button>
            <span />
          </div>
          <div
            className="archive-scroll"
            ref={scroll}
            role="table"
            aria-label={`${deleted ? "Deleted" : "Archived"} ${tab.toLowerCase()}`}
            aria-rowcount={rows.length}
          >
            <div
              style={{ height: virtual.getTotalSize(), position: "relative" }}
            >
              {virtual.getVirtualItems().map((v) => {
                const item = rows[v.index],
                  status = store.data.statuses.find(
                    (s) => s.id === item.statusId,
                  );
                return (
                  <div
                    key={item.id}
                    className={`archive-row ${selected.has(item.id) ? "selected" : ""} ${focused === v.index ? "focused" : ""}`}
                    data-archive-id={item.id}
                    role="row"
                    aria-selected={selected.has(item.id)}
                    tabIndex={0}
                    style={{
                      position: "absolute",
                      top: 0,
                      transform: `translateY(${v.start}px)`,
                      height: v.size,
                      width: "100%",
                    }}
                    onClick={(event) => {
                      if (event.shiftKey || event.metaKey || event.ctrlKey)
                        select(
                          v.index,
                          event.shiftKey,
                          event.metaKey || event.ctrlKey,
                        );
                      else if (kind === "issues")
                        navigate(`/${routes[kind]}/${item.id}`);
                      else select(v.index);
                    }}
                    onDoubleClick={() =>
                      navigate(`/${routes[kind]}/${item.id}`)
                    }
                    onContextMenu={(event) => {
                      if (!teamArchive || kind !== "issues") return;
                      event.preventDefault();
                      setFocused(v.index);
                      setContext({
                        issue: item,
                        x: event.clientX,
                        y: event.clientY,
                      });
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        navigate(`/${routes[kind]}/${item.id}`);
                      } else if (
                        event.key === "F10" &&
                        event.shiftKey &&
                        teamArchive &&
                        kind === "issues"
                      ) {
                        event.preventDefault();
                        const rect = event.currentTarget.getBoundingClientRect();
                        setContext({
                          issue: item,
                          x: rect.left + 80,
                          y: rect.top + 20,
                        });
                      }
                    }}
                  >
                    <input
                      type="checkbox"
                      aria-label={`Select ${item.title ?? item.name}`}
                      checked={selected.has(item.id)}
                      onClick={(event) => event.stopPropagation()}
                      onChange={() => select(v.index, false, true)}
                    />
                    <button
                      className="archive-item-name"
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate(`/${routes[kind]}/${item.id}`);
                      }}
                    >
                      {kind === "issues" ? (
                        <StatusIcon status={status} />
                      ) : (
                        <Icon
                          name={
                            kind === "projects"
                              ? "Box"
                              : kind === "cycles"
                                ? "Repeat"
                                : kind === "documents"
                                  ? "FileText"
                                  : "Layers"
                          }
                        />
                      )}
                      <span className="muted">{item.identifier}</span>
                      <strong>{item.title ?? item.name}</strong>
                    </button>
                    <time>{date(item.deletedAt ?? item.archivedAt)}</time>
                    <Button
                      disabled={busy}
                      onClick={(event) => {
                        event.stopPropagation();
                        void restore([item.id]);
                      }}
                    >
                      Restore
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : store.initialSyncing ? (
        <div className="archive-loading muted">Loading archive…</div>
      ) : (
        <Blank
          icon={<Icon name="Archive" size={30} />}
          title={
            teamArchive && nativeTab === "recently-deleted-initiatives"
              ? `No matching ${tab.toLowerCase()}`
              : `No ${deleted ? "deleted" : "archived"} ${tab.toLowerCase()}`
          }
          description={
            teamArchive && nativeTab === "recently-deleted-initiatives"
              ? undefined
              : query
              ? "No items match your search."
              : `${deleted ? "Deleted" : "Archived"} items appear here and can be restored.`
          }
        />
      )}
      {context && kind === "issues" && (
        <Dropdown
          key={`${context.issue.id}:${context.x}:${context.y}`}
          trigger={<span />}
          position={{ x: context.x, y: context.y }}
          menuClassName="issue-context-menu archive-issue-context-menu"
          onOpenChange={(open) => {
            if (!open) setContext(null);
          }}
        >
          <IssueActionFilter compact status>
            <IssueActionSubmenu label="Copy">
              <MenuItem shortcut="⌘ ." onClick={() => void copy(issueName(context.issue))}>
                Copy ID
              </MenuItem>
              <MenuItem shortcut="⌘ ⇧ ," onClick={() => void copy(issueUrl(context.issue))}>
                Copy URL
              </MenuItem>
              <MenuItem shortcut="⌘ ⇧ '" onClick={() => void copy(context.issue.title ?? "")}>
                Copy title
              </MenuItem>
              <MenuItem
                shortcut="⌘ C"
                onClick={() =>
                  void copy(
                    `[${issueName(context.issue)}: ${context.issue.title}](${issueUrl(context.issue)})`,
                  )
                }
              >
                Copy title as link
              </MenuItem>
              <MenuItem
                onClick={() =>
                  void copy(`- ${issueName(context.issue)} ${context.issue.title}`)
                }
              >
                Copy issue as Markdown
              </MenuItem>
              <MenuItem
                shortcut="⌘ ⌥ C"
                onClick={() =>
                  void copy(
                    `# ${issueName(context.issue)} ${context.issue.title}\n\n${context.issue.description ?? ""}`,
                  )
                }
              >
                Copy everything as Markdown
              </MenuItem>
              <MenuItem
                shortcut="⌘ ⇧ ."
                onClick={() =>
                  void copy(
                    `${String(context.issue.identifier ?? "issue").toLowerCase()}-${String(context.issue.title ?? "")
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/^-|-$/g, "")}`,
                  )
                }
              >
                Copy git branch name
              </MenuItem>
            </IssueActionSubmenu>
            {!deleted && (
              <MenuItem
                shortcut="⌘ ⌫"
                danger
                onClick={() => {
                  setDeleteTarget(context.issue);
                  setContext(null);
                }}
              >
                Delete
              </MenuItem>
            )}
            <MenuItem
              shortcut="#"
              onClick={() => {
                const issue = context.issue;
                setContext(null);
                void restore([issue.id]);
              }}
            >
              Restore
            </MenuItem>
            {deleted && (
              <>
                <MenuItem
                  shortcut="⌃ ,"
                  onClick={() => openIssueOutside(context.issue, "window")}
                >
                  Open in new window
                </MenuItem>
                <MenuItem onClick={() => openIssueOutside(context.issue, "tab")}>
                  Open in new tab
                </MenuItem>
              </>
            )}
          </IssueActionFilter>
        </Dropdown>
      )}
      {deleteTarget && (
        <IssueDeleteConfirmation
          issues={[deleteTarget]}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => store.remove("issues", deleteTarget.id)}
        />
      )}
    </section>
  );
}
