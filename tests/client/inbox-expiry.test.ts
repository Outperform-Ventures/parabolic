import test from "node:test";
import assert from "node:assert/strict";
import type { Entity } from "../../src/shared/types";
import { effectiveInboxNotification } from "../../src/client/inbox-expiry";
import { inboxNotificationSummary, notificationBadgeCount } from "../../src/client/inbox-data";

const deadline = Date.parse("2026-09-05T12:00:00Z"),
  time = (offset: number) => new Date(deadline + offset).toISOString(),
  entity = (id: string, fields: Record<string, unknown> = {}): Entity => ({
    id, workspaceId: "workspace", userId: "me", version: 4,
    createdAt: time(-86400000), updatedAt: time(-1000), ...fields,
  });

test("due snoozes become unread at their exact deadline without mutating source or advancing arrival to render time", () => {
  const source = Object.freeze(entity("snoozed", {
    type: "comments", snoozedUntil: time(0), readAt: time(-1),
    movedToInboxAt: time(-86400000),
  }));
  assert.equal(effectiveInboxNotification(source, deadline - 1), source);
  const projected = effectiveInboxNotification(source, deadline);
  assert.notEqual(projected, source);
  assert.equal(projected.readAt, null);
  assert.equal(projected.snoozedUntil, null);
  assert.equal(projected.unsnoozedAt, time(0));
  assert.equal(projected.movedToInboxAt, time(0));
  assert.equal(projected.version, source.version);
  assert.equal(projected.updatedAt, source.updatedAt);
  assert.equal(source.readAt, time(-1));
  assert.equal(source.snoozedUntil, time(0));
  assert.deepEqual(effectiveInboxNotification(source, deadline + 60000), projected);
  assert.equal(effectiveInboxNotification(projected, deadline + 60000), projected, "Projection is stable after snooze has been materialized");
});

test("post-expiry reads survive projection and authoritative wake records are not reinterpreted", () => {
  for (const offset of [0, 1, 60000]) {
    const source = entity("explicit-read", { snoozedUntil: time(0), readAt: time(offset) });
    const projected = effectiveInboxNotification(source, deadline + 60000);
    assert.equal(projected.readAt, source.readAt);
    assert.equal(projected.movedToInboxAt, time(0));
  }
  const serverRecord = entity("server-wake", {
    snoozedUntil: null, unsnoozedAt: time(0), movedToInboxAt: time(0), readAt: time(1000),
  });
  assert.equal(effectiveInboxNotification(serverRecord, deadline + 60000), serverRecord);
  const invalidRead = entity("invalid-read", { snoozedUntil: time(0), readAt: "invalid" });
  assert.equal(effectiveInboxNotification(invalidRead, deadline).readAt, null);
});

test("projection cannot deliver pending reminders or revive hidden/invalid records; delivered reminder snoozes can wake", () => {
  for (const fields of [
    { type: "reminder", remindAt: time(0), deliveredAt: null },
    { type: "reminder", deliveredAt: null },
    { deletedAt: time(-1) },
    { archivedAt: time(-1) },
    { snoozedUntil: "invalid" },
    { snoozedUntil: null },
  ]) {
    const source = entity("unchanged", { snoozedUntil: time(0), readAt: time(-100), ...fields });
    assert.equal(effectiveInboxNotification(source, deadline + 60000), source);
  }
  const delivered = entity("delivered", {
    type: "reminder", remindAt: time(-86400000), deliveredAt: time(-86300000),
    snoozedUntil: time(0), readAt: time(-1),
  });
  const projected = effectiveInboxNotification(delivered, deadline);
  assert.equal(projected.readAt, null);
  assert.equal(projected.deliveredAt, delivered.deliveredAt);
  assert.equal(projected.movedToInboxAt, time(0));
});

test("Inbox summary and badges count waking stacks once and preserve explicit post-expiry read choices", () => {
  const issue = entity("issue", { priority: 0 }),
    assignment = entity("assignment", { type: "assigned", issueId: issue.id, archivedAt: time(-1000) }),
    first = entity("first", { type: "comments", issueId: issue.id, snoozedUntil: time(0), readAt: time(-1) }),
    second = entity("second", { type: "comments", issueId: issue.id, snoozedUntil: time(0), readAt: time(-100) }),
    pending = entity("pending", { type: "reminder", issueId: issue.id, remindAt: time(0), snoozedUntil: time(0), deliveredAt: null }),
    hidden = entity("hidden", { type: "assigned", issueId: "another", userId: "someone-else", snoozedUntil: time(0), readAt: time(-1) }),
    rows = [assignment, first, second, pending, hidden];
  assert.equal(notificationBadgeCount(rows, [issue], "me", {}, deadline - 1), 0);
  const summary = inboxNotificationSummary(rows, [issue], "me", {}, deadline);
  assert.equal(summary.unreadTotal, 1);
  assert.equal(summary.unreadPriority, 1);
  assert.ok(summary.priorityIds.has("issue#issue"));
  assert.equal(notificationBadgeCount(rows, [issue], "me", { badgeCount: "priority" }, deadline + 60000), 1);
  assert.equal(notificationBadgeCount(rows.map(row => row === first ? { ...row, readAt: time(0) } : row), [issue], "me", {}, deadline), 1);
  const allRead = rows.map(row => row === first || row === second ? { ...row, readAt: time(1000) } : row);
  assert.equal(notificationBadgeCount(allRead, [issue], "me", {}, deadline + 2000), 0);
  assert.equal(first.readAt, time(-1), "Summary does not mutate stored source notifications");
});
