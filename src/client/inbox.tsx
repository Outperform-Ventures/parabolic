import {NativeControlIcon} from './components/sidebar-icons';
import {notificationDestination} from './notification-destination';
import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Entity } from "../shared/types";
import { patchUserPreferences, useAppStore } from "./store";
import {
  Button,
  Avatar,
  DatePicker,
  Dropdown,
  EmptyState,
  Icon,
  MenuItem,
  Modal,
  RichEditor,
  TextInput,
  StatusIcon,
} from "./components/ui";
import { IssueActions, IssuePage, issueName } from "./issues";
import { relativeDate, textContent } from "./query";
import type { WorkspaceCommand } from "./keyboard";
import { displayNameFor } from "./display-name";
import {
  InboxFilters,
  InboxFilterChips,
  matchesInboxFilters,
  type InboxFilterSpec,
} from "./inbox-filters";
import {
  parseReminderTime,
  reminderPresets,
  reminderTimeLabel,
} from "./reminder-time";
import {
  defaultPriorityTypes,
  type InboxRow,
  isInboxNotification,
  inboxNotificationSummary,
} from "./inbox-data";
import { groupInboxFocus } from "./inbox-focus";
import { useNotificationClock } from "./use-notification-clock";
import { inboxPresentation } from "./inbox-presentation";
import {
  buildInboxStacks,
  snapshotInboxStack,
  type InboxStackSnapshot,
} from "./inbox-stacks";
import { markInboxStackRead } from "./inbox-actions";
import { effectiveInboxNotification } from "./inbox-expiry";
import { IssueActionFilter } from "./issue-action-filter";
import "./inbox.css";

function NativeInboxDeleteIcon(){
  return <svg className="inbox-native-action-icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path fillRule="evenodd" clipRule="evenodd" d="M7.25 1.00006C7.66421 1.00006 8 1.33585 8 1.75006C7.99997 2.16425 7.66419 2.50006 7.25 2.50006H5.17969C4.79573 2.50009 4.45093 2.71908 4.28418 3.05475L4.22363 3.20612L2.74902 8.00006H4.37305C5.32773 8.00006 6.21946 8.4772 6.74902 9.27155L6.78809 9.32233C6.8848 9.43418 7.02584 9.49999 7.17578 9.50006H8.82422C8.99569 9.49997 9.15584 9.41422 9.25098 9.27155L9.35449 9.12604C9.89229 8.41924 10.732 8.00006 11.627 8.00006H14.5L14.8232 8.00885C14.9404 8.38976 15 8.78611 15 9.18463V11.5001L14.9951 11.6797C14.9015 13.5292 13.3727 15.0001 11.5 15.0001H4.5C2.62729 15.0001 1.09845 13.5292 1.00488 11.6797L1 11.5001V9.18463C1.00002 8.88566 1.03339 8.58784 1.09961 8.29694L1.17676 8.00885L2.79004 2.76471C3.09264 1.78131 3.96362 1.09035 4.97559 1.00787L5.17969 1.00006H7.25ZM2.5 11.5001C2.50003 12.6046 3.39545 13.5001 4.5 13.5001H11.5C12.6045 13.5001 13.5 12.6046 13.5 11.5001V9.50006H11.627C11.2304 9.50006 10.8572 9.67386 10.6016 9.96979L10.499 10.1036C10.1257 10.6635 9.49722 11 8.82422 11.0001H7.17578C6.54495 11 5.95335 10.7043 5.57422 10.2061L5.50098 10.1036C5.24961 9.72653 4.8262 9.50006 4.37305 9.50006H2.5V11.5001Z"/><path fillRule="evenodd" clipRule="evenodd" d="M13.7197 1.21979C14.0126.926894 14.4874.926894 14.7803 1.21979C15.0731 1.51269 15.0731 1.98746 14.7803 2.28033L13.5605 3.50006L14.7803 4.71979C15.0732 5.01268 15.0732 5.48744 14.7803 5.78033C14.4874 6.07317 14.0126 6.07321 13.7197 5.78033L12.5 4.56061L11.2803 5.78033C10.9874 6.07321 10.5126 6.07317 10.2197 5.78033C9.92683 5.48744 9.92683 5.01268 10.2197 4.71979L11.4395 3.50006L10.2197 2.28033C9.92685 1.98746 9.92689 1.51269 10.2197 1.21979C10.5126.926894 10.9874.926894 11.2803 1.21979L12.5 2.43951L13.7197 1.21979Z"/></svg>;
}

