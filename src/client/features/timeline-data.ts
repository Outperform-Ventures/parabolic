import type { Entity } from "../../shared/types";
export const DAY = 86_400_000;
export const timelineScales = ["week", "month", "quarter", "year"] as const;
export type TimelineScale = (typeof timelineScales)[number];
export type TimelineWindow = { start: number; span: number };
export const isoDate = (time: number) =>
  new Date(time).toISOString().slice(0, 10);
export function timelineWindow(
  scale: TimelineScale,
  center = Date.now(),
): TimelineWindow {
  const now = new Date(center);
  let start: number, end: number;
  if (scale === "week") {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) - 7);
    start = +d;
    end = start + 28 * DAY;
  } else if (scale === "month") {
    start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1);
    end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 5, 1);
  } else if (scale === "quarter") {
    const q = Math.floor(now.getUTCMonth() / 3);
    start = Date.UTC(now.getUTCFullYear(), q * 3 - 3, 1);
    end = Date.UTC(now.getUTCFullYear(), q * 3 + 9, 1);
  } else {
    start = Date.UTC(now.getUTCFullYear() - 1, 0, 1);
    end = Date.UTC(now.getUTCFullYear() + 2, 0, 1);
  }
  return { start, span: end - start };
}
export function zoomTimeline(
  view: TimelineWindow,
  factor: number,
  anchor = 0.5,
): TimelineWindow {
  const span = Math.max(7 * DAY, Math.min(36525 * DAY, view.span / factor));
  return { start: view.start + view.span * anchor - span * anchor, span };
}
export function timelineTicks(view: TimelineWindow) {
  const result: { time: number; label: string }[] = [],
    days = view.span / DAY,
    step =
      days < 45
        ? "week"
        : days < 250
          ? "month"
          : days < 800
            ? "quarter"
            : "year",
    d = new Date(view.start);
  d.setUTCHours(0, 0, 0, 0);
  if (step === "week") d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  else {
    d.setUTCDate(1);
    if (step === "quarter") d.setUTCMonth(Math.floor(d.getUTCMonth() / 3) * 3);
    if (step === "year") d.setUTCMonth(0);
  }
  while (+d <= view.start + view.span) {
    const time = +d;
    result.push({
      time,
      label:
        step === "week"
          ? d.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              timeZone: "UTC",
            })
          : step === "month"
            ? d.toLocaleDateString(undefined, {
                month: "short",
                year: "numeric",
                timeZone: "UTC",
              })
            : step === "quarter"
              ? `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`
              : String(d.getUTCFullYear()),
    });
    if (step === "week") d.setUTCDate(d.getUTCDate() + 7);
    else if (step === "month") d.setUTCMonth(d.getUTCMonth() + 1);
    else if (step === "quarter") d.setUTCMonth(d.getUTCMonth() + 3);
    else
      d.setUTCFullYear(
        d.getUTCFullYear() + Math.max(1, Math.ceil(days / 365 / 16)),
      );
  }
  return result;
}
export function dependencyProblem(
  blockerId: string,
  blockedId: string,
  projects: Entity[],
): string | null {
  if (blockerId === blockedId) return "A project cannot depend on itself.";
  const lookup = new Map(projects.map((p) => [p.id, p])),
    blocked = lookup.get(blockedId);
  if (!lookup.has(blockerId) || !blocked) return "This project is unavailable.";
  if ((blocked.dependencyIds || []).includes(blockerId))
    return "This dependency already exists.";
  const pending = [blockerId],
    visited = new Set<string>();
  while (pending.length) {
    const id = pending.pop()!;
    if (id === blockedId) return "This dependency would create a cycle.";
    if (visited.has(id)) continue;
    visited.add(id);
    pending.push(...(lookup.get(id)?.dependencyIds || []));
  }
  return null;
}
/** Reach the connected dependency component once; modifiers select which dated projects move. */
export function dependencyChain(
  projects: Entity[],
  roots: string[],
  mode: "planned" | "all" | "none",
  category: (project: Entity) => string,
): string[] {
  if (mode === "none") return roots;
  const neighbors = new Map<string, Set<string>>();
  for (const p of projects)
    for (const id of p.dependencyIds || []) {
      if (!neighbors.has(p.id)) neighbors.set(p.id, new Set());
      if (!neighbors.has(id)) neighbors.set(id, new Set());
      neighbors.get(p.id)!.add(id);
      neighbors.get(id)!.add(p.id);
    }
  const lookup = new Map(projects.map((p) => [p.id, p])),
    visited = new Set(roots),
    pending = [...roots];
  while (pending.length)
    for (const id of neighbors.get(pending.pop()!) || [])
      if (!visited.has(id)) {
        visited.add(id);
        pending.push(id);
      }
  return [...visited].filter(
    (id) =>
      roots.includes(id) ||
      mode === "all" ||
      (lookup.has(id) &&
        ["planned", "backlog"].includes(category(lookup.get(id)!))),
  );
}
