import test from "node:test";
import assert from "node:assert/strict";
import type { Entity } from "../../src/shared/types";
import {
  buildInboxStacks,
  groupingKey,
  inboxNotificationCategory,
  isMentionNotification,
  isReactionNotification,
  notificationMovedToInboxAt,
  snapshotInboxStack,
  stackMembersForAction,
} from "../../src/client/inbox-stacks";
import { groupInboxFocus } from "../../src/client/inbox-focus";

const now = Date.parse("2026-09-05T12:00:00Z");
const row = (id: string, fields: Record<string, unknown> = {}): Entity => ({
  id,
  workspaceId: "workspace",
  version: 1,
  createdAt: new Date(now).toISOString(),
  updatedAt: new Date(now).toISOString(),
  type: "comments",
  ...fields,
});
const ago = (hours: number) => new Date(now - hours * 3600000).toISOString();

test("issue comments share the issue stack while project/document replies share their root thread", () => {
  const comments = [
    row("issue-root", { issueId: "issue" }),
    row("issue-reply", { issueId: "issue", parentId: "issue-root" }),
    row("project-root", { projectId: "project" }),
    row("project-reply", { projectId: "project", parentId: "project-root" }),
    row("document-root", { documentId: "document" }),
    row("document-reply", {
      documentId: "document",
      parentId: "document-root",
    }),
  ];
  const notifications = comments.map((comment) =>
    row(`n-${comment.id}`, { entityKind: "comments", entityId: comment.id }),
  );
  const stacks = buildInboxStacks(notifications, { comments });
  assert.deepEqual(
    stacks.map((stack) => [stack.id, stack.allNotifications.length]),
    [
      ["issue#issue", 2],
      ["project-thread#project-root", 2],
      ["document-thread#document-root", 2],
    ],
  );
  assert.equal(
    groupingKey(
      row("another", {
        type: "projectNewComment",
        projectId: "project",
        commentId: "other-thread",
      }),
    ),
    "project-thread#other-thread",
  );
  assert.equal(
    groupingKey(
      row("missing-comment", {
        type: "projectNewComment",
        projectId: "project",
      }),
    ),
    "project#project",
  );
  assert.equal(
    groupingKey(
      row("missing-initiative-comment", {
        type: "initiativeNewComment",
        initiativeId: "initiative",
      }),
    ),
    "initiative-thread#missing-initiative-comment",
  );
});

test("reminders, entity changes, update notices and particular update threads remain separate", () => {
  const updates = [
    row("update-a", { projectId: "project" }),
    row("update-b", { projectId: "project" }),
    row("update-i", { initiativeId: "initiative" }),
  ];
  const entries = [
    row("general", { projectId: "project", type: "projectAddedAsLead" }),
    row("reminder", {
      entityKind: "projects",
      entityId: "project",
      type: "reminder",
    }),
    row("change", {
      projectId: "project",
      type: "projectDescriptionContentChange",
    }),
    row("new-a", {
      entityKind: "updates",
      entityId: "update-a",
      type: "projectUpdates",
    }),
    row("new-b", {
      entityKind: "updates",
      entityId: "update-b",
      type: "projectUpdates",
    }),
    row("reply-a", { updateId: "update-a", type: "comments" }),
    row("reply-b", { updateId: "update-b", type: "comments" }),
    row("prompt", { projectId: "project", type: "updateReminders" }),
    row("initiative-reaction", { updateId: "update-i", type: "reaction" }),
  ];
  assert.deepEqual(
    buildInboxStacks(entries, { updates }).map((stack) => stack.id),
    [
      "project#project",
      "project-reminder#project",
      "project-description-change#project",
      "new-update-on-project#project",
      "project-update#update-a",
      "project-update#update-b",
      "project-update-prompt#project",
      "initiative-update#update-i",
    ],
  );
  const cases: [Record<string, unknown>, string][] = [
    [
      { type: "documentContentChange", documentId: "doc" },
      "document-content-change#doc",
    ],
    [
      {
        type: "documentContentRevision",
        documentId: "doc",
        metadata: { documentContentRevision: { revisionId: "rev" } },
      },
      "document-content-revision#rev",
    ],
    [{ type: "documentDeleted", documentId: "doc" }, "document-moved#doc"],
    [
      { type: "initiativeReminder", initiativeId: "initiative" },
      "initiative-reminder#initiative",
    ],
    [{ type: "issueReminder", issueId: "issue" }, "issue-reminder#issue"],
    [
      {
        type: "projectMilestoneNewComment",
        projectMilestoneId: "milestone",
        commentId: "comment",
      },
      "project-milestone-thread#comment",
    ],
    [
      {
        type: "projectMilestoneDescriptionContentChange",
        projectMilestoneId: "milestone",
      },
      "project-description-change#milestone",
    ],
  ];
  for (const [fields, expected] of cases)
    assert.equal(groupingKey(row("notification", fields)), expected);
  assert.equal(
    groupingKey(
      row("update-mention", {
        entityKind: "updates",
        entityId: "update-a",
        type: "projectUpdates",
        reasons: ["projectUpdates", "mentioned"],
      }),
      { updates },
    ),
    "project-update#update-a",
  );
});

