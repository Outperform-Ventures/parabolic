import type { Entity } from "../shared/types";

/** One displayed row. Candidate members can omit read records; actions need allNotifications. */
export interface InboxStack {
  id: string;
  mainNotification: Entity;
  otherNotifications: Entity[];
  allNotifications: Entity[];
}
export interface InboxStackSnapshot {
  notificationId: string;
  latestMovedToInboxAt: number;
  latestNotificationIds: readonly string[];
}
export interface InboxStackContext {
  comments?: readonly Entity[];
  updates?: readonly Entity[];
  requests?: readonly Entity[];
}
export interface InboxStackOptions extends InboxStackContext {
  now?: number;
  selectedSnapshots?:
    | ReadonlyMap<string, InboxStackSnapshot>
    | Readonly<Record<string, InboxStackSnapshot>>;
}

const normalized = (value: unknown): string =>
  typeof value === "string" ? value.toLowerCase().replace(/[\s_-]/g, "") : "";
const tagSet = (values: string) => new Set(values.split(" ").map(normalized));
export function inboxNotificationTags(item: Entity): Set<string> {
  return new Set(
    [item.type, ...(Array.isArray(item.reasons) ? item.reasons : [])]
      .map(normalized)
      .filter(Boolean),
  );
}
const has = (values: Set<string>, choices: Set<string>) =>
  [...values].some((value) => choices.has(value));
const mentionTags = tagSet(
  "mention mentions mentioned issueMention issueMentioned issueCommentMention projectMention projectCommentMention projectMilestoneMention projectMilestoneCommentMention initiativeMention initiativeCommentMention documentMention documentCommentMention projectUpdateMention projectUpdateMentionPrompt projectUpdateCommentMention initiativeUpdateMention initiativeUpdateCommentMention",
);
const reactionTags = tagSet(
  "reaction reactions issueEmojiReaction issueCommentReaction projectCommentReaction projectMilestoneCommentReaction initiativeCommentReaction documentCommentReaction projectUpdateReaction projectUpdateCommentReaction initiativeUpdateReaction initiativeUpdateCommentReaction",
);
const commentTags = tagSet(
  "comment comments reply replies commentsAndReplies issueComment issueNewComment issueThreadResolved projectComment projectNewComment projectThreadResolved projectMilestoneNewComment projectMilestoneThreadResolved initiativeComment initiativeNewComment initiativeThreadResolved documentComment documentNewComment documentThreadResolved projectUpdateNewComment initiativeUpdateNewComment",
);
const reminderTags = tagSet(
  "reminder reminders issueReminder projectReminder initiativeReminder documentReminder",
);
const promptTags = tagSet(
  "updateReminders projectUpdatePrompt initiativeUpdatePrompt",
);
const assignmentTags = tagSet(
  "assigned unassigned assignments issueAssignedToYou issueUnassignedFromYou projectAddedAsMember projectAddedAsLead initiativeAddedAsOwner documentAddedAsOwner documentRemovedAsOwner",
);
const subscriptionTags = tagSet(
  "subscription subscriptions subscribed unsubscribed shared issueSubscribed issueUnsubscribed issueSharedWithYou documentSubscribed documentUnsubscribed",
);
const updateTags = tagSet(
  "updates postsAndUpdates projectUpdates initiativeUpdates projectUpdateCreated initiativeUpdateCreated",
);
const requestTags = tagSet(
  "request requests customers customerRequests customerRequestCreated customerRequestImportant customerRequestResolved customerNeedCreated customerNeedMarkedAsImportant customerNeedResolved",
);
const documentChangeTags = tagSet(
  "documentChanges documentContentChange documentContentRevision documentMoved documentDeleted documentRestored projectDescriptionContentChange projectDeleted projectRestored initiativeDescriptionContentChange initiativeMoved initiativeDeleted initiativeRestored",
);

