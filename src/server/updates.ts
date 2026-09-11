import { updateAging } from '../shared/update-aging';
import { randomUUID } from "node:crypto";
import { assert } from "./errors.ts";
import type { Actor, RecordEntity, Repository } from "./repository.ts";
import {
  defaultUpdateSchedule,
  updateSnapshot,
  type UpdateSchedule,
} from "../shared/updates.ts";
import { projectStatuses } from "./project-statuses.ts";

export function validateUpdateSchedule(value: unknown) {
  assert(
    value && typeof value === "object" && !Array.isArray(value),
    422,
    "Update schedule must be an object",
    "INVALID_UPDATE_SCHEDULE",
  );
  const v = value as UpdateSchedule;
  if (v.mode !== undefined)
    assert(
      ["default", "custom", "never"].includes(v.mode),
      422,
      "Invalid update reminder mode",
      "INVALID_UPDATE_SCHEDULE",
    );
  if (v.enabled !== undefined)
    assert(
      typeof v.enabled === "boolean",
      422,
      "Enabled must be true or false",
      "INVALID_UPDATE_SCHEDULE",
    );
  if(v.anchorDate!==undefined)assert(typeof v.anchorDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v.anchorDate)&&Number.isFinite(Date.parse(v.anchorDate))&&new Date(v.anchorDate).toISOString().slice(0,10)===v.anchorDate,422,'Choose a valid reminder anchor date','INVALID_UPDATE_SCHEDULE');
  const schedule = { ...defaultUpdateSchedule, ...v };
  assert(
    ["daily", "weekly"].includes(schedule.frequency),
    422,
    "Invalid update reminder frequency",
    "INVALID_UPDATE_SCHEDULE",
  );
  assert(
    Number.isInteger(schedule.interval) &&
      schedule.interval >= 1 &&
      schedule.interval <= 52,
    422,
    "Update interval must be between 1 and 52",
    "INVALID_UPDATE_SCHEDULE",
  );
  assert(
    Number.isInteger(schedule.weekday) &&
      schedule.weekday >= 0 &&
      schedule.weekday <= 6,
    422,
    "Invalid reminder weekday",
    "INVALID_UPDATE_SCHEDULE",
  );
  assert(
    Number.isInteger(schedule.hour) &&
      schedule.hour >= 0 &&
      schedule.hour <= 23,
    422,
    "Invalid reminder hour",
    "INVALID_UPDATE_SCHEDULE",
  );
}
export function validateUpdateEntity(
  repo: Repository,
  actor: Actor,
  kind: string,
  e: RecordEntity,
  previous?: RecordEntity,
) {
  if (kind === "workspaces")
    for (const field of ["projectUpdateSchedule", "initiativeUpdateSchedule"])
      if (e[field] !== undefined) validateUpdateSchedule(e[field]);
  if (
    ["projects", "initiatives"].includes(kind) &&
    e.updateSchedule !== undefined
  )
    validateUpdateSchedule(e.updateSchedule);
  if (kind === "comments" && e.updateId) {
    const reader = {...actor,scopes:[...actor.scopes,'read']};
    const update = repo.get(reader, "updates", e.updateId);
    e.projectId = update.projectId ?? null;
    e.initiativeId = update.initiativeId ?? null;
    assert(
      !e.issueId && !e.documentId,
      422,
      "Update comments cannot also belong to issues or documents",
      "INVALID_UPDATE_COMMENT",
    );
    if (e.parentId) {
      const parent = repo.get(reader, "comments", e.parentId);
      assert(
        parent.updateId === e.updateId,
        422,
        "Comment parent belongs to another update",
        "INVALID_UPDATE_COMMENT",
      );
    }
  }
  if (kind !== "updates") return;
  assert(
    !!e.projectId !== !!e.initiativeId,
    422,
    "An update must belong to one project or initiative",
    "INVALID_UPDATE",
  );
  assert(
    typeof e.body === "string" &&
      e.body.replace(/<[^>]*>/g, "").trim().length > 0,
    422,
    "Write an update before publishing",
    "INVALID_UPDATE",
  );
  assert(
    ["On track", "At risk", "Off track"].includes(e.health),
    422,
    "Select a valid update health",
    "INVALID_UPDATE",
  );
  const parentKind = e.projectId ? "projects" : "initiatives",
    id = e.projectId || e.initiativeId,
    item = repo.get(actor, parentKind, id),
    ownerId = item[e.projectId ? "leadId" : "ownerId"];
  if (previous) {
    assert(
      e.projectId === previous.projectId &&
        e.initiativeId === previous.initiativeId,
      422,
      "An update cannot be moved to another parent",
      "INVALID_UPDATE",
    );
    const changed = Object.keys(e).filter(
      (key) =>
        !["updatedAt", "version", "reactions"].includes(key) &&
        JSON.stringify(e[key]) !== JSON.stringify(previous[key]),
    );
    if (changed.length)
      assert(
        actor.system || actor.userId === previous.authorId,
        403,
        "Only the author can edit an update",
        "FORBIDDEN",
      );
    e.progressSnapshot = previous.progressSnapshot;
    e.editedAt =
      e.body !== previous.body || e.health !== previous.health
        ? (actor.now || new Date()).toISOString()
        : previous.editedAt;
  } else {
    const prior = repo
      .all("updates", actor.workspaceId)
      .some(
        (update) =>
          update[parentKind === "projects" ? "projectId" : "initiativeId"] ===
          id,
      );
    if (ownerId && !prior)
      assert(
        actor.system || ownerId === actor.userId,
        403,
        "The project lead or initiative owner must post the first update",
        "UPDATE_OWNER_REQUIRED",
      );
    e.progressSnapshot = updateSnapshot(
      e.projectId ? "project" : "initiative",
      item,
      {
        issues: repo.all("issues", actor.workspaceId),
        statuses: repo.all("statuses", actor.workspaceId),
        milestones: repo.all("milestones", actor.workspaceId),
      },
    );
  }
  e.title = `${item.name} update`;
}
export function validateOwnReactions(
  actor: Actor,
  e: RecordEntity,
  previous?: RecordEntity,
) {
  if (e.reactions === undefined) return;
  assert(
    e.reactions &&
      typeof e.reactions === "object" &&
      !Array.isArray(e.reactions) &&
      Object.keys(e.reactions).length <= 100,
    422,
    "Invalid reactions",
    "INVALID_REACTIONS",
  );
  for (const [emoji, ids] of Object.entries(e.reactions)) {
    assert(
      emoji.length > 0 &&
        emoji.length <= 64 &&
        Array.isArray(ids) &&
        ids.length <= 10000 &&
        ids.every((id) => typeof id === "string") &&
        new Set(ids).size === ids.length,
      422,
      "Invalid reaction",
      "INVALID_REACTIONS",
    );
  }
  if (actor.system) return;
  const keys = new Set([
    ...Object.keys(e.reactions),
    ...Object.keys(previous?.reactions ?? {}),
  ]);
  for (const key of keys) {
    const before = (previous?.reactions?.[key] ?? [])
      .filter((id: string) => id !== actor.userId)
      .sort();
    const after = (e.reactions[key] ?? [])
      .filter((id: string) => id !== actor.userId)
      .sort();
    assert(
      JSON.stringify(before) === JSON.stringify(after),
      403,
      "You can only change your own reactions",
      "FORBIDDEN",
    );
  }
}
export function updateRecipients(
  repo: Repository,
  actor: Actor,
  kind: string,
  e: RecordEntity,
  previous: RecordEntity | undefined,
  add: (id: string, reason: string) => void,
) {
  if (kind === "updates" && !previous) {
    const field = e.projectId ? "projectId" : "initiativeId",
      id = e[field],
      parent = repo.raw(e.projectId ? "projects" : "initiatives", id),
      reason = e.projectId ? "projectUpdates" : "initiativeUpdates";
    if (parent) {
      if (parent.leadId || parent.ownerId)
        add(parent.leadId || parent.ownerId, reason);
      for (const userId of parent.subscriberIds ?? []) add(userId, reason);
      for (const s of repo.all("subscriptions", actor.workspaceId))
        if (s[field] === id || s.entityId === id) add(s.userId, reason);
    }
  }
  if (kind === "comments" && e.updateId && !previous) {
    const update = repo.raw("updates", e.updateId);
    if (update?.authorId) add(update.authorId, "comments");
    for (const comment of repo.all("comments", actor.workspaceId))
      if (comment.updateId === e.updateId) add(comment.authorId, "comments");
  }
}
export function recordLatestUpdate(
  repo: Repository,
  actor: Actor,
  kind: string,
  e: RecordEntity,
) {
  if (kind !== "updates") return;
  const field = e.projectId ? "projectId" : "initiativeId",
    parentKind = e.projectId ? "projects" : "initiatives",
    id = e[field];
  const latest = repo
    .all("updates", actor.workspaceId)
    .filter((u) => u[field] === id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!e.deletedAt && latest?.id !== e.id) return;
  const parent = repo.raw(parentKind, id);
  if (!parent) return;
  if(parent.health===(latest?.health??null)&&parent.latestUpdateAt===(latest?.createdAt??null)&&parent.lastUpdateId===(latest?.id??null))return;
  repo.update(
    {
      ...actor,
      system: true,
      silent: true,
      scopes: ["read", "write", "admin"],
    },
    parentKind,
    id,
    {
      health: latest?.health ?? null,
      latestUpdateAt: latest?.createdAt ?? null,
      lastUpdateId: latest?.id ?? null,
      updateHealthStatus: latest ? "current" : "overdue",
    },
  );
}

