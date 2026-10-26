import { IssueLinkDialog } from "./issue-link-dialog";
import { IssueDeleteConfirmation } from "./issue-delete-confirmation";
import { IssueCustomDue } from "./issue-custom-due";
import { IssueDueMenu } from "./issue-due-menu";
import { IssueMarkAs, type MarkIssueType } from "./issue-mark-as";
import { guestCapabilities } from "../shared/guest-capabilities";
import { InviteAndAssign } from "./features/invite-and-assign";
import {
  commonIssueValues,
  issueBulkPropertyChanges,
  commonIssueStatusOptions,
  resolveIssueBulkStatuses,
} from "./issue-bulk-properties";
import {
  commonSubscribers,
  subscriberValues,
  subscriberSelectionChanges,
} from "./subscriber-selection";
import {
  commonProjectValues,
  projectBulkChanges,
  projectArrayValues,
} from "./features/project-bulk-data";
import { TargetDateControl } from "./features/date-picker";
import { projectRequestsMarkdown } from "./features/project-request-markdown";
import React, { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import type { Entity, EntityKind } from "../shared/types";
import { apiRequest, useAppStore } from "./store";
import { Button, DatePicker, Icon, Modal, TextInput } from "./components/ui";
import { openComposer, issueName, priorities } from "./issues";
import {
  resolveShortcut,
  type ShortcutContext,
  type ShortcutSequence,
  type WorkspaceCommand,
} from "./keyboard";
import { projectStatusOptions } from "./features/project-statuses";
import {
  sharedEstimateOptions,
  isIssueSubscribed,
  toggleIssueSubscription,
} from "./issue-sharing";
import { richTextToMarkdown } from "./markdown";
import { prepareIssueSelection } from "./sub-issue-selection";
import { issueTemplates, initialIssueFields } from "./template-utils";
import { IssueQuickOpen, DocumentQuickOpen } from "./quick-open";
import { displayNameFor } from "./display-name";
import {
  ReminderDialog,
  pendingReminder,
  type ReminderTarget,
  type ReminderKind,
} from "./reminders";
import { nativeCommandRouting } from "./native-command-routing";
import { installMouseHistoryNavigation } from "./history-navigation";

type Target = { kind: EntityKind; items: Entity[] };
type DialogState = {
  type:
    | "property"
    | "picker"
    | "relation"
    | "delete"
    | "rename"
    | "subscribers"
    | "link";
  title: string;
  target?: Target;
  field?: string;
  value?: string;
  options?: { id: string | number | null; name: string; route?: string }[];
  multiple?: boolean;
};
const shellCommands = new Set([
  "help",
  "contact-support",
  "send-feedback",
  "open-parabolic-documentation",
  "open-api-documentation",
  "open-parabolic-status",
  "report-performance-problem",
  "disable-hardware-acceleration",
  "new-contextual",
  "new-initiative",
  "navigation-tabs",
  "new-issue",
  "new-issue-expanded",
  "new-tab",
  "close-tab",
  "close-other-tabs",
  "close-tabs-right",
  "reopen-tab",
  "next-tab",
  "previous-tab",
  "select-tab",
  "pin-tab",
  "new-project",
  "new-document",
  "command-menu",
  "search",
  "settings",
  "navigate",
  "open-toast-link",
  "open-recently-viewed",
  "create-workspace",
  "leave-team",
  "toggle-sidebar",
  "keyboard-shortcuts",
  "back",
  "forward",
  "open-drafts",
]);
const listCommands = new Set([
  "save-view",
  "focus-item",
  "extend-selection",
  "open-focused-item",
  "peek-item",
  "toggle-selection",
  "clear-selection",
  "select-all",
  "select-group",
  "toggle-layout",
  "add-filter",
  "clear-filters",
  "clear-last-filter",
  "toggle-group",
  "toggle-all-groups",
  "reorder-item",
]);
const fieldNames: Record<string, string> = {
  statusId: "Status",
  status: "Status",
  assigneeId: "Assignee",
  ownerId: "Owner",
  leadId: "Lead",
  priority: "Priority",
  estimate: "Estimate",
  dueDate: "Due date",
  targetDate: "Target date",
  startDate: "Start date",
  projectId: "Project",
  cycleId: "Cycle",
  milestoneId: "Milestone",
  parentId: "Parent issue",
  labelIds: "Labels",
  teamId: "Team",
  teamIds: "Teams",
  memberIds: "Members",
  initiativeIds: "Initiatives",
};
const alive = (items: Entity[]) =>
  items.filter((item) => !item.deletedAt && !item.archivedAt);
export function dispatchWorkspaceCommand(action: WorkspaceCommand) {
  return !window.dispatchEvent(
    new CustomEvent("workspace-command", { detail: action, cancelable: true }),
  );
}
function clickLabel(label: string) {
  const button = [
    ...document.querySelectorAll<HTMLButtonElement>("button[aria-label]"),
  ].find((item) => item.getAttribute("aria-label") === label && !item.disabled);
  if (!button) return false;
  button.click();
  return true;
}
function currentTarget(
  pathname: string,
  data: ReturnType<typeof useAppStore>["data"],
): Target | null {
  const view = document.querySelector<HTMLElement>(
    ".issue-view[data-selected-ids]",
  );
  if (view) {
    const selected = view.dataset.selectedIds?.split(",").filter(Boolean) ?? [];
    const ids = selected.length
      ? selected
      : view.dataset.focusedId
        ? [view.dataset.focusedId]
        : [
            ...view.querySelectorAll<HTMLElement>(
              ".issue-row.selected,.issue-row.focused,.board-card.selected,.board-card.focused",
            ),
          ]
            .map(
              (row) =>
                row.dataset.issueId ??
                data.issues.find(
                  (issue) =>
                    issue.identifier ===
                    row.querySelector(".issue-identifier")?.textContent?.trim(),
                )?.id,
            )
            .filter((id): id is string => !!id);
    const items = data.issues.filter((item) => ids.includes(item.id));
    return items.length ? { kind: "issues", items } : null;
  }
  const projects = document.querySelector<HTMLElement>(
    ".project-collection[data-selected-project-ids]",
  );
  if (projects) {
    const selected =
        projects.dataset.selectedProjectIds?.split(",").filter(Boolean) || [],
      ids = selected.length
        ? selected
        : projects.dataset.focusedProjectId
          ? [projects.dataset.focusedProjectId]
          : [],
      byId = new Map(
        data.projects
          .filter((item) => !item.deletedAt && !item.archivedAt)
          .map((item) => [item.id, item]),
      );
    const items = ids
      .map((id) => byId.get(id))
      .filter((item): item is Entity => !!item);
    return items.length ? { kind: "projects", items } : null;
  }
  const parts = pathname.split("/");
  const kind = (
    {
      issues: "issues",
      project: "projects",
      initiative: "initiatives",
      document: "documents",
    } as Record<string, EntityKind>
  )[parts[1]];
  if (kind) {
    const item = data[kind].find((item) => item.id === parts[2]);
    return item ? { kind, items: [item] } : null;
  }
  if (pathname.startsWith("/inbox")) {
    const id = document.querySelector<HTMLElement>(
      ".inbox-detail .issue-detail-view[data-issue-id]",
    )?.dataset.issueId;
    const issue = data.issues.find((issue) => issue.id === id);
    if (issue) return { kind: "issues", items: [issue] };
  }
  return null;
}
function contextFor(
  pathname: string,
  data: ReturnType<typeof useAppStore>["data"],
  event: KeyboardEvent,
): ShortcutContext {
  const target = event.target instanceof Element ? event.target : null;
  const editor = target instanceof HTMLElement && target.isContentEditable;
  const typing = editor
    ? "editor"
    : target?.closest(
          'input:not([type=checkbox]):not([type=radio]),textarea,select,[role="textbox"],[role="combobox"]',
        )
      ? "input"
      : false;
  const scope = document.querySelector(".issue-view[data-selected-ids]")
    ? "list"
    : pathname.startsWith("/issues/")
      ? "issue"
      : pathname.startsWith("/project/")
        ? "project"
        : pathname.startsWith("/initiative/")
          ? "initiative"
          : pathname.startsWith("/inbox")
            ? "inbox"
            : document.querySelector(".feature-timeline")
              ? "timeline"
              : document.querySelector(".project-collection")
                ? "list"
                : "global";
  const entity =
    scope === "list" && document.querySelector(".issue-view[data-selected-ids]")
      ? "issues"
      : currentTarget(pathname, data)?.kind;
  const teamId = pathname.startsWith("/team/")
    ? pathname.split("/")[2]
    : (currentTarget(pathname, data)?.items[0]?.teamId ?? data.teams[0]?.id);
  const cycles = alive(data.cycles)
    .filter((cycle) => cycle.teamId === teamId)
    .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)));
  const cycleTeam = data.teams.find((team) => team.id === teamId);
  const now = Date.now();
  const selected = currentTarget(pathname, data),
    issue =
      selected?.kind === "issues" && selected.items.length === 1
        ? selected.items[0]
        : undefined,
    triageIssueId =
      issue &&
      (issue.sharedStatuses ?? data.statuses).find(
        (status: Entity) => status.id === issue.statusId,
      )?.type === "triage"
        ? issue.id
        : undefined;
  return {
    scope,
    triageIssueId,
    entity:
      entity === "issues"
        ? "issue"
        : entity === "projects"
          ? "project"
          : entity === "initiatives"
            ? "initiative"
            : entity === "documents"
              ? "document"
              : undefined,
    typing,
    modalOpen: !!document.querySelector('[role="dialog"],dialog[open],[aria-modal="true"],[role="menu"],.dropdown-content'),
    platform: /Mac|iPhone|iPad/.test(navigator.platform) ? "mac" : "other",
    teamId,
    cyclesEnabled: !!(cycleTeam?.cycleEnabled || cycleTeam?.cyclesEnabled),
    currentCycleId: cycles.find(
      (cycle) =>
        Date.parse(cycle.startDate) <= now && Date.parse(cycle.endDate) >= now,
    )?.id,
    upcomingCycleId: cycles.find((cycle) => Date.parse(cycle.startDate) > now)
      ?.id,
    submitOnCommandEnter: !!target?.closest(
      "form,.issue-composer,.comment-composer",
    ),
  };
}