export function isMentionNotification(item: Entity): boolean {
  return (
    normalized(item.category) === "mentions" ||
    has(inboxNotificationTags(item), mentionTags)
  );
}
export function isReactionNotification(item: Entity): boolean {
  // A coalesced mention must not be treated as a low-priority reaction.
  return (
    !isMentionNotification(item) &&
    (normalized(item.category) === "reactions" ||
      has(inboxNotificationTags(item), reactionTags))
  );
}
/** Normalized category names also used by Inbox Focus. Explicit events precede entity fallbacks. */
export function inboxNotificationCategory(item: Entity): string {
  if (isMentionNotification(item)) return "mentions";
  if (isReactionNotification(item)) return "reactions";
  const explicit = normalized(item.category),
    values = inboxNotificationTags(item);
  if (explicit) return explicit;
  if (has(values, promptTags)) return "updatereminders";
  if (has(values, reminderTags)) return "reminders";
  if (has(values, commentTags)) return "commentsandreplies";
  if (has(values, assignmentTags)) return "assignments";
  if (has(values, subscriptionTags)) return "subscriptions";
  if (has(values, updateTags)) return "postsandupdates";
  if (has(values, requestTags)) return "customers";
  if (has(values, documentChangeTags)) return "documentchanges";
  if (
    values.has("triage") ||
    values.has("triageresponsibilityissueaddedtotriage")
  )
    return "triage";
  if (values.has("system") || values.has("appsandintegrations"))
    return "system";
  if (item.entityKind === "comments") return "commentsandreplies";
  if (item.entityKind === "updates") return "postsandupdates";
  if (item.entityKind === "requests") return "customers";
  if (item.entityKind === "documents") return "documentchanges";
  return "";
}

type ParentKind =
  "issue" | "project" | "initiative" | "document" | "project-milestone";
type Lookup = {
  comments: Map<string, Entity>;
  updates: Map<string, Entity>;
  requests: Map<string, Entity>;
};
const lookup = (context: InboxStackContext): Lookup => ({
  comments: new Map(context.comments?.map((item) => [item.id, item])),
  updates: new Map(context.updates?.map((item) => [item.id, item])),
  requests: new Map(context.requests?.map((item) => [item.id, item])),
});
const ownId = (item: Entity, kind: string): string | undefined =>
  item.entityKind === kind && typeof item.entityId === "string"
    ? item.entityId
    : undefined;
const id = (...values: unknown[]): string | undefined =>
  values.find((value) => typeof value === "string" && value.length > 0) as
    string | undefined;
const typed = (kind: string, value: string | undefined, item: Entity): string =>
  `${kind}#${value || item.id}`;

// Only known type families imply a parent. An unknown type with an issueId stays independent.
const issueTags = tagSet(
  "assigned unassigned status shared triage subscribed unsubscribed subscription subscriptions mention mentioned mentions comment comments reply replies reaction reactions sla slaBreached slaWarning slaAtRisk dueDateNear dueDateOverdue issueCreated issueAssignedToYou issueUnassignedFromYou issueAddedToView issueRemovedFromView issueMention issueMentioned issueNewComment issueComment issueCommentMention issueCommentReaction issueThreadResolved issueEmojiReaction issuePriorityUrgent issueSubscribed issueUnsubscribed issueBlocking issueUnblocked issueStatusChanged issueStatusChangedDone issueStatusChangedAll issueReopened issueDue issueSharedWithYou issueSlaHighRisk issueSlaBreached issueDeleted issueRestored triageResponsibilityIssueAddedToTriage",
);
const genericParentTags = tagSet(
  "assigned unassigned subscribed unsubscribed subscription subscriptions shared mention mentions mentioned comment comments reply replies reaction reactions",
);
const nativeFamilySuffixes = tagSet(
  "AddedAsMember AddedAsLead AddedAsOwner RemovedAsOwner Mention CommentMention NewComment Comment ThreadResolved CommentReaction Subscribed Unsubscribed",
);
const threadSuffixes = tagSet(
  "CommentMention NewComment Comment ThreadResolved CommentReaction Subscribed Unsubscribed",
);

