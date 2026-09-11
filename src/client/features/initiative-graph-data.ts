import type { Entity } from "../../shared/types";
import { initiativeProjectRollup } from "../../shared/initiatives";
import { buildStatusHistory, compareActivities } from "../../shared/activity-history";

const WEEK = 7 * 86400000;
export const weekStart = (time: number) => {
  const date = new Date(time);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return +date;
};
export type InitiativeGraphSource = {
  initiatives: Entity[];
  projects: Entity[];
  issues: Entity[];
  statuses: Entity[];
  activities: Entity[];
};
export type InitiativeProjectSeries = {
  project: Entity;
  values: number[];
  issueIds: string[][];
  total: number;
};
export type InitiativeGraphData = {
  weeks: number[];
  series: InitiativeProjectSeries[];
  total: number;
};
/** A completion belongs to the project at that event, even when the issue later moves or reopens. */
export function initiativeCompletionGraph(
  source: InitiativeGraphSource,
  initiativeId: string,
  directOnly = false,
  now = Date.now(),
): InitiativeGraphData {
  const rollup = initiativeProjectRollup(
    source.initiatives,
    source.projects,
    initiativeId,
  );
  const projects = rollup.projects.filter(
    (project) =>
      !project.deletedAt &&
      (!directOnly || rollup.directProjectIds.includes(project.id)),
  );
  const projectIds = new Set(projects.map((project) => project.id)),
    statusHistory = buildStatusHistory(source.statuses, source.activities);
  const completed = (
    state: Record<string, any>,
    time: number,
    event?: Entity,
    side: "before" | "after" = "after",
  ) => {
    const type = (event
      ? statusHistory.eventCategory(event, side, state.statusId)
      : statusHistory.categoryAt(state.statusId, time)) ?? state.status;
    return ["completed", "done"].includes(type);
  };
  const histories = new Map<string, Entity[]>();
  for (const activity of source.activities) {
    if (
      activity.entityKind !== "issues" ||
      !Number.isFinite(Date.parse(activity.createdAt))
    )
      continue;
    const entries = histories.get(activity.entityId) ?? [];
    entries.push(activity);
    histories.set(activity.entityId, entries);
  }
  const completions = new Map<string, Map<number, Set<string>>>();
  const add = (issueId: string, projectId: string, time: number) => {
    if (!projectIds.has(projectId) || !Number.isFinite(time) || time > now)
      return;
    const weeks = completions.get(projectId) ?? new Map<number, Set<string>>(),
      week = weekStart(time),
      issues = weeks.get(week) ?? new Set<string>();
    issues.add(issueId);
    weeks.set(week, issues);
    completions.set(projectId, weeks);
  };
  for (const issue of source.issues) {
    if (
      !Number.isFinite(Date.parse(issue.createdAt)) ||
      Date.parse(issue.createdAt) > now
    )
      continue;
    const events = (histories.get(issue.id) ?? []).slice().sort(compareActivities);
    const state: Record<string, any> = { ...issue };
    for (const event of events.slice().reverse()) {
      if (event.action === "create") continue;
      if (event.action === "delete") state.deletedAt = null;
      if (event.action === "restore") state.deletedAt = event.createdAt;
      for (const [field, change] of Object.entries(event.changes ?? {}))
        state[field] = (change as { from: any }).from;
    }
    const created = events.find((event) => event.action === "create");
    if (
      completed(
        state,
        Date.parse(issue.createdAt),
        created,
      ) &&
      !state.deletedAt
    )
      add(
        issue.id,
        state.projectId,
        Date.parse(state.completedAt || issue.createdAt),
      );
    for (const event of events) {
      if (Date.parse(event.createdAt) > now || event.action === "create")
        continue;
      const wasComplete = completed(
        state,
        Date.parse(event.createdAt),
        event,
        "before",
      );
      for (const [field, change] of Object.entries(event.changes ?? {}))
        state[field] = (change as { to: any }).to;
      if (event.action === "delete") state.deletedAt = event.createdAt;
      if (event.action === "restore") state.deletedAt = null;
      if (
        !wasComplete &&
        completed(
          state,
          Date.parse(event.createdAt),
          event,
        ) &&
        !state.deletedAt
      )
        add(issue.id, state.projectId, Date.parse(event.createdAt));
    }
  }
  const initiative = source.initiatives.find(
      (item) => item.id === initiativeId,
    ),
    last = weekStart(now);
  let first = last - 11 * WEEK;
  for (const entries of completions.values())
    for (const week of entries.keys()) first = Math.min(first, week);
  const created = Date.parse(initiative?.createdAt ?? "");
  if (Number.isFinite(created)) first = Math.min(first, weekStart(created));
  // Bound the chart's time resolution; older activity is still included in total counts.
  const step = Math.max(1, Math.ceil(((last - first) / WEEK + 1) / 260)) * WEEK;
  const weeks: number[] = [];
  for (let time = first; time <= last; time += step) weeks.push(time);
  if (weeks.at(-1) !== last) weeks.push(last);
  const series = projects
    .map((project) => {
      const entries =
          completions.get(project.id) ?? new Map<number, Set<string>>(),
        issueIds = weeks.map(() => [] as string[]);
      for (const [week, issues] of entries) {
        // The final bucket can be shorter than the regular historical interval.
        let low = 0, high = weeks.length;
        while (low < high) {
          const middle = (low + high) >>> 1;
          if (weeks[middle] <= week) low = middle + 1;
          else high = middle;
        }
        const index = low - 1;
        if (index >= 0) issueIds[index].push(...issues);
      }
      const values = issueIds.map((ids) => new Set(ids).size),
        total = new Set([...entries.values()].flatMap((ids) => [...ids])).size;
      return {
        project,
        values,
        issueIds: issueIds.map((ids) => [...new Set(ids)]),
        total,
      };
    })
    .sort(
      (a, b) =>
        b.total - a.total || a.project.name.localeCompare(b.project.name),
    );
  return {
    weeks,
    series,
    total: new Set(series.flatMap((row) => row.issueIds.flat())).size,
  };
}