test("customer requests resolve their customer first and retain the native issue consolidation fallback", () => {
  const requests = [
    row("request", {
      customerId: "customer",
      issueId: "issue",
      projectId: "project",
    }),
  ];
  assert.equal(
    groupingKey(
      row("n", {
        type: "requests",
        entityKind: "requests",
        entityId: "request",
      }),
      { requests },
    ),
    "customer#customer",
  );
  assert.equal(
    groupingKey(
      row("n", { type: "requests", issueId: "issue", projectId: "project" }),
    ),
    "issue#issue",
  );
  assert.equal(
    groupingKey(row("n", { type: "requests", projectId: "project" })),
    "project#project",
  );
  assert.equal(
    groupingKey(
      row("n", {
        type: "requests",
        projectId: "project",
        metadata: { issueIdForGrouping: "linked" },
      }),
    ),
    "issue#linked",
  );
  assert.equal(
    groupingKey(
      row("native", { type: "customerNeedCreated", customerId: "customer" }),
    ),
    "customer#customer",
  );
});

test("unknown or incomplete event references cannot accidentally collapse unrelated notifications", () => {
  const a = row("a", { type: "futureEvent", issueId: "shared" }),
    b = row("b", { type: "futureEvent", issueId: "shared" });
  assert.deepEqual(
    buildInboxStacks([a, b]).map((stack) => stack.id),
    ["unknown#a", "unknown#b"],
  );
  assert.equal(
    groupingKey(row("a", { type: "issueStatusChanged" })),
    "issue#a",
  );
  assert.equal(
    groupingKey(row("b", { type: "documentNewComment" })),
    "document#b",
  );
  assert.equal(
    groupingKey(row("c", { groupingEntityId: "project#canonical" })),
    "project#canonical",
  );
  assert.equal(
    groupingKey(row("d", { groupingEntityId: "#", type: "futureEvent" })),
    "unknown#d",
  );
  assert.equal(
    groupingKey(
      row("e", {
        type: "comments",
        entityKind: "comments",
        entityId: "unavailable",
      }),
    ),
    "unknown#e",
  );
});

test("unread candidate selection retains hidden read members for group actions and preserves entity identity", () => {
  const read = Object.freeze(
    row("read-mention", {
      issueId: "issue",
      type: "mentioned",
      readAt: ago(1),
    }),
  );
  const old = Object.freeze(
    row("old", { issueId: "issue", createdAt: ago(2) }),
  );
  const latest = Object.freeze(
    row("latest", { issueId: "issue", createdAt: ago(1) }),
  );
  const input = Object.freeze([read, old, latest]);
  const [stack] = buildInboxStacks(input, { now });
  assert.strictEqual(stack.mainNotification, latest);
  assert.deepEqual(stack.otherNotifications, [old]);
  assert.deepEqual(stack.allNotifications, [read, old, latest]);
  assert.strictEqual(stack.allNotifications[0], read);
  assert.deepEqual(stackMembersForAction(stack.id, input), [read, old, latest]);
  assert.deepEqual(input, [read, old, latest]);
});

