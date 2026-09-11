import type { Entity } from "./types";
export type UpdateSchedule = {
  enabled?: boolean;
  mode?: "default" | "custom" | "never";
  frequency: "daily" | "weekly";
  interval: number;
  weekday: number;
  hour: number;
  anchorDate?: string;
};
export const defaultUpdateSchedule: UpdateSchedule = {
  enabled: false,
  mode: "default",
  frequency: "weekly",
  interval: 1,
  weekday: 3,
  hour: 9,
};
export type UpdateSnapshot = {
  status?: string;
  ownerId?: string;
  targetDate?: string;
  issueCount: number;
  completedCount: number;
  progress: number;
  milestones: {
    id: string;
    name: string;
    targetDate?: string;
    completed: number;
    total: number;
  }[];
};
export function updateSnapshot(
  kind: "project" | "initiative",
  item: Entity,
  data: { issues: Entity[]; statuses: Entity[]; milestones: Entity[] },
): UpdateSnapshot {
  const issues =
    kind === "project"
      ? data.issues.filter(
          (i) => !i.deletedAt && !i.archivedAt && i.projectId === item.id,
        )
      : [];
  const completed = new Set(
    data.statuses.filter((s) => s.type === "completed").map((s) => s.id),
  );
  const completedCount = issues.filter((i) => completed.has(i.statusId)).length;
  return {
    status: item.status,
    ownerId: kind === "project" ? item.leadId : item.ownerId,
    targetDate: item.targetDate,
    issueCount: issues.length,
    completedCount,
    progress: issues.length ? (completedCount / issues.length) * 100 : 0,
    milestones:
      kind === "project"
        ? data.milestones
            .filter((m) => !m.deletedAt && m.projectId === item.id)
            .map((m) => {
              const group = issues.filter((i) => i.milestoneId === m.id);
              return {
                id: m.id,
                name: m.name,
                targetDate: m.targetDate,
                completed: group.filter((i) => completed.has(i.statusId))
                  .length,
                total: group.length,
              };
            })
        : [],
  };
}
export function updateProgressDetails(
  current: UpdateSnapshot,
  previous?: UpdateSnapshot,
) {
  const details: { field: string; from: any; to: any }[] = [];
  if (!previous) return details;
  for (const field of ["status", "ownerId", "targetDate"] as const)
    if ((current[field] ?? null) !== (previous[field] ?? null))
      details.push({
        field,
        from: previous[field] ?? null,
        to: current[field] ?? null,
      });
  if (Math.abs(current.progress - previous.progress) > 2)
    details.push({
      field: "progress",
      from: previous.progress,
      to: current.progress,
    });
  for (const milestone of current.milestones) {
    const before = previous.milestones?.find((m) => m.id === milestone.id);
    if (
      !before ||
      before.name !== milestone.name ||
      before.completed !== milestone.completed ||
      before.total !== milestone.total ||
      before.targetDate !== milestone.targetDate
    )
      details.push({ field: "milestone", from: before ?? null, to: milestone });
  }
  for(const milestone of previous.milestones||[])if(!current.milestones.some(item=>item.id===milestone.id))details.push({field:'milestone',from:milestone,to:null});
  return details;
}

/** Aggregated initiative feeds interleave parents; report baselines never cross them. */
export function previousUpdateSnapshot(update:Entity,ordered:Entity[]):UpdateSnapshot|undefined{const key=update.projectId?'projectId':'initiativeId',index=ordered.findIndex(item=>item.id===update.id);if(index<0)return;return ordered.slice(index+1).find(item=>!item.deletedAt&&item[key]===update[key])?.progressSnapshot;}
