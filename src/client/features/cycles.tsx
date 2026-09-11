import { guestCapabilities } from "../../shared/guest-capabilities";
import { issueEffort } from "../../shared/estimates";
import { CycleCalendarSubscription } from "./cycle-calendar-subscription";
import { CycleAssignees } from "./cycle-assignees";
import { EntityDocuments } from "./entity-documents";
import {
  cycleLocalDay,
  cycleInclusiveEnd,
  cycleExclusiveEnd,
} from "./cycle-calendar";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import { apiRequest } from "../store";
import { IssueList } from "../issues";
import { Button, Dropdown, Icon, MenuItem, RichEditor } from "../components/ui";
import { ProgressGraph } from "./progress-chart";
import {
  Action,
  AddButton,
  Blank,
  FormDialog,
  Header,
  live,
  optionList,
  Progress,
  SearchBox,
  Tabs,
  useActions,
  type Row,
} from "./shared";
import "./cycles.css";
const DAY = 86400000;
function teamToday(team: Row | undefined, workspace: Row | undefined) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: team?.timezone || workspace?.timezone || "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return ["year", "month", "day"]
    .map((key) => parts.find((part) => part.type === key)?.value)
    .join("-");
}
const day = (value: string) => String(value || "").slice(0, 10),
  dayTime = (value: string) => Date.parse(day(value) + "T12:00:00Z");
const dateLabel = (value: string, zone = "UTC") =>
  new Date(dayTime(cycleLocalDay(value, zone))).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