test("recent mentions are prioritized across every reason and the 72-hour cutoff is strict", () => {
  const latest = row("latest", { issueId: "issue" });
  const mention = row("mention", {
    issueId: "issue",
    reasons: ["comments", "mentioned"],
    createdAt: ago(71),
  });
  assert.equal(isMentionNotification(mention), true);
  assert.equal(
    buildInboxStacks([latest, mention], { now })[0].mainNotification.id,
    "mention",
  );
  const boundary = row("boundary", {
    ...mention,
    id: "boundary",
    createdAt: ago(72),
  });
  assert.equal(
    buildInboxStacks([latest, boundary], { now })[0].mainNotification.id,
    "latest",
  );
  const allRead = [latest, mention].map((item) => ({
    ...item,
    readAt: ago(1),
  }));
  assert.equal(
    buildInboxStacks(allRead, { now })[0].mainNotification.id,
    "mention",
  );
});

test("reactions defer to the first nonreaction without demoting a coalesced mention", () => {
  const reaction = row("reaction", { issueId: "issue", type: "reaction" });
  const comment = row("comment", { issueId: "issue", createdAt: ago(1) });
  const old = row("old", { issueId: "issue", createdAt: ago(2) });
  const [stack] = buildInboxStacks([old, reaction, comment], { now });
  assert.deepEqual(
    [stack.mainNotification, ...stack.otherNotifications].map(
      (item) => item.id,
    ),
    ["comment", "reaction", "old"],
  );
  assert.equal(
    buildInboxStacks(
      [
        reaction,
        row("other-reaction", {
          issueId: "issue",
          type: "reaction",
          createdAt: ago(1),
        }),
      ],
      { now },
    )[0].mainNotification.id,
    "reaction",
  );
  const combined = row("combined", {
    type: "reaction",
    reasons: ["reaction", "mentioned"],
    entityKind: "comments",
  });
  assert.equal(isReactionNotification(combined), false);
  assert.equal(inboxNotificationCategory(combined), "mentions");
  assert.equal(
    inboxNotificationCategory(
      row("r", { type: "reaction", entityKind: "comments" }),
    ),
    "reactions",
  );
  assert.equal(
    inboxNotificationCategory(
      row("r", { type: "reaction", entityKind: "updates" }),
    ),
    "reactions",
  );
});

test("timestamp ties use IDs and moved-to-Inbox time never replaces creation time in representative priority", () => {
  const a = row("a", { issueId: "issue" }),
    b = row("b", { issueId: "issue" });
  assert.equal(buildInboxStacks([b, a], { now })[0].mainNotification.id, "a");
  const awakened = row("awake", {
    issueId: "issue",
    createdAt: ago(10),
    unsnoozedAt: new Date(now + 1).toISOString(),
  });
  assert.equal(
    buildInboxStacks([awakened, a], { now })[0].mainNotification.id,
    "a",
  );
  assert.equal(notificationMovedToInboxAt(awakened), now + 1);
  assert.equal(
    notificationMovedToInboxAt(
      row("read-update", {
        createdAt: ago(5),
        updatedAt: new Date(now + 1000).toISOString(),
      }),
    ),
    now - 5 * 3600000,
  );
  assert.equal(
    notificationMovedToInboxAt(
      row("explicit", { movedToInboxAt: ago(2), unsnoozedAt: ago(4) }),
    ),
    now - 2 * 3600000,
  );
});

