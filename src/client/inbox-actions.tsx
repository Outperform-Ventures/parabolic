import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { getAppSnapshot, useAppStore } from "./store";
import { isInboxNotification } from "./inbox-data";
import { stackMembersForAction } from "./inbox-stacks";
import { effectiveInboxNotification } from "./inbox-expiry";

type InboxScope = { workspaceId: string; userId: string };
const recentlyMarkedUnread = new Map<string, number>();
const scopedKey = (scope: InboxScope, stackId: string) =>
  `${scope.workspaceId}:${scope.userId}:${stackId}`;

/** Resolve group members when the action runs, including arrivals since selection. */
export async function markInboxStackRead(
  stackId: string,
  read: boolean,
  automatic = false,
  expectedScope?: InboxScope,
) {
  const store = getAppSnapshot();
  if (!store.user || !store.data.workspaceId) return;
  const scope = { workspaceId: store.data.workspaceId, userId: store.user.id };
  if (
    expectedScope &&
    (expectedScope.workspaceId !== scope.workspaceId ||
      expectedScope.userId !== scope.userId)
  )
    return;
  const key = scopedKey(scope, stackId);
  const now = Date.now();
  if (automatic && now - (recentlyMarkedUnread.get(key) || 0) < 500) return;
  if (!read) {
    recentlyMarkedUnread.set(key, now);
    for (const [id, time] of recentlyMarkedUnread)
      if (now - time > 500) recentlyMarkedUnread.delete(id);
  }
  const members = stackMembersForAction(
    stackId,
    store.data.notifications.filter((row) =>
      isInboxNotification(row, scope.userId),
    ),
    {
      comments: store.data.comments,
      updates: store.data.updates,
      requests: store.data.requests,
    },
  ).filter(
    (member) => !!effectiveInboxNotification(member, now).readAt !== read,
  );
  const readAt = read ? new Date(now).toISOString() : null;
  try {
    for (let index = 0; index < members.length; index += 1000) {
      const latest = getAppSnapshot();
      if (
        latest.data.workspaceId !== scope.workspaceId ||
        latest.user?.id !== scope.userId
      )
        return;
      await latest.batch(
        members
          .slice(index, index + 1000)
          .map((member) => ({
            kind: "notifications",
            id: member.id,
            data: { readAt },
          })),
        { history: !automatic },
      );
    }
  } catch (error) {
    store.toast((error as Error).message);
  }
}

/** Keep the selected-Inbox read lifecycle when a narrow window opens the full entity page. */
export function InboxNavigationRead() {
  const location = useLocation();
  const store = useAppStore();
  const target = location.state?.inboxStackRead as
    (InboxScope & { stackId: string }) | undefined;
  useEffect(() => {
    if (
      !target ||
      target.workspaceId !== store.data.workspaceId ||
      target.userId !== store.user?.id
    )
      return;
    const timer = setTimeout(
      () => void markInboxStackRead(target.stackId, true, true, target),
      300,
    );
    return () => clearTimeout(timer);
  }, [
    location.key,
    target?.stackId,
    target?.workspaceId,
    target?.userId,
    store.data.workspaceId,
    store.user?.id,
  ]);
  return null;
}
