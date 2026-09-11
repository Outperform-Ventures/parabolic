import type { Entity } from "../shared/types";

/** Project a due snooze until its authoritative scheduler update arrives. No writes or mutation. */
export function effectiveInboxNotification(
  notification: Entity,
  now = Date.now(),
): Entity {
  if (
    notification.deletedAt ||
    notification.archivedAt ||
    !notification.snoozedUntil ||
    (notification.type === "reminder" && !notification.deliveredAt)
  )
    return notification;
  const deadline = Date.parse(notification.snoozedUntil);
  if (!Number.isFinite(deadline) || deadline > now) return notification;
  const readTime =
    typeof notification.readAt === "string"
      ? Date.parse(notification.readAt)
      : NaN;
  const arrival = new Date(deadline).toISOString();
  return {
    ...notification,
    snoozedUntil: null,
    unsnoozedAt: arrival,
    movedToInboxAt: arrival,
    readAt:
      Number.isFinite(readTime) && readTime >= deadline
        ? notification.readAt
        : null,
  };
}