function NativeInboxSettingsIcon(){
  return <svg className="inbox-native-action-icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8.58 1a.5.5 0 0 1 .49.42l.25 1.48a.49.49 0 0 0 .33.38c.18.059.353.132.52.22a.49.49 0 0 0 .51 0l1.22-.87a.5.5 0 0 1 .64 0l.82.82a.5.5 0 0 1 .05.64l-.87 1.22a.49.49 0 0 0 0 .51c.088.167.161.34.22.52a.49.49 0 0 0 .38.33l1.48.25a.5.5 0 0 1 .42.49v1.17a.5.5 0 0 1-.42.49l-1.48.25a.49.49 0 0 0-.38.33 3.38 3.38 0 0 1-.22.52.49.49 0 0 0 0 .51l.87 1.22a.5.5 0 0 1-.05.64l-.82.82a.5.5 0 0 1-.64.05l-1.22-.87a.49.49 0 0 0-.51 0 3.38 3.38 0 0 1-.52.22.49.49 0 0 0-.33.38l-.25 1.48a.5.5 0 0 1-.49.42H7.42a.5.5 0 0 1-.49-.42l-.25-1.52a.49.49 0 0 0-.33-.38 3.38 3.38 0 0 1-.52-.22.49.49 0 0 0-.51 0l-1.22.87a.5.5 0 0 1-.64-.05l-.82-.82a.5.5 0 0 1 0-.64l.87-1.22a.49.49 0 0 0 0-.51 3.38 3.38 0 0 1-.22-.52.49.49 0 0 0-.38-.33l-1.49-.21A.5.5 0 0 1 1 8.58V7.42a.5.5 0 0 1 .42-.49l1.48-.25a.49.49 0 0 0 .38-.33 3.38 3.38 0 0 1 .22-.52.49.49 0 0 0 0-.51L2.59 4.1a.5.5 0 0 1 0-.64l.82-.82a.5.5 0 0 1 .64 0l1.22.87a.49.49 0 0 0 .51 0 3.38 3.38 0 0 1 .52-.22.49.49 0 0 0 .33-.38l.3-1.49A.5.5 0 0 1 7.42 1h1.16ZM8 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"/></svg>;
}

function InboxActionItem({children,shortcut,disabled,onClick,settings=false}:{children:React.ReactNode;shortcut?:string;disabled?:boolean;onClick:()=>void;settings?:boolean}){
  return <button className="menu-item" role="menuitem" disabled={disabled} onClick={onClick}>{settings?<NativeInboxSettingsIcon/>:<NativeInboxDeleteIcon/>}<span>{children}</span>{shortcut&&<kbd>{shortcut}</kbd>}</button>;
}

type InboxDeleteMode =
  "selected" | "read" | "all" | "completed-read" | "completed-all";
type InboxDeleteRequest = { items: Entity[]; mode: InboxDeleteMode };