export function ShortcutActions({
  onCommand,
  tabs,
}: {
  onCommand: (command: WorkspaceCommand) => void;
  tabs: { id: string; route: string }[];
}) {
  const store = useAppStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [customDue, setCustomDue] = useState(false);
  const [issueQuickOpen, setIssueQuickOpen] = useState(false);
  const [documentQuickOpen, setDocumentQuickOpen] = useState(false);
  const [reminderTarget, setReminderTarget] = useState<ReminderTarget | null>(
    null,
  );
  const [dialog, setDialog] = useState<DialogState | null>(null),
    [query, setQuery] = useState(""),
    [value, setValue] = useState<any>(""),
    [selected, setSelected] = useState<any[]>([]),
    [touched, setTouched] = useState<string[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [find, setFind] = useState(false),
    [findText, setFindText] = useState(""),
    [findResult, setFindResult] = useState("");
  const findInput = useRef<HTMLInputElement>(null),
    findPreviousFocus = useRef<HTMLElement | null>(null);
  const sequence = useRef<ShortcutSequence | null>(null);
  const latest = useRef({ store, location, onCommand, tabs });
  latest.current = { store, location, onCommand, tabs };
  const open = (next: DialogState, initial: any = "") => {
    setCustomDue(false);
    setDialog(next);
    setValue(initial);
    setSelected(Array.isArray(initial) ? initial : []);
    setTouched([]);
    setQuery("");
    setError("");
  };
  const safe = (operation: Promise<unknown>) => {
    void operation.catch((error) =>
      latest.current.store.toast(
        error instanceof Error ? error.message : "Unable to perform action",
      ),
    );
  };
  const write = async (
    target: Target,
    patch: Record<string, any>,
    preserveMixed = false,
    touched?: string[],
  ) => {
    if (target.kind === "projects")
      return latest.current.store.batch(
        projectBulkChanges(
          target.items,
          patch,
          preserveMixed,
          touched,
          latest.current.store.data.labels,
        ),
      );
    if (target.kind === "issues")
      return latest.current.store.batch(
        resolveIssueBulkStatuses(
          target.items,
          issueBulkPropertyChanges(
            target.items,
            patch,
            preserveMixed,
            touched,
            latest.current.store.data.labels,
          ),
          latest.current.store.data.statuses,
        ),
      );
    await latest.current.store.batch(
      target.items.map((item) => ({
        kind: target.kind,
        id: item.id,
        expectedVersion: item.version,
        data: patch,
      })),
    );
  };
  const optionsFor = (target: Target, field: string) => {
    const { data } = latest.current.store;
    const item = target.items[0];
    if (target.kind === "issues" && field === "statusId")
      return commonIssueStatusOptions(target.items, data.statuses);
    if (target.kind === "issues" && ["labelIds", "estimate"].includes(field)) {
      const lists = target.items.map((issue) => {
        const ancestors = new Set<string>();
        let team = data.teams.find((team) => team.id === issue.teamId),
          ancestor = team;
        while (ancestor && !ancestors.has(ancestor.id)) {
          ancestors.add(ancestor.id);
          ancestor = data.teams.find((team) => team.id === ancestor!.parentId);
        }
        if (field === "statusId")
          return [
            ...(issue.sharedStatuses ??
              alive(data.statuses).filter(
                (row) => row.teamId === issue.teamId,
              )),
          ]
            .sort(
              (a: Entity, b: Entity) =>
                (a.position ?? a.sortOrder ?? 0) -
                (b.position ?? b.sortOrder ?? 0),
            )
            .map((row: Entity) => ({ id: row.id, name: row.name }));
        if (field === "labelIds")
          return (
            issue.sharedLabels ??
            alive(data.labels).filter(
              (row) =>
                (!row.entityType || row.entityType === "issues") &&
                (!row.teamId || ancestors.has(row.teamId)),
            )
          ).map((row: Entity) => ({ id: row.id, name: row.name }));
        const visited = new Set<string>();
        while (
          team?.inheritEstimates &&
          team.parentId &&
          !visited.has(team.id)
        ) {
          visited.add(team.id);
          team =
            data.teams.find((parent) => parent.id === team!.parentId) ?? team;
        }
        return sharedEstimateOptions(
          issue.sharedEstimateConfig
            ? issue
            : { ...issue, sharedEstimateConfig: team ?? {} },
        )!;
      });
      return (lists[0] ?? []).filter((option: { id: string | number | null }) =>
        lists.every((list) =>
          list.some(
            (candidate: { id: string | number | null }) =>
              candidate.id === option.id,
          ),
        ),
      );
    }
    if (field === "priority")
      return priorities.map((name, id) => ({ id, name }));
    if (field === "estimate")
      return [null, 0, 1, 2, 3, 5, 8, 13, 21].map((id) => ({
        id,
        name: id === null ? "No estimate" : String(id),
      }));
    if (field === "status")
      return projectStatusOptions(data).map((option) => ({
        id: option.value,
        name: option.label,
      }));
    const kind = (
      {
        statusId: "statuses",
        assigneeId: "users",
        ownerId: "users",
        leadId: "users",
        memberIds: "users",
        projectId: "projects",
        cycleId: "cycles",
        milestoneId: "milestones",
        parentId: "issues",
        labelIds: "labels",
        teamId: "teams",
        teamIds: "teams",
        initiativeIds: "initiatives",
      } as Record<string, EntityKind>
    )[field];
    if (!kind) return [];
    const rows = alive(data[kind])
      .filter(
        (row) =>
          target.kind !== "projects" ||
          field !== "labelIds" ||
          row.entityType === "projects",
      )
      .filter((row) =>
        field === "statusId" || field === "cycleId"
          ? row.teamId === item.teamId
          : field === "milestoneId"
            ? row.projectId === item.projectId
            : field === "parentId"
              ? !target.items.some((item) => item.id === row.id)
              : true,
      )
      .map((row) => ({
        id: row.id,
        name:
          kind === "issues"
            ? `${issueName(row)} ${row.title}`
            : kind === "users"
              ? displayNameFor(row, data)
              : (row.name ?? row.title),
      }));
    return field.endsWith("Ids") || ["teamId", "statusId"].includes(field)
      ? rows
      : [{ id: null, name: "None" }, ...rows];
  };
  const copy = (text: string) =>
    safe(
      (window.desktop
        ? window.desktop.copyText(text)
        : navigator.clipboard.writeText(text)
      ).then(() => latest.current.store.toast("Copied to clipboard")),
    );
  const doFind = (text: string, backwards = false) => {
    const desktop = window.desktop as any;
    if (desktop?.findInPage) {
      if (text)
        void desktop.findInPage(text, { forward: !backwards, findNext: true });
      else void desktop.stopFindInPage();
    } else if (text) {
      const matched = (window as any).find?.(text, false, backwards, true);
      setFindResult(matched ? "Match found" : "No matches");
    } else {
      getSelection()?.removeAllRanges();
      setFindResult("");
    }
  };

  const closeFind = () => {
    setFind(false);
    (window.desktop as any)?.stopFindInPage?.();
    const previous = findPreviousFocus.current;
    findPreviousFocus.current = null;
    if (previous?.isConnected) previous.focus({ preventScroll: true });
  };

  const execute = (event: WorkspaceCommand): boolean => {
    const { store, location, tabs, onCommand } = latest.current;
    const data = store.data;
    const target = currentTarget(location.pathname, data);
    const item = target?.items[0];
    const guestAccess = guestCapabilities(data, store.user?.id);
    if (
      guestAccess.guest &&
      (/customer|initiative|invite/.test(event.command) ||
        (event.command === "open-picker" &&
          ["customer", "initiative"].includes(String(event.value))))
    ) {
      store.toast("This action is unavailable for guests");
      return true;
    }
    if (event.command === "undo" || event.command === "redo") {
      const focused = document.activeElement as HTMLElement | null;
      if (
        focused?.closest(
          'input:not([type=checkbox]):not([type=radio]),textarea,[contenteditable="true"]',
        )
      ) {
        const mac = /Mac|iPhone|iPad/.test(navigator.platform),
          key = new KeyboardEvent("keydown", {
            key: "z",
            code: "KeyZ",
            metaKey: mac,
            ctrlKey: !mac,
            shiftKey: event.command === "redo",
            bubbles: true,
            cancelable: true,
          });
        if (focused.dispatchEvent(key)) document.execCommand(event.command);
        return true;
      }
      onCommand(event);
      return true;
    }
    const findInDialog =
      event.command === "find-in-page" &&
      !!document.querySelector('[role="dialog"],dialog[open]');
    if (
      !findInDialog &&
      location.pathname.startsWith("/inbox") &&
      [
        "snooze-notification",
        "delete-notification",
        "find-in-page",
        "focus-item",
        "toggle-read",
        "mark-all-read",
        "delete-read-notifications",
      ].includes(event.command)
    )
      return false;
    if (
      !findInDialog &&
      event.command === "find-in-page" &&
      document.querySelector(".issue-view[data-selected-ids]")
    )
      return false;
    if (event.command === "remind" || event.command === "cancel-reminder") {
      const kind =
        event.field &&
        ["issues", "documents", "projects", "initiatives"].includes(event.field)
          ? (event.field as ReminderKind)
          : (target?.kind as ReminderKind);
      if (!["issues", "documents", "projects", "initiatives"].includes(kind))
        return false;
      const items =
        event.field && typeof event.value === "string"
          ? data[kind].filter((item) => item.id === event.value)
          : (target?.items ?? []);
      if (!items.length) return false;
      if (event.command === "remind") setReminderTarget({ kind, items });
      else {
        const reminders = items
          .map((item) =>
            pendingReminder(data.notifications, kind, item.id, store.user?.id),
          )
          .filter((item): item is Entity => !!item);
        if (reminders.length)
          safe(
            store
              .batch(
                reminders.map((item) => ({
                  kind: "notifications",
                  action: "delete",
                  id: item.id,
                })),
              )
              .then(() => store.toast("Reminder canceled")),
          );
      }
      return true;
    }
    if (
      [
        "new-customer-request",
        "share-issue",
        "duplicate-issue",
        "convert-issue-to-project",
        "convert-issue-to-recurring",
      ].includes(event.command)
    )
      return false;
    if (event.command === "new-customer") {
      navigate("/customers?new=1");
      return true;
    }
    if (
      event.command === "command-menu" &&
      target?.kind === "projects" &&
      document.querySelector<HTMLElement>(".project-collection")?.dataset
        .selectedProjectIds
    )
      return clickLabel("Open project selection commands");
    if (shellCommands.has(event.command)) {
      onCommand(event);
      return true;
    }
    if (listCommands.has(event.command)) return false;
    if (event.command === "submit") {
      const element = document.activeElement;
      const form = element?.closest("form") as HTMLFormElement | null;
      if (form) {
        form.requestSubmit();
        return true;
      }
      if (element?.closest(".comment-composer"))
        return clickLabel("Submit comment");
      const create = [
        ...document.querySelectorAll<HTMLButtonElement>(
          ".issue-composer button",
        ),
      ].find(
        (button) =>
          button.textContent?.trim() === "Create issue" && !button.disabled,
      );
      if (create) {
        create.click();
        return true;
      }
      return false;
    }
    if (event.command === "help-menu")
      return (
        clickLabel("Help") ||
        (onCommand({ command: "keyboard-shortcuts" }), true)
      );
    if (event.command === "logout") {
      safe(store.logout());
      return true;
    }
    if (event.command === "display-options")
      return clickLabel("Display options");
    if (event.command === "toggle-right-sidebar")
      return clickLabel("Toggle properties") || clickLabel("Toggle details");
    if (event.command === "copy-page-url") {
      copy(window.location.href);
      return true;
    }
    if (event.command === "open-last-toast-link") {
      const link = [
        ...document.querySelectorAll<HTMLAnchorElement>(".toast a"),
      ].at(-1);
      if (link) {
        link.click();
        return true;
      }
      return false;
    }
    if (event.command === "open-tab-menu") {
      open({
        type: "picker",
        title: "Open tab",
        value: "tab",
        options: tabs.map((tab, index) => ({ id: index, name: tab.route })),
      });
      return true;
    }
    if (event.command === "select-team") {
      const team = data.teams[Number(event.value)];
      if (team) {
        navigate(`/team/${team.id}/all`);
        return true;
      }
      return false;
    }
    if (
      ["find-in-page", "find-next", "find-previous"].includes(event.command)
    ) {
      const focused = document.activeElement as HTMLElement | null;
      if (!focused?.closest(".shortcut-find"))
        findPreviousFocus.current = focused;
      setFind(true);
      if (event.command === "find-in-page") {
        findInput.current?.focus();
        findInput.current?.select();
      } else doFind(findText, event.command === "find-previous");
      return true;
    }
    if (["open-current-cycle", "open-upcoming-cycle"].includes(event.command)) {
      navigate("/cycles");
      return true;
    }
    if (event.command === "new-issue-template") {
      open({
        type: "picker",
        title: "New issue from template",
        value: "template",
        options: alive(data.templates)
          .filter((template) => !template.type || template.type === "issue")
          .map((template) => ({ id: template.id, name: template.name })),
      });
      return true;
    }
    if (event.command === "open-picker") {
      if (event.value === "issue") {
        setIssueQuickOpen(true);
        return true;
      }
      if (event.value === "document") {
        setDocumentQuickOpen(true);
        return true;
      }
      if (event.value === "label") {
        open({
          type: "picker",
          title: "Open label",
          value: "label",
          options: [
            ...alive(data.labels)
              .filter((row) => (row.entityType || "issues") === "issues")
              .map((row) => ({
                id: row.id,
                name: row.name,
                route: "/label/" + row.id,
              })),
            ...alive(data.labelGroups)
              .filter((row) => (row.entityType || "issues") === "issues")
              .map((row) => ({
                id: row.id,
                name: row.name,
                route: "/label-group/" + row.id,
              })),
          ],
        });
        return true;
      }
      const kind = (
        {
          issue: "issues",
          project: "projects",
          cycle: "cycles",
          user: "users",
          team: "teams",
          view: "views",
          document: "documents",
          initiative: "initiatives",
          customer: "customers",
          favorite: "favorites",
          workspace: "workspaces",
        } as Record<string, EntityKind>
      )[String(event.value)];
      if (!kind) return false;
      const prefix = (
        {
          issues: "issues",
          projects: "project",
          cycles: "cycles",
          teams: "team",
          views: "view",
          documents: "document",
          initiatives: "initiative",
          customers: "customer",
        } as Record<string, string>
      )[kind];
      open({
        type: "picker",
        title: `Open ${event.value}`,
        value: String(event.value),
        options: alive(data[kind]).map((row) => ({
          id: row.id,
          name:
            kind === "issues"
              ? `${issueName(row)} ${row.title}`
              : kind === "users"
                ? displayNameFor(row, data)
                : (row.name ??
                  row.title ??
                  row.label ??
                  row.email ??
                  "Favorite"),
          route:
            kind === "favorites"
              ? row.route
              : kind === "users"
                ? `/profiles/${row.id}`
                : prefix
                  ? `/${prefix}/${row.id}${kind === "teams" ? "/overview" : ""}`
                  : undefined,
        })),
      });
      return true;
    }
    if (!target || !item) return false;
    if (
      event.command === "issue-description-history" &&
      target.kind === "issues" &&
      !event.value
    ) {
      if (target.items.length !== 1) {
        store.toast("Select one issue to view its description history");
        return true;
      }
      return dispatchWorkspaceCommand({
        command: "issue-description-history",
        value: item.id,
      });
    }
    if (
      target.kind === "issues" &&
      target.items.some((issue) => issue.sharedAccess)
    ) {
      const restrictedProperty = [
        "teamId",
        "teamIds",
        "projectId",
        "cycleId",
        "milestoneId",
        "parentId",
        "sharedWithIds",
        "templateId",
        "archivedAt",
      ].includes(event.field ?? "");
      if (
        (["edit-property", "set-property"].includes(event.command) &&
          restrictedProperty) ||
        [
          "delete-issue",
          "restore-issue",
          "new-sub-issue",
          "new-sub-issue-template",
          "apply-template",
          "manage-subscribers",
        ].includes(event.command) ||
        (event.command === "add-relation" && event.value === "duplicate")
      ) {
        store.toast("This action requires access to the issue’s team");
        return true;
      }
    }
    if (event.command === "edit-property" && event.field) {
      open(
        {
          type: "property",
          title: `Change ${fieldNames[event.field] ?? event.field}`,
          target,
          field: event.field,
          multiple: event.field.endsWith("Ids"),
          options: optionsFor(target, event.field),
        },
        event.field.endsWith("Ids")
          ? target.kind === "issues"
            ? commonIssueValues(target.items, event.field)
            : commonProjectValues(target.items, event.field)
          : (item[event.field] ?? ""),
      );
      return true;
    }
    if (event.command === "set-property" && event.field) {
      safe(
        write(target, {
          [event.field]: event.value === "" ? null : event.value,
        }),
      );
      return true;
    }
    if (event.command === "assign-to-me" && target.kind === "issues") {
      safe(write(target, { assigneeId: store.user?.id ?? null }));
      return true;
    }
    if (event.command === "rename-issue") {
      open({ type: "rename", title: "Rename issue", target }, item.title);
      return true;
    }
    if (event.command === "rename-project" && target.kind === "projects") {
      if (target.items.length === 1)
        open(
          { type: "rename", title: "Rename project", target, field: "name" },
          item.name,
        );
      return true;
    }
    if (event.command === "delete-issue") {
      open({
        type: "delete",
        title:
          target.items.length > 1
            ? `Delete ${target.items.length} ${target.kind === "projects" ? "projects" : "issues"}?`
            : target.kind === "projects"
              ? "Delete project?"
              : "Delete issue?",
        target,
      });
      return true;
    }
    if (event.command === "restore-issue") {
      safe(
        Promise.all(
          target.items.map((item) => store.restore(target.kind, item.id)),
        ),
      );
      return true;
    }
    if (event.command === "archive-projects" && target.kind === "projects") {
      safe(write(target, { archivedAt: new Date().toISOString() }));
      return true;
    }
    if (event.command === "favorite-projects" && target.kind === "projects") {
      const changes = target.items
        .filter(
          (item) =>
            !alive(data.favorites).some(
              (favorite) =>
                favorite.entityId === item.id &&
                favorite.userId === store.user?.id,
            ),
        )
        .map((item) => ({
          kind: "favorites" as const,
          action: "create" as const,
          data: {
            entityId: item.id,
            type: "project",
            userId: store.user?.id,
            label: item.name,
            route: "/project/" + item.id,
          },
        }));
      if (changes.length) safe(store.batch(changes));
      return true;
    }
    if (event.command === "copy-project-links" && target.kind === "projects") {
      copy(
        target.items
          .map(
            (item) =>
              "[" +
              String(item.name).replaceAll("[", "\\[").replaceAll("]", "\\]") +
              "](" +
              window.location.origin +
              "/project/" +
              item.id +
              ")",
          )
          .join("\n"),
      );
      return true;
    }
    if (
      event.command === "copy-project-markdown" &&
      target.kind === "projects"
    ) {
      copy(
        target.items
          .map(
            (item) =>
              "# " +
              item.name +
              "\n\n" +
              richTextToMarkdown(item.description ?? ""),
          )
          .join("\n\n"),
      );
      return true;
    }
    if (
      event.command === "copy-project-requests-markdown" &&
      target.kind === "projects"
    ) {
      copy(
        projectRequestsMarkdown(
          target.items,
          data.requests,
          data.customers,
          window.location.origin,
        ),
      );
      return true;
    }
    if (event.command === "toggle-favorite") {
      safe(
        (async () => {
          for (const item of target.items) {
            const existing = alive(data.favorites).find(
              (f) => f.entityId === item.id && f.userId === store.user?.id,
            );
            if (existing) await store.remove("favorites", existing.id);
            else
              await store.create("favorites", {
                entityId: item.id,
                type:
                  target.kind === "issues"
                    ? "issue"
                    : target.kind === "projects"
                      ? "project"
                      : target.kind === "documents"
                        ? "document"
                        : "initiative",
                userId: store.user?.id,
                label: item.title ?? item.name,
                route: `/${target.kind === "issues" ? "issues" : target.kind === "projects" ? "project" : target.kind === "documents" ? "document" : "initiative"}/${item.id}`,
              });
          }
        })(),
      );
      return true;
    }
    if (event.command === "toggle-subscription") {
      safe(
        (async () => {
          const desired =
            typeof event.value === "boolean"
              ? event.value
              : !target.items.every((item) =>
                  target.kind === "issues"
                    ? isIssueSubscribed(store, item)
                    : (item.subscriberIds ?? []).includes(store.user?.id),
                );
          for (const item of target.items) {
            if (target.kind === "issues") {
              if (isIssueSubscribed(store, item) !== desired)
                await toggleIssueSubscription(store, item);
              continue;
            }
            const ids = item.subscriberIds ?? [];
            await store.update(target.kind, item.id, {
              subscriberIds: desired
                ? [...new Set([...ids, store.user?.id])]
                : ids.filter((id: string) => id !== store.user?.id),
            });
          }
        })(),
      );
      return true;
    }
    if (event.command === "manage-subscribers") {
      const detail =
        target.kind === "issues" && target.items.length === 1
          ? Array.from(
              document.querySelectorAll<HTMLElement>(
                ".issue-detail-view[data-issue-id]",
              ),
            ).find((node) => node.dataset.issueId === item.id)
          : undefined;
      const trigger = detail?.querySelector<HTMLButtonElement>(
        '[aria-label="Change subscribers"]',
      );
      if (trigger && !trigger.disabled) {
        window.dispatchEvent(
          new CustomEvent("open-issue-subscribers", {
            detail: { issueId: item.id },
          }),
        );
        return true;
      }
      open(
        {
          type: "subscribers",
          title: "Manage subscribers",
          target,
          multiple: true,
          options: alive(data.users).map((user) => ({
            id: user.id,
            name: displayNameFor(user, data),
          })),
        },
        target.kind === "issues"
          ? commonSubscribers(target.items)
          : (item.subscriberIds ?? []),
      );
      return true;
    }
    if (
      event.command === "mark-issue-as" &&
      target.kind === "issues" &&
      target.items.length === 1
    ) {
      open({
        type: "picker",
        title: "Mark issue as",
        value: "mark-issue-as",
        target,
        options: [
          { id: "blockedBy", name: "Blocked by…" },
          { id: "blocking", name: "Blocking…" },
          { id: "related", name: "Related to…" },
          { id: "duplicate", name: "Duplicate of…" },
        ],
      });
      return true;
    }
    if (
      event.command === "show-similar-issues" &&
      target.kind === "issues" &&
      target.items.length === 1
    ) {
      navigate(
        "/search?" + new URLSearchParams({ q: item.title, type: "Issues" }),
      );
      return true;
    }
    if (
      event.command === "convert-issue-template" &&
      target.kind === "issues" &&
      target.items.length === 1
    ) {
      safe(
        store
          .create("templates", {
            name: item.title,
            type: "issue",
            teamId: item.teamId,
            title: item.title,
            description: item.description ?? "",
            properties: {
              priority: item.priority ?? 0,
              statusId: item.statusId ?? null,
              assigneeId: item.assigneeId ?? null,
              projectId: item.projectId ?? null,
              cycleId: item.cycleId ?? null,
              estimate: item.estimate ?? null,
              labelIds: item.labelIds ?? [],
              dueDate: item.dueDate ?? null,
            },
          })
          .then((template) => {
            store.toast("Issue template created");
            navigate("/settings/templates?template=" + template.id);
          }),
      );
      return true;
    }
    if (event.command === "new-sub-issue") {
      const conversion =
        target.kind === "issues" ? prepareIssueSelection(item.id) : null;
      if (conversion?.pending) return true;
      if (conversion) {
        const defaults = initialIssueFields(
          { teamId: item.teamId, parentId: item.id, templateId: null },
          data,
          store.user?.id,
        );
        safe(
          store
            .batch([
              ...conversion.children.map((child) => ({
                kind: "issues" as const,
                action: "create" as const,
                data: { ...defaults, ...child },
              })),
              {
                kind: "issues",
                id: item.id,
                data: { description: conversion.description },
                expectedFields: { description: item.description ?? null },
              },
            ])
            .then(() => {
              conversion.completed();
              store.toast(
                conversion.children.length === 1
                  ? "Issue created"
                  : `${conversion.children.length} issues created`,
                { label: "View sub-issues", route: `/issues/${item.id}` },
              );
            })
            .catch((error) => {
              conversion.failed();
              throw error;
            }),
        );
      } else openComposer({ teamId: item.teamId, parentId: item.id });
      return true;
    }
    if (
      event.command === "new-sub-issue-template" &&
      target.kind === "issues"
    ) {
      open({
        type: "picker",
        title: "New sub-issue from template",
        value: "sub-template",
        target,
        options: issueTemplates(data, item.teamId, item.id).map((template) => ({
          id: template.id,
          name: template.name,
        })),
      });
      return true;
    }
    if (event.command === "open-parent-issue" && item.parentId) {
      navigate(`/issues/${item.parentId}`);
      return true;
    }
    if (event.command === "open-sub-issue") {
      const child = alive(data.issues).find(
        (issue) => issue.parentId === item.id,
      );
      if (child) {
        navigate(`/issues/${child.id}`);
        return true;
      }
      return false;
    }
    if (event.command === "add-relation") {
      open({
        type: "relation",
        title: "Add relation",
        target,
        value: String(event.value),
        options: alive(data.issues)
          .filter((issue) => !target.items.some((item) => item.id === issue.id))
          .map((issue) => ({
            id: issue.id,
            name: `${issueName(issue)} ${issue.title}`,
          })),
      });
      return true;
    }
    if (event.command === "apply-template") {
      open({
        type: "picker",
        title: "Apply template",
        target,
        value: "apply-template",
        options: alive(data.templates)
          .filter((template) => !template.type || template.type === "issue")
          .map((template) => ({ id: template.id, name: template.name })),
      });
      return true;
    }
    if (event.command === "copy-issue-id") {
      copy(target.items.map(issueName).join("\n"));
      return true;
    }
    if (event.command === "copy-entity-title") {
      copy(
        target.items
          .map((item) =>
            target.kind === "issues"
              ? issueName(item) + ": " + item.title
              : (item.title ?? item.name),
          )
          .join("\n"),
      );
      return true;
    }
    if (event.command === "copy-entity-url") {
      copy(
        target.items
          .map(
            (item) =>
              `${window.location.origin}/${target.kind === "issues" ? "issues" : target.kind === "projects" ? "project" : target.kind === "documents" ? "document" : "initiative"}/${item.id}`,
          )
          .join("\n"),
      );
      return true;
    }
    if (event.command === "copy-issue-title-link" && target.kind === "issues") {
      copy(
        target.items
          .map(
            (item) =>
              "[" +
              issueName(item) +
              ": " +
              item.title +
              "](" +
              window.location.origin +
              "/issues/" +
              item.id +
              ")",
          )
          .join("\n"),
      );
      return true;
    }
    if (event.command === "copy-issue-markdown") {
      copy(
        target.items
          .map(
            (item) =>
              `# ${issueName(item)} ${item.title}\n\n${richTextToMarkdown(item.description ?? "")}`,
          )
          .join("\n\n"),
      );
      return true;
    }
    if (event.command === "copy-document-markdown" && target.kind === "documents") {
      copy(
        target.items
          .map((item) => `# ${item.title || "Untitled"}\n\n${richTextToMarkdown(item.content ?? "")}`)
          .join("\n\n"),
      );
      return true;
    }
    if (event.command === "focus-description") {
      const input = document.querySelector<HTMLElement>(
        '.issue-article [contenteditable="true"]',
      );
      if (input) {
        input.focus();
        return true;
      }
      return false;
    }
    if (
      event.command === "focus-comment" ||
      event.command === "reply-comment"
    ) {
      const input = document.querySelector<HTMLElement>(
        '.comment-composer [contenteditable="true"]',
      );
      if (input) {
        if (event.command === "reply-comment") {
          const comments = [
            ...document.querySelectorAll<HTMLElement>(".comment"),
          ];
          const comment =
            document.activeElement?.closest(".comment") ?? comments.at(-1);
          const reply = comment?.querySelector<HTMLButtonElement>(
            ".comment-reactions>.text-button",
          );
          reply?.click();
        }
        input.focus();
        return true;
      }
      return false;
    }
    if (event.command === "link-url") {
      open({ type: "link", title: "Link URL", target });
      return true;
    }
    if (event.command === "toggle-links") {
      const section = document.querySelector<HTMLElement>(
        '[data-shortcut="links-section"]',
      );
      if (section) {
        section.hidden = !section.hidden;
        return true;
      }
      return false;
    }
    if (
      event.command === "open-updates" &&
      ["projects", "initiatives"].includes(target.kind)
    ) {
      navigate(
        `/${target.kind === "projects" ? "project" : target.kind === "documents" ? "document" : "initiative"}/${item.id}/updates`,
      );
      return true;
    }
    if (
      event.command === "write-update" &&
      ["projects", "initiatives"].includes(target.kind)
    ) {
      navigate(
        `/${target.kind === "projects" ? "project" : target.kind === "documents" ? "document" : "initiative"}/${item.id}/updates?compose=1`,
      );
      return true;
    }
    return false;
  };
  const executeRef = useRef(execute);
  executeRef.current = execute;
  useEffect(() => {
    // A cached workspace can render before the initial session check replaces it.
    // Keep native startup commands queued until that authentication phase settles.
    if (store.initialSyncing) return;
    if (!window.desktop) return;
    const routing = nativeCommandRouting<WorkspaceCommand>(
      dispatchWorkspaceCommand,
      () =>
        latest.current.store.toast(
          "Link will open after you close the current dialog",
        ),
    );
    const unsubscribe = window.desktop.onCommand((command) =>
      routing.receive(command),
    );
    return () => {
      unsubscribe?.();
      routing.dispose();
    };
  }, [store.initialSyncing]);
  useEffect(() => {
    const listener = (event: Event) => {
      if (event.defaultPrevented) return;
      const command = (event as CustomEvent<WorkspaceCommand>).detail;
      if (command && executeRef.current(command)) event.preventDefault();
    };
    window.addEventListener("workspace-command", listener);
    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey &&
        !event.altKey &&
        event.key.toLowerCase() === "c" &&
        window.getSelection()?.toString()
      )
        return;
      if (
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        ["Enter", " "].includes(event.key) &&
        (event.target as Element)?.closest(
          "button,a,input,select,textarea,[role=button]",
        )
      )
        return;
      const { store, location } = latest.current;
      const result = resolveShortcut(
        event,
        contextFor(location.pathname, store.data, event),
        sequence.current,
      );
      sequence.current = result.pending;
      if (result.pending) {
        event.preventDefault();
        return;
      }
      if (result.action) {
        let handled = false;
        /* Subsequent shortcuts inspect the selected/focused DOM state. Commit this discrete action before the next key. */ flushSync(
          () => {
            handled = dispatchWorkspaceCommand(result.action!);
          },
        );
        if (handled) event.preventDefault();
      }
    };
    const historyKeydown = (event: KeyboardEvent) => {
      if (!event.metaKey && !event.ctrlKey && !event.altKey && ["Backspace", "BrowserBack", "BrowserForward"].includes(event.key)) {
        // Closed property buttons stop bubbling keys; navigation still belongs
        // to the page. contextFor/resolveShortcut preserve editing and menus.
        keydown(event);
      }
    };
    document.addEventListener("keydown", historyKeydown, true);
    document.addEventListener("keydown", keydown);
    const removeMouseHistory = installMouseHistoryNavigation(dispatchWorkspaceCommand);
    const found = (window.desktop as any)?.onFindResult?.(
      (result: { activeMatchOrdinal: number; matches: number }) =>
        setFindResult(`${result.activeMatchOrdinal} of ${result.matches}`),
    );
    return () => {
      window.removeEventListener("workspace-command", listener);
      document.removeEventListener("keydown", keydown);
      document.removeEventListener("keydown", historyKeydown, true);
      removeMouseHistory();
      found?.();
    };
  }, []);
  const choose = async (id: any) => {
    if (!dialog) return;
    const { data } = store;
    if (dialog.type === "picker") {
      if (dialog.value === "tab") {
        onCommand({ command: "select-tab", value: Number(id) });
        setDialog(null);
        return;
      }
      if (dialog.value === "mark-issue-as" && dialog.target) {
        setDialog({
          type: "relation",
          title: "Add relation",
          target: dialog.target,
          value: String(id),
          options: alive(data.issues)
            .filter(
              (issue) =>
                !dialog.target!.items.some((item) => item.id === issue.id),
            )
            .map((issue) => ({
              id: issue.id,
              name: `${issueName(issue)} ${issue.title}`,
            })),
        });
        return;
      }
      if (dialog.value === "sub-template") {
        const parent = dialog.target?.items[0];
        if (parent)
          openComposer({
            teamId: parent.teamId,
            parentId: parent.id,
            templateId: id,
          });
        setDialog(null);
        return;
      }
      if (dialog.value === "workspace") {
        await fetch("/auth/workspace", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ workspaceId: id }),
        }).then(async (response) => {
          if (!response.ok)
            throw Error(
              (await response.json())?.error?.message ??
                "Unable to switch workspace",
            );
        });
        await store.reload();
        navigate("/my-issues");
      } else if (
        dialog.value === "template" ||
        dialog.value === "apply-template"
      ) {
        const template = data.templates.find((template) => template.id === id);
        if (template) {
          if (dialog.target)
            await write(dialog.target, {
              ...(template.fields ?? template.properties ?? {}),
              description: template.description ?? "",
            });
          else
            openComposer({
              ...template.fields,
              ...template.properties,
              description: template.description ?? "",
              templateId: template.id,
            });
        }
      } else {
        const option = dialog.options?.find((option) => option.id === id);
        if (option?.route) navigate(option.route);
      }
    } else if (dialog.type === "relation" && dialog.target) {
      for (const item of dialog.target.items) {
        if (dialog.value === "duplicate")
          await apiRequest(
            `/api/v1/issues/${encodeURIComponent(item.id)}/merge`,
            { method: "POST", body: JSON.stringify({ targetId: id }) },
          );
        else
          await store.update("issues", item.id, {
            relations: [
              ...(item.relations ?? []),
              {
                type: dialog.value === "blocking" ? "blocks" : dialog.value,
                issueId: id,
              },
            ],
          });
      }
      if (dialog.value === "duplicate") await store.reload();
    } else if (dialog.target && dialog.field)
      await write(dialog.target, { [dialog.field]: id });
    setDialog(null);
  };
  const submit = async () => {
    if (!dialog) return;
    setBusy(true);
    setError("");
    try {
      const target = dialog.target;
      if (dialog.type === "property" && target && dialog.field)
        await write(
          target,
          { [dialog.field]: dialog.multiple ? selected : value || null },
          ["projects", "issues"].includes(target.kind) && !!dialog.multiple,
          touched,
        );
      if (dialog.type === "rename" && target) {
        if (!String(value).trim())
          throw Error(
            dialog.field === "name" ? "Enter a project name" : "Enter a title",
          );
        await write(target, {
          [dialog.field || "title"]: String(value).trim(),
        });
      }
      if (dialog.type === "delete" && target) {
        await store.batch(
          target.items.map((item) => ({
            kind: target.kind,
            id: item.id,
            action: "delete",
          })),
        );
        if (location.pathname.startsWith("/issues/")) navigate(-1);
        store.toast("Moved to recently deleted");
      }
      if (dialog.type === "subscribers" && target) {
        if (target.kind === "issues") {
          const changes = subscriberSelectionChanges(
            target.items.map(
              (item) =>
                store.data.issues.find((current) => current.id === item.id) ??
                item,
            ),
            selected,
            touched,
          );
          if (changes.length) await store.batch(changes);
        } else await write(target, { subscriberIds: selected });
      }
      if (dialog.type === "link" && target) {
        let url: URL;
        try {
          url = new URL(value);
        } catch {
          throw Error("Enter a valid URL");
        }
        if (!["http:", "https:"].includes(url.protocol))
          throw Error("Use an HTTP or HTTPS URL");
        for (const item of target.items)
          await store.update(target.kind, item.id, {
            links: [
              ...(item.links ?? []),
              { url: url.href, title: url.hostname },
            ],
          });
      }
      setDialog(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to save");
    } finally {
      setBusy(false);
    }
  };
  if (dialog?.type === "link" && dialog.target?.kind === "issues")
    return (
      <IssueLinkDialog
        issues={dialog.target.items}
        onClose={() => setDialog(null)}
        onSave={async (link) => {
          for (const item of dialog.target!.items) {
            const current =
              store.data.issues.find((issue) => issue.id === item.id) ?? item;
            await store.update("issues", item.id, {
              links: [...(current.links ?? []), link],
            });
          }
        }}
      />
    );
  const dateDialog =
    dialog?.type === "property" &&
    ["dueDate", "targetDate", "startDate"].includes(dialog.field ?? "");
  const projectDates = dateDialog && dialog?.target?.kind === "projects";
  if (dateDialog && dialog?.target?.kind === "issues" && !customDue)
    return (
      <Modal
        className="command-palette issue-due-command"
        onClose={() => setDialog(null)}
      >
        <div className="command-input">
          <span>
            {dialog.target.items.length === 1
              ? issueName(dialog.target.items[0]) +
                " · " +
                dialog.target.items[0].title
              : dialog.target.items.length + " issues"}
          </span>
        </div>
        <IssueDueMenu
          command
          onCustom={() => setCustomDue(true)}
          onSelect={(date) => {
            void write(dialog.target!, { dueDate: date })
              .then(() => setDialog(null))
              .catch((error) => store.toast(error.message));
          }}
        />
      </Modal>
    );
  if (dateDialog && dialog?.target?.kind === "issues" && customDue)
    return (
      <IssueCustomDue
        value={value}
        onSave={(dueDate) => write(dialog.target!, { dueDate })}
        onClose={() => setDialog(null)}
      />
    );
  if (dialog?.type === "delete" && dialog.target?.kind === "issues")
    return (
      <IssueDeleteConfirmation
        issues={dialog.target.items}
        onClose={() => setDialog(null)}
        onConfirm={async () => {
          await store.batch(
            dialog.target!.items.map((item) => ({
              kind: "issues",
              id: item.id,
              action: "delete",
            })),
          );
          if (location.pathname.startsWith("/issues/")) navigate(-1);
          store.toast("Moved to recently deleted");
        }}
      />
    );
  const markType: MarkIssueType | undefined =
    dialog?.target?.kind === "issues" && dialog.target.items.length === 1
      ? dialog.type === "relation"
        ? (
            {
              related: "related",
              blockedBy: "blockedBy",
              blocking: "blocks",
              blocks: "blocks",
              duplicate: "duplicate",
            } as Record<string, MarkIssueType>
          )[dialog.value ?? ""]
        : dialog.type === "property" && dialog.field === "parentId"
          ? "childOf"
          : undefined
      : undefined;
  if (markType && dialog?.target)
    return (
      <IssueMarkAs
        issue={dialog.target.items[0]}
        type={markType}
        onClose={() => setDialog(null)}
      />
    );
  const filtered =
    dialog?.options?.filter((option) =>
      option.name.toLowerCase().includes(query.toLowerCase()),
    ) ?? [];
  return (
    <>
      {reminderTarget && (
        <ReminderDialog
          target={reminderTarget}
          onClose={() => setReminderTarget(null)}
        />
      )}{" "}
      {issueQuickOpen && (
        <IssueQuickOpen onClose={() => setIssueQuickOpen(false)} />
      )}{" "}
      {documentQuickOpen && (
        <DocumentQuickOpen onClose={() => setDocumentQuickOpen(false)} />
      )}{" "}
      {find && (
        <div
          className="shortcut-find"
          role="search"
          data-global-focus-scope="true"
          style={{
            position: "fixed",
            right: 24,
            top: 50,
            zIndex: 400,
            display: "flex",
            gap: 6,
            alignItems: "center",
            padding: 8,
            border: "1px solid var(--border)",
            borderRadius: 8,
            background: "var(--panel)",
            boxShadow: "var(--shadow)",
          }}
        >
          <input
            ref={findInput}
            className="input"
            autoFocus
            aria-label="Find in page"
            value={findText}
            onChange={(event) => {
              setFindText(event.target.value);
              doFind(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                doFind(findText, event.shiftKey);
              }
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                closeFind();
              }
            }}
          />
          <small className="muted">{findResult}</small>
          <button
            className="icon-button"
            aria-label="Previous match"
            onClick={() => doFind(findText, true)}
          >
            <Icon name="ChevronUp" />
          </button>
          <button
            className="icon-button"
            aria-label="Next match"
            onClick={() => doFind(findText)}
          >
            <Icon name="ChevronDown" />
          </button>
          <button
            className="icon-button"
            aria-label="Close find"
            onClick={closeFind}
          >
            <Icon name="X" />
          </button>
        </div>
      )}
      {dialog && (
        <Modal title={dialog.title} onClose={() => setDialog(null)}>
          <div className="modal-body">
            {projectDates ? (
              <TargetDateControl
                label={
                  dialog.field === "startDate" ? "Start date" : "Target date"
                }
                value={dialog.target!.items[0][dialog.field!]}
                precision={
                  dialog.field === "targetDate"
                    ? dialog.target!.items[0].datePrecision || "day"
                    : "day"
                }
                allowPeriods={dialog.field === "targetDate"}
                minDate={
                  dialog.field === "targetDate"
                    ? dialog
                        .target!.items.map((item) => item.startDate)
                        .filter(Boolean)
                        .sort()
                        .at(-1)
                    : undefined
                }
                maxDate={
                  dialog.field === "startDate"
                    ? dialog
                        .target!.items.map((item) => item.targetDate)
                        .filter(Boolean)
                        .sort()[0]
                    : undefined
                }
                onChange={async (date, precision) => {
                  const result = await write(dialog.target!, {
                    [dialog.field!]: date,
                    ...(dialog.field === "targetDate"
                      ? { datePrecision: precision }
                      : {}),
                  });
                  setDialog(null);
                  return result;
                }}
              />
            ) : dateDialog ? (
              <DatePicker value={value} onChange={setValue} />
            ) : dialog.type === "delete" ? (
              <p>
                Move {dialog.target?.items.length ?? 0}{" "}
                {dialog.target?.kind ?? "records"} to recently deleted?
              </p>
            ) : dialog.type === "rename" || dialog.type === "link" ? (
              <TextInput
                autoFocus
                aria-label={
                  dialog.type === "rename"
                    ? dialog.field === "name"
                      ? "Project name"
                      : "Issue title"
                    : "Link URL"
                }
                value={value}
                onChange={(event) => setValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void submit();
                }}
              />
            ) : (
              <>
                <TextInput
                  autoFocus
                  aria-label={dialog.title}
                  placeholder="Search…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      filtered.length === 1 &&
                      !dialog.multiple
                    ) {
                      event.preventDefault();
                      void choose(filtered[0].id).catch((error) =>
                        setError(error.message),
                      );
                    }
                  }}
                />
                <div
                  className="selection-list"
                  style={{ maxHeight: 330, overflowY: "auto", marginTop: 10 }}
                >
                  {filtered.map((option) =>
                    dialog.multiple ? (
                      <label key={String(option.id)} className="menu-item">
                        <input
                          type="checkbox"
                          ref={(input) => {
                            if (input)
                              input.indeterminate =
                                dialog.type === "subscribers" &&
                                dialog.target?.kind === "issues"
                                  ? !touched.includes(String(option.id)) &&
                                    !selected.includes(option.id) &&
                                    dialog.target.items.some((item) =>
                                      subscriberValues(item).includes(
                                        String(option.id),
                                      ),
                                    )
                                  : ["projects", "issues"].includes(
                                      dialog.target?.kind ?? "",
                                    ) &&
                                    !!dialog.field &&
                                    !touched.includes(String(option.id)) &&
                                    !selected.includes(option.id) &&
                                    dialog.target!.items.some((item) =>
                                      projectArrayValues(
                                        item,
                                        dialog.field!,
                                      ).includes(String(option.id)),
                                    );
                          }}
                          checked={selected.includes(option.id)}
                          onChange={(event) => {
                            const selectedLabel = store.data.labels.find(
                              (label) => label.id === option.id,
                            );
                            const group =
                              ["projects", "issues"].includes(
                                dialog.target?.kind ?? "",
                              ) &&
                              dialog.field === "labelIds" &&
                              event.target.checked
                                ? selectedLabel?.group
                                : undefined;
                            const replaced = group
                              ? store.data.labels
                                  .filter(
                                    (label) =>
                                      label.group === group &&
                                      (label.teamId ?? null) ===
                                        (selectedLabel?.teamId ?? null) &&
                                      (label.entityType ?? "issues") ===
                                        (selectedLabel?.entityType ?? "issues"),
                                  )
                                  .map((label) => label.id)
                              : [];
                            setTouched((values) => [
                              ...new Set([
                                ...values,
                                ...replaced.map(String),
                                String(option.id),
                              ]),
                            ]);
                            setSelected(
                              event.target.checked
                                ? [
                                    ...selected.filter(
                                      (id) => !replaced.includes(id),
                                    ),
                                    option.id,
                                  ]
                                : selected.filter((id) => id !== option.id),
                            );
                          }}
                        />
                        <span>{option.name}</span>
                      </label>
                    ) : (
                      <button
                        className="menu-item"
                        key={String(option.id)}
                        onClick={() =>
                          void choose(option.id).catch((error) =>
                            setError(error.message),
                          )
                        }
                      >
                        {option.name}
                      </button>
                    ),
                  )}
                  {!filtered.length && (
                    <div className="menu-empty">No matching options</div>
                  )}
                </div>
              </>
            )}
            {error && (
              <p className="error-text" role="alert">
                {error}
              </p>
            )}
          </div>
          <div className="modal-footer">
            {dialog.type === "property" &&
              dialog.target?.items.length === 1 &&
              ((dialog.target.kind === "issues" &&
                dialog.field === "assigneeId") ||
                (dialog.target.kind === "projects" &&
                  dialog.field === "leadId")) && (
                <InviteAndAssign
                  kind={dialog.target.kind as "issues" | "projects"}
                  entityId={dialog.target.items[0].id}
                  onAssigned={() => setDialog(null)}
                />
              )}
            <Button onClick={() => setDialog(null)}>Cancel</Button>
            {((dateDialog && !projectDates) ||
              dialog.multiple ||
              ["delete", "rename", "link"].includes(dialog.type)) && (
              <Button
                variant={dialog.type === "delete" ? "danger" : "primary"}
                disabled={busy}
                onClick={() => void submit()}
              >
                {busy
                  ? "Saving…"
                  : dialog.type === "delete"
                    ? "Delete"
                    : "Save"}
              </Button>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