function groupingWithLookup(item: Entity, context: Lookup): string {
  const explicit = id(item.groupingEntityId);
  if (explicit && /^[^#]+#.+$/.test(explicit)) return explicit;
  const values = inboxNotificationTags(item);
  const commentId = id(item.commentId, ownId(item, "comments"));
  const comment = commentId ? context.comments.get(commentId) : undefined;
  const updateId = id(
    item.projectUpdateId,
    item.initiativeUpdateId,
    item.updateId,
    comment?.updateId,
    ownId(item, "updates"),
  );
  const update = updateId ? context.updates.get(updateId) : undefined;
  const request = context.requests.get(
    id(item.requestId, ownId(item, "requests")) || "",
  );
  const parentIds: Record<ParentKind, string | undefined> = {
    issue: id(
      item.issueId,
      comment?.issueId,
      request?.issueId,
      ownId(item, "issues"),
    ),
    project: id(
      item.projectId,
      comment?.projectId,
      update?.projectId,
      request?.projectId,
      ownId(item, "projects"),
    ),
    initiative: id(
      item.initiativeId,
      comment?.initiativeId,
      update?.initiativeId,
      ownId(item, "initiatives"),
    ),
    document: id(
      item.documentId,
      comment?.documentId,
      ownId(item, "documents"),
    ),
    "project-milestone": id(
      item.projectMilestoneId,
      item.milestoneId,
      comment?.milestoneId,
      ownId(item, "milestones"),
    ),
  };
  const rootCommentId = id(item.parentCommentId, comment?.parentId, commentId);
  const thread = (kind: ParentKind) =>
    kind === "issue"
      ? typed(kind, parentIds[kind], item)
      : rootCommentId
        ? typed(`${kind}-thread`, rootCommentId, item)
        : kind === "initiative"
          ? typed("initiative-thread", undefined, item)
          : typed(kind, parentIds[kind], item);

  if (has(values, requestTags) || item.entityKind === "requests") {
    const customerId = id(item.customerId, request?.customerId);
    if (customerId) return typed("customer", customerId, item);
    if (parentIds.issue) return typed("issue", parentIds.issue, item);
    if (parentIds.project) {
      const issueForGrouping = id(item.metadata?.issueIdForGrouping);
      return issueForGrouping
        ? typed("issue", issueForGrouping, item)
        : typed("project", parentIds.project, item);
    }
    return typed("issue", undefined, item);
  }

  const kinds: ParentKind[] = [
    "issue",
    "project",
    "initiative",
    "document",
    "project-milestone",
  ];
  if (has(values, reminderTags)) {
    const kind =
      kinds.find((kind) => values.has(`${kind.replace("-", "")}reminder`)) ||
      kinds.find((kind) => parentIds[kind]);
    return kind
      ? typed(`${kind}-reminder`, parentIds[kind], item)
      : typed("unknown", undefined, item);
  }
  if (has(values, promptTags)) {
    const kind =
      values.has("initiativeupdateprompt") ||
      (parentIds.initiative && !parentIds.project)
        ? "initiative"
        : "project";
    return typed(`${kind}-update-prompt`, parentIds[kind], item);
  }
  for (const kind of ["project", "initiative"] as const) {
    if (
      (values.has(`${kind}updates`) ||
        values.has(`${kind}updatecreated`) ||
        (item.entityKind === "updates" && parentIds[kind])) &&
      !isMentionNotification(item) &&
      !isReactionNotification(item)
    )
      return typed(`new-update-on-${kind}`, parentIds[kind], item);
    const updateEvent = [
      "reaction",
      "mention",
      "mentionprompt",
      "newcomment",
      "commentmention",
      "commentreaction",
    ].some((suffix) => values.has(`${kind}update${suffix}`));
    if (
      updateEvent ||
      (updateId &&
        parentIds[kind] &&
        (item.entityKind === "comments" ||
          has(values, commentTags) ||
          isMentionNotification(item) ||
          isReactionNotification(item)))
    )
      return typed(`${kind}-update`, updateId, item);
  }

  if (values.has("documentcontentrevision"))
    return typed(
      "document-content-revision",
      id(
        item.revisionId,
        item.metadata?.documentContentRevision?.revisionId,
        parentIds.document,
      ),
      item,
    );
  if (values.has("documentcontentchange"))
    return typed("document-content-change", parentIds.document, item);
  for (const kind of ["document", "project", "initiative"] as const) {
    if (
      ["moved", "deleted", "restored"].some((suffix) =>
        values.has(`${kind}${suffix}`),
      )
    )
      return typed(`${kind}-moved`, parentIds[kind], item);
    if (values.has(`${kind}descriptioncontentchange`))
      return typed(
        `${kind}-description-change`,
        parentIds[kind] ||
          (kind === "project" ? parentIds["project-milestone"] : undefined),
        item,
      );
  }
  if (values.has("projectmilestonedescriptioncontentchange"))
    return typed(
      "project-description-change",
      parentIds.project || parentIds["project-milestone"],
      item,
    );
  // Native explicit family types work even when the parent record is no longer loaded.
  for (const kind of kinds) {
    const prefix = kind.replace("-", "");
    for (const suffix of nativeFamilySuffixes) {
      if (values.has(prefix + suffix))
        return threadSuffixes.has(suffix)
          ? thread(kind)
          : typed(kind, parentIds[kind], item);
    }
  }
  if (parentIds.issue && has(values, issueTags))
    return typed("issue", parentIds.issue, item);
  if (has(values, genericParentTags) || item.entityKind === "comments") {
    const kind = kinds.find((kind) => parentIds[kind]);
    if (kind)
      return commentId ||
        has(values, commentTags) ||
        isReactionNotification(item)
        ? thread(kind)
        : typed(kind, parentIds[kind], item);
  }
  // Known issue types retain their typed fallback when the issue reference is absent.
  if (
    [...values].some(
      (value) => value.startsWith("issue") && issueTags.has(value),
    )
  )
    return typed("issue", undefined, item);
  return typed("unknown", undefined, item);
}

export function groupingKey(
  item: Entity,
  context: InboxStackContext = {},
): string {
  return groupingWithLookup(item, lookup(context));
}

const timestamp = (value: unknown): number => {
  const result =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Date.parse(value)
        : NaN;
  return Number.isFinite(result) ? result : 0;
};
export function notificationMovedToInboxAt(item: Entity): number {
  return timestamp(item.movedToInboxAt ?? item.unsnoozedAt ?? item.createdAt);
}
const compareIds = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const candidatesByTime = (a: Entity, b: Entity) =>
  timestamp(b.createdAt) - timestamp(a.createdAt) || compareIds(a.id, b.id);
const recentMentionWindow = 72 * 60 * 60 * 1000;

export function snapshotInboxStack(stack: InboxStack): InboxStackSnapshot {
  const candidates = [stack.mainNotification, ...stack.otherNotifications];
  const latestMovedToInboxAt = candidates.reduce(
    (latest, item) => Math.max(latest, notificationMovedToInboxAt(item)),
    -Infinity,
  );
  return {
    notificationId: stack.mainNotification.id,
    latestMovedToInboxAt,
    latestNotificationIds: candidates
      .filter(
        (item) => notificationMovedToInboxAt(item) === latestMovedToInboxAt,
      )
      .map((item) => item.id)
      .sort(compareIds),
  };
}

/** Callers own permission, archived/read/snooze filtering and final stack ordering. Entities are never cloned. */
export function buildInboxStacks(
  input: readonly Entity[],
  options: InboxStackOptions = {},
): InboxStack[] {
  const context = lookup(options),
    groups = new Map<string, Entity[]>(),
    now = options.now ?? Date.now();
  for (const item of input) {
    const key = groupingWithLookup(item, context);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return [...groups].map(([key, allNotifications]) => {
    const unread = allNotifications.filter((item) => !item.readAt);
    const candidates = (unread.length ? unread : [...allNotifications]).sort(
      candidatesByTime,
    );
    const mention = candidates.findIndex(
      (item) =>
        isMentionNotification(item) &&
        timestamp(item.createdAt) > now - recentMentionWindow,
    );
    if (mention > 0) candidates.unshift(...candidates.splice(mention, 1));
    if (isReactionNotification(candidates[0])) {
      const alternative = candidates.findIndex(
        (item) => !isReactionNotification(item),
      );
      if (alternative > 0)
        candidates.unshift(...candidates.splice(alternative, 1));
    }
    const snapshots = options.selectedSnapshots;
    const snapshot =
      snapshots &&
      (typeof (snapshots as ReadonlyMap<string, InboxStackSnapshot>).get ===
      "function"
        ? (snapshots as ReadonlyMap<string, InboxStackSnapshot>).get(key)
        : (snapshots as Readonly<Record<string, InboxStackSnapshot>>)[key]);
    if (snapshot) {
      const previous = candidates.findIndex(
        (item) => item.id === snapshot.notificationId,
      );
      const previousLatest = new Set(snapshot.latestNotificationIds);
      const newerActivity = candidates.some((item) => {
        const at = notificationMovedToInboxAt(item);
        return (
          at > snapshot.latestMovedToInboxAt ||
          (at === snapshot.latestMovedToInboxAt && !previousLatest.has(item.id))
        );
      });
      if (previous > 0 && !newerActivity)
        candidates.unshift(...candidates.splice(previous, 1));
    }
    return {
      id: key,
      mainNotification: candidates[0],
      otherNotifications: candidates.slice(1),
      allNotifications,
    };
  });
}

export function stackMembersForAction(
  stackId: string,
  rows: readonly Entity[],
  context: InboxStackContext = {},
): Entity[] {
  const index = lookup(context);
  return rows.filter((item) => groupingWithLookup(item, index) === stackId);
}