test("displayed representative survives priority expiration until genuinely newer activity arrives", () => {
  const latest = row("latest", { issueId: "issue", createdAt: ago(1) });
  const mention = row("mention", {
    issueId: "issue",
    type: "mentioned",
    createdAt: ago(71),
  });
  const initial = buildInboxStacks([latest, mention], { now })[0];
  const selectedSnapshots = new Map([
    [initial.id, snapshotInboxStack(initial)],
  ]);
  const later = now + 2 * 3600000;
  assert.equal(
    buildInboxStacks([latest, mention], { now: later })[0].mainNotification.id,
    "latest",
  );
  assert.equal(
    buildInboxStacks([latest, mention], { now: later, selectedSnapshots })[0]
      .mainNotification.id,
    "mention",
  );
  const newer = row("newer", {
    issueId: "issue",
    createdAt: new Date(later).toISOString(),
  });
  assert.equal(
    buildInboxStacks([latest, mention, newer], {
      now: later,
      selectedSnapshots,
    })[0].mainNotification.id,
    "newer",
  );
  const older = row("older-arrival", { issueId: "issue", createdAt: ago(30) });
  assert.equal(
    buildInboxStacks([latest, mention, older], {
      now: later,
      selectedSnapshots,
    })[0].mainNotification.id,
    "mention",
  );
});

test("same-time unseen activity invalidates a pinned representative and read candidates cannot remain pinned", () => {
  const b = row("b", { issueId: "issue" });
  const initial = buildInboxStacks([b], { now })[0];
  const selectedSnapshots = { [initial.id]: snapshotInboxStack(initial) };
  const a = row("a", { issueId: "issue" });
  assert.equal(
    buildInboxStacks([b, a], { now, selectedSnapshots })[0].mainNotification.id,
    "a",
  );
  const readB = { ...b, readAt: new Date(now).toISOString() };
  assert.equal(
    buildInboxStacks([readB, a], { now, selectedSnapshots })[0].mainNotification
      .id,
    "a",
  );
  const readOnly = buildInboxStacks([readB], { now, selectedSnapshots })[0];
  assert.strictEqual(readOnly.mainNotification, readB);
});

test("callers retain ownership of deleted/read/snoozed filtering and stack order", () => {
  const first = row("first", {
    issueId: "first",
    deletedAt: ago(1),
    archivedAt: ago(1),
    snoozedUntil: "2099-01-01",
  });
  const second = row("second", { issueId: "second", readAt: ago(1) });
  const stacks = buildInboxStacks([first, second], { now });
  assert.deepEqual(
    stacks.map((stack) => stack.id),
    ["issue#first", "issue#second"],
  );
  assert.strictEqual(stacks[0].mainNotification, first);
  assert.deepEqual(buildInboxStacks([], { now }), []);
});

test("Focus consumes original main/candidate references and counts issue reply stacks once", () => {
  const comments = [
    row("root", { issueId: "issue" }),
    row("reply", { issueId: "issue", parentId: "root" }),
  ];
  const notifications = [
    row("n-main", {
      issueId: "issue",
      entityKind: "comments",
      entityId: "root",
    }),
    row("n-reply", {
      issueId: "issue",
      entityKind: "comments",
      entityId: "reply",
      createdAt: ago(1),
    }),
    row("reminder", { issueId: "other", type: "reminder" }),
  ];
  const stacks = buildInboxStacks(notifications, { comments, now });
  const byMain = new Map(
    stacks.map((stack) => [stack.mainNotification.id, stack]),
  );
  const focus = groupInboxFocus(
    stacks.map((stack) => stack.mainNotification),
    {
      comments,
      otherNotifications: (main) =>
        byMain.get(main.id)?.otherNotifications || [],
    },
  );
  assert.deepEqual(
    focus
      .filter((item) => item.type === "group")
      .map((item) => [item.title, item.count]),
    [
      ["Reminders", 1],
      ["Replies", 1],
    ],
  );
  assert.strictEqual(
    focus.find(
      (item) => item.type === "notification" && item.item.id === "n-main",
    )?.type,
    "notification",
  );
  assert.equal(stacks.length, 2);
});
