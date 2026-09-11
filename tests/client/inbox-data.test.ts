import { test } from "node:test";
import assert from "node:assert/strict";
import {
  groupInboxRows,
  isPriorityNotification,
  notificationBadgeCount,
} from "../../src/client/inbox-data";
import type { Entity } from "../../src/shared/types";
const row = (id: string, fields: Record<string, unknown> = {}) =>
  ({
    id,
    workspaceId: "workspace",
    version: 1,
    createdAt: "2026-09-05T00:00:00Z",
    updatedAt: "2026-09-05T00:00:00Z",
    userId: "me",
    ...fields,
  }) as Entity;
test("priority classification considers every reason on a combined notification", () => {
  const comment = row("combined", { type: "comments", reasons: ["comments", "mentioned"] });
  assert.equal(isPriorityNotification(comment, undefined), true);
  assert.equal(isPriorityNotification(comment, undefined, { priorityTypes: ["comment"] }), true);
  assert.equal(isPriorityNotification(comment, undefined, { priorityTypes: ["assigned"] }), false);
  assert.equal(notificationBadgeCount([comment], [], "me", { priorityEnabled: true, badgeCount: "priority" }), 1);
  assert.equal(isPriorityNotification(row("ordinary", { type: "comments", reasons: ["comments"] }), undefined), false);
});
test("badges count unread notification groups and preserve priority from earlier group events", () => {
  const issue = row("issue", { priority: 0 });
  const assigned = row("assigned", { issueId: issue.id, type: "assigned", archivedAt: "2026-09-04" });
  const first = row("first-comment", { issueId: issue.id, type: "comments" });
  const second = row("second-comment", { issueId: issue.id, type: "comments", readAt: "2026-09-05" });
  assert.equal(notificationBadgeCount([assigned, first, second], [issue], "me", {}, Date.parse("2026-09-05")), 1);
  assert.equal(notificationBadgeCount([assigned, first, second], [issue], "me", { priorityEnabled: true, badgeCount: "priority" }, Date.parse("2026-09-05")), 1);
  assert.equal(notificationBadgeCount([first, second], [issue], "me", { priorityEnabled: true, badgeCount: "priority" }, Date.parse("2026-09-05")), 0);
});
test("notification badges use priority preferences without exposing scheduled reminders, snoozed, read or other users' records", () => {
  const rows = [
    row("assignment", { type: "assigned" }),
    row("status", { type: "status" }),
    row("urgent", { type: "status", issueId: "urgent" }),
    row("read", { readAt: "2026-09-05" }),
    row("snoozed", { snoozedUntil: "2027-01-01" }),
    row("deleted", { deletedAt: "2026-09-05" }),
    row("other", { userId: "other" }),
    row("reminder", { type: "reminder", remindAt: "2026-09-04" }),
  ];
  const issues = [row("urgent", { priority: 1 })],
    now = Date.parse("2026-09-05");
  assert.equal(notificationBadgeCount(rows, issues, "me", {}, now), 3);
  assert.equal(
    notificationBadgeCount(rows, issues, "me", { priorityEnabled: true, badgeCount: "priority" }, now),
    2,
  );
  assert.equal(
    notificationBadgeCount(
      rows,
      issues,
      "me",
      { priorityEnabled: true, badgeCount: "priority", includeUrgent: false },
      now,
    ),
    1,
  );
  assert.equal(
    notificationBadgeCount(rows, issues, "me", { badgeCount: "none" }, now),
    0,
  );
  rows[7].deliveredAt = "2026-09-05";
  assert.equal(
    notificationBadgeCount(rows, issues, "me", { priorityEnabled: true, badgeCount: "priority" }, now),
    3,
  );
  assert.equal(
    notificationBadgeCount(
      rows,
      issues,
      "me",
      { badgeCount: "priority", priorityEnabled: false },
      now,
    ),
    4,
  );
});
test("unread grouping preserves notification ordering within groups and keeps read items separate", () => {
  const a = row("a", { teamId: "one" }),
    b = row("b", { teamId: "two" }),
    c = row("c", { teamId: "one" }),
    d = row("d", { teamId: "one", readAt: "today" });
  const rows = groupInboxRows([a, b, d, c], "team", (item) => ({
    id: item.teamId,
    title: item.teamId,
  }));
  assert.deepEqual(
    rows.map((item) =>
      item.type === "group" ? `${item.title}:${item.count}` : item.item.id,
    ),
    ["one:2", "a", "c", "two:1", "b", "Read:1", "d"],
  );
  assert.deepEqual(
    groupInboxRows([a, b, d, c], "none", () => {
      throw Error("No grouping expected");
    }).map((item) => item.type === "notification" && item.item.id),
    ["a", "b", "d", "c"],
  );
});

test("absent priority preference keeps the unified inbox badge",()=>{const rows=[row('ordinary',{type:'status'})];assert.equal(notificationBadgeCount(rows,[],"me",{badgeCount:"priority"}),1);assert.equal(notificationBadgeCount(rows,[],"me",{badgeCount:"priority",priorityEnabled:true}),0)});