function cyclePhase(cycle: Row, now = Date.now()) {
  return cycle.completedAt || Date.parse(cycle.endDate) <= now
    ? "Completed"
    : Date.parse(cycle.startDate) > now
      ? "Upcoming"
      : "Current";
}
function cycleSummary(cycle: Row, issues: Row[], statuses: Row[], team?: Row) {
  if (cycle.completionSnapshot) return cycle.completionSnapshot;
  const types = new Map(statuses.map((status) => [status.id, status.type])),
    eligible = issues.filter(
      (issue) =>
        !["triage", "canceled", "cancelled", "duplicate"].includes(
          types.get(issue.statusId),
        ),
    ),
    unit = team?.estimateScale === "None" ? "issues" : "points";
  const weight = (issue: Row) => issueEffort(issue, team, unit);
  const started = eligible.filter(
      (issue) => types.get(issue.statusId) === "started",
    ),
    completed = eligible.filter(
      (issue) => types.get(issue.statusId) === "completed",
    );
  return {
    scope: eligible.reduce((sum, issue) => sum + weight(issue), 0),
    started: started.reduce((sum, issue) => sum + weight(issue), 0),
    completed: completed.reduce((sum, issue) => sum + weight(issue), 0),
    issueCount: eligible.length,
    startedIssueCount: started.length,
    completedIssueCount: completed.length,
    success: eligible.length
      ? ((completed.length + started.length * 0.25) / eligible.length) * 100
      : 0,
    unit,
  };
}
type CycleDialog = {
  type: "edit" | "dates" | "start" | "end" | "archive";
  cycle: Row;
};
export function CyclesPage() {
  const [searchParams, setSearchParams] = useSearchParams(),
    selectedAssignee = searchParams.get("assignee");
  const setAssignee = (id: string | null) => {
    const next = new URLSearchParams(searchParams);
    id === null ? next.delete("assignee") : next.set("assignee", id);
    setSearchParams(next);
  };
  const { cycleId, teamId } = useParams(),
    store = useActions(),
    { data } = store,
    nav = useNavigate(),
    canManage = !guestCapabilities(data, store.user?.id).guest;
  const [adding, setAdding] = useState(false),
    [dialog, setDialog] = useState<CycleDialog | null>(null),
    [tab, setTab] = useState("All cycles"),
    [assign, setAssign] = useState(false),
    [details, setDetails] = useState(true),
    [query, setQuery] = useState(""),
    [calendarTeam, setCalendarTeam] = useState<string | null>(null);
  useEffect(() => {
    if (!cycleId) return;
    const key = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== "i" ||
        event.altKey ||
        event.shiftKey ||
        !(/Mac/.test(navigator.platform) ? event.metaKey : event.ctrlKey) ||
        (event.target as Element)?.closest(
          "input,textarea,select,[contenteditable=true]",
        ) ||
        document.querySelector("[role=dialog],dialog[open]")
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      setDetails((value) => !value);
    };
    const command = (event: Event) => {
      if (
        event.defaultPrevented ||
        (event as CustomEvent).detail?.command !== "toggle-right-sidebar"
      )
        return;
      event.preventDefault();
      setDetails((value) => !value);
    };
    window.addEventListener("keydown", key, true);
    window.addEventListener("workspace-command", command, true);
    return () => {
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("workspace-command", command, true);
    };
  }, [cycleId]);
  const cycles = useMemo(
      () =>
        live(data.cycles)
          .filter((cycle) => !teamId || cycle.teamId === teamId)
          .sort((a, b) => Date.parse(b.startDate) - Date.parse(a.startDate)),
      [data.cycles, teamId],
    ),
    selected = cycles.find((cycle) => cycle.id === cycleId),
    issuesByCycle = useMemo(() => {
      const map = new Map<string, Row[]>();
      for (const issue of live(data.issues)) {
        if (!issue.cycleId) continue;
        const values = map.get(issue.cycleId) || [];
        values.push(issue);
        map.set(issue.cycleId, values);
      }
      return map;
    }, [data.issues]);
  const issues = selected ? issuesByCycle.get(selected.id) || [] : [],
    team = data.teams.find((item) => item.id === (selected?.teamId || teamId)),
    workspace = data.workspaces.find((item) => item.id === data.workspaceId),
    today = teamToday(team, workspace),
    zone = team?.timezone || workspace?.timezone || "UTC";
  const cycleRoute = (cycle: Row) =>
    teamId ? "/team/" + teamId + "/cycle/" + cycle.id : "/cycles/" + cycle.id;
  const nextFor = (cycle: Row) =>
    cycles
      .filter(
        (item) =>
          item.teamId === cycle.teamId && cyclePhase(item) === "Upcoming",
      )
      .sort((a, b) => Date.parse(a.startDate) - Date.parse(b.startDate))[0]
      ?.id === cycle.id;
  const favorite =
    selected &&
    data.favorites.find(
      (item) =>
        !item.deletedAt &&
        item.userId === store.user?.id &&
        item.entityId === selected.id,
    );
  const collectionFavorite =
    teamId &&
    !cycleId &&
    data.favorites.find(
      (item) =>
        !item.deletedAt &&
        item.userId === store.user?.id &&
        item.entityKind === "teams" &&
        item.entityId === teamId &&
        item.section === "cycles",
    );
  const toggleFavorite = () =>
    selected &&
    store.act(() =>
      favorite
        ? store.remove("favorites", favorite.id)
        : store.create("favorites", {
            userId: store.user?.id,
            entityId: selected.id,
            entityKind: "cycles",
            label: selected.name,
            route: cycleRoute(selected),
          }),
    );
  const toggleCollectionFavorite = () =>
    teamId &&
    team &&
    store.act(() =>
      collectionFavorite
        ? store.remove("favorites", collectionFavorite.id)
        : store.create("favorites", {
            userId: store.user?.id,
            entityId: teamId,
            entityKind: "teams",
            type: "team",
            section: "cycles",
            label: "Cycles " + team.name,
            route: "/team/" + teamId + "/cycles",
          }),
    );
  const copyCycleLink = (cycle: Row) =>
    void navigator.clipboard.writeText(
      new URL(cycleRoute(cycle), location.origin).href,
    );
  const exportCycle = (cycle: Row) => {
    const escape = (value: unknown) =>
        '"' + String(value ?? "").replaceAll('"', '""') + '"',
      rows = issuesByCycle.get(cycle.id) || [],
      csv = [
        "Identifier,Title,Status,Priority,Assignee,Project",
        ...rows.map((issue) =>
          [
            issue.identifier,
            issue.title,
            data.statuses.find((status) => status.id === issue.statusId)?.name,
            issue.priority,
            data.users.find((person) => person.id === issue.assigneeId)?.name,
            data.projects.find((project) => project.id === issue.projectId)
              ?.name,
          ]
            .map(escape)
            .join(","),
        ),
      ].join("\n"),
      link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = cycle.name + ".csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 0);
  };
  const menu = (cycle: Row, detail = false) =>
    detail ? (
      <Dropdown
        align="right"
        trigger={
          <button
            type="button"
            className="icon-button"
            aria-label="Cycle options"
          >
            <Icon name="MoreHorizontal" size={16} />
          </button>
        }
      >
        {canManage && (
          <MenuItem onClick={() => setDialog({ type: "edit", cycle })}>
            Edit cycle name and description…
          </MenuItem>
        )}
        <MenuItem shortcut="⌥ F" onClick={() => void toggleFavorite()}>
          {favorite ? "Unfavorite" : "Favorite"}
        </MenuItem>
        <MenuItem onClick={() => copyCycleLink(cycle)}>Copy link</MenuItem>
        <MenuItem onClick={() => setCalendarTeam(cycle.teamId)}>
          Subscribe to cycle calendar
        </MenuItem>
        <MenuItem onClick={() => exportCycle(cycle)}>
          Export issues as CSV…
        </MenuItem>
      </Dropdown>
    ) : (
      <Dropdown
        align="right"
        trigger={
          <button
            type="button"
            className="icon-button"
            aria-label={"Cycle actions: " + cycle.name}
          >
            <Icon name="MoreHorizontal" size={16} />
          </button>
        }
      >
        {canManage && (
          <>
            <MenuItem onClick={() => setDialog({ type: "edit", cycle })}>
              Edit cycle…
            </MenuItem>
            {cyclePhase(cycle) !== "Completed" && (
              <MenuItem onClick={() => setDialog({ type: "dates", cycle })}>
                Change cycle dates…
              </MenuItem>
            )}
            {nextFor(cycle) && (
              <MenuItem onClick={() => setDialog({ type: "start", cycle })}>
                Start cycle today
              </MenuItem>
            )}
            {cyclePhase(cycle) === "Current" && (
              <MenuItem onClick={() => setDialog({ type: "end", cycle })}>
                End cycle today
              </MenuItem>
            )}
          </>
        )}
        <MenuItem onClick={() => setCalendarTeam(cycle.teamId)}>
          Subscribe to cycle calendar
        </MenuItem>
        <MenuItem onClick={() => copyCycleLink(cycle)}>
          Copy cycle link
        </MenuItem>
        {canManage && cyclePhase(cycle) === "Completed" && (
          <MenuItem onClick={() => setDialog({ type: "archive", cycle })}>
            Archive cycle
          </MenuItem>
        )}
      </Dropdown>
    );
  const visible = cycles.filter(
    (cycle) =>
      (tab === "All cycles" || cyclePhase(cycle) === tab) &&
      (cycle.name + " " + (cycle.description || ""))
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const current = cycles.filter((cycle) => cyclePhase(cycle) === "Current");
  const summary = selected
    ? cycleSummary(selected, issues, data.statuses, team)
    : null;
  return (
    <section className="feature-page cycle-workspace">
      <Header
        title={selected ? selected.name : "Cycles"}
        icon={<Icon name="CircleDashed" size={16} />}
        breadcrumb={
          selected
            ? {
                title: "Cycles",
                to: team ? "/team/" + team.id + "/cycles" : "/cycles",
              }
            : undefined
        }
      >
        {selected ? (
          <>
            <button
              className="icon-button"
              role="switch"
              aria-checked={!!favorite}
              aria-label={
                favorite ? "Remove from favorites" : "Add to favorites"
              }
              onClick={() => void toggleFavorite()}
            >
              <Icon
                name="Star"
                size={15}
                style={{ fill: favorite ? "currentColor" : undefined }}
              />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={
                details ? "Close cycle details" : "Open cycle details"
              }
              aria-expanded={details}
              onClick={() => setDetails(!details)}
            >
              <Icon name="PanelRight" size={16} />
            </button>
            {menu(selected, cyclePhase(selected) === "Completed")}
          </>
        ) : (
          <>
            {teamId && (
              <button
                type="button"
                className="icon-button"
                role="switch"
                aria-checked={!!collectionFavorite}
                aria-label={
                  collectionFavorite
                    ? "Remove from favorites"
                    : "Add to favorites"
                }
                onClick={() => void toggleCollectionFavorite()}
              >
                <Icon
                  name="Star"
                  size={15}
                  style={
                    collectionFavorite ? { fill: "currentColor" } : undefined
                  }
                />
              </button>
            )}
            <SearchBox value={query} onChange={setQuery} />
            {canManage && team && (
              <Link
                className="button"
                to={"/settings/team-" + team.id + "?section=Cycles"}
              >
                <Icon name="Settings" size={14} />
                Cycle settings
              </Link>
            )}
            {canManage && (
              <AddButton onClick={() => setAdding(true)}>New cycle</AddButton>
            )}
          </>
        )}
      </Header>
      {selected ? (
        <div className="cycle-detail-layout">
          <main className="cycle-issues">
            <div className="feature-list-caption feature-between">
              <span>{issues.length} issues</span>
              <AddButton onClick={() => setAssign(true)}>Add issues</AddButton>
            </div>
            <IssueList
              cycleId={selected.id}
              teamId={selected.teamId}
              assigneeId={selectedAssignee ?? undefined}
              embedded
              filterButtonLabel="Add filter"
            />
          </main>
          {details && (
            <aside className="cycle-detail-sidebar">
              <div className="cycle-status-row">
                <span>{cyclePhase(selected)}</span>
                <span>
                  {dateLabel(selected.startDate, zone)} →{" "}
                  {dateLabel(cycleInclusiveEnd(selected.endDate, zone))}
                </span>
              </div>
              <h1>{selected.name}</h1>
              {selected.description && (
                <RichEditor
                  value={selected.description}
                  readOnly
                  onChange={() => {}}
                />
              )}
              <ProgressGraph item={selected} kind="cycle" compact />
              <div className="cycle-success">
                <strong>{Math.round(summary.success)}%</strong>
                <span>Cycle success</span>
                <small>
                  Completed issues count fully; started issues count 25%.
                </small>
              </div>
              {selected.completionSnapshot && (
                <p className="muted cycle-snapshot-note">
                  Historical totals are preserved from this cycle. The issue
                  list reflects subsequent changes.
                </p>
              )}
              {cyclePhase(selected) === "Upcoming" && (
                <Capacity cycle={selected} summary={summary} />
              )}
              <CycleAssignees
                issues={issues}
                team={team}
                selected={selectedAssignee}
                onSelect={setAssignee}
              />
              <EntityDocuments parent={{ kind: "cycles", id: selected.id }} />
              {canManage && (
                <Link
                  className="cycle-settings-link"
                  to={"/settings/team-" + selected.teamId + "?section=Cycles"}
                >
                  Cycle settings
                </Link>
              )}
            </aside>
          )}
        </div>
      ) : (
        <>
          <Tabs
            items={["All cycles", "Current", "Upcoming", "Completed"]}
            active={tab}
            onChange={setTab}
          />
          {current.length > 0 &&
            ["All cycles", "Current"].includes(tab) &&
            !query && (
              <div className="cycle-current-grid">
                {current.map((cycle) => (
                  <article key={cycle.id} className="cycle-current-card">
                    <header>
                      <Link to={cycleRoute(cycle)}>{cycle.name}</Link>
                      <span className="muted">
                        {data.teams.find((t) => t.id === cycle.teamId)?.name}
                      </span>
                      <span className="spacer" />
                      {menu(cycle)}
                    </header>
                    <ProgressGraph item={cycle} kind="cycle" compact />
                  </article>
                ))}
              </div>
            )}
          <div className="feature-table-wrap">
            <table className="feature-table cycle-table">
              <thead>
                <tr>
                  <th>Cycle</th>
                  {!teamId && <th>Team</th>}
                  <th>Dates</th>
                  <th>Scope</th>
                  <th>Progress / Capacity</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map((cycle) => {
                  const cycleTeam = data.teams.find(
                      (t) => t.id === cycle.teamId,
                    ),
                    totals = cycleSummary(
                      cycle,
                      issuesByCycle.get(cycle.id) || [],
                      data.statuses,
                      cycleTeam,
                    ),
                    phase = cyclePhase(cycle),
                    previous = cycles
                      .filter(
                        (item) =>
                          item.teamId === cycle.teamId &&
                          item.id !== cycle.id &&
                          Date.parse(item.endDate) <=
                            Date.parse(cycle.startDate),
                      )
                      .sort(
                        (a, b) => Date.parse(b.endDate) - Date.parse(a.endDate),
                      )[0],
                    gap = previous
                      ? Math.round(
                          (dayTime(cycle.startDate) -
                            dayTime(previous.endDate)) /
                            DAY,
                        )
                      : 0;
                  return (
                    <React.Fragment key={cycle.id}>
                      {gap > 0 && (
                        <tr className="cycle-cooldown-row">
                          <td colSpan={teamId ? 5 : 6}>
                            <Icon name="Pause" size={12} />
                            {cycleTeam?.cycleCooldownDays
                              ? "Cooldown"
                              : "Cycles paused"}{" "}
                            · {gap} {gap === 1 ? "day" : "days"}
                          </td>
                        </tr>
                      )}
                      <tr
                        data-cycle-id={cycle.id}
                        role="link"
                        aria-label={`${dateLabel(
                          cycle.startDate,
                          cycleTeam?.timezone || workspace?.timezone,
                        )} ${cycle.name} ${phase} Open menu`}
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (
                            event.target === event.currentTarget &&
                            event.key === "Enter"
                          )
                            nav(cycleRoute(cycle));
                        }}
                        onClick={() => nav(cycleRoute(cycle))}
                      >
                        <td>
                          <span className="feature-name">
                            <Icon name="CircleDashed" size={16} />
                            {cycle.name}
                          </span>
                          <small className="muted">{phase}</small>
                        </td>
                        {!teamId && <td>{cycleTeam?.name}</td>}
                        <td className="muted">
                          {dateLabel(
                            cycle.startDate,
                            cycleTeam?.timezone || workspace?.timezone,
                          )}{" "}
                          →{" "}
                          {dateLabel(
                            cycleInclusiveEnd(
                              cycle.endDate,
                              cycleTeam?.timezone || workspace?.timezone,
                            ),
                          )}
                        </td>
                        <td>
                          {totals.scope}{" "}
                          <span className="muted">{totals.unit}</span>
                        </td>
                        <td>
                          {phase === "Upcoming" ? (
                            <Capacity cycle={cycle} summary={totals} compact />
                          ) : (
                            <div className="cycle-row-progress">
                              <Progress
                                value={
                                  totals.scope
                                    ? (totals.completed / totals.scope) * 100
                                    : 0
                                }
                              />
                              <span>{Math.round(totals.success)}%</span>
                            </div>
                          )}
                        </td>
                        <td onClick={(event) => event.stopPropagation()}>
                          {menu(cycle)}
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
            {!visible.length && (
              <Blank
                icon={<Icon name="CircleDashed" size={30} />}
                title={
                  query
                    ? "No matching cycles"
                    : tab === "All cycles"
                      ? "Cycles"
                      : "No " + tab.toLowerCase() + " cycles"
                }
                description="Enable cycles in team settings to create a repeating schedule."
                action={
                  canManage ? (
                    <AddButton onClick={() => setAdding(true)}>
                      New cycle
                    </AddButton>
                  ) : undefined
                }
              />
            )}
          </div>
        </>
      )}
      {canManage && adding && (
        <NewCycle teamId={teamId} onClose={() => setAdding(false)} />
      )}{" "}
      {canManage && dialog && (
        <CycleDialogForm
          value={dialog}
          today={teamToday(
            data.teams.find((t) => t.id === dialog.cycle.teamId),
            workspace,
          )}
          zone={
            data.teams.find((t) => t.id === dialog.cycle.teamId)?.timezone ||
            workspace?.timezone ||
            "UTC"
          }
          onClose={() => setDialog(null)}
          onArchived={() =>
            nav(team ? "/team/" + team.id + "/cycles" : "/cycles")
          }
        />
      )}{" "}
      {calendarTeam && (
        <CycleCalendarSubscription
          teamId={calendarTeam}
          onClose={() => setCalendarTeam(null)}
        />
      )}{" "}
      {assign && selected && (
        <CycleAssignment cycle={selected} onClose={() => setAssign(false)} />
      )}
    </section>
  );
}
function Capacity({
  cycle,
  summary,
  compact = false,
}: {
  cycle: Row;
  summary: any;
  compact?: boolean;
}) {
  const capacity = Number(cycle.capacity) || 0,
    ratio = capacity ? summary.scope / capacity : 0;
  return (
    <div
      className={"cycle-capacity " + (compact ? "compact" : "")}
      title={
        cycle.capacityEstimated
          ? "Approximate capacity based on team members"
          : cycle.capacitySource === "history"
            ? "Average completed work from the last three cycles"
            : "Manually configured capacity"
      }
    >
      <svg
        viewBox="0 0 40 24"
        role="img"
        aria-label={
          capacity
            ? Math.round(ratio * 100) + "% capacity allocated"
            : "Capacity not available"
        }
      >
        <path
          d="M4 22 A16 16 0 0 1 36 22"
          fill="none"
          stroke="var(--border)"
          strokeWidth="4"
        />
        <path
          d="M4 22 A16 16 0 0 1 36 22"
          fill="none"
          stroke={ratio > 1 ? "#ce795c" : "var(--accent)"}
          strokeWidth="4"
          pathLength="100"
          strokeDasharray={Math.min(100, ratio * 100) + " 100"}
        />
      </svg>
      <span>
        {capacity ? Math.round(ratio * 100) + "%" : "—"}
        {!compact && (
          <small>
            {summary.scope} / {capacity || "—"} {summary.unit} ·{" "}
            {cycle.capacityEstimated
              ? "Approximate capacity"
              : cycle.capacitySource === "history"
                ? "Recent cycle velocity"
                : "Capacity"}
          </small>
        )}
      </span>
    </div>
  );
}
function NewCycle({
  teamId,
  onClose,
}: {
  teamId?: string;
  onClose: () => void;
}) {
  const { data, create, act } = useActions();
  const selected = data.teams.find(
      (team) => team.id === (teamId || data.teams[0]?.id),
    ),
    today = teamToday(
      selected,
      data.workspaces.find((w) => w.id === data.workspaceId),
    );
  return (
    <FormDialog
      title="New cycle"
      fields={[
        { key: "name", label: "Cycle name", required: true },
        {
          key: "teamId",
          label: "Team",
          required: true,
          type: "select",
          options: optionList(data.teams, "Select team"),
        },
        { key: "startDate", label: "Start date", required: true, type: "date" },
        { key: "endDate", label: "End date", required: true, type: "date" },
      ]}
      initial={{
        teamId: selected?.id,
        startDate: today,
        endDate: new Date(dayTime(today) + 13 * DAY).toISOString().slice(0, 10),
      }}
      submit="Create cycle"
      onClose={onClose}
      onSave={(values) => {
        if (values.endDate < values.startDate)
          throw Error("End date must be on or after the start date.");
        return act(() =>
          create("cycles", {
            ...values,
            endDate: cycleExclusiveEnd(values.endDate),
          }),
        );
      }}
    />
  );
}
function CycleDialogForm({
  value,
  today,
  zone,
  onClose,
  onArchived,
}: {
  value: CycleDialog;
  today: string;
  zone: string;
  onClose: () => void;
  onArchived: () => void;
}) {
  const { update, act } = useActions(),
    { cycle, type } = value,
    [description, setDescription] = useState(cycle.description || ""),
    mutation = useRef(crypto.randomUUID());
  const phase = cyclePhase(cycle),
    fields =
      type === "edit"
        ? [{ key: "name", label: "Cycle name", required: true }]
        : type === "dates"
          ? [
              ...(phase === "Upcoming"
                ? [
                    {
                      key: "startDate",
                      label: "Start date",
                      type: "date" as const,
                      required: true,
                    },
                  ]
                : []),
              {
                key: "endDate",
                label: "End date",
                type: "date" as const,
                required: true,
              },
            ]
          : [],
    title = {
      edit: "Edit cycle",
      dates: "Change cycle dates",
      start: "Start cycle today?",
      end: "End cycle today?",
      archive: "Archive cycle?",
    }[type];
  return (
    <FormDialog
      title={title}
      fields={fields}
      initial={{
        name: cycle.name,
        startDate: cycleLocalDay(cycle.startDate, zone),
        endDate: cycleInclusiveEnd(cycle.endDate, zone),
      }}
      submit={
        type === "edit" || type === "dates"
          ? "Save changes"
          : type === "start"
            ? "Start cycle today"
            : type === "end"
              ? "End cycle today"
              : "Archive cycle"
      }
      onClose={onClose}
      onSave={async (values) => {
        if (type === "edit")
          return act(() =>
            update("cycles", cycle.id, { name: values.name, description }),
          );
        if (type === "dates") {
          if (
            (phase === "Upcoming" && values.startDate <= today) ||
            values.endDate < today
          )
            throw Error("Cycle dates cannot move into the past.");
          if (
            values.endDate <
            (values.startDate || cycleLocalDay(cycle.startDate, zone))
          )
            throw Error("End date must follow the start date.");
          return act(() =>
            update("cycles", cycle.id, {
              ...(phase === "Upcoming" ? { startDate: values.startDate } : {}),
              endDate: cycleExclusiveEnd(values.endDate),
            }),
          );
        }
        if (type === "archive") {
          const saved = await act(() =>
            update("cycles", cycle.id, {
              archivedAt: new Date().toISOString(),
            }),
          );
          if (saved) onArchived();
          return saved;
        }
        return apiRequest(
          "/api/v1/cycles/" +
            cycle.id +
            "/" +
            (type === "start" ? "start-today" : "end-today"),
          {
            method: "POST",
            body: JSON.stringify({
              version: cycle.version,
              clientMutationId: mutation.current,
            }),
          },
        );
      }}
    >
      {type === "edit" ? (
        <>
          <label className="feature-field">
            <span>Description</span>
          </label>
          <RichEditor
            value={description}
            onChange={setDescription}
            placeholder="What is the focus of this cycle?"
          />
        </>
      ) : (
        <p className="muted">
          {type === "dates"
            ? "Adjustments may change the following cycle or its cooldown. Past cycle dates remain fixed."
            : type === "start"
              ? "This starts the next cycle today in the team’s timezone, completes any active cycle, and carries unfinished work forward. This change cannot be reverted."
              : type === "end"
                ? "The current cycle will finish at the end of today in the team’s timezone. Unfinished work carries into the next cycle when it starts."
                : "This completed cycle will move to the archive. Its historical totals remain available."}
        </p>
      )}
    </FormDialog>
  );
}
function CycleAssignment({
  cycle,
  onClose,
}: {
  cycle: Row;
  onClose: () => void;
}) {
  const { data, batch } = useActions(),
    [ids, setIds] = useState<string[]>([]),
    [query, setQuery] = useState(""),
    viewport = useRef<HTMLDivElement>(null);
  const issues = live(data.issues).filter(
    (issue) =>
      issue.teamId === cycle.teamId &&
      issue.cycleId !== cycle.id &&
      (issue.title + " " + issue.identifier)
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const virtualizer = useVirtualizer({
    count: issues.length,
    getScrollElement: () => viewport.current,
    estimateSize: () => 40,
    overscan: 5,
  });
  return (
    <FormDialog
      title="Add issues to cycle"
      fields={[]}
      submit={"Add " + ids.length + " issues"}
      onClose={onClose}
      onSave={async () => {
        if (!ids.length) throw Error("Select at least one issue.");
        for (let index = 0; index < ids.length; index += 1000)
          await batch(
            ids.slice(index, index + 1000).map((id) => ({
              kind: "issues" as const,
              id,
              data: { cycleId: cycle.id },
            })),
          );
        return true;
      }}
    >
      <SearchBox value={query} onChange={setQuery} />
      <div
        ref={viewport}
        className="feature-selection-list"
        style={{ height: 320, overflowY: "auto" }}
      >
        <div
          style={{ position: "relative", height: virtualizer.getTotalSize() }}
        >
          {virtualizer.getVirtualItems().map((item) => {
            const issue = issues[item.index];
            return (
              <label
                key={issue.id}
                style={{
                  position: "absolute",
                  height: 40,
                  top: 0,
                  left: 0,
                  right: 0,
                  transform: "translateY(" + item.start + "px)",
                }}
              >
                <input
                  type="checkbox"
                  checked={ids.includes(issue.id)}
                  onChange={(event) =>
                    setIds(
                      event.target.checked
                        ? [...ids, issue.id]
                        : ids.filter((id) => id !== issue.id),
                    )
                  }
                />
                <span className="muted">{issue.identifier}</span>
                {issue.title}
              </label>
            );
          })}
        </div>
      </div>
    </FormDialog>
  );
}