function localParts(now: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, Number(p.value)]),
  );
  return {
    day: Math.floor(
      Date.UTC(parts.year, parts.month - 1, parts.day) / 86400000,
    ),
    hour: parts.hour,
  };
}
function weekday(day: number) {
  return new Date(day * 86400000).getUTCDay();
}
function working(day: number, week: string) {
  return week === "sun-thu"
    ? ![5, 6].includes(weekday(day))
    : ![0, 6].includes(weekday(day));
}
function addWorking(day: number, count: number, week: string) {
  while (count) {
    day++;
    if (working(day, week)) count--;
  }
  return day;
}
export function effectiveUpdateSchedule(
  workspace: RecordEntity,
  item: RecordEntity,
  kind: "project" | "initiative",
): UpdateSchedule {
  if (item.updateSchedule?.mode === "never")
    return { ...defaultUpdateSchedule, mode: "never", enabled: false };
  const base = workspace[`${kind}UpdateSchedule`] ?? {};
  return item.updateSchedule?.mode === "custom"
    ? { ...defaultUpdateSchedule, ...item.updateSchedule, enabled: true }
    : { ...defaultUpdateSchedule, ...base };
}
export function runUpdateReminders(
  repo: Repository,
  actor: Actor,
  workspace: RecordEntity,
  now: Date,
) {
  for (const kind of ["project", "initiative"] as const)
    for (const item of repo.all(
      kind === "project" ? "projects" : "initiatives",
      workspace.id,
    )) {
      if (item.archivedAt) continue;
      const schedule = effectiveUpdateSchedule(workspace, item, kind),
        ownerId = item[kind === "project" ? "leadId" : "ownerId"],
        category =
          kind === "project"
            ? projectStatuses(repo, workspace.id).find(
                (s) => s.id === item.status,
              )?.type
            : item.status;
      const active = ["started", "active", "in_progress"].includes(
        category ?? "",
      );
      if (!schedule.enabled || !active || !ownerId) {
        if (item.updateHealthStatus !== "notExpected")
          repo.update(
            { ...actor, silent: true },
            kind === "project" ? "projects" : "initiatives",
            item.id,
            { updateHealthStatus: "notExpected" },
          );
        continue;
      }
      const owner = repo.raw("users", ownerId);
      if (!owner) continue;
      let timeZone =
        owner.preferences?.timezone ||
        owner.preferences?.timeZone ||
        workspace.timezone ||
        "UTC";
      try {
        new Intl.DateTimeFormat("en", { timeZone }).format(now);
      } catch {
        timeZone = "UTC";
      }
      const local = localParts(now, timeZone),
        created = localParts(new Date(item.createdAt), timeZone),
        week = workspace.workWeek ?? "mon-fri";
      let due: number | undefined;
      const interval = Math.max(1, schedule.interval),
        anchor = schedule.anchorDate
          ? Math.floor(Date.parse(schedule.anchorDate) / 86400000)
          : 4;
      for (
        let day = local.day;
        day >= Math.max(created.day, local.day - interval * 7 - 7);
        day--
      ) {
        if (
          (day === local.day && local.hour < schedule.hour) ||
          (day === created.day && created.hour >= schedule.hour)
        )
          continue;
        const cadence =
          schedule.frequency === "daily"
            ? (day - anchor) % interval === 0
            : weekday(day) === schedule.weekday &&
              Math.floor((day - anchor) / 7) % interval === 0;
        if (cadence) {
          due = day;
          break;
        }
      }
      if (due === undefined) continue;
      const updates = repo
          .all("updates", workspace.id)
          .filter(
            (u) =>
              u[kind === "project" ? "projectId" : "initiativeId"] === item.id,
          ),
        latest = updates.sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt),
        )[0];
      const latestLocal = latest
        ? localParts(new Date(latest.createdAt), timeZone)
        : null;
      const fulfilled =
        (latestLocal &&
          (latestLocal.day > due ||
            (latestLocal.day === due && latestLocal.hour >= schedule.hour))) ||
        (latest && Date.parse(latest.createdAt) > now.getTime() - 86400000);
      const lastDay = latestLocal?.day ?? created.day;
      const aging = updateAging(local.day - lastDay, schedule.frequency === "weekly" ? "weekly" : "daily", interval);
      const health = fulfilled
        ? "current"
        : (!latest || (aging.outdated && latest.health !== "Off track"))
          ? "missing"
          : "overdue";
      if (item.updateHealthStatus !== health)
        repo.update(
          { ...actor, silent: true },
          kind === "project" ? "projects" : "initiatives",
          item.id,
          { updateHealthStatus: health },
        );
      if (fulfilled) continue;
      const actorOwner = repo.actorForUser(ownerId, workspace.id);
      if (
        actorOwner.role === "none" ||
        !repo.canRead(
          actorOwner,
          kind === "project" ? "projects" : "initiatives",
          item,
        )
      )
        continue;
      const stages = [due, addWorking(due, 1, week), addWorking(due, 3, week)];
      const eligible = stages
        .map((day, index) => ({ day, index }))
        .filter(
          ({ day }) =>
            day < local.day ||
            (day === local.day && local.hour >= schedule.hour),
        )
        .at(-1);
      for (let index = 0; index < stages.length; index++) {
        if (index !== eligible?.index) continue;
        if (
          local.day < stages[index] ||
          (local.day === stages[index] && local.hour < schedule.hour)
        )
          continue;
        const key = `update-reminder:${item.id}:${due}:${index}`;
        if (
          repo.db.prepare("SELECT key FROM scheduler_runs WHERE key=?").get(key)
        )
          continue;
        repo.transaction(() => {
          const at = now.toISOString();
          repo.save(
            "notifications",
            {
              id: randomUUID(),
              workspaceId: workspace.id,
              createdAt: at,
              updatedAt: at,
              version: 1,
              userId: ownerId,
              entityKind: kind === "project" ? "projects" : "initiatives",
              entityId: item.id,
              [`${kind}Id`]: item.id,
              type: "updateReminders",
              reasons: ["updateReminders"],
              title: `${index ? "Reminder: write" : "Write"} an update for ${item.name}`,
              body: `Share the current health and progress of this ${kind}.`,
              readAt: null,
            },
            "create",
            actor,
          );
          for (let past = 0; past <= index; past++)
            repo.db
              .prepare("INSERT OR IGNORE INTO scheduler_runs VALUES(?,?)")
              .run(`update-reminder:${item.id}:${due}:${past}`, at);
        });
      }
    }
}
