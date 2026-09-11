import { assert } from "./errors";
import type { Actor, RecordEntity, Repository } from "./repository";

const kinds = new Set(["labels", "labelGroups"]);

export function validateLabelSubscription(
  repo: Repository,
  actor: Actor,
  entity: RecordEntity,
  previous?: RecordEntity,
) {
  if (!kinds.has(entity.entityKind)) return;
  if (previous && kinds.has(previous.entityKind))
    assert(
      entity.entityKind === previous.entityKind && entity.entityId === previous.entityId,
      422,
      "A label subscription cannot change its target",
      "INVALID_LABEL_SUBSCRIPTION",
    );
  const target = repo.raw(entity.entityKind, entity.entityId);
  assert(
    target &&
      !target.archivedAt &&
      (target.entityType ?? "issues") === "issues" &&
      repo.canRead({ ...actor, scopes: [...actor.scopes, "read"] }, entity.entityKind, target),
    422,
    "Choose an accessible issue label",
    "INVALID_LABEL_SUBSCRIPTION",
  );
  for (const field of ["notifyOnAdded", "notifyOnClosed"]) {
    if (entity[field] === undefined) entity[field] = true;
    assert(typeof entity[field] === "boolean", 422, "Subscription options must be booleans", "INVALID_LABEL_SUBSCRIPTION");
  }
  assert(entity.notifyOnAdded || entity.notifyOnClosed, 422, "Choose at least one notification event", "INVALID_LABEL_SUBSCRIPTION");
  assert(
    !repo.all("subscriptions", actor.workspaceId).some(
      (item) =>
        item.id !== entity.id &&
        item.userId === entity.userId &&
        item.entityKind === entity.entityKind &&
        item.entityId === entity.entityId,
    ),
    409,
    "Already subscribed to this label view",
    "DUPLICATE_LABEL_SUBSCRIPTION",
  );
}

function includesTarget(repo: Repository, subscription: RecordEntity, issue: RecordEntity | undefined) {
  if (!issue || issue.deletedAt || issue.archivedAt) return false;
  if (subscription.entityKind === "labels") return (issue.labelIds ?? []).includes(subscription.entityId);
  const group = repo.raw("labelGroups", subscription.entityId);
  if (!group) return false;
  const ids = new Set(
    repo
      .all("labels", issue.workspaceId, true)
      .filter(
        (label) =>
          !label.deletedAt &&
          (label.labelGroupId === group.id ||
            (!label.labelGroupId &&
              label.group === group.name &&
              (label.teamId || null) === (group.teamId || null) &&
              (label.entityType ?? "issues") === (group.entityType ?? "issues"))),
      )
      .map((label) => label.id),
  );
  return (issue.labelIds ?? []).some((id: string) => ids.has(id));
}

export function labelSubscriptionRecipients(
  repo: Repository,
  actor: Actor,
  issue: RecordEntity,
  previous: RecordEntity | undefined,
  add: (userId: string, reason: string) => void,
) {
  const closed =
    !!previous &&
    issue.statusId !== previous.statusId &&
    ["completed", "canceled"].includes(repo.raw("statuses", issue.statusId)?.type);
  for (const subscription of repo.all("subscriptions", actor.workspaceId)) {
    if (!kinds.has(subscription.entityKind) || subscription.archivedAt) continue;
    const target = repo.raw(subscription.entityKind, subscription.entityId);
    const recipient = repo.actorForUser(subscription.userId, actor.workspaceId);
    if (!target || target.archivedAt || recipient.role === "none" || !repo.canRead(recipient, subscription.entityKind, target)) continue;
    const before = includesTarget(repo, subscription, previous);
    const after = includesTarget(repo, subscription, issue);
    if (subscription.notifyOnAdded === true && !before && after) add(subscription.userId, "labelIssueAdded");
    if (subscription.notifyOnClosed === true && closed && (before || after)) add(subscription.userId, "labelIssueClosed");
  }
}