export function InboxPage() {
  const store = useAppStore(),
    navigate = useNavigate(),
    location = useLocation();
  const now = useNotificationClock(store.data.notifications);
  const user =
    store.data.users.find((u) => u.id === store.user?.id) ?? store.user;
  const [preferences, setPreferences] = useState<Record<string, any>>(
    user?.preferences?.inbox ?? {},
  );
  const pendingPreferenceValues = useRef<Record<string, any>>({});
  useEffect(() => {
    const saved = user?.preferences?.inbox ?? {};
    for (const [key, value] of Object.entries(pendingPreferenceValues.current))
      if (JSON.stringify(saved[key]) === JSON.stringify(value))
        delete pendingPreferenceValues.current[key];
    setPreferences({ ...saved, ...pendingPreferenceValues.current });
  }, [user?.preferences?.inbox]);
  const priorityEnabled = preferences.priorityEnabled === true;
  const [tab, setTab] = useState("Priority"),
    [selected, setSelected] = useState<string | null>(null),
    [query, setQuery] = useState(""),
    [search, setSearch] = useState(false),
    [snooze, setSnooze] = useState<Entity | null>(null),
    [snoozeDate, setSnoozeDate] = useState(""),
    [snoozeQuery, setSnoozeQuery] = useState(""),
    [snoozeTime, setSnoozeTime] = useState("09:00"),
    [context, setContext] = useState<{
      item: Entity;
      x: number;
      y: number;
    } | null>(null),
    [deleting, setDeleting] = useState<InboxDeleteRequest | null>(null),
    [prioritySettings, setPrioritySettings] = useState(false),
    [alternateActions, setAlternateActions] = useState(false);
  useEffect(() => {
    const update = (event: KeyboardEvent) => setAlternateActions(event.altKey);
    const reset = () => setAlternateActions(false);
    window.addEventListener("keydown", update);
    window.addEventListener("keyup", update);
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("keydown", update);
      window.removeEventListener("keyup", update);
      window.removeEventListener("blur", reset);
    };
  }, []);
  useEffect(() => {
    if (new URLSearchParams(location.search).get("settings") === "priority")
      setPrioritySettings(true);
  }, [location.search]);
  const listRef = useRef<HTMLDivElement>(null),
    searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setSnoozeQuery("");
    setSnoozeDate("");
    setSnoozeTime("09:00");
  }, [snooze?.id]);
  const customSnooze = parseReminderTime(
    snoozeQuery || (snoozeDate ? `${snoozeDate} ${snoozeTime}` : ""),
  );
  const issueMap = useMemo(
    () => new Map(store.data.issues.map((i) => [i.id, i])),
    [store.data.issues],
  );
  const priorityTypes = preferences.priorityTypes ?? defaultPriorityTypes;
  const patchPreferences = (patch: Record<string, any>) => {
    Object.assign(pendingPreferenceValues.current, patch);
    setPreferences((old) => ({ ...old, ...patch }));
    void patchUserPreferences(user!.id, { inbox: patch }).catch((error) =>
      {
        for (const [key, value] of Object.entries(patch))
          if (
            JSON.stringify(pendingPreferenceValues.current[key]) ===
            JSON.stringify(value)
          )
            delete pendingPreferenceValues.current[key];
        setPreferences({
          ...(user?.preferences?.inbox ?? {}),
          ...pendingPreferenceValues.current,
        });
        store.toast(error.message);
      },
    );
  };
  const all = store.data.notifications
    .filter((n) => isInboxNotification(n, store.user?.id))
    .map((notification) => effectiveInboxNotification(notification, now));
  const filters: InboxFilterSpec = preferences.filters || {};
  const statusTypes = new Map(
    store.data.statuses.map((status) => [status.id, status.type]),
  );
  const readCache = useRef({
    key: "",
    values: new Map<string, boolean>(),
    arrivals: new Map<string, string>(),
  });
  const readKey = JSON.stringify([
    store.data.workspaceId,
    store.user?.id,
    location.key,
    tab,
    query,
    filters,
    preferences.groupBy,
    preferences.ordering,
    preferences.unreadFirst,
    preferences.unreadOnly,
    preferences.showSnoozed,
  ]);
  if (readCache.current.key !== readKey)
    readCache.current = {
      key: readKey,
      values: new Map(),
      arrivals: new Map(),
    };
  for (const notification of all) {
    const signature = `${notification.snoozedUntil || ""}:${notification.deliveredAt || ""}:${notification.unsnoozedAt || ""}`;
    if (
      !readCache.current.values.has(notification.id) ||
      readCache.current.arrivals.get(notification.id) !== signature
    ) {
      readCache.current.values.set(notification.id, !!notification.readAt);
      readCache.current.arrivals.set(notification.id, signature);
    }
  }
  const wasRead = (notification: Entity) =>
    readCache.current.values.get(notification.id) ?? !!notification.readAt;
  const stackContext = {
    comments: store.data.comments,
    updates: store.data.updates,
    requests: store.data.requests,
  };
  const viewedStacks = useMemo(
    () => new Map<string, InboxStackSnapshot>(),
    [readKey],
  );
  const stackOptions = {
    ...stackContext,
    now,
    selectedSnapshots: viewedStacks,
  };
  const allStacks = buildInboxStacks(all, stackOptions);
  const stackById = new Map(allStacks.map((stack) => [stack.id, stack]));
  const stackIds = new Map(
    allStacks.flatMap((stack) =>
      stack.allNotifications.map((item) => [item.id, stack.id] as const),
    ),
  );
  const groupId = (item: Entity) =>
    stackIds.get(item.id) || `unknown#${item.id}`;
  const { priorityIds, unreadTotal, unreadPriority } = inboxNotificationSummary(
    store.data.notifications,
    store.data.issues,
    store.user?.id,
    preferences,
    now,
    stackContext,
  );
  const arrival = (notification: Entity) => {
    const wake = Date.parse(notification.snoozedUntil || "");
    return Math.max(
      Date.parse(
        notification.movedToInboxAt ||
          notification.deliveredAt ||
          notification.unsnoozedAt ||
          notification.createdAt,
      ) || 0,
      wake <= now ? wake : 0,
    );
  };
  const compareNotifications = (a: Entity, b: Entity) => {
    if (preferences.unreadFirst && wasRead(a) !== wasRead(b))
      return wasRead(a) ? 1 : -1;
    if (preferences.ordering === "priority") {
      const difference =
        (issueMap.get(a.issueId)?.priority || 5) -
        (issueMap.get(b.issueId)?.priority || 5);
      if (difference) return difference;
    }
    const direction = preferences.ordering === "oldest" ? 1 : -1;
    return (
      direction *
        (arrival(a) - arrival(b) || a.createdAt.localeCompare(b.createdAt)) ||
      a.id.localeCompare(b.id)
    );
  };
  const filteredNotifications = all
    .filter((n) => {
      const linkedIssue = issueMap.get(n.issueId);
      if (preferences.unreadOnly && wasRead(n)) return false;
      if (
        !matchesInboxFilters(
          n,
          linkedIssue,
          statusTypes.get(linkedIssue?.statusId),
          filters,
        )
      )
        return false;
      const future = n.snoozedUntil && Date.parse(n.snoozedUntil) > now;
      if (future && !preferences.showSnoozed) return false;
      if (
        priorityEnabled &&
        !query.trim() &&
        ((tab === "Priority" && !priorityIds.has(groupId(n))) ||
          (tab === "Other" && priorityIds.has(groupId(n))))
      )
        return false;
      if (query) {
        const issue = issueMap.get(n.issueId),
          assignee = store.data.users.find((u) => u.id === issue?.assigneeId),
          team = store.data.teams.find((t) => t.id === issue?.teamId),
          project = store.data.projects.find(
            (p) => p.id === (issue?.projectId ?? n.projectId),
          );
        return [
          n.title,
          n.type,
          n.message,
          n.body,
          issue?.identifier,
          issue?.title,
          displayNameFor(assignee, store.data, ""),
          assignee?.name,
          assignee?.email,
          team?.name,
          project?.name,
          ["No priority", "Urgent", "High", "Medium", "Low"][
            issue?.priority ?? 0
          ],
        ]
          .join(" ")
          .toLowerCase()
          .includes(query.trim().toLowerCase());
      }
      return true;
    })
    .sort(compareNotifications);
  const visibleStacks = buildInboxStacks(filteredNotifications, stackOptions);
  const visibleById = new Map(visibleStacks.map((stack) => [stack.id, stack]));
  const notifications = visibleStacks.map((stack) => stack.mainNotification);
  useLayoutEffect(() => {
    for (const stack of visibleStacks)
      viewedStacks.set(stack.id, snapshotInboxStack(stack));
  });
  const grouped =
    preferences.groupBy === "focus"
      ? groupInboxFocus(notifications, {
          issues: store.data.issues,
          statuses: store.data.statuses,
          comments: store.data.comments,
          showReadItems: !preferences.unreadOnly,
          readStateOnFirstSeen: readCache.current.values,
          otherNotifications: (main) =>
            visibleById.get(groupId(main))?.otherNotifications || [],
        })
      : notifications.map((item) => ({ type: "notification" as const, item }));
  const rows: InboxRow[] = [];
  let pendingRows: Extract<InboxRow, { type: "notification" }>[] = [];
  const appendRows = () => {
    rows.push(
      ...pendingRows.sort((a, b) => compareNotifications(a.item, b.item)),
    );
    pendingRows = [];
  };
  for (const row of grouped) {
    if (row.type === "group") {
      appendRows();
      rows.push(row);
    } else pendingRows.push(row);
  }
  appendRows();
  const currentStack = selected
    ? visibleById.get(selected) || stackById.get(selected)
    : undefined;
  const current = currentStack?.mainNotification;
  const currentDestination=current?notificationDestination(current):null;
  const currentPresentation=current?inboxPresentation(current,store.data):null;
  const bulkDeleteItems = (mode: Exclude<InboxDeleteMode, "selected">) =>
    all.filter((item) => {
      const future = item.snoozedUntil && Date.parse(item.snoozedUntil) > now;
      if (future && (!preferences.showSnoozed || mode.startsWith("completed")))
        return false;
      if ((mode === "read" || mode === "completed-read") && !item.readAt)
        return false;
      if (mode.startsWith("completed")) {
        const issue = issueMap.get(item.issueId);
        return (
          item.type === "issueStatusChangedDone" ||
          ["completed", "canceled", "duplicate"].includes(
            statusTypes.get(issue?.statusId) || "",
          )
        );
      }
      return true;
    });
  const requestDelete = (items: Entity[], mode: InboxDeleteMode = "selected") =>
    setDeleting({ items, mode });
  const requestBulkDelete = (mode: Exclude<InboxDeleteMode, "selected">) =>
    requestDelete(bulkDeleteItems(mode), mode);
  const expandStacks = (items: Entity[]) => [
    ...new Map(
      items
        .flatMap(
          (item) => stackById.get(groupId(item))?.allNotifications || [item],
        )
        .map((item) => [item.id, item]),
    ).values(),
  ];
  const markStackRead = (item: Entity, read: boolean, automatic = false) =>
    markInboxStackRead(groupId(item), read, automatic, {
      workspaceId: store.data.workspaceId,
      userId: store.user!.id,
    });
  const readSelected = useRef(() => {});
  readSelected.current = () => {
    if (current) void markStackRead(current, true, true);
  };
  useEffect(() => {
    if (!current || current.readAt) return;
    const timer = setTimeout(() => readSelected.current(), 300);
    return () => clearTimeout(timer);
  }, [selected, current?.id, current?.readAt]);
  const virtual = useVirtualizer({
    count: rows.length,
    getScrollElement: () => listRef.current,
    estimateSize: (index) =>
      rows[index]?.type === "group"
        ? 32
        : rows[index].item.snoozedUntil &&
            Date.parse(rows[index].item.snoozedUntil) > now
          ? 79
          : 55,
    getItemKey: (index) =>
      rows[index].type === "group"
        ? `group:${rows[index].id}`
        : groupId(rows[index].item),
    overscan: 8,
  });
  const select = (n: Entity) => {
    setSelected(groupId(n));
    if (n.issueId && !issueMap.has(n.issueId))
      void store.loadEntity("issues", n.issueId).catch(() => {});
    if (window.matchMedia("(max-width: 720px)").matches) {
      const options = {
        state: {
          inboxStackRead: {
            stackId: groupId(n),
            workspaceId: store.data.workspaceId,
            userId: store.user?.id,
          },
        },
      };
      const destination=notificationDestination(n);
      if(destination.kind!=='inbox')navigate(destination.route,options);
    }
  };
  const advanceSelection = (removed: Set<string>) => {
    if (!selected || !removed.has(selected)) return;
    const items = rows.flatMap((row) =>
      row.type === "notification" ? [row.item] : [],
    );
    const index = items.findIndex((item) => groupId(item) === selected);
    const next =
      items.slice(index + 1).find((item) => !removed.has(groupId(item))) ||
      items
        .slice(0, index)
        .reverse()
        .find((item) => !removed.has(groupId(item)));
    setSelected(next ? groupId(next) : null);
    if (next) {
      const rowIndex = rows.findIndex(
        (row) =>
          row.type === "notification" && groupId(row.item) === groupId(next),
      );
      virtual.scrollToIndex(rowIndex);
      requestAnimationFrame(() =>
        listRef.current
          ?.querySelector<HTMLButtonElement>(
            `[data-notification-stack-id="${CSS.escape(groupId(next))}"]`,
          )
          ?.focus(),
      );
    }
  };
  const applySnooze = async (item: Entity, date: string | null) => {
    const members = date ? expandStacks([item]) : [item];
    try {
      for (let index = 0; index < members.length; index += 1000)
        await store.batch(
          members
            .slice(index, index + 1000)
            .map((member) => ({
              kind: "notifications",
              id: member.id,
              data: { snoozedUntil: date, readAt: null },
            })),
        );
      if (date && !preferences.showSnoozed)
        advanceSelection(new Set([groupId(item)]));
    } catch (error) {
      store.toast((error as Error).message);
    }
    setSnooze(null);
  };
  useEffect(() => {
    const handle = (event: Event) => {
      const e = event as CustomEvent<WorkspaceCommand>;
      if (e.defaultPrevented) return;
      const command = e.detail.command;
      if (
        command === "find-in-page" &&
        document.querySelector('[role="dialog"],dialog[open]')
      )
        return;
      if (command === "find-in-page") {
        setSearch(true);
        requestAnimationFrame(() => searchRef.current?.focus());
        e.preventDefault();
      } else if (command === "focus-item") {
        const items = rows.flatMap((row) =>
          row.type === "notification" ? [row.item] : [],
        );
        const index = items.findIndex((n) => groupId(n) === selected),
          next = Math.max(
            0,
            Math.min(
              items.length - 1,
              index + (e.detail.value === "up" ? -1 : 1),
            ),
          );
        if (items[next]) {
          select(items[next]);
          virtual.scrollToIndex(
            rows.findIndex(
              (row) =>
                row.type === "notification" && row.item.id === items[next].id,
            ),
          );
          e.preventDefault();
        }
      } else if (command === "snooze-notification" && current) {
        setSnooze(current);
        e.preventDefault();
      } else if (command === "delete-notification" && current) {
        requestDelete([current]);
        e.preventDefault();
      } else if (command === "toggle-read" && current) {
        void markStackRead(current, !current.readAt);
        e.preventDefault();
      } else if (command === "mark-all-read") {
        void markAllRead();
        e.preventDefault();
      } else if (command === "delete-read-notifications") {
        requestBulkDelete("read");
        e.preventDefault();
      }
    };
    window.addEventListener("workspace-command", handle, true);
    return () => window.removeEventListener("workspace-command", handle, true);
  }, [notifications, selected, current]);
  const markAllRead = async () => {
    const unread = visibleStacks
        .flatMap((stack) => [
          stack.mainNotification,
          ...stack.otherNotifications,
        ])
        .filter((n) => !n.readAt),
      readAt = new Date().toISOString();
    try {
      for (let index = 0; index < unread.length; index += 1000)
        await store.batch(
          unread
            .slice(index, index + 1000)
            .map((n) => ({
              kind: "notifications",
              id: n.id,
              data: { readAt },
            })),
        );
    } catch (error) {
      store.toast((error as Error).message);
    }
  };
  const deleteItems = async ({ items, mode }: InboxDeleteRequest) => {
    const members =
      mode === "selected" ? expandStacks(items) : bulkDeleteItems(mode);
    const ids = new Set(members.map((item) => item.id));
    try {
      for (let index = 0; index < members.length; index += 1000)
        await store.batch(
          members
            .slice(index, index + 1000)
            .map((n) => ({
              kind: "notifications",
              action: "delete",
              id: n.id,
            })),
        );
      advanceSelection(
        new Set(
          allStacks
            .filter((stack) =>
              stack.allNotifications.every((item) => ids.has(item.id)),
            )
            .map((stack) => stack.id),
        ),
      );
      setDeleting(null);
    } catch (error) {
      store.toast((error as Error).message);
    }
  };
  return (
    <div className="inbox-page">
      <header className="page-header">
        <h1>Inbox</h1>
        <Dropdown
          align="left"
          sideOffset={4.5}
          menuClassName="inbox-actions-menu"
          trigger={
            <button className="icon-button" aria-label="Notification actions">
              <Icon name="MoreHorizontal" />
            </button>
          }
        >
          <IssueActionFilter compact status searchLabel="Filter…">
            <InboxActionItem disabled={!bulkDeleteItems("all").length} onClick={()=>requestBulkDelete("all")}>Delete all</InboxActionItem>
            <InboxActionItem shortcut="⇧⌫" disabled={!bulkDeleteItems("read").length} onClick={()=>requestBulkDelete("read")}>Delete all read</InboxActionItem>
            {alternateActions&&<>
            <MenuItem icon="CheckCheck" disabled={!visibleStacks.some(stack=>!stack.mainNotification.readAt)} onClick={()=>void markAllRead()}>Mark all as read</MenuItem>
            <MenuItem icon="Trash2" disabled={!bulkDeleteItems("completed-read").length} onClick={()=>requestBulkDelete("completed-read")}>Delete read notifications for completed issues</MenuItem>
            <MenuItem icon="Trash2" disabled={!bulkDeleteItems("completed-all").length} onClick={()=>requestBulkDelete("completed-all")}>Delete notifications for completed issues</MenuItem>
            </>}
            <div className="menu-separator"/>
            <InboxActionItem settings onClick={()=>navigate("/settings/notifications")}>Go to settings</InboxActionItem>
          </IssueActionFilter>
        </Dropdown>
        <span className="spacer" />
        <button
          className={`icon-button ${preferences.unreadOnly ? "active" : ""}`}
          aria-label="Show unreads only"
          aria-pressed={!!preferences.unreadOnly}
          title="Show unreads only"
          onClick={() =>
            patchPreferences({ unreadOnly: !preferences.unreadOnly })
          }
        >
          <Icon name="MailOpen" size={15} />
        </button>
        <InboxFilters
          data={store.data}
          notifications={all}
          value={filters}
          onChange={(filters) => patchPreferences({ filters })}
        />
        <Dropdown
          align="right"
          sideOffset={4.5}
          menuClassName="inbox-display-menu"
          trigger={
            <button className="icon-button" aria-label="Display options">
              <NativeControlIcon name="Display options" />
            </button>
          }
        >
          <div className="inbox-display" data-keep-open>
            <label><span>Enable priority inbox</span><input type="checkbox" role="switch" checked={priorityEnabled} onChange={e=>patchPreferences({priorityEnabled:e.target.checked})}/></label><div className="menu-separator"/>
            <label>
              <span>Group unreads by</span>
              <select
                aria-label="Group unreads by"
                value={preferences.groupBy === "focus" ? "focus" : "none"}
                onChange={(event) =>
                  patchPreferences({ groupBy: event.target.value })
                }
              >
                <option value="none">No grouping</option>
                <option value="focus">Focus</option>
              </select>
            </label>
            <label>
              <span>Ordering</span>
              <select
                aria-label="Notification ordering"
                value={preferences.ordering || "newest"}
                onChange={(event) =>
                  patchPreferences({ ordering: event.target.value })
                }
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="priority">Priority</option>
              </select>
            </label>
            <div className="menu-separator"/>
            {[
              ["showSnoozed", "Show snoozed", !!preferences.showSnoozed],
              ["unreadFirst", "Show unread first", !!preferences.unreadFirst],
            ].map(([key, label, checked]) => (
              <label key={String(key)}>
                <span>{String(label)}</span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={Boolean(checked)}
                  onChange={(e) =>
                    patchPreferences({ [String(key)]: e.target.checked })
                  }
                />
              </label>
            ))}
          </div>
        </Dropdown>
      </header>
      {priorityEnabled && (
        <div className="view-toolbar page-tabs">
          {["Priority", "Other"].map((name) => (
            <button
              key={name}
              aria-label={name}
              aria-description={`${name === "Priority" ? unreadPriority : Math.max(0, unreadTotal - unreadPriority)} unread`}
              className={name === tab ? "active" : ""}
              onClick={() => {
                setTab(name);
                setSelected(null);
              }}
              onContextMenu={(e) => {
                if (name === "Priority") {
                  e.preventDefault();
                  setPrioritySettings(true);
                }
              }}
            >
              {name}
              <span className="inbox-tab-count">
                {name === "Priority"
                  ? unreadPriority
                  : Math.max(0, unreadTotal - unreadPriority)}
              </span>
            </button>
          ))}
        </div>
      )}
      {search && (
        <div className="inbox-search">
          <Icon name="Search" size={14} />
          <input
            ref={searchRef}
            aria-label="Search notifications"
            placeholder="Search title, ID, person, project, team…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                setSearch(false);
                setQuery("");
              }
            }}
          />
          <button
            className="icon-button"
            aria-label="Clear notification search"
            onClick={() => {
              setQuery("");
              setSearch(false);
            }}
          >
            <Icon name="X" size={14} />
          </button>
        </div>
      )}
      {Object.values(filters).some((values) => values.length) && (
        <InboxFilterChips
          data={store.data}
          notifications={all}
          value={filters}
          onChange={(filters) => patchPreferences({ filters })}
        />
      )}
      <div className="inbox-layout">
        <div
          className="inbox-list"
          ref={listRef}
          aria-rowcount={notifications.length}
        >
          {notifications.length ? (
            <div
              style={{ height: virtual.getTotalSize(), position: "relative" }}
            >
              {virtual.getVirtualItems().map((row) => {
                const item = rows[row.index];
                if (item.type === "group")
                  return (
                    <div
                      key={`group:${item.id}`}
                      className="inbox-group-heading"
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: 32,
                        transform: `translateY(${row.start}px)`,
                      }}
                    >
                      <span>{item.title}</span>
                      <span>{item.count}</span>
                    </div>
                  );
                const n = item.item,
                  issue = notificationDestination(n).kind==='issue'?issueMap.get(n.issueId):undefined,
                  presentation = inboxPresentation(
                    n,
                    store.data,
                    issue || null,
                  ),
                  snoozed = n.snoozedUntil && Date.parse(n.snoozedUntil) > now;
                return (
                  <button
                    key={groupId(n)}
                    data-notification-stack-id={groupId(n)}
                    data-notification-id={n.id}
                    className={`inbox-item ${selected === groupId(n) ? "active" : ""} ${!n.readAt ? "unread" : ""}`}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: row.size,
                      transform: `translateY(${row.start}px)`,
                    }}
                    onClick={(event) => {
                      if (event.altKey) void markStackRead(n, !n.readAt);
                      else select(n);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContext({ item: n, x: e.clientX, y: e.clientY });
                    }}
                  >
                    <div className="inbox-avatar-wrap">
                      {presentation.actor ? (
                        <Avatar user={presentation.actor} size={32} />
                      ) : (
                        <div className="inbox-system-avatar">
                          <Icon name={presentation.entityIcon} size={18} />
                        </div>
                      )}
                      <span className="inbox-reason-icon">
                        <Icon name={presentation.icon} size={12} />
                      </span>
                    </div>
                    <div className="inbox-row-text">
                      <strong>
                        <i className="notification-dot" />
                        {preferences.showIssueId !== false && issue && (
                          <span className="inbox-identifier">
                            {issueName(issue)}{" "}
                          </span>
                        )}
                        {presentation.title}
                      </strong>
                      <p>
                        {preferences.showProject && presentation.project
                          ? `${presentation.project.name} · `
                          : ""}
                        {presentation.summary}
                      </p>
                      {snoozed && (
                        <div className="inbox-snoozed-until">
                          <Icon name="Clock" size={12} />
                          Snoozed until{" "}
                          {new Date(n.snoozedUntil).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </div>
                      )}
                    </div>
                    <div className="inbox-row-meta">
                      {issue ? (
                        <StatusIcon status={presentation.status} />
                      ) : (
                        <Icon name={presentation.entityIcon} size={15} />
                      )}
                      <time>
                        {relativeDate(new Date(arrival(n)).toISOString())}
                      </time>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon="Inbox"
              title={
                query || Object.values(filters).some((values) => values.length)
                  ? "No matching notifications"
                  : "You're all caught up"
              }
              description={
                query || Object.values(filters).some((values) => values.length)
                  ? "Try a title, team, project, or person."
                  : "New updates will appear here."
              }
            />
          )}
        </div>
        <div className="inbox-detail">
          {current ? (
            <>
              <div className="inbox-detail-toolbar">
                <Button
                  aria-label={current.readAt ? "Mark unread" : "Mark read"}
                  onClick={() => void markStackRead(current, !current.readAt)}
                >
                  <Icon name="Circle" size={14} />
                </Button>
                <Button
                  aria-label="Snooze notification"
                  onClick={() => setSnooze(current)}
                >
                  <Icon name="Clock" size={14} />
                </Button>
                <Button
                  aria-label="Delete notification"
                  onClick={() => requestDelete([current])}
                >
                  <Icon name="Trash2" size={14} />
                </Button>
                <span className="spacer" />
                {currentDestination?.kind==='issue'&&issueMap.has(current.issueId) && (
                  <IssueActions issue={issueMap.get(current.issueId)!} />
                )}{" "}
                {currentDestination?.kind==='issue'&&current.issueId && (
                  <Button
                    aria-label="Open issue"
                    onClick={() => navigate(`/issues/${current.issueId}`)}
                  >
                    <Icon name="ArrowUpRight" size={14} />
                  </Button>
                )}
              </div>
              {currentDestination?.kind==='issue'&&current.issueId ? (
                <IssuePage
                  key={current.issueId}
                  issueId={current.issueId}
                  embedded
                />
              ) : (
                <div className="inbox-detail-content">
                  <h2>{currentPresentation?.title ?? "Update"}</h2>
                  {current.body||current.message?<RichEditor readOnly value={current.body||current.message} onChange={()=>{}}/>:<p className="muted">{currentPresentation?.summary}</p>}
                  {currentDestination&&currentDestination.kind!=='inbox'&&<Button onClick={()=>navigate(currentDestination.route)}>Open {currentDestination.kind}<Icon name="ArrowUpRight" size={14}/></Button>}
                </div>
              )}
            </>
          ) : (
            <div className="inbox-empty-detail">
              <svg
                viewBox="0 0 78 80"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M10.4 9.11A10 10 0 0 1 20.22 1h37.56a10 10 0 0 1 9.82 8.11l8.11 42.2a10 10 0 0 1-9.82 11.9H54.7a6.36 6.36 0 0 0-5.65 3.45 6.36 6.36 0 0 1-5.66 3.45H34.6a6.36 6.36 0 0 1-5.66-3.45 6.36 6.36 0 0 0-5.65-3.46H12.1a10 10 0 0 1-9.8-11.89l8.11-42.2Z"
                  stroke="var(--muted)"
                  strokeWidth="1.5"
                />
                <path
                  d="M14.3 9.03a5 5 0 0 1 4.91-4.08H58.8a5 5 0 0 1 4.91 4.08l8.07 43.22a6 6 0 0 1-5.9 7.1H52.76a5.72 5.72 0 0 0-5.24 3.41 5.72 5.72 0 0 1-5.23 3.42h-6.58a5.72 5.72 0 0 1-5.23-3.42 5.72 5.72 0 0 0-5.24-3.4h-13.1a6 6 0 0 1-5.9-7.1L14.3 9.02Z"
                  stroke="var(--text-primary)"
                  strokeWidth="1.5"
                />
                <path
                  d="m2.36 55.6 3.2 14.06A12 12 0 0 0 17.26 79h43.48a12 12 0 0 0 11.7-9.34l3.2-14.06"
                  stroke="var(--muted)"
                  strokeWidth="1.5"
                />
              </svg>
              <p>No notification selected</p>
            </div>
          )}
        </div>
      </div>
      {context && (
        <Dropdown
          key={`${context.item.id}:${context.x}:${context.y}`}
          position={{ x: context.x, y: context.y }}
          onOpenChange={(open) => {
            if (open) return;
            const row = document.querySelector<HTMLElement>(
              `[data-notification-stack-id="${CSS.escape(groupId(context.item))}"]`,
            );
            setContext(null);
            requestAnimationFrame(() => row?.focus({ preventScroll: true }));
          }}
          trigger={<span />}
        >
          <IssueActionFilter compact status searchLabel="Filter…">
            <MenuItem
              icon="Circle"
              shortcut="U"
              onClick={() => {
                void markStackRead(context.item, !context.item.readAt);
                setContext(null);
              }}
            >
              {context.item.readAt ? "Mark unread" : "Mark read"}
            </MenuItem>
            <MenuItem
              icon="Trash2"
              shortcut="⌫"
              danger
              onClick={() => {
                requestDelete([context.item]);
                setContext(null);
              }}
            >
              Delete notification
            </MenuItem>
            <MenuItem
              icon="Clock"
              shortcut="H"
              onClick={() => {
                setSnooze(context.item);
                setContext(null);
              }}
            >
              Snooze
            </MenuItem>
            {context.item.snoozedUntil && (
              <MenuItem
                icon="Clock"
                onClick={() => {
                  applySnooze(context.item, null);
                  setContext(null);
                }}
              >
                Unsnooze
              </MenuItem>
            )}
          </IssueActionFilter>
        </Dropdown>
      )}
      {snooze && (
        <Modal title="Snooze notification" onClose={() => setSnooze(null)}>
          <div className="modal-body snooze-options">
            <input
              className="input"
              autoFocus
              aria-label="Snooze date and time"
              placeholder="Jan 3 10am, next quarter, or for 2 weeks…"
              value={snoozeQuery}
              onChange={(event) => setSnoozeQuery(event.target.value)}
              onKeyDown={(event) => {
                const parsed =
                  parseReminderTime(event.currentTarget.value) ||
                  (!event.currentTarget.value.trim() ? customSnooze : null);
                if (event.key === "Enter" && parsed) {
                  event.preventDefault();
                  applySnooze(snooze, parsed.toISOString());
                }
              }}
            />
            {!snoozeQuery &&
              reminderPresets().map(({ label, date }) => (
                <button
                  className="menu-item"
                  key={label}
                  onClick={() => applySnooze(snooze, date.toISOString())}
                >
                  <Icon name="Clock" size={14} />
                  <span>{label}</span>
                  <small>{date.toLocaleDateString()}</small>
                </button>
              ))}
            <DatePicker
              label="Custom snooze date"
              value={snoozeDate}
              onChange={(value) => {
                setSnoozeDate(value);
                setSnoozeQuery("");
              }}
            />
            <label className="field">
              <span>Time</span>
              <input
                className="input"
                type="time"
                aria-label="Snooze time"
                value={snoozeTime}
                onChange={(event) => {
                  setSnoozeTime(event.target.value);
                  setSnoozeQuery("");
                }}
              />
            </label>
            {(snoozeQuery || snoozeDate) && (
              <p className="muted">
                {customSnooze
                  ? reminderTimeLabel(customSnooze)
                  : "Enter a complete future date and time."}
              </p>
            )}
            {snooze.snoozedUntil && (
              <Button onClick={() => applySnooze(snooze, null)}>
                Unsnooze
              </Button>
            )}
          </div>
          <div className="modal-footer">
            <Button onClick={() => setSnooze(null)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!customSnooze}
              onClick={() =>
                customSnooze && applySnooze(snooze, customSnooze.toISOString())
              }
            >
              Snooze
            </Button>
          </div>
        </Modal>
      )}
      {deleting && (
        <Modal title="Delete notifications?" onClose={() => setDeleting(null)}>
          <div className="modal-body">
            Delete {deleting.items.length}{" "}
            {deleting.items.length === 1 ? "notification" : "notifications"}{" "}
            from your inbox?
          </div>
          <div className="modal-footer">
            <Button onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => void deleteItems(deleting)}>
              Delete notifications
            </Button>
          </div>
        </Modal>
      )}
      {prioritySettings && (
        <Modal
          title="Priority inbox filter"
          onClose={() => setPrioritySettings(false)}
        >
          <div className="modal-body inbox-priority-settings">
            <p className="muted">
              Choose which notifications appear in Priority.
            </p>
            <label>
              <span>Urgent issues</span>
              <input
                type="checkbox"
                checked={preferences.includeUrgent !== false}
                onChange={(event) =>
                  patchPreferences({ includeUrgent: event.target.checked })
                }
              />
            </label>
            {[
              ["assigned", "Assignments"],
              ["mention", "Mentions"],
              ["reminder", "Reminders"],
              ["request", "Customer requests"],
              ["comment", "Comments"],
              ["update", "Project and initiative updates"],
            ].map(([key, label]) => (
              <label key={key}>
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={priorityTypes.includes(key)}
                  onChange={(e) =>
                    patchPreferences({
                      priorityTypes: e.target.checked
                        ? [...priorityTypes, key]
                        : priorityTypes.filter(
                            (value: string) => value !== key,
                          ),
                    })
                  }
                />
              </label>
            ))}
          </div>
          <div className="modal-footer">
            <Button
              variant="primary"
              onClick={() => setPrioritySettings(false)}
            >
              Done
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
