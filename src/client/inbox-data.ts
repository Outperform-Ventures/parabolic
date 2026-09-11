import type { Entity } from "../shared/types";
import { buildInboxStacks, type InboxStackContext } from "./inbox-stacks";
import { effectiveInboxNotification } from "./inbox-expiry";

import {defaultPriorityTypes,isPriorityNotification} from '../shared/notification-priority';
export {defaultPriorityTypes,isPriorityNotification} from '../shared/notification-priority';
export function desktopNotificationEnabled(
  row: Entity,
  preferences: Record<string, any> = {},
) {
  if (preferences.desktop === false) return false;
  const aliases: Record<string, string> = {
    viewIssueAdded: "viewSubscriptions",
    viewIssueClosed: "viewSubscriptions",
    mention: "mentioned",
    comment: "comments",
    request: "requests",
    dueDateNear: "dueDateAlerts",
    dueDateOverdue: "dueDateAlerts",
    slaBreached: "sla",
    slaAtRisk: "sla",
    slaWarning: "sla",
    reminder: "reminders",
  };
  return (Array.isArray(row.reasons) ? row.reasons : [row.type]).some(
    (type: string) => preferences[aliases[type] || type] !== false,
  );
}
export function isInboxNotification(row: Entity, userId?: string) {
  return (
    !row.deletedAt &&
    !row.archivedAt &&
    (!row.userId || row.userId === userId) &&
    !(row.type === "reminder" && row.remindAt && !row.deliveredAt)
  );
}
export function notificationBadgeCount(
  rows: Entity[],
  issues: Entity[],
  userId: string | undefined,
  preferences: Record<string, any> = {},
  now = Date.now(),
  context: InboxStackContext = {},
) {
  if (preferences.badgeCount === "none") return 0;
  const counts = inboxNotificationSummary(
    rows,
    issues,
    userId,
    preferences,
    now,
    context,
  );
  return preferences.badgeCount === "priority" &&
    preferences.priorityEnabled === true
    ? counts.unreadPriority
    : counts.unreadTotal;
}
export function inboxNotificationSummary(
  rows: Entity[],
  issues: Entity[],
  userId: string | undefined,
  preferences: Record<string, any> = {},
  now = Date.now(),
  context: InboxStackContext = {},
) {
  const issueMap = new Map(issues.map((issue) => [issue.id, issue]));
  const priorityIds = new Set<string>();
  let unreadTotal = 0,
    unreadPriority = 0;
  for (const stack of buildInboxStacks(
    rows
      .filter((row) => !row.userId || row.userId === userId)
      .map((row) => effectiveInboxNotification(row, now)),
    context,
  )) {
    const priority = stack.allNotifications.some((row) =>
      isPriorityNotification(row, issueMap.get(row.issueId), preferences),
    );
    if (priority) priorityIds.add(stack.id);
    if (
      stack.allNotifications.some(
        (row) =>
          isInboxNotification(row, userId) &&
          !row.readAt &&
          (!row.snoozedUntil || Date.parse(row.snoozedUntil) <= now),
      )
    ) {
      unreadTotal++;
      if (priority) unreadPriority++;
    }
  }
  return { priorityIds, unreadTotal, unreadPriority };
}
export type InboxRow =
  | { type: "notification"; item: Entity }
  | { type: "group"; id: string; title: string; count: number };
export function groupInboxRows(
  notifications: Entity[],
  groupBy: string | undefined,
  label: (item: Entity, field: string) => { id: string; title: string },
): InboxRow[] {
  if (!groupBy || groupBy === "none")
    return notifications.map((item) => ({ type: "notification", item }));
  const groups = new Map<string, { title: string; items: Entity[] }>(),
    read: Entity[] = [];
  for (const item of notifications) {
    if (item.readAt) {
      read.push(item);
      continue;
    }
    const group = label(item, groupBy);
    if (!groups.has(group.id))
      groups.set(group.id, { title: group.title, items: [] });
    groups.get(group.id)!.items.push(item);
  }
  const rows: InboxRow[] = [];
  for (const [id, group] of groups) {
    rows.push(
      { type: "group", id, title: group.title, count: group.items.length },
      ...group.items.map((item) => ({ type: "notification" as const, item })),
    );
  }
  if (read.length)
    rows.push(
      { type: "group", id: "read", title: "Read", count: read.length },
      ...read.map((item) => ({ type: "notification" as const, item })),
    );
  return rows;
}
