import { useEffect, useState } from "react";
import type { Entity } from "../shared/types";

/** Wake only when a snoozed notification becomes visible, rather than polling the app. */
export function useNotificationClock(notifications: readonly Entity[]) {
  const [tick, setTick] = useState(Date.now);
  const now = Math.max(tick, Date.now());
  const next = notifications.reduce((earliest, notification) => {
    if (notification.deletedAt || notification.archivedAt || !notification.snoozedUntil) return earliest;
    const deadline = Date.parse(notification.snoozedUntil);
    return deadline > now ? Math.min(earliest, deadline) : earliest;
  }, Infinity);
  useEffect(() => {
    if (!Number.isFinite(next)) return;
    const timer = setTimeout(() => setTick(Date.now()), Math.min(2_147_483_647, Math.max(1, next - Date.now() + 1)));
    return () => clearTimeout(timer);
  }, [next, tick]);
  useEffect(() => {
    const wake = () => { if (document.visibilityState === "visible") setTick(Date.now()); };
    document.addEventListener("visibilitychange", wake);
    return () => document.removeEventListener("visibilitychange", wake);
  }, []);
  return now;
}
