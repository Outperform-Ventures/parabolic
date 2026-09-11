import {notificationDestination} from './notification-destination';
import {inboxPresentation} from './inbox-presentation';
import type { Entity, WorkspaceData } from "../shared/types";
import { textContent } from "./query";
import { desktopNotificationEnabled, isPriorityNotification } from "./inbox-data";

export async function deliverDesktopNotification(
  notification: Entity,
  preferences: Record<string, any>,
  data?: WorkspaceData,
) {
  if (
    !desktopNotificationEnabled(notification, preferences) ||
    (preferences.priorityOnly === true && !isPriorityNotification(notification,data?.issues.find(issue=>issue.id===notification.issueId),data?.users.find(user=>user.id===notification.userId)?.preferences?.inbox||{})) ||
    (document.visibilityState === "visible" && document.hasFocus())
  )
    return;
  const {route}=notificationDestination(notification);
  const title = textContent(notification.title || "Workspace update").slice(
      0,
      250,
    ),
    body = textContent(
      notification.body ||
        notification.message ||
        (data?inboxPresentation(notification,data).summary:undefined) ||
        "You have a new notification",
    ).slice(0, 4000);
  if (window.desktop?.isDesktop) {
    await window.desktop.notify({
      title,
      body,
      route,
      tag: `${notification.workspaceId}:${notification.userId}:${notification.id}:${notification.deliveredAt || notification.createdAt}`,
    });
    return;
  }
  if (!("Notification" in window) || Notification.permission !== "granted")
    return;
  const options: NotificationOptions = {
    body,
    tag: `parabolic:${notification.workspaceId}:${notification.userId}:${notification.id}`,
    icon: "/app-icon-256.png",
    data: { route },
  };
  const registration =
    "serviceWorker" in navigator
      ? await navigator.serviceWorker.getRegistration()
      : undefined;
  if (registration?.active && registration.showNotification) {
    await registration.showNotification(title, options);
    return;
  }
  const alert = new Notification(title, options);
  alert.onclick = () => {
    window.focus();
    window.location.assign(route);
    alert.close();
  };
}
