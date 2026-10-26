import { myIssueTabSearch } from "./my-issue-tab-navigation";
import { IssueTitleEditor } from "./issue-title-editor";
import { ComposerFieldSettings, ComposerActions, useComposerFieldLayout } from "./composer-field-settings";
import { composerLayoutForContext, visibleComposerFields, type ComposerField } from "./composer-field-layout";
import { useIssueGroupCollapse } from "./issue-collapse-state";
import { useSectionReorder, SECTION_DRAG_TYPE } from "./section-reorder";
import { mergeSectionOrder, type SectionOrders } from "./section-order";
import "./composer-parity.css";
import "./issue-drag-feedback.css";
import { IssueDescriptionHistory } from "./issue-description-history";
import { IssueLayoutIcon } from "./components/issue-layout-icon";
import { IssueGroupOrderIcon } from "./components/issue-group-order-icon";
import {
  isIssueLabelGroup,
  issueLabelGroupField,
  issueLabelGroups,
} from "./issue-label-grouping";
import { IssueDeleteConfirmation } from "./issue-delete-confirmation";
import { IssueTeamMenu } from "./issue-team-menu";
import { IssueReminderMenu } from "./issue-reminder-menu";
import { IssueCustomDue } from "./issue-custom-due";
import { IssueDueMenu } from "./issue-due-menu";
import { InlineDueDatePicker } from "./inline-due-date-picker";
import { useInlineMenuPosition } from "./use-inline-menu-position";
import "./inline-issue-properties.css";
import {CustomerPicker,CustomerAssignmentControl,CustomerBulkControl} from "./customer-assignment-picker";
import {withCustomerAssignments} from "../shared/customer-assignments";
import { InlineIssueValue, InlineIssueSla } from "./inline-issue-value";
import {
  IssueMarkAs,
  markIssueActions,
  type MarkIssueType,
} from "./issue-mark-as";
import { IssueActionSubmenu } from "./issue-action-submenu";
import { IssueActionFilter } from "./issue-action-filter";
import { IssueCopyIcon } from "./components/issue-copy-icon";
import { nestedIssueRows } from "./issue-nesting";
import { IssueGroupOrderEditor } from "./issue-group-order-editor";
import { IssueFilterEmpty, IssueFilterEmptyArt } from "./issue-filter-empty";
import { projectPropertyFields } from "../shared/project-property-filter";
import { projectStatuses } from "./features/project-statuses";
import {
  projectStatistics,
  progressPercentage,
} from "../shared/milestone-progress";
import { StatusDurationValue } from "./status-duration-value";
import { issueDateFields } from "../shared/issue-date-presets";
import { relationFilters } from "../shared/issue-quick-filter";
import { CURRENT_USER_FILTER } from "../shared/current-user-filter";
import { AsksIssueConversation } from "./features/asks-conversation";
import {
  sortIssueView,
  availableIssueSortFields,
  type IssueSortRule,
} from "./issue-sort-rules";
import { IssueSortColumns } from "./issue-sort-columns";
import { IssueColumn, OrderedIssueColumns, IssueColumnEditor, ISSUE_COLUMN_HEADER_HEIGHT } from "./issue-column-editor";
import { issueColumnDefinitions, normalizeIssueColumnOrder, normalizeIssueColumnWidths, isIssueColumnVisible, setIssueColumnVisible, issueColumnSettingsFingerprint, withSavedIssueColumns } from "./issue-column-order";
import { IssueSortEditor } from "./issue-sort-editor";
import { migrateProfileDisplay, profileStatusOrder } from "./profile-display";
import { IssueFilterMenu, IssueFilterChips } from "./issue-filter-menu";
import { unwrapIssueFilter } from "./issue-filter-selection";
import {
  completedIssueVisible,
  orderCompletedIssues,
} from "./issue-completed-display";
import { PeekPreview } from "./peek-preview";
import {
  estimateOptions,
  issueEffort,
  estimateLabel,
} from "../shared/estimates";
import { IssueActivityTimeline } from "./issue-activity-timeline";
import { ScheduleView } from "./features/schedule-view";
import type { ScheduleOptions } from "./features/schedule-data";
import { formattingOnlyIssueActivity } from "./issue-history-content";
import { IssueSubscriberMenu } from "./issue-subscriber-menu";
import { dispatchWorkspaceCommand } from "./shortcut-actions";
import { InvitePersonDialog } from "./features/invite-and-assign";
import { priorityDropChanges } from "./priority-order";
import { useDragEdgeScroll } from "./drag-edge-scroll";
import { useBoardPan } from "./board-pan";
import { SelectionToolbarIcon } from "./selection-toolbar-icons";
import {
  observedActivityTime,
  myIssueTab,
  myIssueTabs,
  myIssueDisplay,
  profileIssueDisplay,
  myIssueActivity,
  myActivityVerb,
  myActivityDateLabel,
} from "./my-issues-state";
import { ViewSubscriptionMenu } from "./view-subscriptions";
import { SavedViewInlineEditor } from "./saved-view-inline-editor";
import {
  reorderIssueSelection,
  issueSelectionRange,
} from "./issue-selection-order";
import { selectedIssueListUrl } from "./selected-issue-list";
import { FilterGroups } from "./filter-groups";
import { filterConditionCount } from "../shared/filter-groups";
import { useRouteFilter } from "./use-route-filter";
import { supportsDateOn } from "../shared/relative-date-filter";
import { DateFilterValue } from "./date-filter-value";
import { filterLabelRecords } from "../shared/label-filter-values";
import { labelViewRoute } from "./label-view-route";
import { LabelViewOptions } from "./label-view-options";
import { issueSubscribedBy } from "../shared/issue-subscriptions";
import { RecurrenceDialog } from "./recurring-issues";
import { parseDueDate } from "./due-date-data";
import { DueDateIndicator, useCalendarDay } from "./due-date";
import { DocumentForm } from "./features/document-form";
import { EntityDocuments } from "./features/entity-documents";
import { parseLabelName } from "./label-name";
import { NativeControlIcon } from "./components/sidebar-icons";
import { NativeIssueActionIcon } from "./components/issue-action-icons";
import "./issue-visual.css";
import { reactionUsers, toggleReaction } from "../shared/reactions";
import { TriageActions } from "./triage-actions";
import {
  ViewSummary,
  matchesSummary,
  type SummarySelection,
} from "./view-summary";
import { ReminderBanner, openReminder } from "./reminders";
import { filterIncludesTriage } from "./triage-data";
import { parseInsightContext } from "./insight-context";
import { displayNameFor, attributedUser, creatorChoices } from "./display-name";
import {
  toggleIssueSubscription,
  isIssueSubscribed,
  sharedEstimateOptions,
} from "./issue-sharing";
import {
  IssueSharingControl,
  IssueSharingBanner,
  IssueSharingDialog,
} from "./issue-sharing";
import { richTextToMarkdown } from "./markdown";
import { pastedIssueTitles } from "./sub-issue-selection";
import {
  buildCustomerMetrics,
  withCustomerMetrics,
  usesCustomerMetrics,
  customerMetricFields,
} from "../shared/customer-metrics";
import { EntityCustomerRequests, RequestEditor } from "./features/customers";
import { EntityIcon, EntityIconPicker } from "./features/entity-icon";
import { EmojiPicker, EmojiGlyph } from "./components/emoji-picker";
import { IssueReactions } from "./issue-reactions";
import { IssueCommentComposer } from "./issue-comment-composer";
import { CommentDeleteDialog } from "./comment-delete";
import { commentThreads, threadIsResolved } from "./comment-threads";
import { SubIssues } from "./sub-issues";
import { IssueLifecycleDialog } from "./issue-lifecycle";
import { IssueRelations } from "./issue-relations";
import {
  issueGroupPatch,
  issueGroupCreationDefaults,
  issueGroupMoveError,
  nestIssueGroups,
  issueGroupPathPatch,
  type NestedIssueGroup,
  type IssueGroupPath,
} from "./issue-groups";
import { IssueSwimlaneBoard } from "./issue-swimlanes";
import "./issue-subgroups.css";
import {
  initialIssueFields,
  issueTemplates,
  templateFields,
  missingTemplateFields,
  incompleteTemplateFields,
} from "./template-utils";
import { FormTemplateFields } from "./templates";
import { prefilledIssueUrl } from "./new-issue-link";
import { SlaIndicator, SlaPicker, slaLabels } from "./slas";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { useVirtualizer, defaultRangeExtractor } from "@tanstack/react-virtual";
import type { Entity, Issue } from "../shared/types";
import { apiRequest, useAppStore } from "./store";
import { draftKey, saveDraft, removeDraft } from "./drafts";
import {
  Avatar,
  Badge,
  Button,
  DatePicker,
  Dropdown,
  EmptyState,
  Field,
  Icon,
  MenuItem,
  Modal,
  PriorityIcon,
  RichEditor,
  StatusIcon,
  TextInput,
} from "./components/ui";
import {
  matchesFilter,
  resolveMergedLabelId,
  relativeDate,
  sortEntities,
  textContent,
  type FilterSpec,
} from "./query";

export const priorities = ["No priority", "Urgent", "High", "Medium", "Low"];
function LabelGroupGlyph({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`label-group-glyph ${className}`.trim()}
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden="true"
    >
      <path d="M7.95021 6C8.91671 6 9.70021 5.2165 9.70021 4.25C9.70021 3.2835 8.91671 2.5 7.95021 2.5C6.98371 2.5 6.20021 3.2835 6.20021 4.25C6.20021 5.2165 6.98371 6 7.95021 6ZM4.4502 9.5C5.41669 9.5 6.2002 8.7165 6.2002 7.75C6.2002 6.7835 5.41669 6 4.4502 6C3.4837 6 2.7002 6.7835 2.7002 7.75C2.7002 8.7165 3.4837 9.5 4.4502 9.5ZM7.95018 13C8.91668 13 9.70018 12.2165 9.70018 11.25C9.70018 10.2835 8.91668 9.5 7.95018 9.5C6.98369 9.5 6.20018 10.2835 6.20018 11.25C6.20018 12.2165 6.98369 13 7.95018 13ZM13.2002 7.75C13.2002 8.7165 12.4167 9.5 11.4502 9.5C10.4837 9.5 9.7002 8.7165 9.7002 7.75C9.7002 6.7835 10.4837 6 11.4502 6C12.4167 6 13.2002 6.7835 13.2002 7.75Z" />
    </svg>
  );
}
export function openComposer(defaults: Record<string, any> = {}) {
  window.dispatchEvent(new CustomEvent("create-issue", { detail: defaults }));
}
export function active(items: Entity[]) {
  return items.filter((e) => !e.deletedAt && !e.archivedAt);
}
export function issueName(issue: Partial<Entity>) {
  return issue.identifier ?? `ISS-${issue.number ?? "…"}`;
}
type Property =
  | "statusId"
  | "priority"
  | "assigneeId"
  | "projectId"
  | "cycleId"
  | "labelIds"
  | "estimate"
  | "teamId"
  | "milestoneId";
export function PropertyPicker({
  field,
  value,
  onChange,
  teamId,
  projectId,
  compact = false,
  emptyLabel,
  optionsOverride,
  actionMenu = false,
  detail: detailRequested = false,
  inline = false,
  triggerClassName,
  children,
}: {
  field: Property;
  value: any;
  onChange: (value: any) => void;
  teamId?: string;
  projectId?: string;
  compact?: boolean;
  emptyLabel?: string;
  optionsOverride?: any[];
  actionMenu?: boolean;
  detail?: boolean;
  inline?: boolean;
  triggerClassName?: string;
  children?: React.ReactNode;
}) {
  const detail = detailRequested || inline;
  const { data, user, create } = useAppStore();
  const creatingLabel = useRef(false);
  const [inviting, setInviting] = useState(false);
  const [expandedLabelGroups, setExpandedLabelGroups] = useState<string[]>([]);
  const [labelError, setLabelError] = useState(""),
    [labelBusy, setLabelBusy] = useState(false);
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState(0),
    [rect, setRect] = useState<DOMRect>();
  const ref = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  useInlineMenuPosition(open && inline, ref, popup);
  const projectMemberIds = new Set<string>(data.projects.find(project => project.id === projectId)?.memberIds || []);
  const assigneeGroup = (id: string) => projectMemberIds.has(id) ? "Project members" : "Team members";
  const options = useMemo(() => {
    if (optionsOverride) return optionsOverride;
    if (field === "priority")
      return priorities.map((name, id) => ({ id, name }));
    if (field === "estimate") {
      let team = data.teams.find((t) => t.id === teamId);
      const visited = new Set<string>();
      while (team?.inheritEstimates && team.parentId && !visited.has(team.id)) {
        visited.add(team.id);
        team = data.teams.find((t) => t.id === team!.parentId) ?? team;
      }
      return estimateOptions(team, open
        ? [...data.issues.filter(issue => issue.teamId === teamId && !issue.deletedAt).map(issue => issue.estimate), value]
        : [value]);
    }
    const kind = (
      {
        statusId: "statuses",
        assigneeId: "users",
        projectId: "projects",
        cycleId: "cycles",
        labelIds: "labels",
        teamId: "teams",
        milestoneId: "milestones",
      } as const
    )[field];
    const teamScope = new Set<string>();
    let ancestor = data.teams.find((t) => t.id === teamId);
    while (ancestor && !teamScope.has(ancestor.id)) {
      teamScope.add(ancestor.id);
      ancestor = data.teams.find((t) => t.id === ancestor?.parentId);
    }
    let items = (
      field === "labelIds"
        ? data[kind].filter(
            (item) =>
              !item.deletedAt &&
              (!item.archivedAt || (value || []).includes(item.id)),
          )
        : active(data[kind])
    ).filter((e) =>
      field === "statusId" || field === "cycleId"
        ? e.teamId === teamId
        : field === "milestoneId"
          ? e.projectId === projectId
          : field === "labelIds"
            ? (!e.entityType || e.entityType === "issues") &&
              (!e.teamId || teamScope.has(e.teamId))
            : true,
    );
    if (field === "assigneeId")
      items = items
        .map((item) => ({
          ...item,
          name: displayNameFor(item, data),
        }))
        .sort((a, b) =>
          a.id === user?.id
            ? -1
            : b.id === user?.id
              ? 1
              : (inline ? Number(projectMemberIds.has(b.id)) - Number(projectMemberIds.has(a.id)) : 0) || String(a.name).localeCompare(String(b.name)),
        );
    if (field === "projectId" && teamId)
      items = items
        .filter(
          (item) => item.teamId === teamId || item.teamIds?.includes(teamId),
        )
        .sort((a, b) => String(a.name).localeCompare(String(b.name)));
    if (field === "labelIds") {
      const groups: any[] = active(data.labelGroups)
        .filter(
          (group) =>
            (group.entityType || "issues") === "issues" &&
            (!group.teamId || teamScope.has(group.teamId)),
        )
        .sort((a, b) => String(a.name).localeCompare(String(b.name)))
        .map((group) => ({ ...group, groupHeader: true }));
      const visibleLabels = items.filter(
        (label) =>
          (!label.labelGroupId && !label.group) ||
          !!query ||
          expandedLabelGroups.includes(
            label.labelGroupId ||
              groups.find((group) => group.name === label.group)?.id,
          ),
      );
      items = [...groups, ...visibleLabels];
    }
    if (field === "statusId")
      items.sort(
        (a, b) =>
          (a.position ?? a.sortOrder ?? 0) - (b.position ?? b.sortOrder ?? 0),
      );
    if (!["teamId", "labelIds", "statusId"].includes(field))
      items = [
        { id: null, name: `No ${field.replace("Id", "")}` } as any,
        ...items,
      ];
    return items;
  }, [
    data,
    field,
    teamId,
    projectId,
    optionsOverride,
    open,
    value,
    user?.id,
    expandedLabelGroups,
    query,
  ]);
  const filtered: any[] = options.filter((e) =>
    String(
      field === "labelIds" && e.group ? e.group + "/" + e.name : (e.name ?? ""),
    )
      .toLowerCase()
      .includes((field === "projectId" ? query.trim() : query.replace(":", "/")).toLowerCase()),
  );
  const createProjectOnly = field === "projectId" && !optionsOverride && !!query.trim() && !filtered.length;
  if (createProjectOnly) filtered.push({ id: "create-project", name: `Create ${query.trim()}`, createProject: true });
  const newLabel =
    field === "labelIds" && !optionsOverride ? parseLabelName(query) : null;
  if (newLabel) {
    for (const scope of [null, ...(teamId ? [teamId] : [])]) {
      const exists = options.some(
        (item) =>
          (item.teamId || null) === scope &&
          String(item.name).toLocaleLowerCase() ===
            newLabel.name.toLocaleLowerCase() &&
          (item.group || "").toLocaleLowerCase() ===
            (newLabel.group || "").toLocaleLowerCase(),
      );
      if (!exists)
        filtered.push({
          id: "create-label:" + (scope || "workspace"),
          name: `Create “${newLabel.group ? newLabel.group + "/" : ""}${newLabel.name}” in ${scope ? data.teams.find((t) => t.id === scope)?.name || "team" : "Workspace"}`,
          createLabel: {
            ...newLabel,
            teamId: scope,
            entityType: "issues",
            color: "#7775df",
          },
        });
    }
  }
  const option = options.find((e) => e.id === value);
  const label =
    emptyLabel &&
    (value == null ||
      value === "" ||
      (field === "priority" && value === 0) ||
      (Array.isArray(value) && !value.length))
      ? emptyLabel
      : field === "labelIds"
        ? `${value?.length ? value.length + " labels" : "Labels"}`
        : (option?.name ??
          (
            {
              statusId: "Status",
              priority: "Priority",
              assigneeId: "No assignee",
              projectId: "No project",
              cycleId: "No cycle",
              milestoneId: "No milestone",
              estimate: "No estimate",
              teamId: "Team",
            } as Record<string, string>
          )[field] ??
          field);
  const optionName = (item: any) => detail && field === "estimate" && item.id != null && /^\d+$/.test(item.name)
    ? `${item.id} ${item.id === 1 ? "Point" : "Points"}` : item.name;
  const leading = (item: any) =>
    item.createProject ? <Icon name="Plus" size={16} /> : field === "statusId" ? (
      detail &&
      (item.type === "duplicate" ||
        item.name?.toLowerCase() === "duplicate") ? (
        <svg
          className="issue-detail-duplicate-icon"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          aria-hidden="true"
          style={{ color: item.color }}
        >
          <circle cx="8" cy="8" r="6.5" fill="currentColor" />
          <path
            d="m4.5 9 4.5-4.5M7 11.5 11.5 7"
            fill="none"
            stroke="var(--panel)"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <StatusIcon status={item} />
      )
    ) : field === "priority" ? (
      <PriorityIcon priority={item.id} />
    ) : field === "assigneeId" ? (
      <Avatar user={item.id ? item : null} />
    ) : field === "estimate" ? (
      item.id == null ? <Icon name="CircleDashed" size={16} /> : <EntityIcon
        entity={{ icon: "Estimate", color: "var(--muted)" }}
        size={15}
      />
    ) : field === "projectId" && item.id ? (
      <EntityIcon entity={item} size={16} />
    ) : field === "labelIds" ? (
      item.groupHeader ? (
        <LabelGroupGlyph className="property-label-group-glyph" />
      ) : (
        <span
          className="property-label-color"
          style={{ backgroundColor: item.color || "var(--muted)" }}
          aria-hidden="true"
        />
      )
    ) : (
      <Icon
        name={
          field === "teamId"
            ? "Users"
            : field === "projectId"
              ? "Box"
              : field === "cycleId"
                ? "Repeat"
                : "Diamond"
        }
        size={15}
      />
    );
  const openNewProject = () => {
    setOpen(false);
    window.dispatchEvent(new CustomEvent("workspace-command", {
      detail: { command: "new-project", value: query.trim() },
    }));
  };
  const choose = (item: any) => {
    if (item.createProject) { openNewProject(); return; }
    if (
      creatingLabel.current ||
      (field === "labelIds" &&
        item.archivedAt &&
        !(value || []).includes(item.id))
    )
      return;
    if (field === "labelIds" && item.groupHeader) {
      setExpandedLabelGroups((groups) =>
        groups.includes(item.id)
          ? groups.filter((id) => id !== item.id)
          : [...groups, item.id],
      );
      return;
    }
    if (item.createLabel) {
      const draft = item.createLabel;
      if (
        draft.group &&
        data.labels.filter(
          (label) =>
            !label.deletedAt &&
            (label.teamId || null) === (draft.teamId || null) &&
            (label.entityType || "issues") === "issues" &&
            (label.group || "").toLocaleLowerCase() ===
              draft.group.toLocaleLowerCase(),
        ).length >= 250
      ) {
        setLabelError("A label group can contain at most 250 labels");
        return;
      }
      creatingLabel.current = true;
      setLabelBusy(true);
      setLabelError("");
      void create("labels", item.createLabel)
        .then((created) => {
          creatingLabel.current = false;
          choose(created);
          setQuery("");
          setSelected(0);
        })
        .catch((error) =>
          setLabelError(error instanceof Error ? error.message : String(error)),
        )
        .finally(() => {
          creatingLabel.current = false;
          setLabelBusy(false);
        });
      return;
    }
    onChange(
      field === "labelIds"
        ? (value ?? []).includes(item.id)
          ? value.filter((id: string) => id !== item.id)
          : [
              ...(value ?? []).filter(
                (id: string) =>
                  !item.group ||
                  !options.some(
                    (label: any) =>
                      label.id === id && label.group === item.group,
                  ),
              ),
              item.id,
            ]
        : item.id,
    );
    if (field !== "labelIds") setOpen(false);
  };
  useEffect(() => {
    if (open) setSelected(field === "priority" || detail
      ? Math.max(0, options.findIndex(item => item.id === value)) : 0);
    // Opening resolves imported estimate options; initialize against that list.
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (
        !popup.current?.contains(e.target as Node) &&
        !ref.current?.contains(e.target as Node)
      )
        setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (!popup.current?.contains(e.target as Node) && !ref.current?.contains(e.target as Node)) return;
      if (inline && field === "assigneeId" && !query && /^[01]$/.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const item = options.find(option => option.id === (e.key === "0" ? null : user?.id));
        if (item) { e.preventDefault(); e.stopPropagation(); choose(item); }
        return;
      }
      if (
        detail &&
        field === "statusId" &&
        !query &&
        /^[1-9]$/.test(e.key) &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.isComposing
      ) {
        const item = filtered[Number(e.key) - 1];
        if (item) {
          e.preventDefault();
          e.stopPropagation();
          choose(item);
        }
        return;
      }
      if (
        field === "priority" &&
        !query &&
        /^[0-4]$/.test(e.key) &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        e.preventDefault();
        e.stopPropagation();
        const item = options.find((option) => option.id === Number(e.key));
        if (item) choose(item);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        requestAnimationFrame(() =>
          ref.current?.focus({ preventScroll: true }),
        );
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setSelected(
          (i) =>
            (i + (e.key === "ArrowDown" ? 1 : filtered.length - 1)) %
            Math.max(1, filtered.length),
        );
      }
      if (e.key === "Enter" && filtered[selected]) {
        e.preventDefault();
        e.stopPropagation();
        choose(filtered[selected]);
      }
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("keydown", key, true);
    };
  }, [open, filtered, selected, value]);
  return (
    <>
      <button
        ref={ref}
        data-property={field}
        type="button"
        className={triggerClassName || `property-button ${compact ? "compact" : ""} ${actionMenu ? "issue-primary-action-button" : ""}`}
        aria-label={`Change ${field.replace(/Ids?$/, "")}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onKeyDown={(e) => { e.stopPropagation(); }}
        onClick={(e) => {
          e.stopPropagation();
          setRect(ref.current?.getBoundingClientRect());
          setQuery("");
          setLabelError("");
          setOpen(!open);
        }}
      >
        {children ?? (
          <>
            {leading(option ?? { id: value })}
            <span>{label}</span>
          </>
        )}
      </button>
      {open &&
        rect &&
        createPortal(
          <div
            ref={popup}
            className={`menu property-menu ${detail ? "issue-detail-property-menu" : ""} ${inline ? "inline-issue-property-menu" : ""} ${field === "priority" ? "priority-property-menu" : ""}`}
            data-property-menu={field}
            role={detail ? "dialog" : undefined}
            aria-label={detail ? "Menu" : undefined}
            style={{
              position: "fixed",
              left: actionMenu
                ? rect.right + 4 + 270 < innerWidth
                  ? rect.right + 4
                  : Math.max(8, rect.left - 274)
                : detail
                  ? Math.round(
                      field === "labelIds" ? rect.left - 212 : rect.left,
                    )
                  : Math.min(
                      rect.left,
                      innerWidth - (field === "priority" ? 216 : 270),
                    ),
              top: actionMenu
                ? Math.max(
                    8,
                    Math.min(
                      rect.top,
                      innerHeight - Math.min(360, filtered.length * 32 + 55),
                    ),
                  )
                : detail
                  ? Math.round(
                      field === "labelIds" ? rect.top - 4 : rect.bottom + 4,
                    )
                  : field === "priority"
                    ? Math.round(Math.min(rect.bottom + 4, innerHeight - 219))
                    : Math.min(rect.bottom + 6, innerHeight - 360),
            }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {detail && (
              <span className="native-visually-hidden" role="status">
                Showing all items
              </span>
            )}
            <input
              autoFocus
              role={detail ? "searchbox" : undefined}
              aria-label={
                detail
                  ? (
                      {
                        statusId: "Change status…",
                        priority: "Change priority to…",
                        assigneeId: "Assign to…",
                        estimate: "Change estimate to…",
                        labelIds: "Add labels…",
                        projectId: "Add to project…",
                      } as Partial<Record<Property, string>>
                    )[field]
                  : undefined
              }
              aria-expanded={detail ? true : undefined}
              aria-controls={
                detail ? `issue-detail-${field}-options` : undefined
              }
              aria-activedescendant={
                detail && filtered[selected]
                  ? `issue-detail-${field}-option-${selected}`
                  : undefined
              }
              placeholder={
                detail
                  ? ((
                      {
                        statusId: "Change status…",
                        priority: "Change priority to…",
                        assigneeId: "Assign to…",
                        estimate: "Change estimate to…",
                        labelIds: "Add labels…",
                        projectId: "Add to project…",
                      } as Partial<Record<Property, string>>
                    )[field] ?? `Search ${field.replace(/Ids?$/, "")}…`)
                  : field === "priority"
                    ? "Change priority to…"
                    : `Search ${field.replace(/Ids?$/, "")}…`
              }
              value={query}
              disabled={labelBusy}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelected(0);
              }}
            />
            {(field === "priority" ||
              (detail &&
                [
                  "statusId",
                  "assigneeId",
                  "estimate",
                  "labelIds",
                  "projectId",
                ].includes(field))) && (
              <kbd className="priority-menu-shortcut" aria-hidden="true">
                {
                  (
                    {
                      priority: "P",
                      statusId: "S",
                      assigneeId: "A",
                      estimate: "⇧ E",
                      labelIds: "L",
                      projectId: "⇧ P",
                    } as Partial<Record<Property, string>>
                  )[field]
                }
              </kbd>
            )}
            <div
              className="menu-scroll"
              role={detail ? "listbox" : undefined}
              id={detail ? `issue-detail-${field}-options` : undefined}
            >
              {filtered.length ? (
                filtered.map((item, i) => (
                  <React.Fragment key={String(item.id)}>
                    {detail &&
                      field === "assigneeId" &&
                      item.id !== null &&
                      item.id !== user?.id &&
                      (inline
                        ? assigneeGroup(filtered.slice(0, i).filter(row => row.id != null && row.id !== user?.id).at(-1)?.id) !== assigneeGroup(item.id) || filtered.slice(0, i).every(row => row.id === null || row.id === user?.id)
                        : filtered.slice(0, i).every(row => row.id === null || row.id === user?.id)) && (
                        <div
                          className="property-menu-group"
                          role="group"
                          aria-label={inline ? assigneeGroup(item.id) : "Team members"}
                        >
                          {inline ? assigneeGroup(item.id) : "Team members"}
                        </div>
                      )}
                    {detail &&
                      field === "projectId" &&
                      !item.createProject &&
                      item.id !== null &&
                      filtered.slice(0, i).every((row) => row.id === null) && (
                        <div
                          className="property-menu-group"
                          role="group"
                          aria-label={`Projects in ${data.teams.find((team) => team.id === teamId)?.name || "team"} team`}
                        >
                          Projects in{" "}
                          {data.teams.find((team) => team.id === teamId)
                            ?.name || "team"}{" "}
                          team
                        </div>
                      )}
                    <button
                      type="button"
                      role={detail ? "option" : undefined}
                      aria-label={detail ? optionName(item) : undefined}
                      id={
                        detail ? `issue-detail-${field}-option-${i}` : undefined
                      }
                      aria-selected={detail ? i === selected : undefined}
                      disabled={
                        labelBusy ||
                        (field === "labelIds" &&
                          !!item.archivedAt &&
                          !(value || []).includes(item.id))
                      }
                      data-tooltip={
                        field === "labelIds"
                          ? item.description || undefined
                          : undefined
                      }
                      className={`menu-item ${i === selected ? "selected" : ""}`}
                      onMouseEnter={() => setSelected(i)}
                      onClick={() => choose(item)}
                    >
                      {leading(item)}
                      <span>
                        {optionName(item)}
                      </span>
                      {(field === "labelIds"
                        ? (value ?? []).includes(item.id)
                        : value === item.id) && <Icon name="Check" size={14} />}
                      {(field === "priority" ||
                        (detail && field === "statusId" && !query) ||
                        (inline && field === "assigneeId" && !query && (item.id == null || item.id === user?.id))) && (
                        <kbd aria-hidden="true">
                          {field === "priority" ? item.id : field === "assigneeId" ? item.id == null ? 0 : 1 : i + 1}
                        </kbd>
                      )}
                      {item.groupHeader && (
                        <Icon
                          name={
                            expandedLabelGroups.includes(item.id)
                              ? "ChevronDown"
                              : "ChevronRight"
                          }
                          size={12}
                        />
                      )}
                    </button>
                  </React.Fragment>
                ))
              ) : detail && field === "labelIds" && !query ? (
                <button
                  type="button"
                  role="option"
                  aria-selected="false"
                  className="menu-item"
                  disabled
                >
                  <Icon name="Plus" size={14} />
                  <span>Start typing to create a new label</span>
                </button>
              ) : (
                <div className="menu-empty">No results</div>
              )}
              {detail && field === "assigneeId" && !optionsOverride && (
                <>
                  <div
                    className="property-menu-group"
                    role="group"
                    aria-label="New user"
                  >
                    New user
                  </div>
                  <button
                    type="button"
                    role="option"
                    className="menu-item"
                    onClick={() => {
                      setOpen(false);
                      setInviting(true);
                    }}
                  >
                    Invite and assign…
                  </button>
                </>
              )}
              {detail && field === "projectId" && !optionsOverride && !createProjectOnly && (
                <>
                  {inline && value && <Link className="menu-item" to={`/project/${value}`} onClick={() => setOpen(false)}><Icon name="ArrowUpRight" size={16}/><span>Open project</span></Link>}
                  <div
                    className="property-menu-group"
                    role="group"
                    aria-label="New project"
                  >
                    New project
                  </div>
                  <button
                    type="button"
                    role="option"
                    className="menu-item"
                    onClick={openNewProject}
                  >
                    Create new project…
                  </button>
                </>
              )}
            </div>
            {field === "assigneeId" && !detail && !optionsOverride && (
              <button
                type="button"
                className="menu-item"
                onClick={() => {
                  setOpen(false);
                  setInviting(true);
                }}
              >
                Invite and assign…
              </button>
            )}
            {labelError && (
              <p className="error-text" role="alert">
                {labelError}
              </p>
            )}
          </div>,
          document.body,
        )}
      {inviting && (
        <InvitePersonDialog
          teamId={teamId}
          onClose={() => setInviting(false)}
          onInvited={(id) => onChange(id)}
        />
      )}
    </>
  );
}

function InlineIssueComposerFrame({
  children,
  className = "",
}: React.ComponentProps<typeof Modal>) {
  return (
    <section
      className={`${className} inline-subissue-composer`.trim()}
      aria-label="Create sub-issue"
    >
      {children}
    </section>
  );
}

export function IssueComposer({
  defaults,
  onClose,
  inline = false,
}: {
  defaults: Record<string, any>;
  onClose: () => void;
  inline?: boolean;
}) {
  const store = useAppStore();
  const composerLayout = useComposerFieldLayout();
  const firstTeam = defaults.teamId ?? store.data.teams[0]?.id;
  const [fields, setFields] = useState<Record<string, any>>(() => ({
    ...initialIssueFields(defaults, store.data, store.user?.id),
    ...(defaults.assigneeId !== undefined
      ? { assigneeId: defaults.assigneeId }
      : !defaults.parentId && store.user?.preferences?.autoAssign
        ? { assigneeId: store.user?.id }
        : {}),
    ...(defaults.__draftId ? defaults : {}),
    ...(defaults.__multiple || defaults.__multipleTitles?.length
      ? {
          __multiple: true,
          __multipleText:
            defaults.__multipleText ??
            defaults.__multipleTitles?.join("\n") ??
            "",
        }
      : {}),
  }));
  const [expanded, setExpanded] = useState(!!defaults.expanded),
    [more, setMore] = useState(inline ? false : !!defaults.parentId),
    [discard, setDiscard] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [due, setDue] = useState(false),
    [recurring, setRecurring] = useState(!!defaults.__recurring),
    [linkRequest, setLinkRequest] = useState(0),
    [customerRequestIssueId, setCustomerRequestIssueId] = useState<string | null>(null);
  const navigate = useNavigate();
  const savedDraftId = useRef(defaults.__draftId ?? crypto.randomUUID());
  const draftStorage = draftKey(store.user!.id, store.data.workspaceId);
  const draftSubmitted = useRef(false);
  const draftStorageFailed = useRef(false);
  const initialTemplateApplied = useRef(!store.initialSyncing);
  useEffect(() => {
    if (!store.initialSyncing && !initialTemplateApplied.current) {
      initialTemplateApplied.current = true;
      setFields((old) =>
        old.title.trim() || textContent(old.description) || old.templateId
          ? old
          : {
              ...old,
              ...initialIssueFields(
                { ...defaults, teamId: old.teamId },
                store.data,
                store.user?.id,
              ),
            },
      );
    }
  }, [store.initialSyncing]);
  useEffect(() => {
    if (!draftSubmitted.current) {
      const saved = saveDraft(draftStorage, savedDraftId.current, fields);
      if (!saved && !draftStorageFailed.current)
        store.toast(
          "This draft could not be saved on this device. It is preserved in this window; keep the app open until storage is available.",
        );
      draftStorageFailed.current = !saved;
    }
  }, [fields]);
  const set = (key: string, value: any) =>
    setFields((old) => ({ ...old, [key]: value }));
  const multiple = !!fields.__multiple;
  const titles = multiple
    ? pastedIssueTitles(fields.__multipleText ?? "")
    : [fields.title.trim()].filter(Boolean);
  const close = () => {
    if (titles.length || textContent(fields.description)) setDiscard(true);
    else onClose();
  };
  const selectedTemplate =
    store.data.templates.find((t) => t.id === fields.templateId) ??
    (fields.templateId === fields.__template?.id
      ? fields.__template
      : undefined);
  const missingFields = missingTemplateFields(
    selectedTemplate,
    fields,
    store.data.labels,
  );
  const submit = async (
    keepProperties = false,
    followUp?: "customer-request" | "sub-issue",
  ) => {
    if (busy) return;
    if (!titles.length) {
      if (followUp) {
        setError("Add an issue title before continuing.");
          document
            .querySelector<HTMLInputElement>(".issue-composer .issue-title-input")
            ?.focus();
      } else
        store.toast(
          "Title required — We couldn't generate one automatically. Please enter a title before submitting.",
        );
      return;
    }
    if (titles.length > 1000) {
      setError("Create up to 1,000 issues at a time.");
      return;
    }
    if (missingFields.length) {
      setError(`Complete required fields: ${missingFields.join(", ")}`);
      const first = incompleteTemplateFields(
        selectedTemplate,
        fields,
        store.data.labels,
      )[0];
      const group = Array.from(
        document.querySelectorAll<HTMLElement>(
          ".issue-composer [data-template-field-id]",
        ),
      ).find((element) => element.dataset.templateFieldId === first?.id);
      group
        ?.querySelector<HTMLElement>("input,textarea,select,button,[tabindex] ")
        ?.focus();
      return;
    }
    setBusy(true);
    try {
      const {
        __draftId,
        __parentFor,
        __template,
        __multiple,
        __multipleText,
        __multipleTitles,
        expanded,
        ...payload
      } = fields;
      if (__parentFor && multiple)
        throw new Error("Create one parent issue at a time.");
      const parentCreateId = __parentFor ? crypto.randomUUID() : undefined;
      const createdOrUpdated = __parentFor
        ? await store.batch([
            {
              kind: "issues",
              action: "create",
              data: { ...payload, id: parentCreateId, title: titles[0] },
            },
            {
              kind: "issues",
              id: __parentFor.id,
              expectedVersion: __parentFor.version,
              data: { parentId: parentCreateId },
            },
          ])
        : multiple
          ? await store.batch(
              titles.map((title) => ({
                kind: "issues" as const,
                action: "create" as const,
                data: { ...payload, title },
              })),
            )
          : [await store.create("issues", { ...payload, title: titles[0] })];
      const results = __parentFor
        ? createdOrUpdated.slice(0, 1)
        : createdOrUpdated;
      const result = results[0];
      draftSubmitted.current = true;
      removeDraft(draftStorage, savedDraftId.current);
      store.toast(
        results.length > 1
          ? `${results.length} issues created`
          : "Issue created",
        {
          label:
            results.length > 1 && fields.parentId
              ? "View sub-issues"
              : "Open issue",
          route: `/issues/${results.length > 1 && fields.parentId ? fields.parentId : result.id}`,
        },
      );
      if (followUp === "customer-request") {
        setCustomerRequestIssueId(result.id);
        navigate(`/issues/${result.id}`);
        return;
      }
      if (followUp === "sub-issue") {
        savedDraftId.current = crypto.randomUUID();
        draftSubmitted.current = false;
        setFields(
          initialIssueFields(
            { teamId: fields.teamId, parentId: result.id },
            store.data,
            store.user?.id,
          ),
        );
        setMore(true);
        requestAnimationFrame(() =>
          document
            .querySelector<HTMLInputElement>(".issue-title-input")
            ?.focus(),
        );
        return;
      }
      if (more || keepProperties) {
        savedDraftId.current = crypto.randomUUID();
        draftSubmitted.current = false;
        setFields((old) =>
          keepProperties || !defaults.parentId
            ? { ...old, title: "", description: "", __multipleText: "" }
            : initialIssueFields(
                { teamId: old.teamId, parentId: defaults.parentId },
                store.data,
                store.user?.id,
              ),
        );
        requestAnimationFrame(() =>
          document
            .querySelector<HTMLInputElement>(".issue-title-input")
            ?.focus(),
        );
      } else {
        onClose();
        if (defaults.expanded) navigate(`/issues/${result.id}`);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void submit(e.shiftKey);
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  });
  const ComposerFrame = inline ? InlineIssueComposerFrame : Modal;
  const estimateDisabled = store.data.teams.find(team => team.id === fields.teamId)?.estimateScale === "None";
  const composerContext = {
    customized: composerLayout.customized, inline, expanded, projectId: fields.projectId,
    estimateDisabled, dueDate: fields.dueDate, recurrence: fields.recurrence,
  };
  const effectiveLayout = composerLayoutForContext(composerLayout.layout, composerContext);
  const visibleFields = visibleComposerFields(effectiveLayout, composerContext);
  const composerProperties: (Property | ComposerField)[] = [...(inline ? ['teamId' as const] : []), ...visibleFields];
  const discardInline = () => {
    draftSubmitted.current = true;
    removeDraft(draftStorage, savedDraftId.current);
    onClose();
  };
  return (
    <>
      <ComposerFrame
        onClose={close}
        preserveCompositionEscape
        wide={expanded}
        className={`issue-composer ${expanded ? "expanded" : ""}`}
      >
        {!inline && <div className="composer-top">
          <PropertyPicker
            field="teamId"
            value={fields.teamId}
            onChange={(teamId) =>
              setFields(
                initialIssueFields(
                  {
                    teamId,
                    title: fields.title,
                    description: fields.description,
                    parentId: fields.parentId,
                    __multiple: fields.__multiple,
                    __multipleText: fields.__multipleText,
                  },
                  store.data,
                  store.user?.id,
                ),
              )
            }
          >
            <EntityIcon
              entity={
                store.data.teams.find((team) => team.id === fields.teamId) ?? {}
              }
              size={14}
            />
            <span>
              {store.data.teams.find((team) => team.id === fields.teamId)
                ?.key ?? "Team"}
            </span>
          </PropertyPicker>
          <Icon name="ChevronRight" size={12} />
          <span>New issue</span>
          <span className="spacer" />
          <Dropdown
            align="right"
            trigger={
              <button className="icon-button" aria-label="Apply template">
                <Icon name="FileText" />
              </button>
            }
          >
            {issueTemplates(store.data, fields.teamId, fields.parentId)
              .length ? (
              issueTemplates(store.data, fields.teamId, fields.parentId).map(
                (t) => (
                  <MenuItem
                    key={t.id}
                    icon="FileText"
                    onClick={() => {
                      setFields(templateFields(t, fields, store.data.labels));
                      setError("");
                    }}
                  >
                    {t.name}
                  </MenuItem>
                ),
              )
            ) : (
              <div className="menu-empty">No issue templates</div>
            )}
          </Dropdown>
          <button
            className="icon-button"
            aria-label={expanded ? "Collapse composer" : "Expand composer"}
            onClick={() => setExpanded(!expanded)}
          >
            <Icon name={expanded ? "Minimize2" : "Maximize2"} />
          </button>
          <button
            className="icon-button"
            aria-label="Close composer"
            onClick={close}
          >
            <Icon name="X" />
          </button>
        </div>}
        <div className="composer-body">
          {multiple ? (
            <>
              <label className="muted" htmlFor="multiple-issue-titles">
                One issue title per line · {titles.length}{" "}
                {fields.parentId ? "sub-issues" : "issues"}
              </label>
              <textarea
                id="multiple-issue-titles"
                autoFocus
                className="issue-title-input"
                disabled={busy}
                aria-label="Issue titles"
                placeholder="One issue title per line"
                value={fields.__multipleText ?? ""}
                rows={Math.min(10, Math.max(3, titles.length))}
                style={{
                  resize: "vertical",
                  width: "100%",
                  fontSize: "1.125rem",
                  lineHeight: 1.5,
                }}
                onChange={(e) =>
                  setFields((old) => ({
                    ...old,
                    __multipleText: e.target.value,
                    title: pastedIssueTitles(e.target.value)[0] ?? "",
                  }))
                }
              />
            </>
          ) : (
            <div className={inline ? "inline-subissue-title-row" : undefined}>
              {inline && (
                <PropertyPicker
                  compact
                  field="statusId"
                  value={fields.statusId}
                  teamId={fields.teamId}
                  onChange={(value) => set("statusId", value)}
                >
                  <StatusIcon
                    status={
                      store.data.statuses.find(
                        (status) => status.id === fields.statusId,
                      ) ?? {}
                    }
                  />
                </PropertyPicker>
              )}
              <input
                autoFocus
                className="issue-title-input"
                disabled={busy}
                aria-label="Issue title"
                placeholder="Issue title"
                value={fields.title}
                onChange={(e) => set("title", e.target.value)}
                onPaste={(e) => {
                  const pasted = pastedIssueTitles(
                    e.clipboardData.getData("text/plain"),
                  );
                  if (pasted.length > 1) {
                    e.preventDefault();
                    setFields((old) => ({
                      ...old,
                      __multiple: true,
                      __multipleText: pasted.join("\n"),
                      title: pasted[0],
                    }));
                  }
                }}
              />
            </div>
          )}
          <RichEditor
            issueFormatting
            ariaLabel={inline ? "Issue description" : undefined}
            openLinkRequest={linkRequest}
            value={fields.description}
            readOnly={busy}
            onChange={(v) => set("description", v)}
            placeholder="Add description…"
          />
          {selectedTemplate && (
            <>
              <div className="composer-template-label">
                <Icon name="FileText" size={13} />
                {selectedTemplate.name}
                {selectedTemplate.subIssues?.length > 0 && (
                  <span className="muted">
                    {" "}
                    · {selectedTemplate.subIssues.length} sub-issues
                  </span>
                )}
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Remove template"
                  onClick={() =>
                    setFields((old) => ({
                      ...old,
                      templateId: null,
                      templateAnswers: {},
                    }))
                  }
                >
                  <Icon name="X" size={12} />
                </button>
              </div>
              <FormTemplateFields
                template={selectedTemplate}
                fields={fields}
                onChange={(value) => {
                  setFields(value);
                  setError("");
                }}
              />
            </>
          )}
          <div className="composer-properties">
            {composerProperties.map((field) => {
              if (field === 'customers') return <CustomerPicker key={field} className="property-button" kind="issues" entity={fields} onChange={patch=>setFields(old=>({...old,...patch}))}/>;
              if (field === 'dueDate') return <Dropdown key={field} trigger={<button type="button" className="property-button" data-property="dueDate" aria-label="Set due date"><Icon name="Calendar" size={14}/>{fields.dueDate ? <time dateTime={fields.dueDate}>{parseDueDate(fields.dueDate)?.toLocaleDateString()}</time> : 'Due date'}</button>}><IssueDueMenu value={fields.dueDate} onRemove={() => set('dueDate', null)} onCustom={() => setDue(true)} onSelect={date => set('dueDate', date)}/></Dropdown>;
              if (field === 'recurrence') return <button key={field} type="button" className="property-button" data-property="recurrence" onClick={() => setRecurring(true)}><Icon name="Repeat" size={14}/>{fields.recurrence ? `Repeats ${fields.recurrence.frequency}` : 'Make recurring…'}</button>;
              return (
              <PropertyPicker
                key={field}
                field={field}
                value={fields[field]}
                teamId={fields.teamId}
                projectId={fields.projectId}
                emptyLabel={
                  {
                    priority: "Priority",
                    projectId: "Project",
                    estimate: "Estimate",
                  }[field as "priority" | "projectId" | "estimate"]
                }
                onChange={(v) =>
                  inline && field === "teamId"
                    ? setFields((old) =>
                        initialIssueFields(
                          {
                            teamId: v,
                            title: old.title,
                            description: old.description,
                            parentId: old.parentId,
                            __multiple: old.__multiple,
                            __multipleText: old.__multipleText,
                          },
                          store.data,
                          store.user?.id,
                        ),
                      )
                    : field === 'projectId' ? setFields(old => ({...old, projectId: v, milestoneId: old.projectId === v ? old.milestoneId : null})) : set(field, v)
                }
              />
            );})}
            <Dropdown
              menuClassName="composer-settings-menu"
              trapFocus
              trigger={
                <button
                  className="property-button icon-button"
                  aria-label="More actions"
                  title="Customize issue fields"
                >
                  <Icon name="MoreHorizontal" />
                </button>
              }
            >
              <ComposerFieldSettings layout={effectiveLayout} onChange={composerLayout.change} projectId={fields.projectId} estimateDisabled={estimateDisabled}/>
              <ComposerActions>
              <IssueActionFilter searchLabel="Filter issue actions">
                <span className="native-visually-hidden" role="status">
                  Showing all items
                </span>
                <MenuItem
                  icon="Link"
                  shortcut="⌃ L"
                  onClick={() => setLinkRequest((request) => request + 1)}
                >
                  Add link…
                </MenuItem>
                <MenuItem
                  icon="MessageSquare"
                  shortcut="⌃ R"
                  onClick={() => void submit(false, "customer-request")}
                >
                  Add customer request…
                </MenuItem>
                <MenuItem
                  icon="GitBranch"
                  shortcut="⌘ ⇧ O"
                  onClick={() => void submit(false, "sub-issue")}
                >
                  Add sub-issue
                </MenuItem>
              </IssueActionFilter>
              </ComposerActions>
            </Dropdown>
            {inline && (
              <>
                <span className="spacer" />
                <button
                  type="button"
                  className="composer-attach icon-button"
                  aria-label="Attach images, files, or videos"
                  disabled={busy}
                  onClick={(event) =>
                    event.currentTarget
                      .closest(".issue-composer")
                      ?.querySelector<HTMLInputElement>(
                        '.rich-editor input[type="file"]',
                      )
                      ?.click()
                  }
                >
                  <NativeIssueActionIcon name="attachment" width={16} height={16} />
                </button>
                <Button aria-label="Discard sub-issue" onClick={discardInline}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  disabled={busy}
                  onClick={(event) => void submit(event.shiftKey)}
                >
                  Create
                </Button>
              </>
            )}
          </div>
        </div>
        {!inline && <div className="composer-footer">
          <button
            type="button"
            className="composer-attach icon-button"
            aria-label={
              inline ? "Attach images, files, or videos" : "Attach files"
            }
            disabled={busy}
            onClick={(event) =>
              event.currentTarget
                .closest(".issue-composer")
                ?.querySelector<HTMLInputElement>(
                  '.rich-editor input[type="file"]',
                )
                ?.click()
            }
          >
            <NativeIssueActionIcon name="attachment" width={16} height={16} />
          </button>
          {error && (
            <span className="muted" role="alert">
              {error}
            </span>
          )}
          <span className="spacer" />
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={more}
              onChange={(e) => setMore(e.target.checked)}
            />
            Create more
          </label>
          <Button
            variant="primary"
            disabled={busy}
            onClick={(e) => void submit(e.shiftKey)}
          >
            {multiple
              ? `Create ${titles.length || "multiple"} issues`
              : "Create issue"}
          </Button>
        </div>}
      </ComposerFrame>
      {!inline && discard && (
        <Modal title="Discard this issue?" onClose={() => setDiscard(false)}>
          <div className="modal-body muted">
            Confirm that you want to discard this issue.
          </div>
          <div className="modal-footer">
            <Button onClick={() => setDiscard(false)}>Cancel</Button>
            <Button
              autoFocus
              variant="danger"
              onClick={() => {
                draftSubmitted.current = true;
                removeDraft(draftStorage, savedDraftId.current);
                onClose();
              }}
            >
              Discard
            </Button>
          </div>
        </Modal>
      )}
      {due && (
        <Modal title="Set due date" onClose={() => setDue(false)}>
          <div className="modal-body">
            <DatePicker
              value={fields.dueDate}
              onChange={(v) => set("dueDate", v)}
            />
          </div>
          <div className="modal-footer">
            <Button variant="primary" onClick={() => setDue(false)}>
              Apply date
            </Button>
          </div>
        </Modal>
      )}
      {customerRequestIssueId && (
        <RequestEditor
          issueId={customerRequestIssueId}
          onClose={() => {
            setCustomerRequestIssueId(null);
            onClose();
          }}
        />
      )}
      {recurring && (
        <RecurrenceDialog
          issue={fields}
          onClose={() => setRecurring(false)}
          onSave={(patch) => setFields((old) => ({ ...old, ...patch }))}
        />
      )}
    </>
  );
}

function InlineIssueActions({
  children,
}: {
  children: React.ReactNode;
  [key: string]: any;
}) {
  return <div className="issue-context-actions">{children}</div>;
}

export function IssueActions({
  onAddDocument,
  onClose,
  inline = false,
  issue,
  trigger,
  position,
  movePosition,
  showSubscriptionByDefault = false,
}: {
  issue: Entity;
  inline?: boolean;
  onAddDocument?: () => void;
  onClose?: () => void;
  trigger?: React.ReactNode;
  position?: { x: number; y: number };
  movePosition?: { index: number; count: number };
  showSubscriptionByDefault?: boolean;
}) {
  const MenuContainer = inline ? InlineIssueActions : Dropdown;
  // Positioned actions are owned by the row context state. Preserve that
  // owner while an action opens a dialog, then release it with the dialog.
  const preserveContextForLayer = useRef(false);
  const layerReturnFocus = useRef<HTMLElement | null>(null);
  const detailActionTrigger = useRef<HTMLButtonElement | null>(null);
  const openLayer = (show: () => void) => {
    if (position) {
      preserveContextForLayer.current = true;
      layerReturnFocus.current = document.querySelector<HTMLElement>(
        `[data-issue-id="${CSS.escape(issue.id)}"]`,
      );
    } else if (!inline) layerReturnFocus.current = detailActionTrigger.current;
    show();
  };
  const closeLayer = (hide: () => void) => {
    const returnFocus = layerReturnFocus.current;
    hide();
    if (position) onClose?.();
    if (returnFocus)
      requestAnimationFrame(() => {
        if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
      });
  };
  const store = useAppStore();
  const navigate = useNavigate();
  const [markAs, setMarkAs] = useState<MarkIssueType | null>(null);
  const [recurrenceOpen, setRecurrenceOpen] = useState(false);
  const [slaOpen, setSlaOpen] = useState(false),
    [sharing, setSharing] = useState(false),
    [customerRequest, setCustomerRequest] = useState(false),
    [lifecycle, setLifecycle] = useState<"duplicate" | "convert" | null>(null);
  const [dialog, setDialog] = useState<string | null>(null),
    [query, setQuery] = useState(""),
    [date, setDate] = useState(issue.dueDate ?? "");
  const [restoring, setRestoring] = useState(false),
    [restoreError, setRestoreError] = useState("");
  const update = (patch: Record<string, any>) =>
    store.update("issues", issue.id, patch);
  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    store.toast("Copied to clipboard");
  };
  useEffect(() => {
    const handler = (event: Event) => {
      const e = event as CustomEvent<{ command: string; value?: string }>;
      if (e.defaultPrevented || e.detail.value !== issue.id) return;
      if (e.detail.command === "issue-description-history") {
        e.preventDefault();
        setDialog("history");
        return;
      }
      if (issue.sharedAccess) return;
      if (e.detail.command === "convert-issue-to-recurring") {
        e.preventDefault();
        setRecurrenceOpen(true);
        return;
      }
      if (
        e.detail.command === "duplicate-issue" ||
        e.detail.command === "convert-issue-to-project"
      ) {
        e.preventDefault();
        setLifecycle(
          e.detail.command === "duplicate-issue" ? "duplicate" : "convert",
        );
      }
    };
    window.addEventListener("workspace-command", handler);
    return () => window.removeEventListener("workspace-command", handler);
  }, [issue.id, issue.sharedAccess]);
  return (
    <>
      <MenuContainer
        align="right"
        menuClassName={
          position ? "issue-context-menu" : "issue-detail-action-menu"
        }
        position={position}
        {...(!inline && position
          ? {
              onOpenChange: (open: boolean) => {
                if (!open) {
                  requestAnimationFrame(() => {
                    if (preserveContextForLayer.current)
                      preserveContextForLayer.current = false;
                    else onClose?.();
                  });
                }
              },
            }
          : {})}
        trigger={
          position ? (
            <span />
          ) : (
            (trigger ?? (
              <button
                ref={detailActionTrigger}
                className="icon-button"
                aria-label="Issue options"
              >
                <Icon name="MoreHorizontal" />
              </button>
            ))
          )
        }
      >
        <IssueActionFilter compact>
          <CustomerAssignmentControl kind="issues" entity={issue} label="Customers…"/>
          {position && (
            <span className="native-visually-hidden" role="status">
              Showing all items
            </span>
          )}
          {(inline || position) &&
            (
              [
                "statusId",
                "priority",
                "assigneeId",
                "dueDate",
                "labelIds",
                "projectId",
                "milestoneId",
                "estimate",
              ] as const
            )
              .filter((field) => field !== "milestoneId" || !movePosition)
              .map((field) =>
                field === "dueDate" ? (
                  <React.Fragment key={field}>
                    <IssueActionSubmenu
                      label="Due date"
                      icon="IssueActionDuedate"
                      shortcut="⇧ D"
                      filter={false}
                    >
                      <IssueDueMenu
                        onCustom={() => {
                          setDate(issue.dueDate ?? "");
                          openLayer(() => setDialog("due"));
                        }}
                        onSelect={(date) =>
                          void update({ dueDate: date }).catch((error) =>
                            store.toast(error.message),
                          )
                        }
                      />
                    </IssueActionSubmenu>
                  </React.Fragment>
                ) : (
                  <div
                    key={field}
                    className="issue-primary-action"
                    role="menuitem"
                    aria-label={
                      {
                        statusId: "Status",
                        priority: "Priority",
                        assigneeId: "Assignee",
                        labelIds: "Labels",
                        projectId: "Project",
                        milestoneId: "Milestone",
                        estimate: "Estimate",
                      }[field]
                    }
                    data-keep-open
                    aria-haspopup="menu"
                    tabIndex={-1}
                    onClick={(event) => {
                      if (event.target === event.currentTarget)
                        event.currentTarget
                          .querySelector<HTMLButtonElement>("button")
                          ?.click();
                    }}
                  >
                    <PropertyPicker
                      actionMenu
                      field={field}
                      value={issue[field]}
                      teamId={issue.teamId}
                      projectId={issue.projectId}
                      onChange={(value) =>
                        void update({ [field]: value }).catch((error) =>
                          store.toast(error.message),
                        )
                      }
                    >
                      <Icon
                        name={
                          "IssueActionB008" +
                          {
                            statusId: "Status",
                            priority: "Priority",
                            assigneeId: "Assignee",
                            labelIds: "Labels",
                            projectId: "Project",
                            milestoneId: "Project",
                            estimate: "Estimate",
                          }[field]
                        }
                        size={16}
                      />
                      <span>
                        {
                          {
                            statusId: "Status",
                            priority: "Priority",
                            assigneeId: "Assignee",
                            labelIds: "Labels",
                            projectId: "Project",
                            milestoneId: "Milestone",
                            estimate: "Estimate",
                          }[field]
                        }
                      </span>
                      <kbd>
                        {
                          {
                            statusId: "S",
                            priority: "P",
                            assigneeId: "A",
                            labelIds: "L",
                            projectId: "⇧ P",
                            milestoneId: "⇧ M",
                            estimate: "⇧ E",
                          }[field]
                        }
                      </kbd>
                      <span className="issue-menu-arrow" aria-hidden="true">
                        ▶
                      </span>
                    </PropertyPicker>
                  </div>
                ),
              )}
          {!(inline || position) && (
            <>
              {!issue.sharedAccess && (
                <IssueActionSubmenu
                  label="Team"
                  menuWidth={246}
                  icon="IssueActionTeam"
                  shortcut="⌘ ⇧ M"
                  filter={false}
                >
                  <IssueTeamMenu issue={issue} />
                </IssueActionSubmenu>
              )}
              <IssueActionSubmenu
                label="Due date"
                icon="IssueActionDuedate"
                shortcut="⇧ D"
                filter={false}
              >
                <IssueDueMenu
                  onCustom={() => {
                    setDate(issue.dueDate ?? "");
                    openLayer(() => setDialog("due"));
                  }}
                  onSelect={(date) =>
                    void update({ dueDate: date }).catch((error) =>
                      store.toast(error.message),
                    )
                  }
                />
              </IssueActionSubmenu>
            </>
          )}
          {(inline || position) && !issue.sharedAccess && (
            <IssueActionSubmenu
              label="More properties"
              icon="IssueActionB008Moreproperties"
            >
              {movePosition && (
                <div
                  className="issue-primary-action"
                  role="menuitem"
                  aria-label="Milestone"
                  data-keep-open
                  aria-haspopup="menu"
                  tabIndex={-1}
                  onClick={(event) => {
                    if (event.target === event.currentTarget)
                      event.currentTarget
                        .querySelector<HTMLButtonElement>("button")
                        ?.click();
                  }}
                >
                  <PropertyPicker
                    actionMenu
                    field="milestoneId"
                    value={issue.milestoneId}
                    teamId={issue.teamId}
                    projectId={issue.projectId}
                    onChange={(value) =>
                      void update({ milestoneId: value }).catch((error) =>
                        store.toast(error.message),
                      )
                    }
                  >
                    <Icon name="IssueActionB008Project" size={16} />
                    <span>Milestone</span>
                    <kbd>⇧ M</kbd>
                    <span className="issue-menu-arrow" aria-hidden="true">
                      ▶
                    </span>
                  </PropertyPicker>
                </div>
              )}
              <IssueActionSubmenu
                label="Team"
                menuWidth={246}
                icon="IssueActionTeam"
                shortcut="⌘ ⇧ M"
                filter={false}
              >
                <IssueTeamMenu issue={issue} />
              </IssueActionSubmenu>
              <MenuItem
                icon="IssueActionAddcustomerrequest"
                shortcut="⌃ R"
                onClick={() => openLayer(() => setCustomerRequest(true))}
              >
                Add customer request…
              </MenuItem>
            </IssueActionSubmenu>
          )}
          {onAddDocument && (
            <MenuItem
              icon="IssueActionAddlink"
              shortcut="⌃ L"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("workspace-command", {
                    detail: { command: "link-url" },
                    cancelable: true,
                  }),
                )
              }
            >
              Add link…
            </MenuItem>
          )}
          {!(inline || position) && !issue.sharedAccess && (
            <MenuItem
              icon="IssueActionAddcustomerrequest"
              shortcut="⌃ R"
              onClick={() => {
                const event = new CustomEvent("workspace-command", {
                  detail: {
                    command: "new-customer-request",
                    issueId: issue.id,
                  },
                  cancelable: true,
                });
                window.dispatchEvent(event);
                if (!event.defaultPrevented) openLayer(() => setCustomerRequest(true));
              }}
            >
              Add customer request…
            </MenuItem>
          )}
          {onAddDocument && (
            <MenuItem icon="IssueActionAdddocument" onClick={onAddDocument}>
              Add document…
            </MenuItem>
          )}
          {issue.canManageSharing && (
            <MenuItem icon="Users" onClick={() => openLayer(() => setSharing(true))}>
              Share issue
            </MenuItem>
          )}
          {!(inline || position) && (
            <MenuItem searchOnly icon="Flame" onClick={() => openLayer(() => setSlaOpen(true))}>
              Set SLA
            </MenuItem>
          )}

          <div className="menu-separator" />
          {!issue.sharedAccess && (
            <IssueActionSubmenu
              label="Create related"
              icon="IssueActionCreaterelated"
            >
              <MenuItem
                icon="Link"
                onClick={() =>
                  openComposer({
                    teamId: issue.teamId,
                    relations: [{ type: "related", issueId: issue.id }],
                  })
                }
              >
                Issue…
              </MenuItem>
              <MenuItem
                icon="Plus"
                shortcut="⌘ ⇧ O"
                onClick={() =>
                  openComposer({ teamId: issue.teamId, parentId: issue.id })
                }
              >
                Sub-issue…
              </MenuItem>
              <MenuItem
                icon="ArrowUp"
                onClick={() =>
                  openComposer({
                    teamId: issue.teamId,
                    __parentFor: { id: issue.id, version: issue.version },
                  })
                }
              >
                Parent issue…
              </MenuItem>
              <MenuItem
                icon="Ban"
                onClick={() =>
                  openComposer({
                    teamId: issue.teamId,
                    relations: [{ type: "blockedBy", issueId: issue.id }],
                  })
                }
              >
                Blocked issue…
              </MenuItem>
              <MenuItem
                icon="ArrowRight"
                onClick={() =>
                  openComposer({
                    teamId: issue.teamId,
                    relations: [{ type: "blocks", issueId: issue.id }],
                  })
                }
              >
                Blocking issue…
              </MenuItem>
            </IssueActionSubmenu>
          )}
          <IssueActionSubmenu label="Mark as" icon="IssueActionMarkas">
            {markIssueActions
              .filter(
                (action) =>
                  !issue.sharedAccess ||
                  ["related", "blockedBy", "blocks"].includes(action.type),
              )
              .map((action) => (
                <MenuItem
                  key={action.type}
                  icon={action.icon}
                  shortcut={"shortcut" in action ? action.shortcut : undefined}
                  onClick={() => openLayer(() => setMarkAs(action.type))}
                >
                  {action.label}
                </MenuItem>
              ))}
          </IssueActionSubmenu>
          <div className="menu-separator" />
          <IssueActionSubmenu label="Copy" icon="IssueActionCopy">
            <MenuItem
              icon="Copy"
              shortcut="⌘ ."
              onClick={() => copy(issueName(issue))}
            >
              Copy ID
            </MenuItem>
            <MenuItem
              icon="Link"
              shortcut="⌘ ⇧ ,"
              onClick={() => copy(`${location.origin}/issues/${issue.id}`)}
            >
              Copy URL
            </MenuItem>
            <MenuItem
              icon="Type"
              shortcut="⌘ ⇧ '"
              onClick={() => copy(issueName(issue) + ": " + issue.title)}
            >
              Copy title
            </MenuItem>
            <MenuItem
              icon="Link"
              shortcut="⌘ C"
              onClick={() =>
                copy(
                  "[" +
                    issueName(issue) +
                    ": " +
                    issue.title +
                    "](" +
                    location.origin +
                    "/issues/" +
                    issue.id +
                    ")",
                )
              }
            >
              Copy title as link
            </MenuItem>
            <MenuItem
              icon="FileText"
              onClick={() => copy(richTextToMarkdown(issue.description ?? ""))}
            >
              Copy description as Markdown
            </MenuItem>
            <MenuItem
              icon="FileText"
              onClick={() =>
                copy(
                  `# ${issueName(issue)} ${issue.title}\n\n${richTextToMarkdown(issue.description ?? "")}`,
                )
              }
            >
              Copy content as Markdown
            </MenuItem>
          </IssueActionSubmenu>

          {!issue.sharedAccess && !(inline || position) && (
            <MenuItem
              searchOnly
              icon="FileText"
              onClick={() => openLayer(() => setDialog("template"))}
            >
              Apply template
            </MenuItem>
          )}
          {!issue.sharedAccess && (
            <IssueActionSubmenu label="Convert to" icon="IssueActionConvertto">
              <MenuItem icon="Box" onClick={() => openLayer(() => setLifecycle("convert"))}>
                Project…
              </MenuItem>
              <MenuItem
                icon="FileText"
                onClick={() =>
                  navigate(
                    "/settings/templates?new=issue&fromIssue=" +
                      encodeURIComponent(issue.id),
                  )
                }
              >
                Template…
              </MenuItem>
              <MenuItem icon="Repeat" onClick={() => openLayer(() => setRecurrenceOpen(true))}>
                {issue.recurrence ? "Edit recurrence…" : "Recurring issue…"}
              </MenuItem>
            </IssueActionSubmenu>
          )}
          {!issue.sharedAccess && (
            <MenuItem
              icon="IssueActionMakeacopy"
              onClick={() => openLayer(() => setLifecycle("duplicate"))}
            >
              Make a copy…
            </MenuItem>
          )}
          {position && movePosition && (
            <IssueActionSubmenu
              label="Move"
              icon="Move"
              menuWidth={202}
              filter={false}
            >
              {movePosition.index > 0 && (
                <>
                  <MenuItem
                    icon="ArrowUp"
                    shortcut="⌥ ↑"
                    onClick={() =>
                      dispatchWorkspaceCommand({
                        command: "reorder-item",
                        value: "up",
                      })
                    }
                  >
                    Move up
                  </MenuItem>
                  <MenuItem
                    icon="ArrowUpToLine"
                    shortcut="⌥ ⇧ ↑"
                    onClick={() =>
                      dispatchWorkspaceCommand({
                        command: "reorder-item",
                        value: "top",
                      })
                    }
                  >
                    Move to top
                  </MenuItem>
                </>
              )}
              {movePosition.index < movePosition.count - 1 && (
                <>
                  <MenuItem
                    icon="ArrowDown"
                    shortcut="⌥ ↓"
                    onClick={() =>
                      dispatchWorkspaceCommand({
                        command: "reorder-item",
                        value: "down",
                      })
                    }
                  >
                    Move down
                  </MenuItem>
                  <MenuItem
                    icon="ArrowDownToLine"
                    shortcut="⌥ ⇧ ↓"
                    onClick={() =>
                      dispatchWorkspaceCommand({
                        command: "reorder-item",
                        value: "bottom",
                      })
                    }
                  >
                    Move to bottom
                  </MenuItem>
                </>
              )}
            </IssueActionSubmenu>
          )}
          {position && (
            <IssueActionSubmenu
              label="Open in"
              icon="IssueActionB008Openin"
              menuWidth={220}
              filter={false}
            >
              <MenuItem
                icon="ExternalLink"
                onClick={() =>
                  window.desktop
                    ? window.desktop.newTab(`/issues/${issue.id}`)
                    : window.open(
                        `/issues/${issue.id}`,
                        "_blank",
                        "noopener,noreferrer",
                      )
                }
              >
                Open in new tab
              </MenuItem>
              <MenuItem
                icon="ExternalLink"
                shortcut="⌃ ,"
                onClick={() =>
                  window.desktop
                    ? window.desktop.newWindow(`/issues/${issue.id}`)
                    : window.open(
                        `/issues/${issue.id}`,
                        "_blank",
                        "noopener,noreferrer",
                      )
                }
              >
                Open in new window
              </MenuItem>
            </IssueActionSubmenu>
          )}
          {!issue.sharedAccess && !(inline || position) && (
            <MenuItem
              searchOnly
              icon="Link"
              onClick={() => copy(prefilledIssueUrl(issue, location.origin))}
            >
              Copy pre-filled create issue URL
            </MenuItem>
          )}

          <div className="menu-separator" />
          <MenuItem
            icon="IssueActionFavorite"
            shortcut="⌥ F"
            onClick={async () => {
              const current = store.data.favorites.find(
                (f) => f.entityId === issue.id && f.userId === store.user?.id,
              );
              if (current) await store.remove("favorites", current.id);
              else
                await store.create("favorites", {
                  entityId: issue.id,
                  type: "issue",
                  userId: store.user?.id,
                  label: issue.title,
                  route: `/issues/${issue.id}`,
                });
            }}
          >
            {store.data.favorites.some(
              (f) => f.entityId === issue.id && !f.deletedAt,
            )
              ? "Remove favorite"
              : "Favorite"}
          </MenuItem>
          {!inline && (
            <MenuItem
              searchOnly={!showSubscriptionByDefault}
              icon="Bell"
              shortcut="⇧ S"
              onClick={() => void toggleIssueSubscription(store, issue)}
            >
              {isIssueSubscribed(store, issue) ? "Unsubscribe" : "Subscribe"}
            </MenuItem>
          )}
          <IssueActionSubmenu
            label="Remind me"
            menuWidth={305}
            icon="IssueActionRemindme"
            shortcut="⇧ H"
            filter={false}
          >
            <IssueReminderMenu issue={issue} />
          </IssueActionSubmenu>
          <div className="menu-separator" />
          {!(inline || position) && (
            <MenuItem
              icon="IssueActionShowdescriptionhistory"
              onClick={() => openLayer(() => setDialog("history"))}
            >
              Show description history
            </MenuItem>
          )}
          {issue.archivedAt && (
            <MenuItem icon="Archive" onClick={() => update({ archivedAt: null })}>
              Unarchive
            </MenuItem>
          )}
          <MenuItem
            icon="IssueActionDelete"
            shortcut="⌘ ⌫"
            onClick={() => openLayer(() => setDialog("delete"))}
          >
            Delete
          </MenuItem>
        </IssueActionFilter>
      </MenuContainer>
      {sharing && (
        <IssueSharingDialog issue={issue} onClose={() => closeLayer(() => setSharing(false))} />
      )}
      {customerRequest && (
        <RequestEditor
          issueId={issue.id}
          onClose={() => closeLayer(() => setCustomerRequest(false))}
        />
      )}
      {recurrenceOpen && (
        <RecurrenceDialog
          issue={issue}
          onClose={() => closeLayer(() => setRecurrenceOpen(false))}
          onSave={update}
        />
      )}
      {lifecycle && (
        <IssueLifecycleDialog
          issue={issue}
          mode={lifecycle}
          onClose={() => closeLayer(() => setLifecycle(null))}
        />
      )}
      {markAs && (
        <IssueMarkAs
          issue={issue}
          type={markAs}
          onClose={() => closeLayer(() => setMarkAs(null))}
        />
      )}
      {slaOpen && <SlaPicker issue={issue} onClose={() => closeLayer(() => setSlaOpen(false))} />}{" "}
      {dialog === "due" && (
        <IssueCustomDue
          value={date}
          onSave={(dueDate) => update({ dueDate })}
          onClose={() => closeLayer(() => setDialog(null))}
        />
      )}
      {dialog === "delete" && (
        <IssueDeleteConfirmation
          issues={[issue]}
          onClose={() => closeLayer(() => setDialog(null))}
          onConfirm={async () => {
            await store.remove("issues", issue.id);
            if (location.pathname === `/issues/${issue.id}`)
              navigate(`/team/${issue.teamId}/all`);
            store.toast("Issue moved to recently deleted");
          }}
        />
      )}
      {dialog === "history" && (
        <IssueDescriptionHistory
          issue={issue}
          onClose={() => closeLayer(() => setDialog(null))}
          onRestore={(description) => update({ description })}
        />
      )}
      {dialog &&
        dialog !== "due" &&
        dialog !== "delete" &&
        dialog !== "history" && (
          <Modal
            title={
              dialog === "delete"
                ? "Delete issue?"
                : dialog === "due"
                  ? "Set due date"
                  : dialog === "related"
                    ? "Add relation"
                    : dialog === "parent"
                      ? "Set parent issue"
                      : dialog === "template"
                        ? "Apply template"
                        : `Restore version for ${issueName(issue)} ${issue.title}`
            }
            onClose={() => closeLayer(() => setDialog(null))}
          >
            <div className="modal-body">
              {dialog === "delete" ? (
                <p>
                  Move <strong>{issueName(issue)}</strong> to recently deleted?
                  You can restore it from the archive.
                </p>
              ) : dialog === "due" ? (
                <DatePicker value={date} onChange={setDate} />
              ) : dialog === "history" ? (
                <div className="history-list">
                  {!store.data.activities.some(
                    (a) =>
                      a.entityId === issue.id &&
                      (a.field === "description" ||
                        a.changes?.description ||
                        a.before?.description),
                  ) && <p>There is no history yet.</p>}
                  {store.data.activities
                    .filter(
                      (a) =>
                        a.entityId === issue.id &&
                        (a.field === "description" ||
                          a.changes?.description ||
                          a.before?.description),
                    )
                    .sort(
                      (a, b) =>
                        Date.parse(b.createdAt) - Date.parse(a.createdAt),
                    )
                    .map((a) => (
                      <div className="card" key={a.id}>
                        <small>{new Date(a.createdAt).toLocaleString()}</small>
                        <RichEditor
                          readOnly
                          value={
                            a.before?.description ??
                            a.changes?.description?.from ??
                            a.oldValue ??
                            ""
                          }
                          onChange={() => {}}
                        />
                        <Button
                          disabled={restoring}
                          onClick={async () => {
                            if (restoring) return;
                            setRestoring(true);
                            setRestoreError("");
                            try {
                              await update({
                                description:
                                  a.before?.description ??
                                  a.changes?.description?.from ??
                                  a.oldValue ??
                                  "",
                              });
                              store.toast(
                                "Description restored. Use Undo to return to the previous version.",
                              );
                              setDialog(null);
                            } catch (error) {
                              setRestoreError((error as Error).message);
                            } finally {
                              setRestoring(false);
                            }
                          }}
                        >
                          Restore version
                        </Button>
                      </div>
                    ))}
                  <div className="card">
                    <small>Current version</small>
                    <RichEditor
                      readOnly
                      value={issue.description ?? ""}
                      onChange={() => {}}
                    />
                  </div>
                  {restoreError && (
                    <p className="error-text" role="alert">
                      {restoreError}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <TextInput
                    autoFocus
                    placeholder="Search…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <div className="selection-list">
                    {dialog === "template"
                      ? active(store.data.templates)
                          .filter(
                            (t) =>
                              (t.type === "issue" || !t.type) &&
                              t.name
                                .toLowerCase()
                                .includes(query.toLowerCase()),
                          )
                          .map((t) => (
                            <button
                              key={t.id}
                              className="menu-item"
                              onClick={() => {
                                void update({
                                  ...t.properties,
                                  description:
                                    t.description ?? issue.description,
                                });
                                setDialog(null);
                              }}
                            >
                              <Icon name="FileText" />
                              {t.name}
                            </button>
                          ))
                      : active(store.data.issues)
                          .filter(
                            (e) =>
                              e.id !== issue.id &&
                              `${issueName(e)} ${e.title}`
                                .toLowerCase()
                                .includes(query.toLowerCase()),
                          )
                          .slice(0, 30)
                          .map((e) => (
                            <div className="relation-option" key={e.id}>
                              <span>
                                {issueName(e)} <strong>{e.title}</strong>
                              </span>
                              {dialog === "parent" ? (
                                <Button
                                  onClick={() => {
                                    void update({ parentId: e.id });
                                    setDialog(null);
                                  }}
                                >
                                  Select
                                </Button>
                              ) : (
                                <select
                                  className="input"
                                  defaultValue=""
                                  onChange={async (event) => {
                                    const type = event.target.value;
                                    if (type === "duplicateOf") {
                                      try {
                                        await apiRequest(
                                          `/api/v1/issues/${issue.id}/merge`,
                                          {
                                            method: "POST",
                                            body: JSON.stringify({
                                              targetId: e.id,
                                            }),
                                          },
                                        );
                                        await store.reload();
                                      } catch (error) {
                                        store.toast(
                                          error instanceof Error
                                            ? error.message
                                            : "Could not merge duplicate",
                                        );
                                        return;
                                      }
                                    } else
                                      void update({
                                        relations: [
                                          ...(issue.relations ?? []),
                                          { type, issueId: e.id },
                                        ],
                                      });
                                    setDialog(null);
                                  }}
                                >
                                  <option value="" disabled>
                                    Relation
                                  </option>
                                  <option value="related">Related to</option>
                                  <option value="blockedBy">Blocked by</option>
                                  <option value="blocks">Blocking</option>
                                  <option
                                    value="duplicateOf"
                                    disabled={!!issue.sharedAccess}
                                  >
                                    Duplicate of
                                  </option>
                                </select>
                              )}
                            </div>
                          ))}
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <Button onClick={() => setDialog(null)}>Cancel</Button>
              {["delete", "due"].includes(dialog) && (
                <Button
                  variant={dialog === "delete" ? "danger" : "primary"}
                  onClick={async () => {
                    if (dialog === "delete") {
                      await store.remove("issues", issue.id);
                      if (location.pathname === `/issues/${issue.id}`)
                        navigate(`/team/${issue.teamId}/all`);
                      store.toast("Issue moved to recently deleted");
                    } else if (dialog === "due")
                      await update({ dueDate: date || null });
                    setDialog(null);
                  }}
                >
                  {dialog === "delete" ? "Delete issue" : "Apply"}
                </Button>
              )}
            </div>
          </Modal>
        )}
    </>
  );
}

type Display = ScheduleOptions & {
  columnOrder?: string[];
  columnWidths?: Record<string, number>;
  manualOrders?: Record<string, string[]>;
  sortScope?: string;
  showSortColumns?: boolean;
  sortRules?: IssueSortRule[];
  completedWindow?: string;
  orderCompletedByRecency?: boolean;
  groupOrder?: string[];
  groupOrders?: SectionOrders;
  hiddenGroups?: Record<string, string[]>;
  layout: "list" | "board" | "calendar" | "timeline";
  groupBy: string;
  subGroupBy: string;
  orderBy: string;
  direction: "asc" | "desc";
  showCompleted: boolean;
  showEmpty: boolean;
  showSubIssues: boolean;
  nestedSubIssues?: boolean;
  collapsedSubIssues?: string[];
  properties: string[];
  groupCount: "issues" | "estimate";
};
const displayFingerprint = (value: Display) =>
  JSON.stringify([
    value.layout,
    value.groupCount,
    value.groupBy,
    value.subGroupBy,
    value.orderBy,
    value.direction,
    value.showCompleted,
    value.showCompleted ? value.completedWindow || "all" : "none",
    value.showEmpty,
    value.showSubIssues,
    !!value.nestedSubIssues,
    !!value.orderCompletedByRecency,
    value.sortScope || "groups",
    !!value.showSortColumns,
    value.sortRules || [],
    value.groupOrder || [],
    value.groupOrders || {},
    value.hiddenGroups || {},
    value.manualOrders || {},
    value.collapsedSubIssues || [],
    value.properties,
    value.columnOrder || [],
    normalizeIssueColumnWidths(value.columnWidths),
    value.calendarMode, value.calendarDateField, value.scheduleAnchor,
    value.timelineScale, value.showDependencies, value.showUnscheduled,
  ]);
const defaultDisplay: Display = {
  layout: "list",
  groupCount: "issues",
  groupBy: "statusId",
  subGroupBy: "none",
  orderBy: "sortOrder",
  direction: "asc",
  showCompleted: true,
  showEmpty: true,
  showSubIssues: true,
  properties: [
    "identifier",
    "statusId",
    "slaStatus",
    "priority",
    "assigneeId",
    "projectId",
    "labelIds",
    "createdAt",
  ],
};
const labelViewDisplay: Partial<Display> = {
  layout: "list",
  groupBy: "statusId",
  subGroupBy: "none",
  orderBy: "priority",
  direction: "asc",
  showCompleted: true,
  completedWindow: "all",
  showEmpty: false,
  showSubIssues: true,
  nestedSubIssues: true,
  properties: [
    "identifier",
    "statusId",
    "assigneeId",
    "priority",
    "projectId",
    "dueDate",
    "estimate",
    "labelIds",
    "createdAt",
  ],
};
const projectIssueDisplay: Partial<Display> = {
  layout: "list",
  groupCount: "estimate",
  groupBy: "statusId",
  subGroupBy: "none",
  orderBy: "priority",
  direction: "asc",
  showCompleted: true,
  completedWindow: "all",
  showEmpty: false,
  showSubIssues: true,
  nestedSubIssues: true,
};
const directTeamIssueDisplay: Partial<Display> = {
  groupCount: "estimate",
  groupBy: "statusId",
  subGroupBy: "none",
  orderBy: "priority",
  direction: "asc",
  showEmpty: false,
  nestedSubIssues: true,
  properties: [
    "identifier",
    "statusId",
    "slaStatus",
    "priority",
    "assigneeId",
    "projectId",
    "labelIds",
    "createdAt",
    "estimate",
  ],
};
const migrateDirectTeamSavedDisplay = (
  key: string,
  saved: Partial<Display>,
  enabled: boolean,
) => {
  if (!enabled) return saved;
  const marker = `${key}:native-team-display-v2`;
  try {
    if (localStorage.getItem(marker) === "1") return saved;
    // A fresh direct-Team route already receives directTeamIssueDisplay below.
    // Only migrate an actual legacy local override; otherwise this synthesized
    // object wins over a team's shared displayDefaults and makes a clean view
    // appear customized on first visit.
    if (!Object.keys(saved).length) {
      localStorage.setItem(marker, "1");
      return saved;
    }
    const properties = Array.isArray(saved.properties)
      ? saved.properties
      : defaultDisplay.properties;
    const next = {
      ...saved,
      groupCount: "estimate" as const,
      showEmpty: false,
      nestedSubIssues: true,
      properties: properties.includes("estimate")
        ? properties
        : [...properties, "estimate"],
    };
    localStorage.setItem(key, JSON.stringify(next));
    localStorage.setItem(marker, "1");
    return next;
  } catch {
    return saved;
  }
};
const migrateImportedTriageBoardDisplay = (
  key: string,
  saved: Partial<Display>,
  enabled: boolean,
) => {
  if (!enabled) return saved;
  const marker = `${key}:native-triage-board-v1`;
  try {
    if (localStorage.getItem(marker) === "1") return saved;
    const properties = Array.isArray(saved.properties)
      ? saved.properties
      : defaultDisplay.properties;
    const next = {
      ...saved,
      properties: properties.includes("estimate")
        ? properties
        : [...properties, "estimate"],
    };
    localStorage.setItem(key, JSON.stringify(next));
    localStorage.setItem(marker, "1");
    return next;
  } catch {
    return saved;
  }
};
const SAVED_VIEW_DISPLAY_KEYS: (keyof Display)[] = [
  "calendarMode", "calendarDateField", "scheduleAnchor", "timelineScale", "showDependencies", "showUnscheduled",
  "columnOrder",
  "columnWidths",
  "layout",
  "groupCount",
  "groupBy",
  "subGroupBy",
  "orderBy",
  "direction",
  "showCompleted",
  "completedWindow",
  "showEmpty",
  "showSubIssues",
  "nestedSubIssues",
  "orderCompletedByRecency",
  "sortScope",
  "showSortColumns",
  "sortRules",
  "groupOrder",
  "groupOrders",
  "hiddenGroups",
  "manualOrders",
  "collapsedSubIssues",
  "properties",
];
const migrateSavedViewDisplay = (
  key: string,
  saved: Partial<Display>,
  view?: Entity,
) => {
  if (!view) return saved;
  const marker = `${key}:saved-view-display-revision-v5`;
  const revision = `${view.version ?? ""}:${view.updatedAt ?? ""}`;
  try {
    if (localStorage.getItem(marker) === revision) return saved;
    const next = { ...saved };
    // A saved view owns its structural presentation. Rebase those fields when
    // its shared revision changes. Saved-view structure, visibility and sort
    // rules come from the shared view rather than stale local list state.
    // Ordinary views retain their shared secondary sorts; the canonical
    // imported MASTER view is rebased to its observed native single sort.
    for (const field of SAVED_VIEW_DISPLAY_KEYS) delete next[field];
    if (
      view.name === "MASTER ISSUE VIEW" &&
      (view.display?.groupBy ?? "statusId") === "statusId"
    ) {
      next.groupBy = "statusId";
      next.orderBy = "priority";
      next.direction = "asc";
      next.sortScope = "groups";
      next.showSortColumns = false;
      next.sortRules = [];
      next.groupOrder = view.display?.groupOrder ?? [
        "In Progress",
        "Todo",
        "Backlog",
        "Done",
        "Canceled",
        "Duplicate",
      ];
      next.hiddenGroups = {};
    }
    localStorage.setItem(key, JSON.stringify(next));
    localStorage.setItem(marker, revision);
    return next;
  } catch {
    return saved;
  }
};
const IssueViewForm = React.lazy(() =>
  import("./features/view-builder").then((module) => ({
    default: module.ViewForm,
  })),
);
const ViewInsights = React.lazy(() =>
  import("./view-insights").then((module) => ({
    default: module.ViewInsights,
  })),
);

function BoardColumnMenu({
  group,
  onSelect,
  onHide,
}: {
  group: NestedIssueGroup;
  onSelect: () => void;
  onHide: () => void;
}) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLocaleLowerCase();
  const shown = (label: string) =>
    !normalized || label.toLocaleLowerCase().includes(normalized);
  return (
    <Dropdown
      align="right"
      menuClassName="board-column-menu"
      onOpenChange={(open) => !open && setQuery("")}
      trigger={
        <button
          type="button"
          className="icon-button board-column-menu-trigger"
          aria-label="Open menu"
        >
          <Icon name="MoreHorizontal" size={14} />
        </button>
      }
    >
      <div className="board-column-menu-header" data-keep-open>
        <span>Showing all items</span>
        <input
          autoFocus
          aria-label={`Filter ${group.name} column actions`}
          placeholder="Filter…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {shown("Select all in column") && (
        <MenuItem onClick={onSelect}>Select all in column</MenuItem>
      )}
      {shown("Hide column") && (
        <MenuItem onClick={onHide}>Hide column</MenuItem>
      )}
      {!shown("Select all in column") && !shown("Hide column") && (
        <p className="board-column-menu-empty">No results</p>
      )}
    </Dropdown>
  );
}

function BoardProjectHover({
  project,
  data,
  stats,
  children,
}: {
  project: Entity;
  data: ReturnType<typeof useAppStore>["data"];
  stats?: { progress: number; scope: number };
  children?: React.ReactNode;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [point, setPoint] = useState<{ left: number; top: number } | null>(
    null,
  );
  const close = () => {
    clearTimeout(timer.current);
    timer.current = undefined;
    setPoint(null);
  };
  useEffect(() => close, []);
  const team = data.teams.find(
    (item) => item.id === (project.teamIds?.[0] ?? project.teamId),
  );
  const status = projectStatuses(data).find(
    (item) => item.id === project.status,
  );
  const priority = Number(project.priority) || 0;
  return (
    <span
      className="board-project-hover-anchor"
      onPointerEnter={(event) => {
        if (event.pointerType === "touch" || event.buttons) return;
        clearTimeout(timer.current);
        const rect = event.currentTarget.getBoundingClientRect();
        timer.current = setTimeout(() => {
          const width = 356;
          const height = 78;
          setPoint({
            left: Math.max(8, Math.min(innerWidth - width - 8, rect.left)),
            top:
              rect.bottom + 8 + height <= innerHeight - 8
                ? rect.bottom + 8
                : Math.max(8, rect.top - height - 8),
          });
        }, 500);
      }}
      onPointerLeave={close}
      onClickCapture={close}
    >
      {children ?? <Link
        className="board-project-badge"
        to={`/project/${project.id}`}
        aria-label="Open project"
        data-tooltip-label={project.name}
        onClick={(event) => event.stopPropagation()}
      >
        <EntityIcon entity={project} fallback="Box" size={12} />
        <span>{project.name}</span>
      </Link>}
      {point &&
        createPortal(
          <div
            className="board-project-hover-card"
            role="tooltip"
            style={point}
          >
            <Link to={`/project/${project.id}`}>
              <EntityIcon entity={project} fallback="Box" size={15} />
              <strong>{project.name}</strong>
            </Link>
            <div>
              <span
                className={`board-project-status status-${status?.type || project.status}`}
              >
                <i style={{ borderColor: status?.color }} />
                {status?.name || project.status || "Planned"}
              </span>
              {team && (
                <span>
                  <EntityIcon entity={team} fallback="Users" size={14} />
                  {team.name}
                </span>
              )}
              <span>
                <PriorityIcon priority={priority} />
                {["No priority", "Urgent", "High", "Medium", "Low"][priority]}
              </span>
              <span>
                <i
                  className="board-project-progress"
                  style={
                    {
                      "--progress": `${stats?.progress || 0}%`,
                    } as React.CSSProperties
                  }
                />
                {progressPercentage(stats?.progress || 0)}% of{" "}
                {stats?.scope || 0}
              </span>
            </div>
          </div>,
          document.body,
        )}
    </span>
  );
}

function ProfileDetails({user,data,issues,self,favorite,onFavorite}:{user:Entity;data:any;issues:Entity[];self:boolean;favorite:boolean;onFavorite:()=>void}){
  const [tab,setTab]=useState('Labels'),membership=data.memberships.find((item:Entity)=>!item.deletedAt&&!item.teamId&&item.userId===user.id),teamIds=[...new Set(data.memberships.filter((item:Entity)=>!item.deletedAt&&item.teamId&&item.userId===user.id).map((item:Entity)=>item.teamId))] as string[],projectIds=[...new Set([...data.projects.filter((item:Entity)=>!item.deletedAt&&!item.archivedAt&&item.memberIds?.includes(user.id)).map((item:Entity)=>item.id),...issues.map(issue=>issue.projectId).filter(Boolean)])] as string[],labelIds=[...new Set(issues.flatMap(issue=>issue.labelIds||[]))] as string[];
  const joinedDisplay=String(user.joinedDisplay||''),joined=joinedDisplay?joinedDisplay+(/\b\d{4}\b/.test(joinedDisplay)?'':` ${new Date().getFullYear()}`):membership?.createdAt||user.createdAt,joinedDate=joined?new Date(joined):null,days=joinedDate&&Number.isFinite(joinedDate.getTime())?Math.max(0,Math.floor((Date.now()-joinedDate.getTime())/86400000)):0,joinedRelative=days<7?`${days} days ago`:days<56?`${Math.floor(days/7)} weeks ago`:`${Math.floor(days/30)} months ago`,joinedExact=joinedDisplay||(joinedDate&&Number.isFinite(joinedDate.getTime())?joinedDate.toLocaleString():'—');
  const names=tab==='Labels'?labelIds.map(id=>data.labels.find((item:Entity)=>item.id===id)?.name).filter(Boolean):tab==='Projects'?projectIds.map(id=>data.projects.find((item:Entity)=>item.id===id)?.name).filter(Boolean):tab==='Teams'?teamIds.map(id=>data.teams.find((item:Entity)=>item.id===id)?.name).filter(Boolean):[...new Set(issues.map(issue=>['No priority','Urgent','High','Medium','Low'][issue.priority||0]))];
  return <aside className="profile-details" aria-label="Member details"><header><Avatar user={user} size={34}/><div><strong>{user.name||user.email}</strong><small>{user.username||String(user.email||'').split('@')[0]} · {self?'Online':'Offline'} <i className={self?'online':''}/></small></div>{self?<Dropdown align="right" trigger={<button className="icon-button" aria-label="Open menu"><Icon name="MoreHorizontal" size={14}/></button>}><input autoFocus aria-label="Filter…" placeholder="Filter…"/><Link className="menu-item" role="menuitem" to="/settings/profile">Edit profile</Link></Dropdown>:<button className="icon-button" role="switch" aria-checked={favorite} aria-label={favorite?'Remove from favorites':'Add to favorites'} onClick={onFavorite}><Icon name="Star" size={14} style={favorite?{fill:'currentColor'}:undefined}/></button>}</header><section className="profile-details-fields"><div><span>Email</span><a href={`mailto:${user.email}`}>{user.email}</a></div><div><span>Local time</span><strong>{new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</strong></div>{user.title&&<div><span>Title</span><strong>{user.title}</strong></div>}<div><span>Joined</span><strong title={joinedExact}>{joinedRelative}</strong></div><div><span>Teams</span><span>{teamIds.map(id=>{const team=data.teams.find((item:Entity)=>item.id===id);return team?<Link key={id} to={`/team/${id}/overview`}>{team.name}</Link>:null})}</span></div><div><span>Projects</span><span>{projectIds.map(id=>{const project=data.projects.find((item:Entity)=>item.id===id);return project?<Link key={id} to={`/project/${id}/overview`}>{project.name}</Link>:null})}</span></div></section>{issues.length>0&&<><nav aria-label="Member statistics" role="tablist">{['Labels','Priority','Projects','Teams'].map(name=>{const id=`member-stat-${name.toLowerCase()}`;return <button key={name} id={id} role="tab" aria-selected={tab===name} aria-controls="member-stat-panel" className={tab===name?'active':''} onClick={()=>setTab(name)}>{name}</button>})}</nav><section id="member-stat-panel" role="tabpanel" aria-labelledby={`member-stat-${tab.toLowerCase()}`} className="profile-details-stat">{names.length?names.map(name=><span key={name}>{name}</span>):`No ${tab.toLowerCase()} used`}</section></>}</aside>;
}

const openIssueComposer = openComposer;

export type IssueViewSettings = { layout: string; display: Display; filters: FilterSpec; searchQuery: string };

export function IssueList({
  teamId: passedTeamId,
  customerId,
  section: passedSection,
  viewId: passedViewId,
  projectId,
  cycleId,
  issueIds,
  assigneeId: passedAssigneeId,
  embedded = false,
  onDetailsChange,
  projectScoped = false,
  projectDetailsOpen = false,
  onProjectDetailsToggle,
  filterButtonLabel = "Filter issues",
  onViewSettingsChange,
}: {
  teamId?: string;
  customerId?: string;
  section?: string;
  viewId?: string;
  projectId?: string;
  cycleId?: string;
  issueIds?: string[];
  assigneeId?: string;
  embedded?: boolean;
  onDetailsChange?: (visible: boolean) => void;
  projectScoped?: boolean;
  projectDetailsOpen?: boolean;
  onProjectDetailsToggle?: () => void;
  filterButtonLabel?: string;
  onViewSettingsChange?: (settings: IssueViewSettings) => void;
} = {}) {
  const params = useParams(),
    location = useLocation(),
    navigate = useNavigate(),
    store = useAppStore();
  const openComposer = (defaults:Record<string,any>={}) => openIssueComposer({...defaults,...(customerId?{directCustomerIds:[customerId]}:{})});
  const labelViewId = params.labelId ?? params.labelGroupId;
  const resolvedLabelView = labelViewRoute(location.pathname, store.data);
  const labelView = resolvedLabelView?.entity;
  const isLabelGroupView = resolvedLabelView?.kind === "labelGroups";
  const labelGroupMembers =
    isLabelGroupView && labelView
      ? store.data.labels.filter(
          (entity) =>
            !entity.deletedAt &&
            (entity.entityType || "issues") === "issues" &&
            (entity.teamId || null) === (labelView.teamId || null) &&
            (entity.labelGroupId === labelView.id ||
              (!entity.labelGroupId && entity.group === labelView.name)),
        )
      : [];
  const scopedLabelIds = useMemo(
    () =>
      new Set(
        labelView
          ? isLabelGroupView
            ? store.data.labels
                .filter(
                  (e) =>
                    !e.deletedAt &&
                    (e.entityType || "issues") === "issues" &&
                    (e.teamId || null) === (labelView.teamId || null) &&
                    (e.labelGroupId === labelView.id ||
                      (!e.labelGroupId && e.group === labelView.name)),
                )
                .map((e) => e.id)
            : [labelView.id]
          : [],
      ),
    [labelView, isLabelGroupView, store.data.labels],
  );
  const teamId =
      passedTeamId ??
      params.teamId ??
      labelView?.teamId ??
      store.data.views.find(
        (item) => item.id === (passedViewId ?? params.viewId),
      )?.teamId,
    section =
      passedSection ??
      params.section ??
      (labelViewId &&
      ["active", "backlog", "all", "triage"].includes(
        new URLSearchParams(location.search).get("section") || "",
      )
        ? new URLSearchParams(location.search).get("section")!
        : "all"),
    viewId = passedViewId ?? params.viewId;
  const view = store.data.views.find((e) => e.id === viewId),
    team = store.data.teams.find((t) => t.id === teamId);
  const editingView = !!view && location.pathname === `/view/${view.id}/edit`;
  const importedTriageBoard =
    view?.name === "Triage" &&
    String(view.layout ?? view.display?.layout).toLocaleLowerCase() === "board";
  const nativeTeamTriageBoard = importedTriageBoard && !!view?.teamId;
  const isProfile = location.pathname.startsWith("/profiles/");
  const isMine = isProfile || location.pathname.startsWith("/my-issues");
  const isDirectTeamIssueRoute =
    !!teamId && !view && !isMine && !labelViewId && !embedded;
  const [profileQuery, setProfileQuery] = useState("");
  const [labelQuery, setLabelQuery] = useState("");
  const mineTab = isProfile
    ? params.profileTab === "created"
      ? "Created"
      : "Assigned"
    : myIssueTab(location.search);
  const setMineTab = (tab: string) => {
    if (isProfile) {
      navigate(
        "/profiles/" + params.profileId + (tab === "Created" ? "/created" : ""),
      );
      return;
    }
    const search = myIssueTabSearch(
      location.search,
      tab,
      `${store.data.workspaceId}:${store.user?.id}`,
      sessionStorage,
    );
    navigate({ pathname: location.pathname, search });
  };
  const targetUserId = isProfile
    ? params.profileId
    : isMine
      ? (new URLSearchParams(location.search).get("assignee") ?? store.user?.id)
      : store.user?.id;
  const targetUser = store.data.users.find((u) => u.id === targetUserId);
  const assignedCreationDefaults =
    isMine && !isProfile && mineTab === "Assigned"
      ? { assigneeId: targetUserId }
      : {};
  const availableLabelGroups = issueLabelGroups(store.data, teamId);
  const key = `display:${store.data.workspaceId}:${store.user?.id}:${labelViewId ? `label-view:${labelViewId}` : (viewId ?? (customerId ? "customer:"+customerId : undefined) ?? projectId ?? cycleId ?? (isMine ? `${isProfile ? "profile" : "my"}:${targetUserId}:${mineTab}` : `${teamId ?? "all"}:${section}`))}`;
  const normalizeAssignedFocusLayout = (value: Display): Display =>
    isMine &&
    !isProfile &&
    mineTab === "Assigned" &&
    value.groupBy === "focus" &&
    value.layout === "board"
      ? { ...value, layout: "list" }
      : value;
  const requestedMilestone = projectId
    ? new URLSearchParams(location.search).get("milestone")
    : null;
  const insightQuery = new URLSearchParams(location.search).get("insights");
  const serializedInsightContext = new URLSearchParams(location.search).get(
    "insightContext",
  );
  const insightContext = useMemo(
    () => parseInsightContext(serializedInsightContext),
    [serializedInsightContext],
  );
  const [insightSelection, setInsightSelection] = useState<string[] | null>(
      null,
    ),
    [insightArchived, setInsightArchived] = useState(false),
    [insightReset, setInsightReset] = useState(0);
  const [columnEditingKey, setColumnEditingKey] = useState<string | null>(null);
  const columnEditSnapshot = useRef<{ key: string; columns: Pick<Display, "properties" | "columnOrder" | "columnWidths"> } | null>(null);
  const columnSaveBaseline = useRef<{ key: string; columns: Pick<Display, "properties" | "columnOrder" | "columnWidths"> } | null>(null);
  const [columnSavingKey, setColumnSavingKey] = useState<string | null>(null);
  const [scheduleSavingKey, setScheduleSavingKey] = useState<string|null>(null);
  const [scheduleSaveError, setScheduleSaveError] = useState<{key:string;message:string}|null>(null);
  const [columnSaveError, setColumnSaveError] = useState<{ key: string; message: string } | null>(null);
  useEffect(() => { setColumnEditingKey(null); columnEditSnapshot.current = null; }, [key, editingView]);
  const [groupOrderingOpen, setGroupOrderingOpen] = useState(false);
  const [advancedDisplayOpen, setAdvancedDisplayOpen] = useState(false);
  const displayTrigger = useRef<HTMLButtonElement>(null);
  const columnTrigger = useRef<HTMLButtonElement>(null);
  const [liveDisplay, setLiveDisplay] = useState<Display>(() => {
    try {
      let saved = migrateDirectTeamSavedDisplay(
        key,
        JSON.parse(localStorage.getItem(key) ?? "{}"),
        isDirectTeamIssueRoute,
      );
      saved = migrateImportedTriageBoardDisplay(
        key,
        saved,
        importedTriageBoard,
      );
      saved = migrateSavedViewDisplay(key, saved, view);
      if (isProfile) saved = migrateProfileDisplay(localStorage, key, saved, mineTab);
      const legacyDirectTeamDefault =
        isDirectTeamIssueRoute &&
        displayFingerprint({ ...defaultDisplay, ...saved }) ===
          displayFingerprint(defaultDisplay);
      return normalizeAssignedFocusLayout({
        ...defaultDisplay,
        ...(isDirectTeamIssueRoute ? directTeamIssueDisplay : {}),
        ...(projectScoped ? projectIssueDisplay : {}),
        ...(isProfile ? profileIssueDisplay(mineTab) : {}),
        ...(labelViewId ? labelViewDisplay : {}),
        ...(legacyDirectTeamDefault ? {} : saved),
      });
    } catch {
      return normalizeAssignedFocusLayout({
        ...defaultDisplay,
        ...(isDirectTeamIssueRoute ? directTeamIssueDisplay : {}),
        ...(projectScoped ? projectIssueDisplay : {}),
        ...(isProfile ? profileIssueDisplay(mineTab) : {}),
        ...(labelViewId ? labelViewDisplay : {}),
      });
    }
  });
  const savedViewFilter = useMemo<FilterSpec>(() => {
    const raw = view?.filters ?? view?.filter;
    return raw?.conditions
      ? unwrapIssueFilter(raw)
      : {
          conditions: Object.entries(raw ?? {}).map(([field, value]) => ({
            field,
            value,
            operator: "eq",
          })),
          match: "all",
        };
  }, [view?.filters, view?.filter]);
  const defaultFilter = useMemo<FilterSpec>(() => {
    // Customer ownership is page scope, not a removable user filter.
    if(customerId)return {match:"all",conditions:[]};
    const raw =
      insightContext?.filter ??
      (requestedMilestone
        ? {
            conditions: [
              {
                field: "milestoneId",
                operator: requestedMilestone === "none" ? "empty" : "eq",
                value:
                  requestedMilestone === "none" ? null : requestedMilestone,
              },
            ],
            match: "all",
          }
        : (view?.filters ?? view?.filter));
    return raw?.conditions
      ? unwrapIssueFilter(raw)
      : {
          conditions: Object.entries(raw ?? {}).map(([field, value]) => ({
            field,
            value,
            operator: "eq",
          })),
          match: "all",
        };
  }, [customerId, insightContext, requestedMilestone, view?.filters, view?.filter]);
  const [editDisplay, setEditDisplay] = useState<Display>(() => liveDisplay);
  const [editFilter, setEditFilter] = useState<FilterSpec>(savedViewFilter);
  const display = editingView ? editDisplay : liveDisplay;
  useEffect(() => { if (display.layout !== "list") setColumnEditingKey(null); }, [display.layout]);
  const setDisplay = editingView ? setEditDisplay : setLiveDisplay;
  const [collapsed, setCollapsed] = useIssueGroupCollapse(key, display.groupBy, display.subGroupBy);
  const [filterOpen, setFilterOpen] = useState(false),
    [selection, setSelection] = useState<string[]>([]),
    [focus, setFocus] = useState(""),
    [keyboardFocus, setKeyboardFocus] = useState(false),
    [details, setDetails] = useState(!!insightQuery || (isProfile && targetUserId !== store.user?.id)),
    [summary, setSummary] = useState(isDirectTeamIssueRoute),
    [summarySelection, setSummarySelection] = useState<SummarySelection | null>(
      null,
    ),
    [query, setQuery] = useState(view?.searchQuery || ""),
    [searchOpen, setSearchOpen] = useState(false),
    [context, setContext] = useState<{
      id: string;
      x: number;
      y: number;
    } | null>(null),
    [savingView, setSavingView] = useState(false),
    [peek, setPeek] = useState<string | null>(null),
    [deletingView, setDeletingView] = useState(false),
    [profileNotifications, setProfileNotifications] = useState({ assigned: false, closed: false });
  const profileNotificationKey = `profile-view-notifications:${store.data.workspaceId}:${targetUserId ?? ""}`;
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(profileNotificationKey) || "null");
      setProfileNotifications({ assigned: !!saved?.assigned, closed: !!saved?.closed });
    } catch {
      setProfileNotifications({ assigned: false, closed: false });
    }
  }, [profileNotificationKey]);
  const setProfileNotification = (field: "assigned" | "closed", value: boolean) =>
    setProfileNotifications((current) => {
      const next = { ...current, [field]: value };
      try { localStorage.setItem(profileNotificationKey, JSON.stringify(next)); } catch {}
      return next;
    });
  const closeViewEditor = React.useCallback(() => {
    setFilterOpen(false);
    setAdvancedDisplayOpen(false);
    setGroupOrderingOpen(false);
    navigate({ pathname: `/view/${view!.id}`, search: location.search });
  }, [navigate, view, location.search]);
  const setPersistedSummary = (
    value: boolean | ((current: boolean) => boolean),
  ) =>
    setSummary((current) => {
      const next = typeof value === "function" ? value(current) : value;
      try {
        localStorage.setItem(`${key}:summary-open`, String(next));
      } catch {}
      return next;
    });
  const [filter, setFilter] = useRouteFilter(defaultFilter);
  useEffect(() => {
    onViewSettingsChange?.({ layout: display.layout[0].toUpperCase() + display.layout.slice(1), display, filters: editingView ? editFilter : filter, searchQuery: query });
  }, [onViewSettingsChange, display, filter, editFilter, editingView, query]);
  useEffect(() => {
    if (!editingView) return;
    setEditFilter(savedViewFilter);
    setEditDisplay(liveDisplay);
    setFilterOpen(false);
  }, [editingView, view?.id, view?.version]);
  useEffect(() => {
    onDetailsChange?.(details || summary);
    if (!details) {
      setInsightSelection(null);
      setInsightArchived(false);
    }
    if (!summary) setSummarySelection(null);
  }, [details, summary, onDetailsChange]);
  useEffect(() => {
    setInsightSelection(null);
    setSummarySelection(null);
    setInsightReset((value) => value + 1);
  }, [filter, query, key]);
  const workspace = store.data.workspaces.find(
    (w) => w.id === store.data.workspaceId,
  );
  const project = store.data.projects.find((p) => p.id === projectId),
    cycle = store.data.cycles.find((c) => c.id === cycleId);
  const sharedDisplay =
    view?.display ??
    team?.displayDefaults?.[section] ??
    project?.issueDisplay ??
    cycle?.issueDisplay ??
    workspace?.displayDefaults?.[
      isProfile ? "user-profiles" : isMine ? "my-issues" : "issues"
    ] ??
    {};
  const resetDisplay = () => {
    localStorage.removeItem(key);
    setLiveDisplay(normalizeAssignedFocusLayout({
      ...defaultDisplay,
      ...(isDirectTeamIssueRoute ? directTeamIssueDisplay : {}),
      ...(projectScoped ? projectIssueDisplay : {}),
      ...(isProfile
        ? profileIssueDisplay(mineTab)
        : isMine
          ? myIssueDisplay(mineTab)
          : {}),
      ...sharedDisplay,
      ...(labelViewId ? labelViewDisplay : {}),
    }));
  };
  const saveDefault = () => {
    if (view) return store.update("views", view.id, { display, layout: display.layout[0].toUpperCase() + display.layout.slice(1) });
    if (team)
      return store.update("teams", team.id, {
        displayDefaults: { ...team.displayDefaults, [section]: display },
      });
    if (project)
      return store.update("projects", project.id, { issueDisplay: display });
    if (cycle)
      return store.update("cycles", cycle.id, { issueDisplay: display });
    if (workspace)
      return store.update("workspaces", workspace.id, {
        displayDefaults: {
          ...workspace.displayDefaults,
          [isProfile ? "user-profiles" : isMine ? "my-issues" : "issues"]:
            display,
        },
      });
  };
  const baselineDisplay: Display = {
    ...defaultDisplay,
    ...(isDirectTeamIssueRoute ? directTeamIssueDisplay : {}),
    ...(projectScoped ? projectIssueDisplay : {}),
    ...(isProfile
      ? profileIssueDisplay(mineTab)
      : isMine
        ? myIssueDisplay(mineTab)
        : {}),
    ...sharedDisplay,
    ...(labelViewId ? labelViewDisplay : {}),
    ...(view?.layout
      ? { layout: String(view.layout).toLowerCase() as Display["layout"] }
      : {}),
    ...(insightContext
      ? {
          showCompleted: insightContext.showCompleted,
          showSubIssues: insightContext.showSubIssues,
        }
      : {}),
  };
  const displayCustomized =
    displayFingerprint(display) !== displayFingerprint(baselineDisplay);
  const directTeamAllDisplay = isDirectTeamIssueRoute && section === "all";
  const lastSelected = useRef<string>("");
  const keyboardRange = useRef<{ anchor: string; base: string[] } | null>(null);
  const parent = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(key) ?? "{}");
    } catch {}
    saved = migrateDirectTeamSavedDisplay(key, saved, isDirectTeamIssueRoute);
    saved = migrateImportedTriageBoardDisplay(key, saved, importedTriageBoard);
    saved = migrateSavedViewDisplay(key, saved, view);
    if (isProfile) saved = migrateProfileDisplay(localStorage, key, saved, mineTab);
    if (
      isDirectTeamIssueRoute &&
      displayFingerprint({ ...defaultDisplay, ...saved }) ===
        displayFingerprint(defaultDisplay)
    )
      saved = {};
    setLiveDisplay(normalizeAssignedFocusLayout({
      ...defaultDisplay,
      ...(isDirectTeamIssueRoute ? directTeamIssueDisplay : {}),
      ...(projectScoped ? projectIssueDisplay : {}),
      ...(isProfile
        ? profileIssueDisplay(mineTab)
        : isMine
          ? myIssueDisplay(mineTab)
          : {}),
      ...sharedDisplay,
      ...(labelViewId ? labelViewDisplay : {}),
      ...(view?.layout ? { layout: String(view.layout).toLowerCase() } : {}),
      ...saved,
      ...(insightContext
        ? {
            showCompleted: insightContext.showCompleted,
            showSubIssues: insightContext.showSubIssues,
          }
          : {}),
    }));
    setSelection([]);
    setDetails(!!insightQuery || (isProfile && targetUserId !== store.user?.id));
    let savedSummary: boolean | undefined;
    try {
      const raw = localStorage.getItem(`${key}:summary-open`);
      if (raw !== null) savedSummary = raw === "true";
    } catch {}
    setSummary(
      embedded
        ? false
        : projectScoped
          ? false
          : labelViewId
            ? true
            : (savedSummary ??
              (typeof sharedDisplay.summaryOpen === "boolean"
                ? sharedDisplay.summaryOpen
                : isDirectTeamIssueRoute)),
    );
    if (insightContext) setQuery(insightContext.query);
  }, [key, requestedMilestone, insightContext, insightQuery, view?.version]);
  useEffect(() => {
    if (!store.initialSyncing)
      localStorage.setItem(key, JSON.stringify(liveDisplay));
  }, [liveDisplay, key, store.initialSyncing]);
  const statuses = useMemo(
    () =>
      active([
        ...new Map(
          [
            ...store.data.statuses,
            ...store.data.issues.flatMap((issue) => issue.sharedStatuses ?? []),
          ].map((status) => [status.id, status]),
        ).values(),
      ]).sort(
        (a, b) =>
          (a.position ?? a.sortOrder ?? 0) - (b.position ?? b.sortOrder ?? 0),
      ),
    [store.data.statuses, store.data.issues],
  );
  const boardProjectStatistics = useMemo(
    () => projectStatistics(store.data.issues, statuses, store.data.teams),
    [store.data.issues, statuses, store.data.teams],
  );
  const activityByIssue = useMemo(
    () =>
      isMine && mineTab === "Activity"
        ? myIssueActivity(
            store.data.issues,
            store.data.comments,
            store.data.activities,
            targetUserId,
          )
        : new Map<string, string>(),
    [
      isMine,
      mineTab,
      store.data.issues,
      store.data.comments,
      store.data.activities,
      targetUserId,
    ],
  );
  const activityVerbByIssue = useMemo(() => {
    const labels = new Map<string, string>(),
      comments = new Map(
        store.data.comments.map((comment) => [comment.id, comment.issueId]),
      );
    for (const activity of store.data.activities) {
      const id =
        activity.issueId ??
        (activity.entityKind === "comments"
          ? comments.get(activity.entityId)
          : activity.entityId);
      if (!labels.has(id) && activityByIssue.get(id) === activity.createdAt)
        labels.set(
          id,
          myActivityVerb(
            activity,
            targetUserId,
            store.data.issues.find((issue) => issue.id === id)?.assigneeId ??
              null,
          ),
        );
    }
    for (const issue of store.data.issues) {
      const observed = issue.sourceActivitySummary;
      if (
        observed?.userId === targetUserId &&
        activityByIssue.get(issue.id) === observedActivityTime(observed)
      )
        labels.set(issue.id, observed.verb);
    }
    return labels;
  }, [
    activityByIssue,
    store.data.activities,
    store.data.comments,
    store.data.issues,
    targetUserId,
  ]);
  const customerMetrics = useMemo(
    () =>
      buildCustomerMetrics(
        store.data.customers,
        store.data.requests,
        "issues",
        store.data.issues,
      ),
    [store.data.customers, store.data.requests, store.data.issues],
  );
  const calendarDay = useCalendarDay(filter);
  const availableSortFields: [string, string][] = [
    ...(isMine && mineTab === "Activity"
      ? ([["activityAt", "My activity date"]] as [string, string][])
      : []),
    ...availableIssueSortFields(store.data.issues),
  ];
  const columnDefinitions = issueColumnDefinitions(display.properties, availableSortFields.filter(([field]) => field.startsWith("customFields.")));
  const columnOrder = normalizeIssueColumnOrder(display.columnOrder, columnDefinitions.map(([field]) => field));
  const availableColumnDefinitions = columnDefinitions.filter(([field]) => {
    if (field === "projectId" && (projectScoped || display.groupBy === "projectId" || display.subGroupBy === "projectId")) return false;
    if (field === "activityAt" && !isMine) return false;
    return true;
  });
  const visibleColumnFields = availableColumnDefinitions.filter(([field]) => isIssueColumnVisible(field, display.properties, projectScoped)).map(([field]) => field);
  const columnsEditing = display.layout === "list" && columnEditingKey === key;
  const columnWidths = normalizeIssueColumnWidths(display.columnWidths);
  const columnsAligned = display.layout === "list" && (columnsEditing || Object.keys(columnWidths).length > 0);
  const columnsCustomized = issueColumnSettingsFingerprint(display) !== issueColumnSettingsFingerprint(baselineDisplay);
  const columnFailure = store.failures.find(failure => failure.kind === "views" && failure.entityId === view?.id && failure.data.display);
  const columnConflict = store.conflicts.some(conflict => conflict.kind === "views" && conflict.entityId === view?.id);
  const columnError = columnSaveError?.key === key ? columnSaveError.message : columnFailure?.message || (columnConflict ? "A newer view change needs conflict resolution before these columns can sync." : "");
  const closeColumns = () => {
    setColumnEditingKey(null);
    columnEditSnapshot.current = null;
    if (parent.current && !Object.keys(columnWidths).length) parent.current.scrollLeft = 0;
    columnTrigger.current?.focus();
  };
  const cancelColumns = () => {
    if (columnSavingKey === key) return;
    const previous = columnFailure && columnSaveBaseline.current?.key === key ? columnSaveBaseline.current.columns
      : columnEditSnapshot.current?.key === key ? columnEditSnapshot.current.columns : baselineDisplay;
    if (columnFailure) void store.resolveFailure(columnFailure.id, "discard");
    setDisplay(current => ({ ...current, properties: [...previous.properties], columnOrder: previous.columnOrder, columnWidths: previous.columnWidths }));
    if (parent.current && !Object.keys(previous.columnWidths || {}).length) parent.current.scrollLeft = 0;
    setColumnSaveError(null);
    closeColumns();
  };
  const saveColumnsToView = async () => {
    if (columnSavingKey === key || columnConflict) return;
    const savingKey = key;
    setColumnSavingKey(savingKey);
    setColumnSaveError(null);
    try {
      // Built-in views keep their scoped local preferences. In the full view
      // editor, the outer Save still owns publishing the complete draft.
      if (columnFailure) await store.resolveFailure(columnFailure.id, "retry");
      else if (view && !editingView && columnsCustomized) {
        columnSaveBaseline.current = { key, columns: { properties: [...baselineDisplay.properties], columnOrder: baselineDisplay.columnOrder, columnWidths: baselineDisplay.columnWidths } };
        await store.update("views", view.id, { display: withSavedIssueColumns(view.display, { properties: display.properties, columnOrder, columnWidths }) });
      }
      closeColumns();
    } catch (error) {
      setColumnSaveError({ key: savingKey, message: error instanceof Error ? error.message : "Could not save columns to this view." });
    } finally {
      setColumnSavingKey(current => current === savingKey ? null : current);
    }
  };
  const columnControl = display.layout === "list" ? (
    <button
      type="button"
      ref={columnTrigger}
      className={`icon-button circle-button ${columnsEditing ? "active" : ""}`}
      aria-label="Edit columns"
      title="Edit columns"
      aria-expanded={columnsEditing}
      onClick={() => {
        if (columnEditingKey !== key) columnEditSnapshot.current = { key, columns: {
          properties: [...display.properties], columnOrder: display.columnOrder ? [...display.columnOrder] : undefined,
          columnWidths: display.columnWidths ? { ...display.columnWidths } : undefined,
        } };
        setColumnEditingKey(key);
      }}
    >
      <Icon name="GripVertical" size={16} />
    </button>
  ) : null;
  const columnSaveControls = (
    <div className="issue-column-save">
      <span hidden={columnsEditing}>{editingView ? "Columns are included when you save this view." : !view ? "Save a view to reuse this column layout." : columnError ? "Column settings could not be saved." : columnsCustomized ? "Column settings have unsaved changes." : store.pending ? "Column settings saved locally; sync pending." : "Column settings saved to this view."}</span>
      <button type="button" className="column-save-primary"
        disabled={columnSavingKey === key || columnConflict}
        onClick={() => void saveColumnsToView()}>{columnSavingKey === key ? "Saving…" : "Save to View"}</button>
      <button type="button" disabled={columnSavingKey === key} onClick={cancelColumns}>Cancel</button>
      {!!columnError && <p role="alert">{columnError}</p>}
    </div>
  );
  const customerFiltering =
    usesCustomerMetrics(filter) ||
    display.orderBy.startsWith("customer") ||
    !!display.sortRules?.some((r) => r.field.startsWith("customer"));
  const scopeCandidates = useMemo(
    () =>
      store.data.issues
        .filter(
          (issue) =>
            (!issue.deletedAt || (isMine && mineTab === "Activity")) &&
            (!issueIds || issueIds.includes(issue.id)) &&
            (issueIds !== undefined ||
              !issue.archivedAt ||
              (isMine && mineTab === "Activity") ||
              (details && insightArchived)),
        )
        .map((e) =>
          withCustomerAssignments(customerFiltering ? withCustomerMetrics(e, customerMetrics) : e, store.data.projects, store.data.customers),
        )
        .filter((e) => {
          if (customerId && !e.effectiveCustomerIds.includes(customerId)) return false;
          if (issueIds !== undefined) return true;
          const status = statuses.find((s) => s.id === e.statusId);
          if (
            labelViewId &&
            !(e.labelIds || []).some((id: string) => scopedLabelIds.has(id))
          )
            return false;
          if (teamId && e.teamId !== teamId) return false;
          if (projectId && e.projectId !== projectId) return false;
          if (view?.teamId && e.teamId !== view.teamId) return false;
          if (view?.projectId && e.projectId !== view.projectId) return false;
          if (
            view?.initiativeId &&
            !store.data.projects.some(
              (project) =>
                project.id === e.projectId &&
                project.initiativeIds?.includes(view.initiativeId),
            )
          )
            return false;
          if (cycleId && e.cycleId !== cycleId) return false;
          if (
            passedAssigneeId !== undefined &&
            (e.assigneeId || "") !== passedAssigneeId
          )
            return false;
          if (isMine) {
            if (mineTab === "Assigned" && e.assigneeId !== targetUserId)
              return false;
            if (mineTab === "Created" && e.creatorId !== targetUserId)
              return false;
            if (
              mineTab === "Subscribed" &&
              !issueSubscribedBy(e, store.data.subscriptions, targetUserId)
            )
              return false;
            if (mineTab === "Shared" && e.sharedAccess !== true) return false;
            if (mineTab === "Activity" && !activityByIssue.has(e.id))
              return false;
          }
          if (
            section === "active" &&
            !["started", "unstarted"].includes(status?.type)
          )
            return false;
          if (section === "backlog" && status?.type !== "backlog") return false;
          if (section === "triage" && status?.type !== "triage") return false;
          if (
            section !== "triage" &&
            status?.type === "triage" &&
            !filterIncludesTriage(filter, statuses)
          )
            return false;
          if (
            (!display.showCompleted ||
              !completedIssueVisible(
                e,
                display.completedWindow,
                new Date(calendarDay),
                store.data.cycles,
              )) &&
            ["completed", "canceled"].includes(status?.type)
          )
            return false;
          if (!display.showSubIssues && e.parentId) return false;
          return true;
        }),
    [
      calendarDay,
      labelViewId,
      scopedLabelIds,
      store.data.issues,
      issueIds,
      customerId,
      store.data.customers,
      passedAssigneeId,
      view,
      store.data.projects,
      store.data.cycles,
      store.data.labels,
      store.data.labelGroups,
      details,
      insightArchived,
      store.data.subscriptions,
      activityByIssue,
      activityVerbByIssue,
      customerFiltering,
      customerMetrics,
      statuses,
      teamId,
      projectId,
      cycleId,
      isMine,
      mineTab,
      section,
      display,
      filter,
      targetUserId,
    ],
  );
  const filterCandidates = useMemo(
    () =>
      scopeCandidates.filter((e) =>
        `${issueName(e)} ${e.title}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [scopeCandidates, query],
  );
  const baseMatching = useMemo(
    () =>
      orderCompletedIssues(
        sortIssueView(
          filterCandidates
            .filter((e) =>
              matchesFilter(
                e,
                filter,
                filterLabelRecords(store.data),
                store.data.projects,
                store.data.cycles,
                { now: calendarDay },
                store.user?.id,
                store.data.issues,
                store.data.milestones,
              ),
            )
            .map((issue) => ({
              ...issue,
              ...(isMine && mineTab === "Activity"
                ? {
                    activityAt: activityByIssue.get(issue.id),
                    activityVerb: activityVerbByIssue.get(issue.id),
                  }
                : {}),
              ...(display.orderBy === "linkCount"
                ? { linkCount: issue.links?.length ?? 0 }
                : {}),
              ...(display.orderBy === "statusId"
                ? {
                    statusOrder: [
                      "started",
                      "unstarted",
                      "backlog",
                      "triage",
                      "completed",
                      "canceled",
                    ].indexOf(
                      statuses.find((s) => s.id === issue.statusId)?.type,
                    ),
                  }
                : {}),
            })),
          display.orderBy === "statusId" ? "statusOrder" : display.orderBy,
          display.orderBy === "sortOrder" ? "asc" : display.direction,
          display.sortRules,
          store.data,
        ),
        statuses,
        display.sortRules?.length ? false : display.orderCompletedByRecency,
      ),
    [
      filterCandidates,
      store.user?.id,
      calendarDay,
      labelViewId,
      scopedLabelIds,
      store.data.issues,
      issueIds,
      passedAssigneeId,
      view,
      store.data.projects,
      store.data.cycles,
      store.data.labels,
      store.data.labelGroups,
      details,
      insightArchived,
      store.data.subscriptions,
      activityByIssue,
      activityVerbByIssue,
      customerFiltering,
      customerMetrics,
      statuses,
      teamId,
      projectId,
      cycleId,
      isMine,
      mineTab,
      section,
      display,
      filter,
      query,
      targetUserId,
    ],
  );
  const filteredEmpty =
    !!(query || filterConditionCount(filter)) && baseMatching.length === 0;
  const hiddenCompletedCount = useMemo(() => {
    if (["active", "backlog", "triage"].includes(section)) return 0;
    return store.data.issues.filter((raw) => {
      if (raw.deletedAt || raw.archivedAt) return false;
      const issue = customerFiltering
        ? withCustomerMetrics(raw, customerMetrics)
        : raw;
      const status = statuses.find((item) => item.id === issue.statusId);
      if (!["completed", "canceled"].includes(status?.type)) return false;
      if (
        display.showCompleted &&
        completedIssueVisible(
          issue,
          display.completedWindow,
          new Date(calendarDay),
          store.data.cycles,
        )
      )
        return false;
      if (teamId && issue.teamId !== teamId) return false;
      if (projectId && issue.projectId !== projectId) return false;
      if (view?.teamId && issue.teamId !== view.teamId) return false;
      if (view?.projectId && issue.projectId !== view.projectId) return false;
      if (
        view?.initiativeId &&
        !store.data.projects.some(
          (project) =>
            project.id === issue.projectId &&
            project.initiativeIds?.includes(view.initiativeId),
        )
      )
        return false;
      if (cycleId && issue.cycleId !== cycleId) return false;
      if (
        passedAssigneeId !== undefined &&
        (issue.assigneeId || "") !== passedAssigneeId
      )
        return false;
      if (
        labelViewId &&
        !(issue.labelIds || []).some((id: string) => scopedLabelIds.has(id))
      )
        return false;
      if (isMine) {
        if (mineTab === "Assigned" && issue.assigneeId !== targetUserId)
          return false;
        if (mineTab === "Created" && issue.creatorId !== targetUserId)
          return false;
        if (
          mineTab === "Subscribed" &&
          !issueSubscribedBy(issue, store.data.subscriptions, targetUserId)
        )
          return false;
        if (mineTab === "Shared" && issue.sharedAccess !== true) return false;
        if (mineTab === "Activity" && !activityByIssue.has(issue.id))
          return false;
      }
      if (!display.showSubIssues && issue.parentId) return false;
      if (
        !`${issueName(issue)} ${issue.title}`
          .toLocaleLowerCase()
          .includes(query.toLocaleLowerCase())
      )
        return false;
      return matchesFilter(
        issue,
        filter,
        filterLabelRecords(store.data),
        store.data.projects,
        store.data.cycles,
        { now: calendarDay },
        store.user?.id,
        store.data.issues,
        store.data.milestones,
      );
    }).length;
  }, [
    activityByIssue,
    calendarDay,
    cycleId,
    customerFiltering,
    customerMetrics,
    display.completedWindow,
    display.showCompleted,
    display.showSubIssues,
    filter,
    isMine,
    labelViewId,
    mineTab,
    passedAssigneeId,
    projectId,
    query,
    scopedLabelIds,
    section,
    statuses,
    store.data,
    store.user?.id,
    targetUserId,
    teamId,
    view,
  ]);
  const matching = useMemo(() => {
    let result = baseMatching;
    if (summary && summarySelection)
      result = result.filter((issue) =>
        matchesSummary(issue, summarySelection),
      );
    else if (details && insightSelection !== null) {
      const ids = new Set(insightSelection);
      result = result.filter((issue) => ids.has(issue.id));
    }
    const order =
      display.orderBy === "sortOrder"
        ? display.manualOrders?.[display.groupBy + ":" + display.subGroupBy]
        : undefined;
    if (order) {
      const positions = new Map(order.map((id, index) => [id, index]));
      result = [...result].sort(
        (a, b) =>
          (positions.get(a.id) ?? Infinity) - (positions.get(b.id) ?? Infinity),
      );
    }
    return result;
  }, [
    baseMatching,
    details,
    insightSelection,
    summary,
    summarySelection,
    display.orderBy,
    display.manualOrders,
    display.groupBy,
    display.subGroupBy,
  ]);
  // Live membership changes must retire selection without retaining phantom actions.
  useEffect(() => {
    if (store.initialSyncing) return;
    const visible = new Set(matching.map((issue) => issue.id));
    setSelection((previous) => {
      const next = previous.filter((id) => visible.has(id));
      return next.length === previous.length ? previous : next;
    });
    if (keyboardRange.current) {
      if (!visible.has(keyboardRange.current.anchor))
        keyboardRange.current = null;
      else
        keyboardRange.current.base = keyboardRange.current.base.filter((id) =>
          visible.has(id),
        );
    }
  }, [matching, store.initialSyncing]);
  const savedGroupOrder = display.groupOrders?.[display.groupBy] ?? display.groupOrder;
  const secondaryGroupOrder = display.groupOrders?.[display.subGroupBy];
  const effectiveGroupOrder =
    isProfile && display.groupBy === "statusId" && !savedGroupOrder?.length
      ? profileStatusOrder(statuses)
      : savedGroupOrder?.length ||
    section !== "active" ||
    display.groupBy !== "statusId"
      ? savedGroupOrder
      : ["started", "unstarted"].flatMap((type) =>
          statuses
            .filter(
              (status) =>
                status.type === type && (!teamId || status.teamId === teamId),
            )
            .map((status) => status.id),
        );
  const unfilteredGroupCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (
      !(summary && summarySelection) &&
      !(details && insightSelection !== null)
    )
      return counts;
    const { columns } = nestIssueGroups(
      baseMatching,
      display.groupBy,
      display.subGroupBy,
      store.data,
      teamId,
      display.showEmpty,
      effectiveGroupOrder,
      secondaryGroupOrder,
    );
    for (const group of columns)
      for (const row of [group, ...(group.subgroups || [])])
        counts.set(
          row.key,
          display.groupCount === "estimate"
            ? row.issues.reduce(
                (sum, issue) =>
                  sum +
                  issueEffort(
                    issue,
                    store.data.teams.find((team) => team.id === issue.teamId),
                  ),
                0,
              )
            : row.issues.length,
        );
    return counts;
  }, [
    baseMatching,
    summary,
    summarySelection,
    details,
    insightSelection,
    display.groupBy,
    display.subGroupBy,
    display.groupCount,
    display.showEmpty,
    effectiveGroupOrder,
    secondaryGroupOrder,
    store.data,
    teamId,
  ]);
  const { groups, allGroups, swimlanes, flat, ancestors } = useMemo(() => {
    const { columns: allGroups, rows: swimlanes } = nestIssueGroups(
      matching,
      display.groupBy,
      display.subGroupBy,
      ["active", "backlog", "triage"].includes(section)
        ? {
            ...store.data,
            statuses: store.data.statuses.filter((s) =>
              section === "active"
                ? ["started", "unstarted"].includes(s.type)
                : s.type === section,
            ),
          }
        : store.data,
      teamId,
      display.showEmpty,
      effectiveGroupOrder,
      secondaryGroupOrder,
    );
    const groups = allGroups.filter(
      (g) => !(display.hiddenGroups?.[display.groupBy] || []).includes(g.id),
    );
    const nestRows = (issues: Entity[]) =>
      display.nestedSubIssues && display.layout === "list"
        ? nestedIssueRows(issues, display.collapsedSubIssues)
        : issues.map((issue) => ({ issue, depth: 0, hasChildren: false }));
    type FlatRow =
      | { type: "group"; group: NestedIssueGroup; id: string; depth: number }
      | {
          type: "issue";
          group: NestedIssueGroup;
          issue: Entity;
          treeDepth?: number;
          hasChildren?: boolean;
          id: string;
          depth: number;
        };
    const flat: FlatRow[] = [],
      ancestors: number[][] = [];
    if (display.sortScope === "entire" && display.layout === "list") {
      for (const nested of nestRows(matching)) {
        const issue = nested.issue;
        const primary = groups.find((g) =>
          g.issues.some((i) => i.id === issue.id),
        );
        if (!primary) continue;
        const group =
          primary.subgroups?.find((g) =>
            g.issues.some((i) => i.id === issue.id),
          ) || primary;
        flat.push({
          type: "issue",
          issue,
          group,
          id: "entire:" + issue.id,
          depth: 0,
          treeDepth: nested.depth,
          hasChildren: nested.hasChildren,
        });
        ancestors.push([]);
      }
      return { groups, allGroups, swimlanes, flat, ancestors };
    }
    for (const group of groups) {
      const primary = display.groupBy !== "none" ? flat.length : -1;
      if (primary >= 0) {
        flat.push({ type: "group", group, id: "group:" + group.key, depth: 0 });
        ancestors.push([primary]);
      }
      if (collapsed.includes(group.key)) continue;
      if (group.subgroups) {
        for (const child of group.subgroups) {
          const secondary = flat.length;
          flat.push({
            type: "group",
            group: child,
            id: "group:" + child.key,
            depth: primary >= 0 ? 1 : 0,
          });
          ancestors.push([primary, secondary].filter((i) => i >= 0));
          if (!collapsed.includes(child.key))
            for (const nested of nestRows(child.issues)) {
              const issue = nested.issue;
              flat.push({
                type: "issue",
                issue,
                treeDepth: nested.depth,
                hasChildren: nested.hasChildren,
                group: child,
                id: child.key + ":" + issue.id,
                depth: 1,
              });
              ancestors.push([primary, secondary].filter((i) => i >= 0));
            }
        }
      } else
        for (const nested of nestRows(group.issues)) {
          const issue = nested.issue;
          flat.push({
            type: "issue",
            issue,
            treeDepth: nested.depth,
            hasChildren: nested.hasChildren,
            group,
            id: group.key + ":" + issue.id,
            depth: 0,
          });
          ancestors.push(primary >= 0 ? [primary] : []);
        }
    }
    return { groups, allGroups, swimlanes, flat, ancestors };
  }, [
    matching,
    display.groupBy,
    display.subGroupBy,
    display.showEmpty,
    effectiveGroupOrder,
    secondaryGroupOrder,
    display.hiddenGroups,
    display.nestedSubIssues,
    display.collapsedSubIssues,
    section,
    display.sortScope,
    display.layout,
    statuses,
    teamId,
    store.data.users,
    store.data.projects,
    store.data.cycles,
    store.data.labels,
    store.data.teams,
    store.data.customers,
    store.data.milestones,
    collapsed,
  ]);
  const hiddenGroupIssueCount = useMemo(() => {
    const hidden = new Set(display.hiddenGroups?.[display.groupBy] || []);
    return allGroups
      .filter((group) => hidden.has(group.id))
      .reduce((count, group) => count + group.issues.length, 0);
  }, [allGroups, display.groupBy, display.hiddenGroups]);
  const hiddenByDisplayCount = hiddenCompletedCount + hiddenGroupIssueCount;
  const stickyIndices = useRef<number[]>([]);
  const virtualizer = useVirtualizer({
    count: flat.length,
    getScrollElement: () => parent.current,
    paddingStart: columnsEditing ? ISSUE_COLUMN_HEADER_HEIGHT : 0,
    scrollPaddingStart: columnsEditing ? ISSUE_COLUMN_HEADER_HEIGHT : 0,
    estimateSize: (index) => (flat[index]?.type === "group" ? 40 : 44),
    overscan: 12,
    rangeExtractor: (range) => {
      const active = ancestors[range.startIndex] || [];
      stickyIndices.current = active;
      return [...new Set([...active, ...defaultRangeExtractor(range)])].sort(
        (a, b) => a - b,
      );
    },
  });
  const orderedIssues = useMemo(
    () =>
      display.layout === "list"
        ? Array.from(
            new Map(
              flat
                .filter((row) => row.type === "issue")
                .map((row) => [row.issue.id, row.issue]),
            ).values(),
          )
        : Array.from(
            new Map(
              groups
                .flatMap((g) =>
                  g.subgroups
                    ? g.subgroups.flatMap((child) => child.issues)
                    : g.issues,
                )
                .map((i) => [i.id, i]),
            ).values(),
          ),
    [groups, matching, flat, display.sortScope, display.layout],
  );
  const selectionEdges = useMemo(() => {
    const selected = new Set(selection),
      edges = new Map<string, { first: boolean; last: boolean }>();
    orderedIssues.forEach((issue, index) => {
      if (!selected.has(issue.id)) return;
      edges.set(issue.id, {
        first: !selected.has(orderedIssues[index - 1]?.id),
        last: !selected.has(orderedIssues[index + 1]?.id),
      });
    });
    return edges;
  }, [orderedIssues, selection]);
  const identifierSamples = useMemo(
    () =>
      [
        ...new Set(
          // Column sizing belongs to the full filtered view, not its disclosure state.
          matching.map((issue) => issueName(issue).replace(/\d/g, "0")),
        ),
      ]
        .sort()
        .join("\n"),
    [matching],
  );
  const [identifierColumnWidth, setIdentifierColumnWidth] = useState(52);
  useLayoutEffect(() => {
    if (display.layout !== "list") return;
    let canceled = false;
    const measure = () => {
      if (canceled) return;
      const probe = document.createElement("span");
      probe.style.cssText =
        'position:fixed;visibility:hidden;pointer-events:none;white-space:pre;font-family:"Inter Variable";font-size:14px;font-weight:450;font-feature-settings:"calt","cpsp","tnum";letter-spacing:-.02em';
      document.body.append(probe);
      let width = 0;
      for (const text of identifierSamples.split("\n")) {
        probe.textContent = text;
        width = Math.max(width, probe.getBoundingClientRect().width);
      }
      probe.remove();
      setIdentifierColumnWidth(Math.max(52, Math.ceil(width) + 1));
    };
    measure();
    void document.fonts.ready.then(measure);
    return () => {
      canceled = true;
    };
  }, [identifierSamples, display.layout]);
  const listIssueContext = useMemo(
    () => ({
      route: location.pathname + location.search + location.hash,
      label: isProfile
        ? displayNameFor(targetUser, store.data, "Member")
        : isMine
          ? "My issues"
          : (labelView?.name ??
            view?.name ??
            (teamId && section === "active"
              ? "Active issues"
              : team?.name || "Issues")),
      ids: orderedIssues.map((row) => row.id),
    }),
    [
      location.pathname,
      location.search,
      location.hash,
      isMine,
      isProfile,
      targetUser,
      store.data,
      labelView?.name,
      view?.name,
      team?.name,
      teamId,
      section,
      orderedIssues,
    ],
  );
  const openListIssue = useCallback(
    (id: string) =>
      navigate(`/issues/${id}`, {
        state: {
          issueContext: (() => {
            const issue = store.data.issues.find((row) => row.id === id);
            const issueTeam = issue
              ? store.data.teams.find((row) => row.id === issue.teamId)
              : undefined;
            return projectScoped && project
              ? {
                  ...listIssueContext,
                  label: project.name,
                  parentLabel: issueTeam?.name,
                  parentRoute: issueTeam
                    ? `/team/${issueTeam.id}/overview`
                    : undefined,
                }
              : listIssueContext;
          })(),
        },
      }),
    [
      navigate,
      listIssueContext,
      projectScoped,
      project,
      store.data.issues,
      store.data.teams,
    ],
  );
  const contextForIssue = useCallback(
    (issue: Entity) => {
      if (!projectScoped || !project) return listIssueContext;
      const issueTeam = store.data.teams.find((row) => row.id === issue.teamId);
      return {
        ...listIssueContext,
        label: project.name,
        parentLabel: issueTeam?.name,
        parentRoute: issueTeam ? `/team/${issueTeam.id}/overview` : undefined,
      };
    },
    [listIssueContext, projectScoped, project, store.data.teams],
  );
  const select = (issue: Entity, event: React.MouseEvent, checkbox = false) => {
    if (checkbox || event.shiftKey || event.metaKey || event.ctrlKey) {
      event.preventDefault();
      setFocus(issue.id);
      if (event.shiftKey && lastSelected.current) {
        const anchor = lastSelected.current;
        setSelection((ids) =>
          issueSelectionRange(orderedIssues, ids, anchor, issue.id),
        );
      } else
        setSelection(
          selection.includes(issue.id)
            ? selection.filter((id) => id !== issue.id)
            : [...selection, issue.id],
        );
      if (!event.shiftKey || !lastSelected.current)
        lastSelected.current = issue.id;
      keyboardRange.current = null;
    } else {
      // A native double-click opens one detail history entry. The browser emits
      // two click events before dblclick; ignore the second navigation.
      if (event.detail > 1) {
        event.preventDefault();
        return;
      }
      openListIssue(issue.id);
    }
  };
  useEffect(() => {
    const listener = (event: Event) => {
      const e = event as CustomEvent;
      if (e.defaultPrevented) return;
      const { command, value } = e.detail ?? {};
      if (
        command === "find-in-page" &&
        document.querySelector('[role="dialog"],dialog[open]')
      )
        return;
      let handled = true;
      const current =
        orderedIssues.find((i) => i.id === focus) ?? orderedIssues[0];
      const primaryGroup = groups.find((g) =>
        g.issues.some((i) => i.id === current?.id),
      );
      const group =
        primaryGroup?.subgroups?.find((g) =>
          g.issues.some((i) => i.id === current?.id),
        ) ?? primaryGroup;
      switch (command) {
        case "save-view":
          setSavingView(true);
          break;
        case "toggle-insights":
          setSummary(false);
          setDetails((value) => !value);
          break;
        case "close-insights":
          setDetails(false);
          setSummary(false);
          break;
        case "toggle-right-sidebar":
          setDetails(false);
          setPersistedSummary((value) => !value);
          break;
        case "focus-item":
        case "extend-selection": {
          const index = orderedIssues.findIndex((i) => i.id === focus);
          const startRangeHere =
            display.layout === "list" &&
            command === "extend-selection" &&
            selection.length === 0;
          const next =
            orderedIssues[
              Math.max(
                0,
                Math.min(
                  orderedIssues.length - 1,
                  startRangeHere
                    ? Math.max(0, index)
                    : index + (value === "up" || value === "left" ? -1 : 1),
                ),
              )
            ];
          if (next) {
            setFocus(next.id);
            setKeyboardFocus(true);
            if (command === "extend-selection") {
              if (!keyboardRange.current)
                keyboardRange.current = {
                  anchor: focus || next.id,
                  base: selection.filter((id) => id !== focus),
                };
              const range = keyboardRange.current;
              setSelection(
                issueSelectionRange(
                  orderedIssues,
                  range.base,
                  range.anchor,
                  next.id,
                ),
              );
            } else keyboardRange.current = null;
            virtualizer.scrollToIndex(
              flat.findIndex(
                (row) => row.type === "issue" && row.issue.id === next.id,
              ),
              { align: "auto" },
            );
          }
          break;
        }
        case "open-focused-item":
          if (current) openListIssue(current.id);
          break;
        case "peek-item":
          if (current) setPeek(current.id);
          break;
        case "toggle-selection":
          if (current) {
            if (value === "extend-current") {
              const anchor = lastSelected.current;
              setSelection((ids) =>
                anchor
                  ? issueSelectionRange(orderedIssues, ids, anchor, current.id)
                  : ids.includes(current.id)
                    ? ids
                    : [...ids, current.id],
              );
              if (!anchor) lastSelected.current = current.id;
            } else {
              lastSelected.current = current.id;
              setSelection((ids) =>
                ids.includes(current.id)
                  ? ids.filter((id) => id !== current.id)
                  : [...ids, current.id],
              );
            }
          }
          break;
        case "clear-selection":
          setSelection([]);
          lastSelected.current = "";
          keyboardRange.current = null;
          break;
        case "select-all":
          setSelection(matching.map((i) => i.id));
          break;
        case "select-group":
          setSelection(group?.issues.map((i) => i.id) ?? []);
          break;
        case "toggle-layout":
          setDisplay((d) => ({
            ...d,
            layout: d.layout === "list" ? "board" : "list",
          }));
          break;
        case "add-filter":
          document
            .querySelector<HTMLButtonElement>(
              'button[aria-label="Add filter"], button[aria-label="Filter issues"]',
            )
            ?.click();
          break;
        case "clear-filters":
          setFilter({ conditions: [], match: "all" });
          break;
        case "clear-last-filter":
          setFilter((f) => ({ ...f, conditions: f.conditions.slice(0, -1) }));
          break;
        case "toggle-group": {
          const hoveredHeader =
            display.layout === "list"
              ? parent.current?.querySelector<HTMLElement>(
                  ".group-header:hover",
                )
              : null;
          const focusedHeader =
            display.layout === "list" &&
            parent.current?.contains(document.activeElement)
              ? document.activeElement?.closest<HTMLElement>(".group-header")
              : null;
          const headerKey = (hoveredHeader ?? focusedHeader)?.dataset.groupKey;
          const headerGroup = headerKey
            ? groups
                .flatMap((item) => [item, ...(item.subgroups ?? [])])
                .find((item) => item.key === headerKey)
            : undefined;
          const targetGroup = headerGroup ?? group;
          if (targetGroup)
            setCollapsed((ids) =>
              ids.includes(targetGroup.key)
                ? ids.filter((id) => id !== targetGroup.key)
                : [...ids, targetGroup.key],
            );
          break;
        }
        case "toggle-all-groups":
          setCollapsed((ids) => (ids.length ? [] : groups.map((g) => g.id)));
          break;
        case "find-in-page":
          setSearchOpen(true);
          requestAnimationFrame(() =>
            document.querySelector<HTMLInputElement>(".view-search")?.focus(),
          );
          break;
        case "reorder-item": {
          if (!current || !group) break;
          if (
            display.orderBy !== "sortOrder" &&
            value !== "left" &&
            value !== "right"
          ) {
            store.toast(
              "Switch to Manual ordering before moving issues with the keyboard.",
            );
            break;
          }
          const items = group.issues;
          if (value === "left" || value === "right") {
            const chosen = selection.length
              ? orderedIssues.filter((i) => selection.includes(i.id))
              : [current];
            const changes = [];
            let moveError: string | null | undefined;
            for (const issue of chosen) {
              const source = groups.find((g) =>
                g.issues.some((i) => i.id === issue.id),
              );
              const nextGroup =
                source &&
                groups[groups.indexOf(source) + (value === "left" ? -1 : 1)];
              if (!nextGroup || display.groupBy === "none") continue;
              moveError = issueGroupMoveError(
                nextGroup.path,
                issue,
                store.data,
              );
              if (moveError) break;
              changes.push({
                kind: "issues" as const,
                action: "update" as const,
                id: issue.id,
                data: issueGroupPatch(
                  display.groupBy,
                  nextGroup.id,
                  store.data,
                  issue,
                  source.id,
                ),
              });
            }
            if (moveError) {
              store.toast(moveError);
              break;
            }
            if (changes.length)
              void store
                .batch(changes)
                .catch((error) => store.toast(error.message));
          } else {
            const ids = new Set(selection.length ? selection : [current.id]);
            const rest = reorderIssueSelection(items, ids, value);
            const orderField =
              display.orderBy === "priority"
                ? "prioritySortOrder"
                : "sortOrder";
            const changes = rest.flatMap((issue, index) =>
              issue[orderField] === index
                ? []
                : [
                    {
                      kind: "issues" as const,
                      action: "update" as const,
                      id: issue.id,
                      data: { [orderField]: index },
                    },
                  ],
            );
            if (changes.length)
              void store
                .batch(changes)
                .catch((error) => store.toast(error.message));
            const groupIds = new Set(items.map((i) => i.id));
            let nextIndex = 0;
            const manual = orderedIssues.map((i) =>
              groupIds.has(i.id) ? rest[nextIndex++].id : i.id,
            );
            setDisplay((d) => ({
              ...d,
              orderBy: "sortOrder",
              manualOrders: {
                ...d.manualOrders,
                [d.groupBy + ":" + d.subGroupBy]: manual,
              },
            }));
          }
          break;
        }
        default:
          handled = false;
      }
      if (handled) e.preventDefault();
    };
    window.addEventListener("workspace-command", listener);
    return () => window.removeEventListener("workspace-command", listener);
  }, [focus, matching, flat, groups, display, selection, openListIssue]);
  const selectedIssues = matching.filter((i) => selection.includes(i.id));
  const contextIssue = context
    ? store.data.issues.find((issue) => issue.id === context.id)
    : undefined;
  const contextGroup = contextIssue
    ? groups
        .flatMap((group) => [group, ...(group.subgroups || [])])
        .find((group) =>
          group.issues.some((issue) => issue.id === contextIssue.id),
        )
    : undefined;
  const contextMovePosition =
    contextIssue && contextGroup
      ? {
          index: contextGroup.issues.findIndex(
            (issue) => issue.id === contextIssue.id,
          ),
          count: contextGroup.issues.length,
        }
      : undefined;
  const triageTarget =
    selectedIssues.length === 1
      ? selectedIssues[0]
      : !selectedIssues.length
        ? matching.find((issue) => issue.id === focus)
        : undefined;
  const selectedEstimate = selectedIssues.reduce(
    (total, issue) =>
      total +
      issueEffort(
        issue,
        store.data.teams.find((team) => team.id === issue.teamId),
      ),
    0,
  );
  const selectionTargetType = section === "backlog" ? "unstarted" : "backlog";
  const selectionMoves = selectedIssues.map((issue) => ({
    issue,
    status: statuses.find(
      (status) =>
        status.teamId === issue.teamId &&
        status.type === selectionTargetType &&
        !status.archivedAt,
    ),
  }));
  const selectionMoveLabel =
    section === "backlog" ? "Move to Active" : "Move to Backlog";
  const canMoveSelection =
    ["active", "backlog"].includes(section) &&
    selectionMoves.length > 0 &&
    selectionMoves.every((row) => row.status);
  const dragEdgeScroll = useDragEdgeScroll(
    parent,
    display.layout === "board",
    display.layout !== "board" || swimlanes.length > 0,
  );
  useBoardPan(parent, display.layout === "board");
  const [dropTarget, setDropTarget] = useState<{
    id: string;
    edge: "before" | "after";
  } | null>(null);
  const [focusDrag, setFocusDrag] = useState<{
    issue: Entity;
    x: number;
    y: number;
  } | null>(null);
  const [focusTarget, setFocusTarget] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const focusGrouping =
    display.groupBy === "focus" || display.subGroupBy === "focus";
  useEffect(() => {
    if (!focusDrag) return;
    let point = { x: focusDrag.x, y: focusDrag.y };
    const measure = (target: EventTarget | null) => {
      const container = parent.current;
      if (
        display.layout === "board" ||
        !container ||
        !(target instanceof Element) ||
        !container.contains(target)
      ) {
        setFocusTarget(null);
        return;
      }
      const key = target
        .closest("[data-focus-drag-group]")
        ?.getAttribute("data-focus-drag-group");
      if (!key) {
        setFocusTarget(null);
        return;
      }
      const clip = container.getBoundingClientRect();
      const boxes = [...container.querySelectorAll("[data-focus-drag-group]")]
        .filter((el) => el.getAttribute("data-focus-drag-group") === key)
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.bottom > clip.top && r.top < clip.bottom);
      if (!boxes.length) {
        setFocusTarget(null);
        return;
      }
      const top = Math.max(clip.top, Math.min(...boxes.map((r) => r.top)));
      const bottom = Math.min(
        clip.bottom,
        Math.max(...boxes.map((r) => r.bottom)),
      );
      setFocusTarget({
        left: clip.left + 8,
        top,
        width: Math.max(0, clip.width - 16),
        height: Math.max(0, bottom - top),
      });
    };
    const track = (event: DragEvent) => {
      point = { x: event.clientX, y: event.clientY };
      dragEdgeScroll.onDragOver(event as unknown as React.DragEvent);
      setFocusDrag((previous) => (previous ? { ...previous, ...point } : null));
    };
    const move = (event: DragEvent) => {
      track(event);
      measure(event.target);
    };
    const drag = (event: DragEvent) => {
      if (event.clientX || event.clientY) track(event);
    };
    const scroll = () => measure(document.elementFromPoint(point.x, point.y));
    const stop = () => {
      dragEdgeScroll.stop();
      setFocusDrag(null);
      setFocusTarget(null);
      setDropTarget(null);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") stop();
    };
    document.addEventListener("dragover", move, true);
    document.addEventListener("drag", drag, true);
    document.addEventListener("dragend", stop, true);
    document.addEventListener("drop", stop, true);
    document.addEventListener("keydown", key, true);
    document.addEventListener("scroll", scroll, true);
    return () => {
      document.removeEventListener("dragover", move, true);
      document.removeEventListener("drag", drag, true);
      document.removeEventListener("dragend", stop, true);
      document.removeEventListener("drop", stop, true);
      document.removeEventListener("keydown", key, true);
      document.removeEventListener("scroll", scroll, true);
    };
  }, [!!focusDrag]);
  const commitGroupOrder = (field: string, ids: string[]) => {
    setDisplay(current => {
      const order = mergeSectionOrder(current.groupOrders?.[field], ids);
      return { ...current, groupOrders: { ...current.groupOrders, [field]: order },
        ...(field === current.groupBy ? { groupOrder: order } : {}) };
    });
  };
  const sectionReorder = useSectionReorder(key, {
    [display.groupBy]: allGroups.map(group => group.id),
    ...(display.subGroupBy !== 'none' && display.subGroupBy !== display.groupBy
      ? { [display.subGroupBy]: swimlanes.map(group => group.id) } : {}),
  }, commitGroupOrder);
  const dragIds = useRef<string[]>([]);
  const dragOverIssue = (event: React.DragEvent, issue: Entity) => {
    if (!event.dataTransfer.types.includes("application/x-parabolic-issues"))
      return;
    dragEdgeScroll.onDragOver(event);
    if (focusGrouping) {
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "none";
      setDropTarget(null);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    const box = event.currentTarget.getBoundingClientRect();
    const edge = event.clientY < box.top + box.height / 2 ? "before" : "after";
    setDropTarget((previous) =>
      previous?.id === issue.id && previous.edge === edge
        ? previous
        : { id: issue.id, edge },
    );
  };
  const dropOnIssue = (
    event: React.DragEvent,
    group: NestedIssueGroup,
    issue: Entity,
  ) => {
    const edge =
      event.clientY <
      event.currentTarget.getBoundingClientRect().top +
        event.currentTarget.getBoundingClientRect().height / 2
        ? "before"
        : "after";
    const following = group.issues
      .slice(group.issues.findIndex((i) => i.id === issue.id) + 1)
      .find((i) => !dragIds.current.includes(i.id));
    moveFromDrag(event, group, edge === "before" ? issue.id : following?.id);
  };
  const startDrag = (
    event: React.DragEvent,
    issue: Entity,
    group: NestedIssueGroup,
  ) => {
    const ids = selection.includes(issue.id)
      ? orderedIssues.filter((i) => selection.includes(i.id)).map((i) => i.id)
      : [issue.id];
    event.dataTransfer.effectAllowed = "move";
    dragIds.current = ids;
    if (focusGrouping) {
      setFocusDrag({ issue, x: event.clientX, y: event.clientY });
      const blank = document.createElement("canvas");
      blank.width = 1;
      blank.height = 1;
      event.dataTransfer.setDragImage(blank, 0, 0);
    }
    event.dataTransfer.setData("text/issue-id", issue.id);
    event.dataTransfer.setData(
      "application/x-parabolic-issues",
      JSON.stringify(ids),
    );
    event.dataTransfer.setData("text/source-group", group.id);
    event.dataTransfer.setData(
      "application/x-parabolic-group-path",
      JSON.stringify(group.path),
    );
  };
  const moveFromDrag = (
    event: React.DragEvent,
    group: NestedIssueGroup,
    beforeId?: string,
  ) => {
    if (event.dataTransfer.types.includes(SECTION_DRAG_TYPE)) return;
    event.preventDefault();
    event.stopPropagation();
    setDropTarget(null);
    if (focusGrouping) {
      setFocusDrag(null);
      store.toast("You can't re-order focus grouping");
      return;
    }
    let ids: string[];
    try {
      ids = JSON.parse(
        event.dataTransfer.getData("application/x-parabolic-issues"),
      );
    } catch {
      ids = [event.dataTransfer.getData("text/issue-id")];
    }
    ids = Array.isArray(ids)
      ? [
          ...new Set(
            ids.filter(
              (id): id is string =>
                typeof id === "string" &&
                store.data.issues.some((i) => i.id === id),
            ),
          ),
        ]
      : [];
    if (!ids.length || (beforeId && ids.includes(beforeId))) return;
    if (display.orderBy !== "sortOrder") {
      let sourcePath: IssueGroupPath = [];
      try {
        sourcePath = JSON.parse(
          event.dataTransfer.getData("application/x-parabolic-group-path"),
        );
      } catch {}
      if (JSON.stringify(sourcePath) === JSON.stringify(group.path)) {
        store.toast(
          "Sort rules control issue order. Choose Manual to reorder issues.",
        );
        return;
      }
      const moving = ids.map((id) =>
        store.data.issues.find((i) => i.id === id)!,
      );
      const error = moving
        .map((issue) =>
          issueGroupMoveError(group.path, issue, store.data, true),
        )
        .find(Boolean);
      if (error) {
        store.toast(error);
        return;
      }
      void store
        .batch(
          moving.map((issue) => ({
            kind: "issues" as const,
            id: issue.id,
            data: issueGroupPathPatch(group, store.data, issue, sourcePath),
          })),
        )
        .catch((error) => store.toast(error.message));
      return;
    }
    const moveError = ids
      .map((id) => {
        const issue = store.data.issues.find((i) => i.id === id);
        return issue
          ? issueGroupMoveError(group.path, issue, store.data, true)
          : "This issue is no longer available.";
      })
      .find(Boolean);
    if (moveError) {
      store.toast(moveError);
      return;
    }
    const rest = group.issues.filter((i) => !ids.includes(i.id));
    const index = beforeId
      ? rest.findIndex((i) => i.id === beforeId)
      : rest.length;
    const previous = rest[index - 1],
      next = rest[index];
    const lower =
        previous?.sortOrder ?? (next?.sortOrder ?? 0) - ids.length - 1,
      upper = next?.sortOrder ?? lower + ids.length + 1;
    let sourcePath: IssueGroupPath = [];
    try {
      sourcePath = JSON.parse(
        event.dataTransfer.getData("application/x-parabolic-group-path"),
      );
    } catch {
      sourcePath = [
        {
          field: display.groupBy,
          id: event.dataTransfer.getData("text/source-group"),
        },
      ];
    }
    if (
      !Array.isArray(sourcePath) ||
      !sourcePath.every(
        (item) =>
          item && typeof item.field === "string" && typeof item.id === "string",
      )
    )
      sourcePath = [];
    const moving = ids.map((id) =>
      store.data.issues.find((issue) => issue.id === id)!,
    );
    const changes = moving.map((issue, n) => ({
      kind: "issues" as const,
      id: issue.id,
      data: {
        sortOrder: lower + ((upper - lower) * (n + 1)) / (ids.length + 1),
        ...issueGroupPathPatch(group, store.data, issue, sourcePath),
      },
    }));
    void store.batch(changes).catch((error) => store.toast(error.message));
    const order = orderedIssues
      .filter((i) => !ids.includes(i.id))
      .map((i) => i.id);
    const lastInGroup = rest.at(-1)?.id;
    const insertion = beforeId
      ? order.indexOf(beforeId)
      : lastInGroup
        ? order.indexOf(lastInGroup) + 1
        : order.length;
    order.splice(insertion < 0 ? order.length : insertion, 0, ...ids);
    setDisplay((d) => ({
      ...d,
      orderBy: "sortOrder",
      direction: "asc",
      manualOrders: {
        ...d.manualOrders,
        [d.groupBy + ":" + d.subGroupBy]: order,
      },
    }));
  };
  const lastStatusTimes = useMemo(() => {
    const result = new Map<string, string>();
    if (!display.properties.includes("timeInStatus")) return result;
    for (const a of store.data.activities)
      if (
        (a.changes?.statusId ||
          a.field === "statusId" ||
          a.before?.statusId !== a.after?.statusId) &&
        a.createdAt > (result.get(a.entityId) ?? "")
      )
        result.set(a.entityId, a.createdAt);
    return result;
  }, [store.data.activities, display.properties]);
  const activityDate = (issue: Entity) =>
    display.properties.includes("activityAt") &&
    issue.activityAt && (
      <time
        className="small muted"
        dateTime={issue.activityAt}
        data-activity-date={issue.activityAt}
        title={`you ${issue.activityVerb || "updated"} ${new Date(issue.updatedAt).toLocaleString()}`}
      >
        {String(issue.activityVerb || "updated").replace(/^./, (letter) =>
          letter.toUpperCase(),
        )}{" "}
        on {myActivityDateLabel(issue.activityAt)}
      </time>
    );
  const inlineProperty = (issue: Entity, field: Property, children: React.ReactNode, triggerClassName = "inline-field-button") => (
    <PropertyPicker inline field={field} value={issue[field]} teamId={issue.teamId} projectId={issue.projectId}
      triggerClassName={triggerClassName} optionsOverride={field === "statusId" ? issue.sharedStatuses : undefined}
      onChange={value => void store.update("issues", issue.id, { [field]: value, ...(field === "projectId" && value !== issue.projectId ? { milestoneId: null } : {}) })}>
      {children}
    </PropertyPicker>
  );
  const extraProperties = (issue: Entity, includeActivity = true) => {
    const customer = customerMetrics.get(issue.id);
    const since = lastStatusTimes.get(issue.id) ?? issue.createdAt;
    return (
      <>
        <IssueColumn id="effectiveCustomerIds">
        {isIssueColumnVisible("effectiveCustomerIds", display.properties) && issue.effectiveCustomerIds?.length > 0 && <CustomerAssignmentControl entity={issue} kind="issues"/>}
        </IssueColumn>
        {display.properties
          .filter(
            (field) =>
              [
                "startDate",
                "duration",
                "timeEstimate",
                "timeLogged",
                "taskType",
                "completedAt",
              ].includes(field) || field.startsWith("customFields."),
          )
          .map((field) => {
            const raw = field.startsWith("customFields.")
              ? issue.customFields?.[field.slice(13)]
              : issue[field];
            const value =
              raw && typeof raw === "object" && !Array.isArray(raw)
                ? raw.value
                : raw;
            if (value == null) return null;
            if (field !== "completedAt") {
              const customKey = field.startsWith("customFields.") ? field.slice(13) : null;
              const label = availableIssueSortFields([issue]).find(([key]) => key === field)?.[1] || field;
              return <IssueColumn id={field} key={field}><InlineIssueValue label={label} value={value} date={field === "startDate"} onChange={next => store.update("issues", issue.id, customKey ? { customFields: { ...issue.customFields, [customKey]: raw && typeof raw === "object" && !Array.isArray(raw) ? { ...raw, value: next } : next } } : { [field]: next })} /></IssueColumn>;
            }
            return (
              <IssueColumn id={field} key={field}><span
                className="small muted"
                key={field}
                title={
                  availableIssueSortFields([issue]).find(
                    ([key]) => key === field,
                  )?.[1]
                }
              >
                {String(value)}
              </span></IssueColumn>
            );
          })}
        <IssueColumn id="cycleId">
        {display.properties.includes("cycleId") && issue.cycleId && (
          inlineProperty(issue, "cycleId", <Badge>
            <Icon name="Repeat" size={12} />
            {store.data.cycles.find((c) => c.id === issue.cycleId)?.name}
          </Badge>)
        )}
        </IssueColumn>
        <IssueColumn id="milestoneId">
        {display.properties.includes("milestoneId") && issue.milestoneId && (
          inlineProperty(issue, "milestoneId", <Badge>
            <Icon name="Diamond" size={12} />
            {
              store.data.milestones.find((m) => m.id === issue.milestoneId)
                ?.name
            }
          </Badge>)
        )}
        </IssueColumn>
        <IssueColumn id="links">
        {display.properties.includes("links") &&
          (issue.links?.length ?? 0) > 0 && (
            <Badge>
              <Icon name="Link" size={12} />
              {issue.links.length}
            </Badge>
          )}
        </IssueColumn>
        <IssueColumn id="customerCount">
        {display.properties.includes("customerCount") && customer && (
          <Badge>
            <Icon
              name={customer.customerImportant ? "Triangle" : "Building2"}
              size={12}
            />
            {customer.customerCount}{" "}
            {customer.customerCount === 1 ? "customer" : "customers"}
          </Badge>
        )}
        </IssueColumn>
        <IssueColumn id="customerRevenue">
        {display.properties.includes("customerRevenue") && customer && (
          <Badge>
            {new Intl.NumberFormat(undefined, {
              maximumFractionDigits: 0,
            }).format(customer.customerRevenue)}{" "}
            {workspace?.customerSettings?.revenueUnit ?? "USD"}
          </Badge>
        )}
        </IssueColumn>
        <IssueColumn id="timeInStatus">
        {display.properties.includes("timeInStatus") && (
          <span
            className="small muted"
            title={`In status since ${new Date(since).toLocaleString()}`}
          >
            {Math.max(
              0,
              Math.floor((Date.now() - Date.parse(since)) / 86400000),
            )}
            d in status
          </span>
        )}
        </IssueColumn>
        {includeActivity && <IssueColumn id="activityAt">{activityDate(issue)}</IssueColumn>}
        <IssueColumn id="updatedAt">
        {display.properties.includes("updatedAt") && (
          <time className="small muted">{relativeDate(issue.updatedAt)}</time>
        )}
        </IssueColumn>
      </>
    );
  };
  const issueRow = (
    issue: Entity,
    group: (typeof groups)[number],
    treeDepth = 0,
    hasChildren = false,
  ) => {
    const status = statuses.find((s) => s.id === issue.statusId),
      person = store.data.users.find((u) => u.id === issue.assigneeId),
      project = store.data.projects.find((p) => p.id === issue.projectId);
    return (
      <div
        data-issue-id={issue.id}
        aria-label={display.properties.includes("hideTitle") ? `${issueName(issue)}: ${issue.title}` : undefined}
        data-focus-drag-group={
          group.path.find((part) => part.field === "focus")?.id
        }
        data-status-type={status?.type}
        data-tree-depth={display.nestedSubIssues ? treeDepth : undefined}
        data-keyboard-active={focus === issue.id && keyboardFocus}
        data-first-selected={selectionEdges.get(issue.id)?.first}
        data-last-selected={selectionEdges.get(issue.id)?.last}
        style={
          display.nestedSubIssues && !columnsAligned
            ? { paddingLeft: 16 + treeDepth * 20 }
            : columnsAligned ? { "--issue-tree-indent": `${treeDepth * 20}px` } as React.CSSProperties : undefined
        }
        aria-level={display.nestedSubIssues ? treeDepth + 1 : undefined}
        className={`issue-row ${selection.includes(issue.id) ? "selected" : ""} ${focus === issue.id ? "focused" : ""}`}
        role="row"
        tabIndex={isDirectTeamIssueRoute ? -1 : 0}
        aria-selected={selection.includes(issue.id)}
        draggable
        onDragStart={(e) => startDrag(e, issue, group)}
        onDragOver={(e) => dragOverIssue(e, issue)}
        onDragEnd={() => {
          setDropTarget(null);
          dragIds.current = [];
        }}
        data-drop-edge={
          dropTarget?.id === issue.id ? dropTarget.edge : undefined
        }
        onDrop={(e) => dropOnIssue(e, group, issue)}
        onClick={(e) => select(issue, e)}
        onMouseEnter={() => {
          if (!keyboardFocus) setFocus(issue.id);
        }}
        onMouseMove={() => {
          if (focus !== issue.id || keyboardFocus) {
            setFocus(issue.id);
            setKeyboardFocus(false);
          }
        }}
        onFocus={(event) => {
          setFocus(issue.id);
          setKeyboardFocus(
            (event.target as HTMLElement).matches(":focus-visible"),
          );
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          if (!selection.includes(issue.id)) setSelection([]);
          setFocus(issue.id);
          setContext({ id: issue.id, x: e.clientX, y: e.clientY });
        }}
        data-testid="issue-row"
      >
        {isDirectTeamIssueRoute && (
          <Link
            className="issue-row-direct-link"
            to={`/issues/${issue.id}`}
            state={{ issueContext: contextForIssue(issue) }}
            aria-label={`Open ${issueName(issue)} ${issue.title}`}
            draggable={false}
          />
        )}
        <button
          className="row-checkbox"
          aria-label={`Select ${issueName(issue)}`}
          aria-pressed={selection.includes(issue.id)}
          onClick={(e) => {
            e.stopPropagation();
            select(issue, e, true);
          }}
        >
          <span className="row-checkbox-box">
            {selection.includes(issue.id) ? (
              <Icon name="Check" size={12} />
            ) : null}
          </span>
        </button>
        <OrderedIssueColumns order={columnsAligned || display.columnOrder?.length ? columnOrder : undefined} visibleFields={columnsAligned ? visibleColumnFields : undefined}>
        <IssueColumn id="priority">
        {display.properties.includes("priority") && (
          <PropertyPicker
            inline
            field="priority"
            value={issue.priority}
            onChange={(v) =>
              void store.update("issues", issue.id, { priority: v })
            }
            compact
          >
            <PriorityIcon priority={issue.priority} />
          </PropertyPicker>
        )}
        </IssueColumn>
        <IssueColumn id="identifier">
        {display.properties.includes("identifier") && (
          <span className="issue-identifier">{issueName(issue)}</span>
        )}
        </IssueColumn>
        <IssueColumn id="statusId">
        {display.properties.includes("statusId") && (
          <PropertyPicker
            inline
            field="statusId"
            optionsOverride={issue.sharedStatuses}
            value={issue.statusId}
            teamId={issue.teamId}
            onChange={(v) =>
              void store.update("issues", issue.id, { statusId: v })
            }
            compact
          >
            <StatusIcon status={status} size={14} />
          </PropertyPicker>
        )}
        </IssueColumn>
        <IssueColumn id="title">
        {isIssueColumnVisible("title", display.properties) && <span className="issue-row-title">
          {display.nestedSubIssues && hasChildren && (
            <button
              className="issue-tree-toggle"
              aria-label={
                (display.collapsedSubIssues?.includes(issue.id)
                  ? "Expand sub-issues for "
                  : "Collapse sub-issues for ") + issueName(issue)
              }
              aria-expanded={!display.collapsedSubIssues?.includes(issue.id)}
              onClick={(e) => {
                e.stopPropagation();
                setDisplay((d) => ({
                  ...d,
                  collapsedSubIssues: d.collapsedSubIssues?.includes(issue.id)
                    ? d.collapsedSubIssues.filter((id) => id !== issue.id)
                    : [...(d.collapsedSubIssues || []), issue.id],
                }));
              }}
            >
              <Icon
                name={
                  display.collapsedSubIssues?.includes(issue.id)
                    ? "ChevronRight"
                    : "ChevronDown"
                }
                size={12}
              />
            </button>
          )}
          {!display.nestedSubIssues && issue.parentId && (
            <Icon name="ArrowUpRight" size={13} />
          )}
          {issue.title}
        </span>}
        </IssueColumn>
        <IssueColumn id="labelIds">
        {display.properties.includes("labelIds") &&
          (issue.labelIds ?? []).map((id: string) => {
            const label = store.data.labels.find((l) => l.id === id);
            return label ? (
              <Badge
                key={id}
                color={label.color}
                description={label.description}
              >
                {inlineProperty(issue, "labelIds", label.name)}
              </Badge>
            ) : null;
          })}
        </IssueColumn>
        <IssueColumn id="projectId">
        {!projectScoped &&
          display.groupBy !== "projectId" &&
          display.subGroupBy !== "projectId" &&
          display.properties.includes("projectId") &&
          project && (
            inlineProperty(issue, "projectId", <>
              <EntityIcon entity={project} fallback="Box" size={14} />
              <span>{project.name}</span>
            </>, "issue-project-badge")
          )}
        </IssueColumn>
        <IssueColumn id="dueDate">
        {issue.dueDate && display.properties.includes("dueDate") && (
          <InlineDueDatePicker value={issue.dueDate} now={calendarDay} onChange={dueDate => store.update("issues", issue.id, { dueDate })} />
        )}
        </IssueColumn>
        <IssueColumn id="slaStatus">
        {issue.slaDueAt && display.properties.includes("slaStatus") && (
          <InlineIssueSla issue={issue} />
        )}
        </IssueColumn>
        <IssueColumn id="estimate">
        {isIssueColumnVisible("estimate", display.properties, projectScoped) &&
          issue.estimate != null && (
            <span className="issue-estimate-control">
              <PropertyPicker
                inline
                field="estimate"
                value={issue.estimate}
                teamId={issue.teamId}
                compact
                onChange={(value) =>
                  void store.update("issues", issue.id, { estimate: value })
                }
              >
                <span className="issue-estimate">
                  <EntityIcon entity={{ icon: "Estimate" }} size={12} />
                  <span>
                    {estimateLabel(
                      issue.estimate,
                      store.data.teams.find((team) => team.id === issue.teamId),
                    )}
                  </span>
                </span>
              </PropertyPicker>
            </span>
          )}
        </IssueColumn>
        {extraProperties(issue, false)}
        <IssueColumn id="assigneeId">
        {display.properties.includes("assigneeId") && (
          inlineProperty(issue, "assigneeId", <Avatar user={person} size={18} />, "inline-field-button inline-assignee-button")
        )}
        </IssueColumn>
        <IssueColumn id="activityAt">
        {activityDate(issue)}
        </IssueColumn>
        <IssueColumn id="createdAt">
        {display.properties.includes("createdAt") && (
          <time className="issue-row-date">
            {new Date(issue.createdAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </time>
        )}
        </IssueColumn>
        </OrderedIssueColumns>
      </div>
    );
  };
  const renderBoardCard = (issue: Entity, group: NestedIssueGroup) => {
    const parentIssue = issue.parentId
      ? store.data.issues.find((candidate) => candidate.id === issue.parentId)
      : undefined;
    const childIssues = store.data.issues.filter(
      (candidate) =>
        !candidate.deletedAt &&
        !candidate.archivedAt &&
        candidate.parentId === issue.id,
    );
    const completedChildCount = childIssues.filter((candidate) => {
      const type = statuses.find(
        (status) => status.id === candidate.statusId,
      )?.type;
      return type === "completed" || type === "canceled";
    }).length;
    const project = issue.projectId
      ? store.data.projects.find(
          (candidate) => candidate.id === issue.projectId,
        )
      : undefined;
    return (
      <div
        key={issue.id}
        data-issue-id={issue.id}
        onContextMenu={(e) => {
          e.preventDefault();
          if (!selection.includes(issue.id)) setSelection([]);
          setFocus(issue.id);
          setContext({
            id: issue.id,
            x: e.clientX,
            y: e.clientY,
          });
        }}
        draggable
        onDragStart={(e) => startDrag(e, issue, group)}
        onDragOver={(e) => dragOverIssue(e, issue)}
        onDragEnd={() => {
          setDropTarget(null);
          dragIds.current = [];
        }}
        data-drop-edge={
          dropTarget?.id === issue.id ? dropTarget.edge : undefined
        }
        onDrop={(e) => dropOnIssue(e, group, issue)}
        className={`board-card ${selection.includes(issue.id) ? "selected" : ""}`}
        onClick={(e) => select(issue, e)}
        onMouseEnter={() => setFocus(issue.id)}
      >
        <div className="board-card-top">
          {display.properties.includes("identifier") && (
            <span className="board-card-identifier">{issueName(issue)}</span>
          )}
          {parentIssue && (
            <span className="board-card-parent" data-tooltip-label={parentIssue.title}>
              <Icon name="ChevronRight" size={11} />
              <span>{parentIssue.title}</span>
            </span>
          )}
          <span className="spacer" />
          {display.properties.includes("assigneeId") && (
            inlineProperty(issue, "assigneeId", <Avatar
              user={store.data.users.find((u) => u.id === issue.assigneeId)}
              size={18}
            />, "inline-field-button inline-assignee-button")
          )}
        </div>
        <div className="board-card-title">
          {display.properties.includes("statusId") && (
            inlineProperty(issue, "statusId", <StatusIcon
              status={statuses.find((st) => st.id === issue.statusId)}
            />)
          )}
          <span>{issue.title}</span>
        </div>
        <div className="board-card-properties">
          {display.properties.includes("priority") && (
            inlineProperty(issue, "priority", <span className="board-card-priority-chip">
              <PriorityIcon priority={issue.priority} />
            </span>)
          )}
          {display.properties.includes("projectId") && project && (
            <BoardProjectHover
              project={project}
              data={store.data}
              stats={boardProjectStatistics.get(project.id)}
            >{inlineProperty(issue, "projectId", <><EntityIcon entity={project} fallback="Box" size={12} /><span>{project.name}</span></>, "board-project-badge")}</BoardProjectHover>
          )}
          {display.properties.includes("estimate") &&
            issue.estimate != null && (
              inlineProperty(issue, "estimate", <Badge className="board-card-estimate">
                <EntityIcon entity={{ icon: "Estimate" }} size={12} />
                {estimateLabel(
                  issue.estimate,
                  store.data.teams.find((team) => team.id === issue.teamId),
                )}
              </Badge>)
            )}
          {childIssues.length > 0 && (
            <Badge className="board-card-sub-issue-progress">
              <StatusIcon
                status={{
                  type:
                    completedChildCount === childIssues.length
                      ? "completed"
                      : "backlog",
                  color: "#71717a",
                }}
                size={13}
              />
              {completedChildCount}/{childIssues.length}
            </Badge>
          )}
          {display.properties.includes("labelIds") &&
            (issue.labelIds ?? []).map((id: string) => {
              const label = store.data.labels.find((l) => l.id === id);
              return label ? (
                <Badge
                  key={id}
                  color={label.color}
                  description={label.description}
                >
                  {inlineProperty(issue, "labelIds", label.name)}
                </Badge>
              ) : null;
            })}
          {display.properties.includes("dueDate") && issue.dueDate && (
            <InlineDueDatePicker value={issue.dueDate} now={calendarDay} onChange={dueDate => store.update("issues", issue.id, { dueDate })} />
          )}
          {display.properties.includes("slaStatus") && issue.slaDueAt && (
            <InlineIssueSla issue={issue} />
          )}
          {extraProperties(issue)}
        </div>
        {display.properties.includes("createdAt") && (
          <time>
            Created{" "}
            {new Date(issue.createdAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </time>
        )}
      </div>
    );
  };
  const viewFavorite = store.data.favorites.find(
    (f) =>
      !f.deletedAt &&
      f.userId === store.user?.id &&
      (f.route === location.pathname || (viewId && f.entityId === viewId)),
  );
  const toggleViewFavorite = () =>
    viewFavorite
      ? void store.remove("favorites", viewFavorite.id)
      : void store.create("favorites", {
          userId: store.user?.id,
          type: "view",
          entityId: labelViewId ?? viewId ?? (isProfile ? targetUserId : teamId) ?? "my",
          label: labelView?.name ?? view?.name ?? (isProfile ? displayNameFor(targetUser,store.data,"Member") : `${team?.name ?? ""} Issues`),
          route: location.pathname,
        });
  const duplicateView = async () => {
    if (!view) return;
    const { duplicateIssueViewRouteState } =
      await import("./duplicate-issue-view");
    navigate("/views/issues/new", {
      state: duplicateIssueViewRouteState(view, location.pathname),
    });
  };
  const labelNavigationChoices = [
    ...active(store.data.labels)
      .filter(
        (item) => (item.entityType || "issues") === "issues" && !item.isGroup,
      )
      .map((item) => ({ item, route: "/label/" + item.id })),
    ...active(store.data.labelGroups)
      .filter((item) => (item.entityType || "issues") === "issues")
      .map((item) => ({ item, route: "/label-group/" + item.id })),
  ]
    .filter(({ item }) =>
      item.name?.toLocaleLowerCase().includes(labelQuery.toLocaleLowerCase()),
    )
    .sort((a, b) => String(a.item.name).localeCompare(String(b.item.name)));
  const createInGroup = (group: NestedIssueGroup) =>
    openComposer({
      teamId,
      projectId,
      cycleId,
      ...(labelView && !labelView.archivedAt && !isLabelGroupView
        ? { labelIds: [labelView.id] }
        : {}),
      ...issueGroupCreationDefaults(group, store.data),
      ...(customerId?{directCustomerIds:[customerId]}:{}),
      ...assignedCreationDefaults,
    });
  const renderGroupHeader = (
    group: NestedIssueGroup,
    depth = 0,
    board = false,
  ) => (
    <div
      className={"group-header reorderable-section" + (depth ? " issue-subgroup-header" : "")}
      {...sectionReorder.headerProps(group.path.at(-1)!.field, group.id, board, e => moveFromDrag(e, group))}
      data-group-key={group.key}
      data-focus-drag-group={
        group.path.find((part) => part.field === "focus")?.id
      }
      data-group-field={group.path.at(-1)?.field}
      data-group-id={group.id}
    >
      {sectionReorder.handle(group.path.at(-1)!.field, group.id, group.name)}
      {!board && (
        <button
          className="icon-button group-toggle"
          aria-label={
            (collapsed.includes(group.key) ? "Expand" : "Collapse") + " group"
          }
          aria-expanded={!collapsed.includes(group.key)}
          onClick={(event) =>
            setCollapsed((ids) => {
              if (event.altKey) {
                const keys = groups.map((item) => item.key);
                return keys.every((key) => ids.includes(key)) ? [] : keys;
              }
              return ids.includes(group.key)
                ? ids.filter((id) => id !== group.key)
                : [...ids, group.key];
            })
          }
        >
          <Icon
            name={
              collapsed.includes(group.key) ? "ChevronRight" : "ChevronDown"
            }
            size={12}
          />
        </button>
      )}
      {group.path.at(-1)?.field === "statusId" ? (
        <StatusIcon status={group.entity} />
      ) : group.path.at(-1)?.field === "assigneeId" ? (
        <Avatar user={group.entity} size={16} />
      ) : group.path.at(-1)?.field === "priority" ? (
        <PriorityIcon priority={Number(group.id) || 0} />
      ) : group.path.at(-1)?.field === "projectId" && group.entity ? (
        <EntityIcon entity={group.entity} fallback="Box" size={16} />
      ) : group.color ? (
        <span className="group-color-dot" style={{ background: group.color }} />
      ) : null}
      <strong>
        {(group.path.at(-1)?.field === "labelIds" ||
          isIssueLabelGroup(group.path.at(-1)?.field || "")) &&
        group.entity ? (
          <Link
            to={`/label/${group.entity.id}`}
            onClick={(event) => event.stopPropagation()}
          >
            {group.name}
          </Link>
        ) : (
          group.name
        )}
      </strong>
      <button
        className="group-count"
        aria-label={isDirectTeamIssueRoute ? undefined : "Toggle group count"}
        data-tooltip={
          display.groupCount === "estimate"
            ? "Estimate points\nClick to show issue counts"
            : "Issue count\nClick to show estimate points"
        }
        data-tooltip-variant="group-summary"
        onClick={() =>
          setDisplay((d) => ({
            ...d,
            groupCount: d.groupCount === "estimate" ? "issues" : "estimate",
          }))
        }
      >
        {display.groupCount === "estimate" && (
          <EntityIcon entity={{ icon: "Estimate" }} size={12} />
        )}
        {display.groupCount === "estimate"
          ? group.issues.reduce(
              (sum, issue) =>
                sum +
                issueEffort(
                  issue,
                  store.data.teams.find((team) => team.id === issue.teamId),
                ),
              0,
            )
          : group.issues.length}
        {unfilteredGroupCounts.has(group.key) && (
          <span className="muted">
            {" "}
            / {unfilteredGroupCounts.get(group.key)}
          </span>
        )}
      </button>
      <span className="spacer" />
      {board && (
        <BoardColumnMenu
          group={group}
          onSelect={() => {
            setSelection(group.issues.map((issue) => issue.id));
            setFocus(group.issues[0]?.id || "");
          }}
          onHide={() =>
            setDisplay((current) => ({
              ...current,
              hiddenGroups: {
                ...current.hiddenGroups,
                [current.groupBy]: [
                  ...new Set([
                    ...(current.hiddenGroups?.[current.groupBy] || []),
                    group.id,
                  ]),
                ],
              },
            }))
          }
        />
      )}
      <button
        className="icon-button"
        aria-label="Create new issue"
        onClick={() => createInGroup(group)}
      >
        <Icon name="Plus" size={14} />
      </button>
    </div>
  );

  if (teamId && !team && !store.initialSyncing && !store.hydrating)
    return <EmptyState title="Team not found" />;

  return (
    <div
      className={`issue-view ${isProfile ? "profile-issues" : ""} ${embedded ? "embedded-issues" : ""} ${projectScoped ? "project-scoped-issues" : ""} ${editingView ? "editing-saved-view" : ""}`}
      data-focused-id={focus}
      data-selected-ids={selection.join(",")}
    >
      {focusDrag &&
        focusTarget &&
        display.layout !== "board" &&
        createPortal(
          <div
            className="issue-focus-drag-target"
            data-testid="focus-drag-target"
            style={focusTarget}
          />,
          document.body,
        )}
      {focusDrag &&
        createPortal(
          <>
            <div
              className="issue-focus-drag-preview"
              style={{
                left: Math.min(focusDrag.x + 8, innerWidth - 230),
                top: Math.min(focusDrag.y - 23, innerHeight - 50),
              }}
            >
              <PriorityIcon priority={focusDrag.issue.priority} />
              <span className="issue-focus-drag-id">
                {issueName(focusDrag.issue)}
              </span>
              <StatusIcon
                status={statuses.find(
                  (status) => status.id === focusDrag.issue.statusId,
                )}
                size={14}
              />
              <span>{focusDrag.issue.title}</span>
            </div>
            <div className="issue-focus-drag-message" role="status">
              You can't re-order focus grouping
            </div>
          </>,
          document.body,
        )}
      {triageTarget && (
        <TriageActions
          key={triageTarget.id}
          issue={triageTarget}
          controls={false}
        />
      )}
      {!embedded && (
        <header
          className={`page-header ${labelViewId ? "label-view-header" : ""}`}
        >
          {!isMine && !labelViewId && (
            <span className="breadcrumb-icon" style={{ color: team?.color }}>
              {view && !nativeTeamTriageBoard ? (
                <EntityIcon entity={view} fallback="Layers" />
              ) : team ? (
                <EntityIcon entity={team} fallback="Users" />
              ) : (
                <Icon
                  name={labelViewId ? "Tag" : isMine ? "CheckCheck" : "Users"}
                />
              )}
            </span>
          )}
          {team && !labelViewId && (
            <>
              <Link to={`/team/${team.id}/overview`}>{team.name}</Link>
              <Icon name="ChevronRight" size={12} />
            </>
          )}
          <h1>
            {labelView ? (
              <Dropdown
                menuClassName="label-view-picker"
                trigger={
                  <button
                    className="label-view-trigger"
                    aria-label="Open issue label"
                    onClick={() => setLabelQuery("")}
                  >
                    {isLabelGroupView ? (
                      <LabelGroupGlyph />
                    ) : (
                      <span
                        className="label-view-color"
                        style={{
                          background: labelView.color || "var(--accent)",
                        }}
                      />
                    )}
                    <span>{labelView.name}</span>
                    <Icon name="ChevronDown" size={12} />
                  </button>
                }
              >
                <input
                  autoFocus
                  aria-label="Open issue label…"
                  placeholder="Open issue label…"
                  value={labelQuery}
                  onChange={(event) => setLabelQuery(event.target.value)}
                />
                <div className="menu-scroll">
                  {labelNavigationChoices.map(({ item, route }) => (
                    <MenuItem key={route} onClick={() => navigate(route)}>
                      {route.includes("/label-group/") ? (
                        <LabelGroupGlyph />
                      ) : (
                        <span
                          className="label-view-color"
                          style={{ background: item.color || "var(--accent)" }}
                        />
                      )}
                      {item.name}
                    </MenuItem>
                  ))}
                </div>
              </Dropdown>
            ) : isProfile ? (
              <Dropdown
                trigger={
                  <button
                    className="profile-user-trigger"
                    aria-label="Open user"
                    onClick={() => setProfileQuery("")}
                  >
                    <Avatar user={targetUser} size={20} />
                    {displayNameFor(
                      targetUser,
                      store.data,
                      "Member unavailable",
                    )}
                    <Icon name="ChevronDown" size={12} />
                  </button>
                }
              >
                <input
                  autoFocus
                  aria-label="Open user…"
                  placeholder="Open user…"
                  value={profileQuery}
                  onChange={(e) => setProfileQuery(e.target.value)}
                />
                {store.data.users
                  .filter(
                    (user) =>
                      !user.deletedAt &&
                      displayNameFor(user, store.data)
                        .toLowerCase()
                        .includes(profileQuery.toLowerCase()),
                  )
                  .map((user) => (
                    <MenuItem
                      key={user.id}
                      onClick={() => navigate("/profiles/" + user.id)}
                    >
                      <span aria-hidden="true">
                        <Avatar user={user} size={16} />
                      </span>
                      {displayNameFor(user, store.data)}
                    </MenuItem>
                  ))}
              </Dropdown>
            ) : isMine ? (
              targetUserId === store.user?.id ? (
                "My issues"
              ) : (
                `${displayNameFor(targetUser, store.data, "Member")}’s issues`
              )
            ) : labelViewId ? (
              "Label unavailable"
            ) : nativeTeamTriageBoard ? (
              "Issues"
            ) : (
              (view?.name ?? "Issues")
            )}
          </h1>
          {isProfile && targetUserId !== store.user?.id && (
            <>
              <button
                className="icon-button"
                role="switch"
                aria-checked={!!viewFavorite}
                aria-label={viewFavorite ? "Remove from favorites" : "Add to favorites"}
                onClick={toggleViewFavorite}
              >
                <Icon name="Star" size={14} style={viewFavorite?{fill:"currentColor"}:undefined}/>
              </button>
              <Dropdown
                align="right"
                menuClassName="profile-notification-dropdown"
                trigger={<button className="icon-button" aria-label="Setup user view notifications"><Icon name="Bell" size={14}/></button>}
              >
                <div className="profile-notification-popover" data-keep-open>
                  <h2>Send inbox notifications for</h2>
                  <label>
                    <span>The user is assigned an issue</span>
                    <input type="checkbox" checked={profileNotifications.assigned} onChange={(event) => setProfileNotification("assigned", event.target.checked)}/>
                  </label>
                  <label>
                    <span>An issue is marked completed or canceled</span>
                    <input type="checkbox" checked={profileNotifications.closed} onChange={(event) => setProfileNotification("closed", event.target.checked)}/>
                  </label>
                </div>
              </Dropdown>
            </>
          )}
          {!isMine && !editingView && (
            <button
              className="icon-button"
              role={labelView || isDirectTeamIssueRoute ? "switch" : undefined}
              aria-label={
                labelView
                  ? viewFavorite
                    ? "Remove from favorites"
                    : "Add to favorites"
                  : isDirectTeamIssueRoute
                    ? viewFavorite
                      ? "Remove from favorites"
                      : "Add to favorites"
                  : viewFavorite
                    ? "Unfavorite view"
                    : "Favorite view"
              }
              aria-checked={
                labelView || isDirectTeamIssueRoute
                  ? !!viewFavorite
                  : undefined
              }
              aria-pressed={
                labelView || isDirectTeamIssueRoute
                  ? undefined
                  : !!viewFavorite
              }
              onClick={toggleViewFavorite}
            >
              <Icon
                name="Star"
                size={14}
                style={
                  viewFavorite
                    ? { fill: "currentColor", color: "#e8b600" }
                    : undefined
                }
              />
            </button>
          )}
          {view && !nativeTeamTriageBoard && (
            <ViewSubscriptionMenu
              view={view}
              onEdit={() =>
                navigate({
                  pathname: `/view/${view.id}/edit`,
                  search: location.search,
                })
              }
              onDuplicate={() => void duplicateView()}
              onMove={(location) => {
                const [scope, id] = location.split(":");
                void store.update("views", view.id, {
                  visibility: scope === "personal" ? "personal" : "workspace",
                  teamId: scope === "team" ? id : null,
                  projectId: null,
                  initiativeId: null,
                });
              }}
              onDelete={() => setDeletingView(true)}
            />
          )}
          {labelView && (
            <LabelViewOptions
              entity={labelView}
              kind={isLabelGroupView ? "labelGroups" : "labels"}
              members={labelGroupMembers}
            />
          )}
          <span className="spacer" />
          {(!view || nativeTeamTriageBoard) && !labelViewId && !isProfile && (
            <button
              className="icon-button"
              aria-label={
                isDirectTeamIssueRoute
                  ? section === "all"
                    ? "Setup team notifications"
                    : section === "active"
                      ? "Setup active issues notifications"
                      : `Setup ${section} notifications`
                  : "Open notifications"
              }
              title="Notifications"
              onClick={() => navigate("/inbox")}
            >
              <Icon name="Bell" size={14} />
            </button>
          )}
          {!view && !isMine && !labelViewId && !isDirectTeamIssueRoute && (
            <Button
              variant="ghost"
              onClick={() =>
                openComposer({
                  teamId,
                  projectId,
                  cycleId,
                  ...(labelView && !labelView.archivedAt && !isLabelGroupView
                    ? { labelIds: [labelView.id] }
                    : {}),
                })
              }
            >
              <Icon name="Plus" size={14} />
              New issue
            </Button>
          )}
        </header>
      )}
      <div className="view-toolbar">
        {embedded ? (
          projectScoped ? null : (
            <Button
              variant="ghost"
              onClick={() =>
                openComposer({
                  teamId: teamId || view?.teamId,
                  projectId: projectId || view?.projectId,
                  cycleId,
                  ...(labelView && !labelView.archivedAt && !isLabelGroupView
                    ? { labelIds: [labelView.id] }
                    : {}),
                })
              }
            >
              <Icon name="Plus" size={14} />
              New issue
            </Button>
          )
        ) : labelViewId ? null : (
          <div
            className={`page-tabs ${isMine && !isProfile ? "my-issue-tabs" : ""} ${isDirectTeamIssueRoute ? "team-issue-tabs" : ""}`}
          >
            {isMine ? (
              (isProfile
                ? ["Assigned", "Created"]
                : myIssueTabs.filter(
                    (tab) => tab !== "Shared" || mineTab === "Shared",
                  )
              ).map((tab) => (
                isProfile ? (
                  <Link
                    key={tab}
                    className={mineTab === tab ? "active" : ""}
                    aria-current={mineTab === tab ? "page" : undefined}
                    to={"/profiles/" + params.profileId + (tab === "Created" ? "/created" : "")}
                  >
                    {tab}
                  </Link>
                ) : (
                  <button
                    key={tab}
                    className={mineTab === tab ? "active" : ""}
                    onClick={() => setMineTab(tab)}
                  >
                    {tab}
                  </button>
                )
              ))
            ) : view ? (
              view.teamId ? (
                <>
                  {["active", "backlog", "all"].map((section) => (
                    <Link
                      key={section}
                      to={"/team/" + view.teamId + "/" + section}
                    >
                      {section === "all"
                        ? "All issues"
                        : section === "active"
                          ? "Active"
                          : "Backlog"}
                    </Link>
                  ))}
                  {active(store.data.views)
                    .filter(
                      (item) =>
                        (item.entityType || "issues") === "issues" &&
                        item.teamId === view.teamId,
                    )
                    .map((item) => {
                      const nativeTriageTab =
                        item.name === "Triage" &&
                        String(
                          item.layout ?? item.display?.layout,
                        ).toLocaleLowerCase() === "board";
                      return (
                        <Link
                          key={item.id}
                          to={"/view/" + item.id}
                          className={item.id === view.id ? "active" : ""}
                          aria-current={
                            item.id === view.id ? "page" : undefined
                          }
                        >
                          {nativeTriageTab ? (
                            <EntityIcon
                              entity={{ icon: "CustomView", color: "#ed9253" }}
                              size={12}
                            />
                          ) : (
                            <Icon name="Layers" size={12} />
                          )}
                          {item.name}
                        </Link>
                      );
                    })}
                </>
              ) : (
                <span className="view-issue-count">
                  {baseMatching.length}{" "}
                  {baseMatching.length === 1 ? "issue" : "issues"}
                </span>
              )
            ) : (
              [
                "active",
                "backlog",
                "all",
                ...(team?.triageEnabled ? ["triage"] : []),
              ].map((tab) => (
                <Link
                  key={tab}
                  className={section === tab ? "active" : ""}
                  to={
                    labelViewId
                      ? `${location.pathname}?${new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(location.search)), section: tab })}`
                      : teamId
                        ? `/team/${teamId}/${tab}`
                        : `/issues/${tab}`
                  }
                >
                  {tab === "all"
                    ? "All issues"
                    : tab[0].toUpperCase() + tab.slice(1)}
                </Link>
              ))
            )}
            {!isMine &&
              !labelViewId &&
              !view &&
              active(store.data.views)
                .filter(
                  (v) =>
                    (v.entityType || "issues") === "issues" &&
                    v.teamId === teamId,
                )
                .map((v) => (
                  <Link key={v.id} to={`/view/${v.id}`}>
                    <Icon name="Layers" size={12} />
                    {v.name}
                  </Link>
                ))}
            {isMine &&
              !isProfile &&
              store.data.issues.some((issue) => issue.sharedAccess) && (
                <Dropdown
                  trigger={
                    <button aria-label="More issue views">
                      <Icon name="MoreHorizontal" size={14} />
                    </button>
                  }
                >
                  <MenuItem onClick={() => setMineTab("Shared")}>
                    Shared
                  </MenuItem>
                  <MenuItem onClick={() => setSavingView(true)}>
                    Add view
                  </MenuItem>
                </Dropdown>
              )}
            {!isMine && !labelViewId && (!view || view.teamId) && (
              <button
                aria-label={isDirectTeamIssueRoute ? "Add new view" : "Add view"}
                onClick={() => setSavingView(true)}
              >
                <NativeControlIcon name="Add new view" />
              </button>
            )}
          </div>
        )}
        <span className="spacer" />
        {searchOpen && (
          <span className="view-search-control">
            <input
              className="view-search input"
              aria-label="Filter issue titles"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  setSearchOpen(false);
                  setQuery("");
                }
              }}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                type="button"
                className="icon-button"
                aria-label="Clear issue search"
                title="Clear"
                onClick={() => {
                  setQuery("");
                  setSearchOpen(false);
                }}
              >
                <Icon name="X" size={12} />
              </button>
            )}
          </span>
        )}
        {(customerId || filterConditionCount(filter) > 0 || query) && (
          <button
            type="button"
            className="icon-button circle-button"
            aria-label="Save filtered view"
            title="Save view (⌥ V)"
            onClick={() => setSavingView(true)}
          >
            <Icon name="Layers" size={14} />
          </button>
        )}
        {!editingView && columnControl}
        <IssueFilterMenu
          value={filter}
          onChange={setFilter}
          excludeFields={customerId ? ['effectiveCustomerIds'] : []}
          teamId={teamId}
          projectId={projectId}
          issues={filterCandidates}
          onAdvanced={() => setFilterOpen(true)}
          trigger={
            <button
              className={`icon-button circle-button ${filterConditionCount(filter) ? "active" : ""}`}
              aria-label={filterButtonLabel}
            >
              <NativeControlIcon name="Add filter" />
            </button>
          }
        />
        <Dropdown
          align="right"
          trigger={
            <button
              className="icon-button circle-button"
              ref={displayTrigger}
              onClick={() => {
                setAdvancedDisplayOpen(false);
                setGroupOrderingOpen(false);
              }}
              aria-label="Display options"
            >
              <NativeControlIcon name="Display options" />
            </button>
          }
        >
          <div
            className={`display-options ${labelViewId ? "label-display-options" : ""} ${isDirectTeamIssueRoute ? "team-display-options" : ""} ${directTeamAllDisplay ? "team-all-display-options" : ""}`}
            data-keep-open
          >
            {groupOrderingOpen ? (
              <IssueGroupOrderEditor
                groups={allGroups}
                hidden={display.hiddenGroups?.[display.groupBy] || []}
                onHidden={(ids) =>
                  setDisplay({
                    ...display,
                    hiddenGroups: {
                      ...display.hiddenGroups,
                      [display.groupBy]: ids,
                    },
                  })
                }
                onOrder={(ids) => commitGroupOrder(display.groupBy, ids)}
                onSave={view && !editingView ? () => {
                  void store.update("views", view.id, { display: {
                    ...view.display, groupOrder: display.groupOrder, groupOrders: display.groupOrders,
                  } }).then(() => store.toast(store.pending ? "Group order saved locally; sync pending" : "Group order saved to view")).catch(error => store.toast(error.message));
                } : undefined}
                onBack={() => setGroupOrderingOpen(false)}
              />
            ) : (
              <>
                <div
                  className="segmented-control"
                  role="tablist"
                  aria-label="Issue layout"
                >
                  {(["list", "board", "calendar", "timeline"] as const).map((layout) => (
                    <button
                      key={layout}
                      role="tab"
                      aria-selected={display.layout === layout}
                      tabIndex={display.layout === layout ? 0 : -1}
                      onKeyDown={(event) => {
                        if (
                          !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                            event.key,
                          )
                        )
                          return;
                        event.preventDefault();
                        const requested =
                          event.key === "Home"
                            ? "list"
                            : event.key === "End"
                              ? "timeline"
                              : (["list", "board", "calendar", "timeline"] as const)[(["list", "board", "calendar", "timeline"].indexOf(layout)+(event.key === "ArrowLeft" ? 3 : 1))%4];
                        const next =
                          requested === "board" && isMine &&
                          !isProfile &&
                          mineTab === "Assigned" &&
                          display.groupBy === "focus"
                            ? "list"
                            : requested;
                        setDisplay({
                          ...display,
                          layout: next,
                          ...(next === "board" ? { sortScope: "groups" } : {}),
                        });
                        const tabs =
                          event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                            "[role=tab]",
                          );
                        tabs?.[["list", "board", "calendar", "timeline"].indexOf(next)]?.focus();
                      }}
                      disabled={
                        layout === "board" &&
                        isMine &&
                        !isProfile &&
                        mineTab === "Assigned" &&
                        display.groupBy === "focus"
                      }
                      className={display.layout === layout ? "active" : ""}
                      onClick={() =>
                        setDisplay({
                          ...display,
                          layout,
                          ...(layout === "board"
                            ? { sortScope: "groups" }
                            : {}),
                        })
                      }
                    >
                      {layout === "list" || layout === "board" ? <IssueLayoutIcon layout={layout} /> : <Icon name={layout === "calendar" ? "CalendarDays" : "GanttChart"} size={14}/>}
                      <span>{layout === "timeline" ? "Timeline / Gantt" : layout[0].toUpperCase()+layout.slice(1)}</span>
                    </button>
                  ))}
                </div>
                {[
                  [
                    "groupBy",
                    "Grouping",
                    [
                      "effectiveCustomerIds",
                      "none",
                      "statusId",
                      "assigneeId",
                      "projectId",
                      "priority",
                      "cycleId",
                      "labelIds",
                      "labelGroup",
                      "projectLabelIds",
                      "parentId",
                      "teamId",
                      "customerId",
                      "milestoneId",
                      "slaStatus",
                      ...(isMine ? ["focus", "activityAt"] : []),
                    ],
                  ],
                  [
                    "subGroupBy",
                    "Sub-grouping",
                    [
                      "effectiveCustomerIds",
                      "none",
                      "statusId",
                      "assigneeId",
                      "projectId",
                      "priority",
                      "cycleId",
                      "labelIds",
                      "labelGroup",
                      "projectLabelIds",
                      "parentId",
                      "teamId",
                      "customerId",
                      "milestoneId",
                      "slaStatus",
                      ...(isMine ? ["focus", "activityAt"] : []),
                    ],
                  ],
                  [
                    "orderBy",
                    "Ordering",
                    [
                      "sortOrder",
                      "priority",
                      "title",
                      "createdAt",
                      "updatedAt",
                      "dueDate",
                      "statusId",
                      "linkCount",
                      "customerCount",
                      "customerRevenue",
                      ...(isMine ? ["activityAt"] : []),
                    ],
                  ],
                ]
                  .filter(([key]) => key !== "orderBy" && (display.layout === "list" || display.layout === "board"))
                  .map(([key, label, values]) => (
                    <React.Fragment key={key as string}>
                      <div className="display-row issue-grouping-row">
                        {label as string}
                        <span className="spacer" />
                        {key === "groupBy" && display.groupBy !== "none" && (
                          <button
                            className="icon-button"
                            aria-label="Group ordering"
                            onClick={() => setGroupOrderingOpen(true)}
                          >
                            <IssueGroupOrderIcon />
                          </button>
                        )}
                        {key === "orderBy" && (
                          <button
                            className="icon-button"
                            aria-label="Sort direction"
                            title={
                              display.direction === "asc"
                                ? "Ascending"
                                : "Descending"
                            }
                            disabled={display.orderBy === "sortOrder"}
                            onClick={() =>
                              setDisplay({
                                ...display,
                                direction:
                                  display.direction === "asc" ? "desc" : "asc",
                              })
                            }
                          >
                            <Icon
                              name={
                                display.direction === "asc"
                                  ? "ArrowUpNarrowWide"
                                  : "ArrowDownWideNarrow"
                              }
                              size={14}
                            />
                          </button>
                        )}
                        <select
                          aria-label={label as string}
                          value={
                            isIssueLabelGroup((display as any)[key as string])
                              ? "labelGroup"
                              : (display as any)[key as string]
                          }
                          onChange={(e) => {
                            const next =
                              e.target.value === "labelGroup"
                                ? issueLabelGroupField(
                                    availableLabelGroups.find(
                                      (g) =>
                                        key !== "subGroupBy" ||
                                        issueLabelGroupField(g.id) !==
                                          display.groupBy,
                                    )!.id,
                                  )
                                : e.target.value;
                            setDisplay({
                              ...display,
                              ...(display.orderBy === "sortOrder"
                                ? {
                                    manualOrders: {
                                      ...display.manualOrders,
                                      [display.groupBy +
                                      ":" +
                                      display.subGroupBy]: orderedIssues.map(
                                        (i) => i.id,
                                      ),
                                    },
                                  }
                                : {}),
                              [key as string]: next,
                              ...(key === "groupBy" ? {
                                groupOrders: { ...display.groupOrders, [display.groupBy]: effectiveGroupOrder ?? [] },
                                groupOrder: display.groupOrders?.[next] ?? [],
                              } : {}),
                              ...(key === "groupBy" &&
                              next === "focus" &&
                              isMine &&
                              !isProfile &&
                              mineTab === "Assigned"
                                ? { layout: "list" }
                                : {}),
                              ...(key === "groupBy" &&
                              next === display.subGroupBy
                                ? { subGroupBy: "none" }
                                : {}),
                            });
                          }}
                        >
                          {(values as string[])
                            .filter(
                              (v) =>
                                key !== "subGroupBy" ||
                                v === "none" ||
                                v !== display.groupBy,
                            )
                            .map((v) => (
                              <option
                                key={v}
                                value={v}
                                disabled={
                                  v === "labelGroup" &&
                                  !availableLabelGroups.some(
                                    (g) =>
                                      key !== "subGroupBy" ||
                                      issueLabelGroupField(g.id) !==
                                        display.groupBy,
                                  )
                                }
                              >
                                {
                                  (
                                    {
                                      none: "No grouping",
                                      statusId: "Status",
                                      assigneeId: "Assignee",
                                      projectId: "Project",
                                      priority: "Priority",
                                      cycleId: "Cycle",
                                      labelIds: "Label",
                                      labelGroup: "Label group",
                                      projectLabelIds: "Project label",
                                      parentId: "Parent issue",
                                      teamId: "Team",
                                      customerId: "Legacy customer",
                                      effectiveCustomerIds: "Customer",
                                      milestoneId: "Milestone",
                                      slaStatus: "SLA status",
                                      focus: "Focus",
                                      activityAt: "My activity",
                                      sortOrder: "Manual",
                                      title: "Title",
                                      createdAt: "Created",
                                      updatedAt: "Updated",
                                      dueDate: "Due date",
                                      linkCount: "Link count",
                                      customerCount: "Customer count",
                                      customerRevenue: "Customer revenue",
                                    } as any
                                  )[v]
                                }
                              </option>
                            ))}
                        </select>
                      </div>
                      {isIssueLabelGroup((display as any)[key as string]) && (
                        <label className="display-row issue-grouping-row">
                          Label group
                          <select
                            aria-label={
                              key === "groupBy"
                                ? "Label group"
                                : "Sub-group label group"
                            }
                            value={(display as any)[key as string]}
                            onChange={(e) =>
                              setDisplay({
                                ...display,
                                [key as string]: e.target.value,
                                ...(key === "groupBy" &&
                                e.target.value === display.subGroupBy
                                  ? { subGroupBy: "none" }
                                  : {}),
                              })
                            }
                          >
                            {!availableLabelGroups.some(
                              (g) =>
                                issueLabelGroupField(g.id) ===
                                (display as any)[key as string],
                            ) && (
                              <option value={(display as any)[key as string]}>
                                Label group unavailable
                              </option>
                            )}
                            {[
                              ...new Set(
                                availableLabelGroups.map((g) => g.teamId || ""),
                              ),
                            ].map((id) => (
                              <optgroup
                                key={id}
                                label={
                                  store.data.teams.find((t) => t.id === id)
                                    ?.name || "Workspace"
                                }
                              >
                                {availableLabelGroups
                                  .filter((g) => (g.teamId || "") === id)
                                  .map((g) => (
                                    <option
                                      key={g.id}
                                      value={issueLabelGroupField(g.id)}
                                      disabled={
                                        key === "subGroupBy" &&
                                        issueLabelGroupField(g.id) ===
                                          display.groupBy
                                      }
                                    >
                                      {g.name}
                                    </option>
                                  ))}
                              </optgroup>
                            ))}
                          </select>
                        </label>
                      )}
                    </React.Fragment>
                  ))}
                <div className="display-row issue-ordering-row">
                  <button
                    className="display-advanced-link"
                    aria-label={
                      advancedDisplayOpen
                        ? "Close advanced display"
                        : "Advanced sorting and display"
                    }
                    onClick={() => setAdvancedDisplayOpen(!advancedDisplayOpen)}
                  >
                    Ordering
                  </button>
                  <span className="spacer" />
                  <button
                    className="icon-button"
                    aria-label={
                      isDirectTeamIssueRoute ? "Direction" : "Sort direction"
                    }
                    title={
                      display.direction === "asc" ? "Ascending" : "Descending"
                    }
                    disabled={display.orderBy === "sortOrder"}
                    onClick={() =>
                      setDisplay({
                        ...display,
                        direction: display.direction === "asc" ? "desc" : "asc",
                      })
                    }
                  >
                    <Icon
                      name={
                        display.direction === "asc"
                          ? "ArrowUpNarrowWide"
                          : "ArrowDownWideNarrow"
                      }
                      size={14}
                    />
                  </button>
                  <select
                    aria-label="Ordering"
                    value={display.orderBy}
                    onChange={(e) =>
                      setDisplay({
                        ...display,
                        orderBy: e.target.value,
                        sortRules: [],
                      })
                    }
                  >
                    {availableSortFields.map(
                      ([field, label]) => (
                        <option key={field} value={field}>
                          {display.groupBy === "focus" &&
                          field === display.orderBy &&
                          !display.sortRules?.length
                            ? "Importance"
                            : label}
                          {field === display.orderBy &&
                          display.sortRules?.length
                            ? " + " + display.sortRules.length + " rules"
                            : ""}
                        </option>
                      ),
                    )}
                  </select>
                </div>
                {advancedDisplayOpen && (
                  <div
                    className="issue-advanced-display"
                    aria-label="Advanced display"
                  >
                    <IssueSortEditor
                      fields={availableSortFields}
                      scope={display.sortScope || "groups"}
                      onScope={(scope) =>
                        setDisplay({
                          ...display,
                          sortScope: scope,
                          ...(scope === "entire"
                            ? { layout: "list" as const }
                            : {}),
                        })
                      }
                      rules={[
                        {
                          field: display.orderBy,
                          direction: display.direction,
                        },
                        ...(display.sortRules || []),
                      ]}
                      onChange={(rules) =>
                        setDisplay({
                          ...display,
                          orderBy: rules[0].field,
                          direction: rules[0].direction,
                          sortRules: rules.slice(1),
                          ...(rules.length > 1
                            ? { orderCompletedByRecency: false }
                            : {}),
                        })
                      }
                      onSave={() =>
                        void Promise.resolve(saveDefault()).then(() =>
                          store.toast("Sort order saved"),
                        )
                      }
                    />
                    <label className="display-row">
                      Show column sort controls
                      <input
                        type="checkbox"
                        checked={!!display.showSortColumns}
                        onChange={(e) =>
                          setDisplay({
                            ...display,
                            showSortColumns: e.target.checked,
                          })
                        }
                      />
                    </label>
                  </div>
                )}
                {!directTeamAllDisplay && (
                  <label className="display-row">
                    Order completed by recency
                    <input
                      type="checkbox"
                      disabled={!!display.sortRules?.length}
                      checked={!!display.orderCompletedByRecency}
                      onChange={(e) =>
                        setDisplay({
                          ...display,
                          orderCompletedByRecency: e.target.checked,
                        })
                      }
                    />
                  </label>
                )}
                <div className="menu-separator" />
                {(!isDirectTeamIssueRoute || directTeamAllDisplay) && (
                  <label className="display-row">
                    Completed issues
                    <select
                      aria-label="Completed issues"
                      value={
                        !display.showCompleted
                          ? "none"
                          : display.completedWindow || "all"
                      }
                      onChange={(e) =>
                        setDisplay({
                          ...display,
                          completedWindow: e.target.value,
                          showCompleted: e.target.value !== "none",
                        })
                      }
                    >
                      {[
                        ["all", "All"],
                        ["day", "Past day"],
                        ["week", "Past week"],
                        ["month", "Past month"],
                        ["cycle", "Current cycle"],
                        ["none", "None"],
                      ].map(([value, label]) => (
                        <option value={value} key={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="display-row">
                  Show sub-issues
                  <input
                    type="checkbox"
                    checked={display.showSubIssues}
                    onChange={(e) =>
                      setDisplay({
                        ...display,
                        showSubIssues: e.target.checked,
                      })
                    }
                  />
                </label>
                <div className="menu-separator" />
                {display.layout === "list" && (
                  <div className="display-section-heading">List options</div>
                )}
                {display.layout === "list" && display.showSubIssues && (
                  <label className="display-row">
                    Nested sub-issues
                    <input
                      type="checkbox"
                      checked={!!display.nestedSubIssues}
                      disabled={!display.showSubIssues}
                      onChange={(e) =>
                        setDisplay({
                          ...display,
                          nestedSubIssues: e.target.checked,
                        })
                      }
                    />
                  </label>
                )}
                {display.groupBy !== "focus" &&
                  display.groupBy !== "none" &&
                  !(isMine && mineTab === "Activity") && (
                    <label className="display-row">
                      Show empty groups
                      <input
                        type="checkbox"
                        checked={display.showEmpty}
                        onChange={(e) =>
                          setDisplay({
                            ...display,
                            showEmpty: e.target.checked,
                          })
                        }
                      />
                    </label>
                  )}
                {(display.layout === "list" || display.layout === "board") && <><div className="display-properties-heading">
                  Display properties
                </div>
                <div className="property-toggle-list">
                  {[
                    "effectiveCustomerIds",
                    "identifier",
                    "statusId",
                    "assigneeId",
                    "priority",
                    "projectId",
                    "dueDate",
                    "milestoneId",
                    "estimate",
                    "labelIds",
                    "links",
                    "customerCount",
                    "customerRevenue",
                    "timeInStatus",
                    "createdAt",
                    "updatedAt",
                    ...(isMine && mineTab === "Activity"
                      ? ["activityAt"]
                      : []),
                    ...(advancedDisplayOpen
                      ? [
                          ...(isMine && mineTab !== "Activity"
                            ? ["activityAt"]
                            : []),
                          "slaStatus",
                          "cycleId",
                          "startDate",
                          "duration",
                          "timeEstimate",
                          "timeLogged",
                          "taskType",
                          "completedAt",
                          ...availableSortFields
                            .filter(([field]) =>
                              field.startsWith("customFields."),
                            )
                            .map(([field]) => field),
                        ]
                      : []),
                  ]
                    .filter((field) => !projectScoped || field !== "projectId")
                    .map((field) => (
                      <button
                        key={field}
                        aria-label={`Display ${field}`}
                        aria-pressed={isIssueColumnVisible(field, display.properties, projectScoped)}
                        className={`badge ${isIssueColumnVisible(field, display.properties, projectScoped) ? "active" : ""}`}
                        onClick={() =>
                          setDisplay({
                            ...display,
                            properties: setIssueColumnVisible(display.properties, field, !isIssueColumnVisible(field, display.properties, projectScoped)),
                          })
                        }
                      >
                        {(
                          {
                            identifier: "ID",
                            statusId: "Status",
                            assigneeId: "Assignee",
                            priority: "Priority",
                            projectId: "Project",
                            dueDate: "Due date",
                            milestoneId: "Milestone",
                            estimate: "Estimate",
                            labelIds: "Labels",
                            links: "Links",
                            effectiveCustomerIds: "Customer",
                            customerCount: "Request customers",
                            customerRevenue: "Customer revenue",
                            timeInStatus: "Time in status",
                            createdAt: "Created",
                            updatedAt: "Updated",
                            activityAt: "My activity date",
                            cycleId: "Cycle",
                            slaStatus: "SLA",
                          } as Record<string, string>
                        )[field] ||
                          availableSortFields.find(
                            ([key]) => key === field,
                          )?.[1] ||
                          field}
                      </button>
                    ))}
                </div>
                </>}{!view &&
                  !isMine &&
                  !labelViewId &&
                  !projectScoped &&
                  (!isDirectTeamIssueRoute || displayCustomized) && (
                    <div className="display-actions">
                      <Button variant="ghost" onClick={resetDisplay}>
                        Reset
                      </Button>
                      <Button onClick={() => void saveDefault()}>
                        {isDirectTeamIssueRoute
                          ? "Set default for everyone"
                          : "Set as default"}
                      </Button>
                    </div>
                  )}
              </>
            )}
          </div>
        </Dropdown>
        {!projectScoped &&
          (!isMine || isProfile) &&
          !labelViewId &&
          !isDirectTeamIssueRoute && !embedded && (
            <button
              className={`icon-button circle-button ${details ? "active" : ""}`}
              aria-label={isProfile?(details?"Close details":"Open details"):"Toggle insights"}
              title={isProfile?"Member details": "Insights (⌘⇧I)"}
              onClick={() => {
                setSummary(false);
                setDetails(!details);
              }}
            >
              {isProfile?<NativeControlIcon name="Close sidebar"/>:<Icon name="ChartNoAxesColumn" size={15} />}
            </button>
          )}
        {projectScoped ? (
          <button
            className={`icon-button circle-button ${projectDetailsOpen ? "active" : ""}`}
            aria-label={
              projectDetailsOpen
                ? "Close project details"
                : "Open project details"
            }
            aria-pressed={projectDetailsOpen}
            title="Project details (])"
            onClick={onProjectDetailsToggle}
          >
            <NativeControlIcon name="Close sidebar" />
          </button>
        ) : !embedded && !isProfile ? (
          <button
            className={`icon-button circle-button ${summary ? "active" : ""}`}
            aria-label={summary ? "Close details" : "Open details"}
            aria-pressed={summary}
            title="Issue summary (])"
            onClick={() => {
              setDetails(false);
              setPersistedSummary(!summary);
            }}
          >
            <NativeControlIcon name="Close sidebar" />
          </button>
        ) : null}
      </div>
      {view && editingView && (
        <SavedViewInlineEditor
          key={`${view.id}:${view.version ?? ""}`}
          view={view}
          columnControl={columnControl}
          onCancel={closeViewEditor}
          onSave={async (draft) => {
            const saved = await store.update("views", view.id, {
              ...draft,
              filters: editFilter,
              display: editDisplay,
              layout: editDisplay.layout[0].toUpperCase()+editDisplay.layout.slice(1),
            });
            if (saved !== null) closeViewEditor();
            return saved;
          }}
          onAddFilter={() => {
            setAdvancedDisplayOpen(false);
            setGroupOrderingOpen(false);
            setFilterOpen((open) => !open);
          }}
          onDisplayOptions={() => {
            setFilterOpen(false);
            displayTrigger.current?.click();
          }}
        />
      )}
      {filterOpen && (
        <FilterBuilder
          value={editingView ? editFilter : filter}
          onChange={editingView ? setEditFilter : setFilter}
          teamId={teamId}
          excludeFields={customerId ? ['effectiveCustomerIds'] : []}
        />
      )}
      {!filterOpen && filterConditionCount(filter) > 0 && (
        <IssueFilterChips
          issues={filterCandidates}
          teamId={teamId}
          projectId={projectId}
          value={filter}
          onChange={setFilter}
          onAdvanced={() => setFilterOpen(true)}
          onSave={() => setSavingView(true)}
        />
      )}
      {details && insightSelection !== null && (
        <div className="insight-view-selection">
          <Icon name="Filter" size={13} />
          {matching.length} of {baseMatching.length} issues · Insight selection
          <button
            onClick={() => {
              setInsightSelection(null);
              setInsightReset((value) => value + 1);
            }}
          >
            Clear selection
            <Icon name="X" size={12} />
          </button>
        </div>
      )}
      {view && !editingView && (columnsCustomized || columnError) && (columnEditingKey !== key || display.layout !== "list") && (
        <div className="issue-column-save-bar" aria-label="Unsaved view column settings">{columnSaveControls}</div>
      )}
      {display.layout === "list" && display.showSortColumns && (
        <IssueSortColumns
          fields={availableSortFields.filter(
            ([f]) =>
              f === "title" ||
              display.properties.includes(f) ||
              f.startsWith("customFields."),
          )}
          rules={
            display.orderBy === "sortOrder"
              ? []
              : [
                  { field: display.orderBy, direction: display.direction },
                  ...(display.sortRules || []),
                ]
          }
          onSort={(field, entire) => {
            const rules =
              display.orderBy === "sortOrder"
                ? []
                : [
                    { field: display.orderBy, direction: display.direction },
                    ...(display.sortRules || []),
                  ];
            const index = rules.findIndex((r) => r.field === field);
            if (index < 0) rules.push({ field, direction: "desc" });
            else
              rules[index] = {
                ...rules[index],
                direction: rules[index].direction === "asc" ? "desc" : "asc",
              };
            if (entire) {
              const chosen = rules.splice(
                rules.findIndex((r) => r.field === field),
                1,
              )[0];
              rules.unshift(chosen);
            }
            setDisplay({
              ...display,
              orderBy: rules[0].field,
              direction: rules[0].direction,
              sortRules: rules.slice(1),
              sortScope: entire ? "entire" : "groups",
              orderCompletedByRecency: false,
            });
          }}
          onRemove={(field) => {
            const rules = [
              { field: display.orderBy, direction: display.direction },
              ...(display.sortRules || []),
            ].filter((r) => r.field !== field);
            setDisplay({
              ...display,
              orderBy: rules[0]?.field || "sortOrder",
              direction: rules[0]?.direction || "asc",
              sortRules: rules.slice(1),
            });
          }}
          onMove={(field, end) => {
            const rules = [
              { field: display.orderBy, direction: display.direction },
              ...(display.sortRules || []),
            ];
            const index = rules.findIndex((r) => r.field === field);
            if (index < 0) return;
            const moved = rules.splice(index, 1)[0];
            rules.splice(end ? rules.length : 0, 0, moved);
            setDisplay({
              ...display,
              orderBy: rules[0].field,
              direction: rules[0].direction,
              sortRules: rules.slice(1),
            });
          }}
        />
      )}
      {(display.layout === "calendar" || display.layout === "timeline") && !editingView && !onViewSettingsChange && <div className="schedule-save-bar">
        <span role="status">{scheduleSavingKey===key ? "Saving view settings…" : scheduleSaveError?.key===key ? scheduleSaveError.message : displayCustomized ? "Unsaved view settings" : store.pending ? "Saved locally; sync pending" : "View settings saved"}</span>
        <button type="button" disabled={scheduleSavingKey===key||!displayCustomized} onClick={()=>{setScheduleSavingKey(key);setScheduleSaveError(null);void Promise.resolve(saveDefault()).then(()=>store.toast(store.pending?"View saved locally; sync pending":"View settings saved")).catch(error=>{setScheduleSaveError({key,message:error.message});store.toast(error.message);}).finally(()=>setScheduleSavingKey(null));}}>{view?"Save view settings":"Save as default"}</button>
        <button type="button" onClick={()=>setSavingView(true)}>Save as new view</button>
      </div>}
      <IssueColumnEditor key={key} enabled={columnsEditing} aligned={columnsAligned} fields={availableColumnDefinitions} visibleFields={visibleColumnFields} order={columnOrder}
        widths={columnWidths}
        onWidthsChange={columnWidths => setDisplay(current => ({ ...current, columnWidths }))}
        persistence={columnSaveControls}
        onVisibilityChange={(field, visible) => setDisplay(current => ({ ...current, columnOrder, properties: setIssueColumnVisible(current.properties, field, visible) }))}
        onChange={columnOrder => setDisplay(current => ({ ...current, columnOrder }))}
        onCancel={cancelColumns}>
      {columnHeader => <div className="issue-view-content">
        <div
          className={`issue-list-scroll ${display.layout === "board" ? "board-scroll" : ""} ${display.layout === "board" && swimlanes.length ? "has-swimlanes" : ""}`}
          ref={parent}
          {...dragEdgeScroll}
        >
          {columnsEditing && !(flat.length && !filteredEmpty) && <div className="issue-column-empty-table" role="table" aria-label="Issue columns">{columnHeader}</div>}
          {display.layout === "calendar" || display.layout === "timeline" ? <ScheduleView key={key} items={orderedIssues} layout={display.layout} options={display} onOptions={patch=>setDisplay(current=>({...current,...patch}))} onOpen={item=>openListIssue(item.id)}/> : display.layout === "board" &&
          swimlanes.length &&
          !filteredEmpty &&
          groups.length > 0 ? (
            <IssueSwimlaneBoard
              columns={groups}
              rows={swimlanes}
              secondary={display.subGroupBy}
              scrollRef={parent}
              focusedId={focus}
              renderHeader={(group) => renderGroupHeader(group, 0, true)}
              sectionReorder={sectionReorder}
              renderCell={(group) => (
                <>
                  <VirtualBoardItems
                    overscan={1}
                    issues={group.issues}
                    focusedId={focus}
                    renderItem={(issue) => renderBoardCard(issue, group)}
                  />
                  <button
                    className="board-create"
                    aria-label={
                      "Add issue to " +
                      groups.find((g) => g.id === group.path[0].id)?.name +
                      " / " +
                      group.name
                    }
                    onClick={() => createInGroup(group)}
                  >
                    <Icon name="Plus" size={14} />
                    Add new issue
                  </button>
                </>
              )}
              onDrop={moveFromDrag}
              countBy={display.groupCount}
            />
          ) : display.layout === "board" &&
            !filteredEmpty &&
            groups.length > 0 ? (
            <div className="board">
              {groups.map((group) => (
                <div
                  className="board-column"
                  key={group.id}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => moveFromDrag(e, group)}
                >
                  {renderGroupHeader(group, 0, true)}
                  <VirtualBoardItems
                    issues={group.issues}
                    focusedId={focus}
                    renderItem={(issue) => renderBoardCard(issue, group)}
                  />
                  <button
                    className="board-create"
                    onClick={() => createInGroup(group)}
                  >
                    <Icon name="Plus" size={14} />
                    Add new issue
                  </button>
                </div>
              ))}
            </div>
          ) : flat.length && !filteredEmpty ? (
            <div
              className="virtual-issue-list"
              role="table"
              aria-label="Issues"
              aria-rowcount={matching.length}
              style={
                {
                  "--issue-identifier-width": `${identifierColumnWidth}px`,
                  height: virtualizer.getTotalSize(),
                  position: "relative",
                } as React.CSSProperties
              }
            >
              {columnHeader}
              {virtualizer.getVirtualItems().map((row) => {
                const item = flat[row.index];
                return (
                  <div
                    key={item.id}
                    style={{
                      position:
                        item.type === "group" &&
                        stickyIndices.current.includes(row.index)
                          ? "sticky"
                          : "absolute",
                      top:
                        item.type === "group" &&
                        stickyIndices.current.includes(row.index)
                          ? item.depth * 40 + (columnsEditing ? ISSUE_COLUMN_HEADER_HEIGHT : 0)
                          : 0,
                      left: 0,
                      width: "100%",
                      height: row.size,
                      zIndex:
                        item.type === "group" &&
                        stickyIndices.current.includes(row.index)
                          ? 4 - item.depth
                          : undefined,
                      transform:
                        item.type === "group" &&
                        stickyIndices.current.includes(row.index)
                          ? undefined
                          : `translateY(${row.start - (item.type === "issue" && flat[0]?.type === "group" ? 2 : 0)}px)`,
                    }}
                  >
                    {item.type === "group"
                      ? renderGroupHeader(item.group, item.depth)
                      : issueRow(
                          item.issue,
                          item.group,
                          item.treeDepth,
                          item.hasChildren,
                        )}
                  </div>
                );
              })}
            </div>
          ) : allGroups.length > 0 &&
            groups.length === 0 &&
            matching.length > 0 ? (
            <div className="issue-groups-hidden">
              <span>
                {hiddenByDisplayCount}{" "}
                {hiddenByDisplayCount === 1 ? "issue" : "issues"} hidden by
                display options
              </span>
              <Button
                onClick={() => {
                  setGroupOrderingOpen(true);
                  displayTrigger.current?.click();
                }}
              >
                Show options
              </Button>
            </div>
          ) : filteredEmpty ? (
            <IssueFilterEmpty
              count={scopeCandidates.length}
              onClear={() => {
                setFilter({ conditions: [], match: "all" });
                setQuery("");
              }}
            />
          ) : isProfile && targetUserId !== store.user?.id && mineTab === "Assigned" ? (
            <div className="profile-view-empty" role="status">
              <IssueFilterEmptyArt className="profile-view-empty-art" />
              <strong>No matching issues</strong>
            </div>
          ) : labelViewId ? (
            <div className="label-view-empty" role="status">
              <span
                className="label-view-empty-illustration"
                aria-hidden="true"
              >
                <svg width="140" height="82" viewBox="0 0 140 82" fill="none">
                  <path
                    d="M6 25 92 0c5-1 10 1 13 5l34 42c3 5 1 10-4 12L50 85c-5 2-10 0-13-5L4 40c-3-5-2-11 2-15Z"
                    transform="translate(0 -4)"
                    stroke="currentColor"
                    strokeOpacity=".18"
                    strokeDasharray="3 3"
                  />
                  <path
                    d="m35 26 50-14c4-1 7 5 3 7L39 34c-5 1-8-6-4-8Zm9 14 48-15c4-1 7 5 3 7L48 47c-5 1-8-5-4-7Zm12 13 40-12c4-1 7 5 3 7L60 60c-5 1-8-5-4-7Z"
                    transform="matrix(.92 0 0 .92 .36 1.88)"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
              </span>
              <strong>No matching issues</strong>
            </div>
          ) : (
            <EmptyState
              icon="CheckCircle2"
              title={
                query || filterConditionCount(filter)
                  ? "No issues matching the filters"
                  : "No issues"
              }
              description={
                query || filterConditionCount(filter)
                  ? `${scopeCandidates.length} ${scopeCandidates.length === 1 ? "issue" : "issues"} hidden by filters`
                  : "Create an issue to start tracking work."
              }
              action={
                query || filterConditionCount(filter) ? (
                  <Button
                    onClick={() => {
                      setFilter({ conditions: [], match: "all" });
                      setQuery("");
                    }}
                  >
                    Clear filters
                  </Button>
                ) : (
                  <Button
                    onClick={() =>
                      openComposer({
                        teamId: teamId || view?.teamId,
                        projectId: projectId || view?.projectId,
                        cycleId,
                        ...(labelView &&
                        !labelView.archivedAt &&
                        !isLabelGroupView
                          ? { labelIds: [labelView.id] }
                          : {}),
                        ...assignedCreationDefaults,
                      })
                    }
                  >
                    <Icon name="Plus" />
                    New issue
                  </Button>
                )
              }
            />
          )}
          {summary && summarySelection && (
            <div className="issue-summary-filter-notice">
              <div>
                <span>
                  <strong>
                    {baseMatching.length - matching.length}{" "}
                    {baseMatching.length - matching.length === 1
                      ? "issue"
                      : "issues"}
                  </strong>{" "}
                  <span>hidden by filters</span>
                </span>
                <button onClick={() => setSummarySelection(null)}>
                  Clear Filters
                  <Icon name="X" size={12} />
                </button>
              </div>
            </div>
          )}
          {display.layout === "board" &&
            groups.length > 0 &&
            hiddenByDisplayCount > 0 && (
              <div className="issue-board-hidden-footer" role="status">
                <span>
                  {hiddenByDisplayCount}{" "}
                  {hiddenByDisplayCount === 1 ? "issue" : "issues"} hidden by
                  display options
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setGroupOrderingOpen(true);
                    displayTrigger.current?.click();
                  }}
                >
                  Show options
                </button>
              </div>
            )}
        </div>
        {details && isProfile && targetUser ? <ProfileDetails user={targetUser} data={store.data} issues={baseMatching} self={targetUser.id===store.user?.id} favorite={!!viewFavorite} onFavorite={toggleViewFavorite}/>:details && (
          <React.Suspense
            fallback={
              <aside className="view-details" aria-busy="true">
                Loading insights…
              </aside>
            }
          >
            <ViewInsights
              key={key}
              resetKey={insightReset}
              rows={baseMatching}
              scopeKey={key}
              title={
                labelView?.name ??
                view?.name ??
                project?.name ??
                cycle?.name ??
                team?.name ??
                "Issues"
              }
              context={{
                filter,
                query,
                showCompleted: display.showCompleted,
                showSubIssues: display.showSubIssues,
              }}
              onClose={() => setDetails(false)}
              onSelect={setInsightSelection}
              onArchived={setInsightArchived}
            />
          </React.Suspense>
        )}
        {summary && labelView ? (
          <aside
            className="view-summary label-view-summary"
            aria-label="Label details"
          >
            <div
              className={
                "view-summary-card label-view-summary-heading" +
                (isLabelGroupView ? " label-group-summary-heading" : "")
              }
            >
              {isLabelGroupView && (
                <span className="label-view-summary-kind">Label group</span>
              )}
              <div className="label-view-summary-entity">
                {isLabelGroupView ? (
                  <LabelGroupGlyph />
                ) : (
                  <span
                    className="label-view-color"
                    style={{ background: labelView.color || "var(--accent)" }}
                  />
                )}
                <strong>{labelView.name}</strong>
                <button
                  className="icon-button"
                  aria-label={
                    viewFavorite ? "Remove from favorites" : "Add to favorites"
                  }
                  aria-pressed={!!viewFavorite}
                  onClick={toggleViewFavorite}
                >
                  <Icon
                    name="Star"
                    size={14}
                    style={{ fill: viewFavorite ? "currentColor" : undefined }}
                  />
                </button>
                <LabelViewOptions
                  entity={labelView}
                  kind={isLabelGroupView ? "labelGroups" : "labels"}
                  members={labelGroupMembers}
                  trigger="details"
                />
              </div>
            </div>
            <div
              className={
                "view-summary-card label-view-summary-properties" +
                (isLabelGroupView ? " label-group-summary-properties" : "")
              }
            >
              <span>Visibility</span>
              {team ? (
                <Link to={`/team/${team.id}/overview`}>
                  <EntityIcon entity={team} fallback="Users" size={14} />
                  {team.name}
                </Link>
              ) : (
                <span>
                  <Icon name="Users" size={14} />
                  Workspace
                </span>
              )}
              {isLabelGroupView && (
                <>
                  <span>Labels</span>
                  <span className="label-view-group-members">
                    {labelGroupMembers
                      .map((entity) => entity.name)
                      .join(", ") || "No labels"}
                  </span>
                </>
              )}
            </div>
          </aside>
        ) : (
          summary && (
            <ViewSummary
              view={view}
              key={key}
              rows={baseMatching}
              selection={summarySelection}
              onSelect={setSummarySelection}
              measure={display.groupCount}
              onMeasureChange={() =>
                setDisplay((value) => ({
                  ...value,
                  groupCount:
                    value.groupCount === "estimate" ? "issues" : "estimate",
                }))
              }
              onClose={() => setPersistedSummary(false)}
              onEditView={() =>
                navigate({
                  pathname: `/view/${view!.id}/edit`,
                  search: location.search,
                })
              }
              onDeleteView={() => setDeletingView(true)}
            />
          )
        )}
      </div>}
      </IssueColumnEditor>
      {selection.length > 0 && (
        <div
          className="selection-toolbar issue-selection-toolbar"
          role="toolbar"
          aria-label="Selected issues"
        >
          <CustomerBulkControl entities={selectedIssues} kind="issues"/>
          <span className="selection-summary">
            <span className="selection-label">
              <span className="selection-number">{selection.length}</span>
              {"\u00a0selected"}
            </span>
            {!(isMine && mineTab === "Activity") && (
              <>
                <span className="selection-divider">·</span>
                <span
                  className="selection-estimate"
                  title={`Total estimate points for ${selectedIssues.length} ${selectedIssues.length === 1 ? "issue" : "issues"}`}
                >
                  <EntityIcon
                    entity={{ icon: "Estimate", color: "currentColor" }}
                    size={12}
                  />
                  <span className="selection-number">{selectedEstimate}</span>
                </span>
              </>
            )}
          </span>
          {canMoveSelection && (
            <button
              className="selection-action"
              onClick={() =>
                void store
                  .batch(
                    selectionMoves.map(({ issue, status }) => ({
                      kind: "issues",
                      action: "update",
                      id: issue.id,
                      data: { statusId: status!.id },
                    })),
                  )
                  .then(() => setSelection([]))
                  .catch((error) => store.toast(error.message))
              }
            >
              <Icon
                name={section === "backlog" ? "Circle" : "CircleDashed"}
                size={14}
              />
              {selectionMoveLabel}
            </button>
          )}
          <button
            className="selection-action"
            aria-label="Open command menu"
            onClick={() =>
              dispatchWorkspaceCommand({ command: "command-menu" })
            }
          >
            <SelectionToolbarIcon name="command" />
            <span>Actions</span>
          </button>
          <button
            className="icon-button"
            aria-label="Clear selected"
            onClick={() => setSelection([])}
          >
            <SelectionToolbarIcon name="clear" />
          </button>
        </div>
      )}
      {context &&
        contextIssue &&
        (selection.includes(context.id) && selectedIssues.length > 1 ? (
          <BulkIssueActions
            key={`${context.id}:${context.x}:${context.y}`}
            issues={selectedIssues}
            position={context}
            onClose={() => setContext(null)}
            onDone={() => {
              setSelection([]);
              setContext(null);
            }}
          />
        ) : (
          <IssueActions
            key={`${context.id}:${context.x}:${context.y}`}
            issue={store.data.issues.find((i) => i.id === context.id)!}
            position={context}
            showSubscriptionByDefault={
              isMine && (mineTab === "Subscribed" || mineTab === "Activity")
            }
            movePosition={projectScoped ? undefined : contextMovePosition}
            onClose={() => setContext(null)}
          />
        ))}{" "}
      {peek && (
        <PeekPreview
          compact
          onOpen={openListIssue}
          kind="issues"
          id={peek}
          ids={orderedIssues.map((issue) => issue.id)}
          onFocus={(id) => {
            setPeek(id);
            setFocus(id);
          }}
          onClose={() => setPeek(null)}
        />
      )}
      {savingView && (
        <React.Suspense fallback={null}>
          <IssueViewForm
            initialEntityType="issues"
            teamId={teamId || view?.teamId}
            initialSearchQuery={query}
            initialLayout={display.layout[0].toUpperCase()+display.layout.slice(1)}
            initialDisplay={display}
            initialFilters={{
              match: "all",
              conditions: [
                ...(customerId ? [{field:"effectiveCustomerIds",operator:"contains",value:customerId}] : []),
                ...(teamId
                  ? [{ field: "teamId", operator: "eq", value: teamId }]
                  : []),
                ...(labelView
                  ? [
                      {
                        field: "labelIds",
                        operator: "contains",
                        value: labelView.id,
                      },
                    ]
                  : []),
                ...(projectId
                  ? [{ field: "projectId", operator: "eq", value: projectId }]
                  : []),
                ...(cycleId
                  ? [{ field: "cycleId", operator: "eq", value: cycleId }]
                  : []),
                ...(isMine && mineTab === "Assigned"
                  ? [
                      {
                        field: "assigneeId",
                        operator: "eq",
                        value: targetUserId,
                      },
                    ]
                  : []),
                ...(isMine && mineTab === "Created"
                  ? [
                      {
                        field: "creatorId",
                        operator: "eq",
                        value: targetUserId,
                      },
                    ]
                  : []),
                ...(["active", "backlog", "triage"].includes(section)
                  ? [
                      {
                        field: "statusId",
                        operator: "in",
                        value: statuses
                          .filter((status) =>
                            section === "active"
                              ? ["started", "unstarted"].includes(status.type)
                              : status.type === section,
                          )
                          .map((status) => status.id),
                      },
                    ]
                  : []),
              ],
              groups: [filter],
            }}
            onClose={() => setSavingView(false)}
            onSaved={(saved) => {
              setSavingView(false);
              navigate("/view/" + saved.id);
            }}
          />
        </React.Suspense>
      )}
      {view && deletingView && (
        <Modal title="Delete view" onClose={() => setDeletingView(false)}>
          <div className="modal-body">
            Delete <strong>{view.name}</strong>? This will remove the view for
            everyone who can access it.
          </div>
          <div className="modal-footer">
            <Button onClick={() => setDeletingView(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={async () => {
                await store.remove("views", view.id);
                navigate("/views");
              }}
            >
              Delete view
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function BulkIssueActions({
  issues,
  onClose,
  onDone,
  position,
}: {
  issues: Entity[];
  onClose?: () => void;
  onDone: () => void;
  position?: { x: number; y: number };
}) {
  const store = useAppStore();
  // A positioned bulk menu is owned by the collection's context state. Keep
  // that owner mounted while an action opens a child dialog.
  const preserveContextForLayer = useRef(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [property, setProperty] = useState<Property | null>(null);
  const openLayer = (show: () => void) => {
    if (position) preserveContextForLayer.current = true;
    show();
  };
  const closeLayer = (hide: () => void) => {
    hide();
    if (position) onClose?.();
  };
  const change = async (
    patch: Record<string, any> | ((issue: Entity) => Record<string, any>),
    message = "Issues updated",
  ) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await store.batch(
        issues.map((issue) => ({
          kind: "issues",
          action: "update",
          id: issue.id,
          data: typeof patch === "function" ? patch(issue) : patch,
        })),
      );
      store.toast(message);
      onDone();
    } catch (error) {
      setError((error as Error).message);
      store.toast((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const copy = async (format: "title" | "id" | "url" | "markdown") => {
    try {
      await navigator.clipboard.writeText(
        issues
          .map((issue) => {
            const url = `${location.origin}/issues/${issue.id}`;
            return format === "id"
              ? issueName(issue)
              : format === "url"
                ? url
                : format === "markdown"
                  ? `[${issueName(issue)} ${issue.title}](${url})`
                  : `${issueName(issue)} ${issue.title}`;
          })
          .join("\n"),
      );
      store.toast("Copied to clipboard");
    } catch (error) {
      store.toast("Could not copy issues to the clipboard");
    }
  };
  const perform = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      for (let offset = 0; offset < issues.length; offset += 1000) {
        await store.batch(
          issues.slice(offset, offset + 1000).map((issue) => ({
            kind: "issues",
            action: "delete",
            id: issue.id,
          })),
        );
      }
      store.toast(`${issues.length} issues moved to recently deleted`);
      onDone();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Dropdown
        align="right"
        position={position}
        onOpenChange={(open) => {
          if (!open && position) {
            requestAnimationFrame(() => {
              if (preserveContextForLayer.current)
                preserveContextForLayer.current = false;
              else onClose?.();
            });
          }
        }}
        trigger={
          position ? (
            <span />
          ) : (
            <button
              className="icon-button"
              aria-label="Bulk issue actions"
              disabled={busy}
            >
              <Icon name="MoreHorizontal" />
            </button>
          )
        }
      >
        <CustomerBulkControl entities={issues} kind="issues"/>
        <MenuItem
          icon="User"
          onClick={() => void change({ assigneeId: store.user?.id })}
        >
          Assign to me
        </MenuItem>
        <MenuItem icon="Copy" onClick={() => void copy("title")}>
          Copy issues
        </MenuItem>
        <MenuItem icon="Copy" onClick={() => void copy("id")}>
          Copy issue IDs
        </MenuItem>
        <MenuItem
          icon="Link"
          onClick={() =>
            void navigator.clipboard
              .writeText(selectedIssueListUrl(location.origin, issues))
              .then(() => store.toast("Issue list link copied"))
              .catch(() => store.toast("Could not copy issue list link"))
          }
        >
          Copy issue list link
        </MenuItem>
        <MenuItem icon="Link" onClick={() => void copy("url")}>
          Copy issue URLs
        </MenuItem>
        <MenuItem icon="Copy" onClick={() => void copy("markdown")}>
          Copy as Markdown
        </MenuItem>
        {(
          [
            "teamId",
            "statusId",
            "priority",
            "assigneeId",
            "projectId",
            "cycleId",
            "labelIds",
            "estimate",
          ] as Property[]
        ).map((field) => (
          <MenuItem
            key={field}
            onClick={() => openLayer(() => setProperty(field))}
          >
            {
              (
                {
                  teamId: "Move to team",
                  statusId: "Change status",
                  priority: "Change priority",
                  assigneeId: "Assign to",
                  projectId: "Move to project",
                  cycleId: "Move to cycle",
                  labelIds: "Add labels",
                  estimate: "Set estimate",
                } as Record<string, string>
              )[field]
            }
            …
          </MenuItem>
        ))}
        <MenuItem
          icon="Bell"
          onClick={() =>
            void change((issue) => ({
              subscriberIds: Array.from(
                new Set([...(issue.subscriberIds ?? []), store.user!.id]),
              ),
            }))
          }
        >
          Subscribe
        </MenuItem>
        <MenuItem
          icon="Bell"
          onClick={() =>
            void change((issue) => ({
              subscriberIds: (issue.subscriberIds ?? []).filter(
                (id: string) => id !== store.user?.id,
              ),
            }))
          }
        >
          Unsubscribe
        </MenuItem>
        <MenuItem
          icon="Trash2"
          danger
          onClick={() => openLayer(() => setConfirm(true))}
        >
          Delete {issues.length} issues
        </MenuItem>
      </Dropdown>
      {property && (
        <Modal
          title={`Update ${issues.length} issues`}
          onClose={() => closeLayer(() => setProperty(null))}
        >
          <div className="modal-body">
            <PropertyPicker
              field={property}
              value={property === "labelIds" ? [] : issues[0]?.[property]}
              teamId={issues[0]?.teamId}
              projectId={issues[0]?.projectId}
              onChange={(value) => {
                void change((issue) => ({
                  [property]:
                    property === "labelIds"
                      ? Array.from(
                          new Set([
                            ...(issue.labelIds ?? []).filter((id: string) => {
                              const group = store.data.labels.find(
                                (label) => label.id === id,
                              )?.group;
                              return (
                                !group ||
                                !value.some(
                                  (added: string) =>
                                    store.data.labels.find(
                                      (label) => label.id === added,
                                    )?.group === group,
                                )
                              );
                            }),
                            ...value,
                          ]),
                        )
                      : value,
                }));
                setProperty(null);
              }}
            />
            {error && (
              <p className="error-text" role="alert">
                {error}
              </p>
            )}
          </div>
        </Modal>
      )}
      {confirm && (
        <Modal
          title={`Delete ${issues.length} issues?`}
          onClose={() => closeLayer(() => setConfirm(false))}
        >
          <div className="modal-body">
            These issues will move to recently deleted and can be restored from
            the archive.
            {error && (
              <p role="alert" className="error-text">
                {error}
              </p>
            )}
          </div>
          <div className="modal-footer">
            <Button onClick={() => closeLayer(() => setConfirm(false))}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => void perform()}
            >
              {busy ? "Deleting…" : "Delete issues"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

export function FilterBuilder({
  value,
  onChange,
  teamId,
  additionalFields,
  excludeFields = [],
}: {
  value: FilterSpec;
  onChange: (v: FilterSpec) => void;
  teamId?: string;
  excludeFields?: string[];
  additionalFields?: {
    field: string;
    label: string;
    options: { id: string; name: string }[];
  }[];
}) {
  const { data } = useAppStore();
  const set = (index: number, patch: any) =>
    onChange({
      ...value,
      conditions: value.conditions.map((c, i) =>
        i === index ? { ...c, ...patch } : c,
      ),
    });
  const fields = [
    "statusId",
    "priority",
    "assigneeId",
    "creatorId",
    "subscribers",
    "projectId",
    "cycleId",
    "cycleAddition",
    "labelIds",
    "projectLabelIds",
    ...projectPropertyFields
      .filter(([field]) => field !== "projectLabelIds")
      .map(([field]) => field),
    "title",
    "description",
    "searchableContent",
    ...relationFilters.map(([field]) => field),
    "estimate",
    "accumulatedStateUpdatedAt",
    ...issueDateFields.map(([field]) => field),
    "parentId",
    "teamId",
    "templateId",
    "recurrence",
    "slaStatus",
    "effectiveCustomerIds",
    ...customerMetricFields.map(([field]) => field),
    ...(additionalFields || []).map((extra) => extra.field),
  ].filter(field=>!excludeFields.includes(field));
  const filterValue = (condition: FilterSpec["conditions"][number]) =>
    ["labelIds", "projectLabelIds"].includes(condition.field)
      ? Array.isArray(condition.value)
        ? condition.value.map((id) =>
            id === null ? null : resolveMergedLabelId(String(id), data.labels),
          )
        : resolveMergedLabelId(String(condition.value ?? ""), data.labels)
      : condition.value;
  const optionsFor = (field: string) =>
    additionalFields?.find((extra) => extra.field === field)?.options ||
    (relationFilters.some(([key]) => key === field)
      ? [
          { id: "true", name: "Yes" },
          { id: "false", name: "No" },
        ]
      : field === "cycleAddition"
        ? [
            { id: "planned", name: "Planned" },
            { id: "duringCycle", name: "During cycle" },
            { id: "afterCycle", name: "After cycle" },
          ]
        : field === "customerImportant"
          ? [
              { id: "true", name: "Yes" },
              { id: "false", name: "No" },
            ]
          : field === "customerTier" || field === "customerStatus"
            ? Array.from(
                new Set(
                  data.customers
                    .map((c) => c[field === "customerTier" ? "tier" : "status"])
                    .filter(Boolean),
                ),
              ).map((value) => ({ id: value, name: value }))
            : field === "slaStatus"
              ? Object.entries(slaLabels).map(([id, name]) => ({ id, name }))
              : field === "priority" || field === "projectPriority"
                ? priorities.map((name, id) => ({ id, name }))
                : (
                    {
                      statusId: data.statuses.filter(
                        (s) => !teamId || s.teamId === teamId,
                      ),
                      assigneeId: [
                        { id: null, name: "No assignee" },
                        { id: CURRENT_USER_FILTER, name: "Current user" },
                        ...data.users,
                      ],
                      creatorId: [
                        { id: CURRENT_USER_FILTER, name: "Current user" },
                        ...creatorChoices(data),
                      ],
                      subscribers: [
                        { id: CURRENT_USER_FILTER, name: "Current user" },
                        ...data.users,
                      ],
                      projectId: data.projects,
                      projectStatus: projectStatuses(data),
                      projectLeadId: [
                        { id: null, name: "No lead" },
                        { id: CURRENT_USER_FILTER, name: "Current user" },
                        ...data.users,
                      ],
                      cycleId: data.cycles,
                      labelIds: filterLabelRecords(data)
                        .filter(
                          (label) =>
                            !label.deletedAt &&
                            (label.entityType || "issues") === "issues",
                        )
                        .map((label) =>
                          label.isGroup
                            ? { ...label, name: label.name + " (label group)" }
                            : label,
                        ),
                      projectLabelIds: [
                        { id: null, name: "No labels" },
                        ...filterLabelRecords(data)
                          .filter(
                            (label) =>
                              !label.deletedAt &&
                              label.entityType === "projects",
                          )
                          .map((label) =>
                            label.isGroup
                              ? {
                                  ...label,
                                  name: label.name + " (label group)",
                                }
                              : label,
                          ),
                      ],
                      teamId: data.teams,
                      templateId: data.templates,
                      effectiveCustomerIds: data.customers,
                      customerIds: data.customers,
                      customerOwnerIds: [
                        { id: null, name: "No owner" },
                        { id: CURRENT_USER_FILTER, name: "Current user" },
                        ...data.users,
                      ],
                    } as Record<string, { id: any; name?: string }[]>
                  )[field]);
  return (
    <div className="filter-builder">
      <div className="filter-builder-head">
        <Icon name="Filter" size={14} />
        <span>Match</span>
        <select
          value={value.match}
          onChange={(e) => onChange({ ...value, match: e.target.value as any })}
        >
          <option value="all">all filters</option>
          <option value="any">any filter</option>
        </select>
        <span className="spacer" />
        {(filterConditionCount(value) > 0 || !!value.groups?.length) && (
          <button
            type="button"
            className="text-button"
            onClick={() => onChange({ conditions: [], match: "all" })}
          >
            Clear filters
          </button>
        )}
      </div>
      {value.conditions.map((condition, i) => (
        <div className="filter-condition" key={i}>
          <select
            className="input"
            aria-label={`Issue filter ${i + 1} property`}
            value={condition.field}
            onChange={(e) =>
              set(i, {
                field: e.target.value,
                value: "",
                operator:
                  e.target.value === "accumulatedStateUpdatedAt"
                    ? "lte"
                    : e.target.value === "recurrence"
                      ? "notEmpty"
                      : condition.field === "recurrence" ||
                          ["within", "on"].includes(condition.operator) ||
                          (["all", "none"].includes(condition.operator) &&
                            !["labelIds", "projectLabelIds"].includes(
                              e.target.value,
                            ))
                        ? "eq"
                        : condition.operator,
              })
            }
          >
            {fields.map((f) => (
              <option key={f} value={f}>
                {issueDateFields.find(([key]) => key === f)?.[1] ??
                  relationFilters.find(([key]) => key === f)?.[1] ??
                  (f === "effectiveCustomerIds" ? "Customer" : undefined) ??
                  (f === "searchableContent" ? "Content" : undefined) ??
                  additionalFields?.find((extra) => extra.field === f)?.label ??
                  customerMetricFields.find(([field]) => field === f)?.[1] ??
                  (projectPropertyFields.find(([key]) => key === f)?.[1] ||
                    (f === "accumulatedStateUpdatedAt"
                      ? "Time in current status"
                      : f === "subscribers"
                        ? "Subscriber"
                        : f === "creatorId"
                          ? "Created by"
                          : f === "cycleAddition"
                            ? "Added to cycle"
                            : f === "recurrence"
                              ? "Recurring issues"
                              : f === "projectLabelIds"
                                ? "Project label"
                                : f === "dueDate"
                                  ? "Due date"
                                  : f === "createdAt"
                                    ? "Created"
                                    : f === "updatedAt"
                                      ? "Updated"
                                      : f.replace(/Ids?$/, "")))}
              </option>
            ))}
          </select>
          <select
            className="input"
            aria-label={`Issue filter ${i + 1} operator`}
            value={condition.operator}
            onChange={(e) =>
              set(i, {
                operator: e.target.value,
                value:
                  issueDateFields.some(
                    ([field]) => field === condition.field,
                  ) && Array.isArray(condition.value)
                    ? condition.value
                    : ["in", "all", "none"].includes(e.target.value)
                      ? Array.isArray(condition.value)
                        ? condition.value
                        : [condition.value].filter((v) => v !== "")
                      : Array.isArray(condition.value)
                        ? (condition.value[0] ?? "")
                        : condition.value,
              })
            }
          >
            {(condition.field === "accumulatedStateUpdatedAt"
              ? [
                  ["lte", "longer than"],
                  ["gt", "less than"],
                ]
              : issueDateFields.some(([field]) => field === condition.field) &&
                  Array.isArray(condition.value)
                ? [
                    ["within", "within"],
                    ["before", "before"],
                    ["after", "after"],
                  ]
                : condition.field === "recurrence"
                  ? [
                      ["notEmpty", "is recurring"],
                      ["empty", "is not recurring"],
                    ]
                  : [
                      ["eq", "is"],
                      ...(supportsDateOn(condition) ? [["on", "on"]] : []),
                      ["neq", "is not"],
                      ["contains", "contains"],
                      ["notContains", "does not contain"],
                      ["in", "is any of"],
                      ...(["labelIds", "projectLabelIds"].includes(
                        condition.field,
                      )
                        ? [
                            ["all", "includes all"],
                            ["none", "includes none"],
                          ]
                        : [["none", "is none of"]]),
                      ["empty", "is empty"],
                      ["notEmpty", "is not empty"],
                      ["before", "before"],
                      ["after", "after"],
                      ["gte", "at least"],
                      ["lte", "at most"],
                    ]
            ).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
          {condition.field === "accumulatedStateUpdatedAt" ? (
            <StatusDurationValue
              key={condition.field}
              value={condition.value}
              onChange={(value) => set(i, { value })}
            />
          ) : issueDateFields.some(([field]) => field === condition.field) ? (
            <DateFilterValue
              condition={condition}
              onChange={(patch) => set(i, patch)}
              label={
                (issueDateFields.find(
                  ([field]) => field === condition.field,
                )?.[1] || "Date") + " filter value"
              }
            />
          ) : (
            !["empty", "notEmpty"].includes(condition.operator) &&
            (optionsFor(condition.field) ? (
              <select
                className="input"
                aria-label={`Issue filter ${i + 1} value`}
                multiple={["in", "all", "none"].includes(condition.operator)}
                value={
                  ["in", "all", "none"].includes(condition.operator)
                    ? Array.isArray(condition.value)
                      ? (filterValue(condition) as any[]).map(String)
                      : []
                    : filterValue(condition)
                }
                onChange={(e) =>
                  set(i, {
                    value: ["in", "all", "none"].includes(condition.operator)
                      ? Array.from(e.target.selectedOptions).map((o) =>
                          condition.field === "priority" ||
                          condition.field === "projectPriority"
                            ? Number(o.value)
                            : o.value,
                        )
                      : condition.field === "priority" ||
                          condition.field === "projectPriority"
                        ? Number(e.target.value)
                        : e.target.value,
                  })
                }
              >
                <option value="">Select…</option>
                {optionsFor(condition.field).map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="input"
                aria-label={`Issue filter ${i + 1} value`}
                type={
                  condition.field.toLowerCase().includes("date") ||
                  condition.field.endsWith("At")
                    ? "date"
                    : [
                          "estimate",
                          "customerCount",
                          "customerImportantCount",
                          "customerRevenueValues",
                          "customerSizeValues",
                          "customerRequestCount",
                          "customerRevenue",
                          "customerSize",
                        ].includes(condition.field)
                      ? "number"
                      : "text"
                }
                value={condition.value ?? ""}
                onChange={(e) => set(i, { value: e.target.value })}
              />
            ))
          )}
          <button
            type="button"
            className="icon-button"
            aria-label="Remove filter"
            onClick={() =>
              onChange({
                ...value,
                conditions: value.conditions.filter((_, idx) => idx !== i),
              })
            }
          >
            <Icon name="X" size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="text-button"
        onClick={() =>
          onChange({
            ...value,
            conditions: [
              ...value.conditions,
              { field: "statusId", operator: "eq", value: "" },
            ],
          })
        }
      >
        <Icon name="Plus" size={13} />
        Add filter
      </button>
      <FilterGroups
        value={value}
        onChange={onChange}
        render={(group, change) => (
          <FilterBuilder
            value={group}
            onChange={change}
            teamId={teamId}
            additionalFields={additionalFields}
            excludeFields={excludeFields}
          />
        )}
      />
    </div>
  );
}

export function IssuePage({
  issueId: providedIssueId,
  embedded = false,
}: { issueId?: string; embedded?: boolean } = {}) {
  const { issueId: routeIssueId } = useParams();
  const issueId = providedIssueId ?? routeIssueId;
  const store = useAppStore();
  const navigate = useNavigate();
  const currentLocation = useLocation();
  const issue = store.data.issues.find(
    (i) =>
      i.id === issueId ||
      i.identifier === issueId?.toUpperCase() ||
      i.previousIdentifiers?.includes(issueId?.toUpperCase()),
  );
  useEffect(() => {
    if (
      embedded ||
      !issueId ||
      !/^([a-z][a-z0-9]{0,9})-[1-9][0-9]*$/i.test(issueId)
    )
      return;
    let active = true;
    if (issue)
      navigate(
        `/issues/${issue.id}${currentLocation.search}${currentLocation.hash}`,
        { replace: true },
      );
    else
      void store
        .loadEntity("issues", issueId)
        .then((found) => {
          if (active)
            navigate(
              `/issues/${found.id}${currentLocation.search}${currentLocation.hash}`,
              { replace: true },
            );
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [issueId, issue?.id, embedded]);
  const [body, setBody] = useState(""),
    [showEvents, setShowEvents] = useState(true),
    [showProperties, setShowProperties] = useState(true),
    [addingDocument, setAddingDocument] = useState(false),
    [addingSubIssue, setAddingSubIssue] = useState(false),
    [slaOpen, setSlaOpen] = useState(false),
    [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set()),
    [editingComment, setEditingComment] = useState<Entity | null>(null),
    [deletingComment, setDeletingComment] = useState<Entity | null>(null),
    [editedCommentBody, setEditedCommentBody] = useState("");
  const addSubIssueButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const target = currentLocation.state?.commentDraft;
    if (target?.issueId === issueId && typeof target.parentId === "string")
      requestAnimationFrame(() => {
        const thread = document.querySelector(
          `[data-thread-id="${CSS.escape(target.parentId)}"]`,
        );
        thread
          ?.querySelector<HTMLElement>('[aria-label="Leave a reply…"]')
          ?.focus();
      });
    setEditingComment(null);
    setDeletingComment(null);
    setExpandedThreads(new Set());
    setAddingSubIssue(false);
  }, [issueId, currentLocation.key]);
  useEffect(() => {
    setBody(issue?.description ?? "");
  }, [issue?.id, issue?.description]);
  useEffect(() => {
    const id = currentLocation.hash.slice(1);
    if (!id.startsWith("update-") || !issue) return;
    if (!showEvents) {
      setShowEvents(true);
      return;
    }
    document.getElementById(id)?.scrollIntoView({ block: "center" });
  }, [currentLocation.hash, issue?.id, store.data.activities, showEvents]);
  useEffect(() => {
    const id = currentLocation.hash.slice(1);
    if (!id.startsWith("comment-") || !issue) return;
    const comment = store.data.comments.find(
      (row) =>
        !row.deletedAt && row.id === id.slice(8) && row.issueId === issue.id,
    );
    if (!comment) return;
    if (comment.parentId && !expandedThreads.has(comment.parentId)) {
      setExpandedThreads((current) => new Set([...current, comment.parentId]));
      return;
    }
    document.getElementById(id)?.scrollIntoView({ block: "center" });
  }, [currentLocation.hash, issue?.id, store.data.comments, expandedThreads]);
  if (!issue && store.hydrating)
    return <div className="app-loading">Loading issue…</div>;
  if (!issue)
    return (
      <EmptyState
        icon="Search"
        title="Issue not found"
        description="It may have been removed or you may not have access."
      />
    );
  const team = store.data.teams.find((t) => t.id === issue.teamId);
  const issueReadOnly = !!(team?.archivedAt || issue.deletedAt);
  const status =
    store.data.statuses.find((s) => s.id === issue.statusId) ??
    issue.sharedStatuses?.find((s: any) => s.id === issue.statusId);
  const comments = active(store.data.comments)
    .filter((c) => c.entityId === issue.id || c.issueId === issue.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const activity = store.data.activities
    .filter(
      (a) =>
        !a.deletedAt &&
        a.entityId === issue.id &&
        !formattingOnlyIssueActivity(a),
    )
    .sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
    );
  const issueContext = currentLocation.state?.issueContext;
  const neighboringIds: string[] =
    issueContext?.ids?.filter((id: string) =>
      store.data.issues.some((row) => row.id === id),
    ) ?? [];
  const neighborIndex = neighboringIds.indexOf(issue.id);
  const favorite = store.data.favorites.find(
    (row) =>
      !row.deletedAt &&
      row.entityId === issue.id &&
      row.userId === store.user?.id,
  );
  const saveBody = (value: string) => setBody(value);
  const renderComment = (c: Entity, root: Entity = c) => {
    const resolved = threadIsResolved(root);
    const threadSubscription = store.data.subscriptions.find(
      (row) =>
        !row.deletedAt &&
        row.userId === store.user?.id &&
        row.entityKind === "comments" &&
        row.entityId === root.id,
    );
    const reportFailure = (promise: Promise<unknown>) =>
      void promise.catch((error) => store.toast(String(error)));
    const author = store.data.users.find(
      (u) => u.id === (c.authorId ?? c.userId),
    );
    return (
      <div
        id={`comment-${c.id}`}
        className={`comment ${c.parentId ? "reply" : ""}`}
        key={c.id}
      >
        <Avatar user={author} size={24} />
        <div className="comment-main">
          <div className="comment-meta">
            <strong>{displayNameFor(author, store.data, "Member")}</strong>
            <time>{relativeDate(c.createdAt)}</time>
            {root.id === c.id && resolved && <Badge>Resolved</Badge>}
            {root.resolutionCommentId === c.id && resolved && (
              <Badge>Resolution</Badge>
            )}
            <span className="spacer" />
            <button
              className="icon-button comment-reply-action"
              aria-label="Reply to comment"
              title="Reply to comment"
              disabled={issueReadOnly}
              onClick={(event) =>
                event.currentTarget
                  .closest(".comment-thread")
                  ?.querySelector<HTMLElement>('[aria-label="Leave a reply…"]')
                  ?.focus()
              }
            >
              <Icon name="Reply" size={15} />
            </button>
            <Dropdown
              align="right"
              trigger={
                <button className="icon-button" aria-label="Comment options">
                  <Icon name="MoreHorizontal" size={15} />
                </button>
              }
            >
              {author?.id === store.user?.id && (
                <MenuItem
                  disabled={issueReadOnly}
                  icon="FileText"
                  onClick={() => {
                    setEditingComment(c);
                    setEditedCommentBody(c.body ?? "");
                  }}
                >
                  Edit
                </MenuItem>
              )}
              <MenuItem
                icon="Bell"
                onClick={() =>
                  reportFailure(
                    threadSubscription
                      ? store.remove("subscriptions", threadSubscription.id)
                      : store.create("subscriptions", {
                          entityKind: "comments",
                          entityId: root.id,
                          userId: store.user?.id,
                        }),
                  )
                }
              >
                {threadSubscription
                  ? "Unsubscribe from thread"
                  : "Subscribe to thread"}
              </MenuItem>
              <MenuItem
                disabled={issueReadOnly}
                icon="CheckCircle2"
                onClick={() =>
                  reportFailure(
                    store.update(
                      "comments",
                      root.id,
                      resolved
                        ? { resolved: false }
                        : {
                            resolved: true,
                            resolutionCommentId: c.id === root.id ? null : c.id,
                          },
                    ),
                  )
                }
              >
                {resolved ? "Reopen thread" : "Resolve thread"}
              </MenuItem>
              <MenuItem
                icon="Link"
                onClick={() =>
                  void navigator.clipboard.writeText(
                    `${location.origin}/issues/${issue.id}#comment-${c.id}`,
                  )
                }
              >
                Copy link to comment
              </MenuItem>
              <MenuItem
                icon="FileText"
                onClick={() =>
                  void navigator.clipboard.writeText(
                    richTextToMarkdown(c.body ?? ""),
                  )
                }
              >
                Copy content as Markdown
              </MenuItem>
              <MenuItem
                disabled={issueReadOnly}
                icon="Plus"
                onClick={() =>
                  openComposer({
                    title: textContent(c.body).slice(0, 100),
                    description: c.body,
                    teamId: issue.teamId,
                  })
                }
              >
                New issue from comment…
              </MenuItem>
              {!issue.sharedAccess && (
                <MenuItem
                  disabled={issueReadOnly}
                  icon="GitBranch"
                  onClick={() =>
                    openComposer({
                      title: textContent(c.body).slice(0, 100),
                      description: c.body,
                      teamId: issue.teamId,
                      parentId: issue.id,
                    })
                  }
                >
                  New sub-issue from comment…
                </MenuItem>
              )}
              {author?.id === store.user?.id && (
                <MenuItem
                  disabled={issueReadOnly}
                  icon="Trash2"
                  danger
                  onClick={() =>
                    commentThreads(comments).some(
                      (thread) =>
                        thread.root.id === c.id && thread.replies.length,
                    )
                      ? setDeletingComment(c)
                      : reportFailure(store.remove("comments", c.id))
                  }
                >
                  Delete
                </MenuItem>
              )}
            </Dropdown>
          </div>
          {c.anchor?.quote && (
            <button
              type="button"
              className="feature-comment-quote"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("open-inline-comment", {
                    detail: { issueId: issue.id, commentId: root.id },
                  }),
                )
              }
            >
              {c.anchor.quote}
            </button>
          )}
          <RichEditor readOnly value={c.body ?? ""} onChange={() => {}} />
          <div className="comment-reactions">
            {Object.entries(reactionUsers(c.reactions))
              .filter(([, users]) => users.length)
              .map(([emoji, users]) => (
                <button
                  disabled={issueReadOnly}
                  key={emoji}
                  aria-pressed={users.includes(store.user!.id)}
                  onClick={() =>
                    void store.update("comments", c.id, {
                      reactions: toggleReaction(
                        c.reactions,
                        emoji,
                        store.user!.id,
                      ),
                    })
                  }
                >
                  <EmojiGlyph emoji={emoji} /> {users.length}
                </button>
              ))}
            {!issueReadOnly && (
              <EmojiPicker
                onSelect={(emoji) =>
                  store.update("comments", c.id, {
                    reactions: toggleReaction(
                      c.reactions,
                      emoji,
                      store.user!.id,
                    ),
                  })
                }
              />
            )}
            <button
              disabled={issueReadOnly}
              className="text-button"
              onClick={(event) =>
                event.currentTarget
                  .closest(".comment-thread")
                  ?.querySelector<HTMLElement>('[aria-label="Leave a reply…"]')
                  ?.focus()
              }
            >
              Reply
            </button>
          </div>
        </div>
      </div>
    );
  };
  return (
    <div
      className={`issue-detail-view ${embedded ? "embedded-issue" : ""}`}
      data-issue-id={issue.id}
    >
      <header className="page-header">
        {issueContext?.parentRoute && (
          <>
            <Link
              className="issue-context-link"
              aria-label="Team overview"
              to={issueContext.parentRoute}
            >
              {issueContext.parentLabel}
            </Link>
            <Icon name="ChevronRight" size={12} />
          </>
        )}
        {issueContext?.route && (
          <>
            <Link className="issue-context-link" to={issueContext.route}>
              {issueContext.label || "Issues"}
            </Link>
            <Icon name="ChevronRight" size={12} />
          </>
        )}
        <span className="issue-header-title">
          <span className="issue-header-identifier">{issueName(issue)}</span>
          <span className="issue-header-name" data-tooltip-label={issue.title}>{issue.title}</span>
        </span>
        <button
          role="switch"
          aria-checked={!!favorite}
          className="icon-button"
          aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
          onClick={() =>
            favorite
              ? void store.remove("favorites", favorite.id)
              : void store.create("favorites", {
                  userId: store.user?.id,
                  type: "issue",
                  entityId: issue.id,
                  label: issueName(issue) + " " + issue.title,
                  route: "/issues/" + issue.id,
                })
          }
        >
          <Icon
            name="Star"
            size={14}
            style={favorite ? { fill: "currentColor" } : undefined}
          />
        </button>
        {!issueReadOnly && (
          <IssueActions
            issue={issue}
            onAddDocument={
              !issue.sharedAccess ? () => setAddingDocument(true) : undefined
            }
          />
        )}
        <span className="spacer" />
        {neighborIndex >= 0 && (
          <div className="issue-neighbor-controls">
            <span className="issue-neighbor-count">
              {neighborIndex + 1}
              <span> / {neighboringIds.length}</span>
            </span>
            <div className="issue-neighbor-buttons">
              {[1, -1].map((step) => (
                <button
                  key={step}
                  className="icon-button"
                  aria-label={step < 0 ? "Navigate up" : "Navigate down"}
                  disabled={!neighboringIds[neighborIndex + step]}
                  onClick={() =>
                    navigate(
                      "/issues/" + neighboringIds[neighborIndex + step],
                      { replace: true, state: currentLocation.state },
                    )
                  }
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      d={
                        step > 0
                          ? "M11.48 10.326a.75.75 0 0 0-.96-1.152l-1.77 1.475V3.75a.75.75 0 0 0-1.5 0v6.899L5.48 9.174a.75.75 0 0 0-.96 1.152l3 2.5a.75.75 0 0 0 .96 0l3-2.5Z"
                          : "M11.48 5.674a.75.75 0 1 1-.96 1.152L8.75 5.351v6.899a.75.75 0 0 1-1.5 0V5.351L5.48 6.826a.75.75 0 0 1-.96-1.152l3-2.5a.75.75 0 0 1 .96 0l3 2.5Z"
                      }
                    />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        )}
        {!issueReadOnly && <IssueSharingControl issue={issue} />}
      </header>
      {!embedded && (
        <div className="issue-copy-toolbar">
          <div role="group" aria-label="Issue copy actions">
            <button
              className="icon-button issue-copy-control"
              aria-label="Copy issue URL"
              onClick={() => {
                void navigator.clipboard.writeText(location.href);
                store.toast("Issue link copied");
              }}
            >
              <IssueCopyIcon kind="url" />
            </button>
            <button
              className="icon-button issue-copy-control"
              aria-label="Copy issue ID"
              onClick={() =>
                void navigator.clipboard.writeText(issueName(issue))
              }
            >
              <IssueCopyIcon kind="id" />
            </button>
          </div>
        </div>
      )}
      <div className="issue-detail-layout">
        <main className="issue-content-scroll">
          <article className="issue-article">
            {team?.archivedAt && (
              <div className="banner" role="status">
                This team is retired. This issue is read-only.
              </div>
            )}
            <IssueSharingBanner issue={issue} />
            <ReminderBanner kind="issues" id={issue.id} />
            {issue.deletedAt && (
              <div className="banner">
                This issue was deleted.
                <Button onClick={() => void store.restore("issues", issue.id)}>
                  Restore issue
                </Button>
              </div>
            )}
            {issue.archivedAt && (
              <div className="banner">
                Archived issue
                <Button
                  onClick={() =>
                    void store.update("issues", issue.id, { archivedAt: null })
                  }
                >
                  Unarchive
                </Button>
              </div>
            )}
            {issue.parentId && (
              <Link
                className="parent-issue-link"
                to={`/issues/${issue.parentId}`}
              >
                <Icon name="ArrowUpRight" size={14} />
                {store.data.issues.find((i) => i.id === issue.parentId)
                  ?.title ?? "Parent issue"}
              </Link>
            )}
            {issue.duplicateOfId && (
              <div className="banner">
                Duplicate of{" "}
                <Link to={`/issues/${issue.duplicateOfId}`}>
                  {issueName(
                    store.data.issues.find(
                      (i) => i.id === issue.duplicateOfId,
                    ) ?? {},
                  )}
                </Link>
              </div>
            )}
            <IssueTitleEditor
              key={`${store.user?.id}:${issue.id}`}
              issueId={issue.id}
              value={issue.title}
              readOnly={issueReadOnly}
              showProperties={showProperties}
            />
            {!issueReadOnly && <TriageActions issue={issue} />}
            <RichEditor
              readOnly={issueReadOnly}
              blurOnEscape
              ariaLabel="Issue description"
              collaboration={{
                kind: "issues",
                id: issue.id,
                field: "description",
              }}
              attachmentContext={{ issueId: issue.id }}
              value={body}
              onChange={saveBody}
              placeholder="Add description…"
            />
            <div className="issue-description-footer">
              {!issueReadOnly && <IssueReactions issue={issue} />}
              <button
                type="button"
                className="icon-button"
                disabled={issueReadOnly}
                aria-label="Attach images, files, or videos"
                onMouseDown={(event) => event.preventDefault()}
                onClick={(event) =>
                  event.currentTarget
                    .closest(".issue-article")
                    ?.querySelector<HTMLInputElement>(
                      ':scope > .rich-editor > input[type="file"]',
                    )
                    ?.click()
                }
              >
                <NativeIssueActionIcon name="attachment" />
              </button>
              <span className="spacer" />
              {store.pending > 0 && (
                <span className="small muted" role="status">
                  Saving…
                </span>
              )}
            </div>
            <EntityDocuments
              parent={{ kind: "issues", id: issue.id }}
              hideEmpty
              allowCreate={!issue.sharedAccess && !issueReadOnly}
            />
            {addingDocument && (
              <DocumentForm
                initialParent={{ kind: "issues", id: issue.id }}
                onClose={() => setAddingDocument(false)}
              />
            )}
            {!issue.sharedAccess && !issueReadOnly && (
              <div className="issue-add-subissue-row">
                <button
                  ref={addSubIssueButton}
                  className="text-button"
                  aria-label="Create new sub-issue"
                  aria-expanded={addingSubIssue}
                  onClick={() => setAddingSubIssue(true)}
                >
                  <span className="issue-action-glyph">
                    <NativeIssueActionIcon name="plus" />
                  </span>
                  Add sub-issues
                </button>
                {addingSubIssue && (
                  <IssueComposer
                    inline
                    defaults={{ teamId: issue.teamId, parentId: issue.id }}
                    onClose={() => {
                      setAddingSubIssue(false);
                      requestAnimationFrame(() =>
                        addSubIssueButton.current?.focus({ preventScroll: true }),
                      );
                    }}
                  />
                )}
              </div>
            )}
            <fieldset
              disabled={issueReadOnly}
              style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
            >
              <SubIssues key={issue.id} parent={issue} />
            </fieldset>
            <EntityCustomerRequests issueId={issue.id} hideEmpty />
            <AsksIssueConversation issueId={issue.id} />
            <section className="activity-section">
              <div className="activity-heading">
                <h3>Activity</h3>
                <span className="spacer" />
                <button
                  className="text-button"
                  disabled={issueReadOnly}
                  aria-label={
                    isIssueSubscribed(store, issue)
                      ? "Unsubscribe from issue"
                      : "Subscribe to issue"
                  }
                  onClick={() => void toggleIssueSubscription(store, issue)}
                >
                  {isIssueSubscribed(store, issue)
                    ? "Unsubscribe"
                    : "Subscribe"}
                </button>
                {!issue.sharedAccess && (
                  <fieldset
                    disabled={issueReadOnly}
                    style={{ border: 0, padding: 0, margin: 0 }}
                  >
                    <IssueSubscriberMenu issue={issue} />
                  </fieldset>
                )}
              </div>
              {activity.length > 0 && !showEvents && (
                <button
                  className="activity-events-toggle text-button"
                  onClick={() => setShowEvents(!showEvents)}
                >
                  <Icon name="MoreHorizontal" size={15} />
                  Show {activity.length} events
                </button>
              )}
              {showEvents && activity.length > 0 && (
                <IssueActivityTimeline
                  activity={activity}
                  teamId={issue.teamId}
                  issueId={issue.id}
                />
              )}
              {commentThreads(comments).map(({ root, replies }) => {
                const resolved = threadIsResolved(root);
                const expanded = expandedThreads.has(root.id);
                const visibleReplies =
                  resolved && !expanded
                    ? replies.filter(
                        (reply) => reply.id === root.resolutionCommentId,
                      )
                    : replies;
                const hiddenCount = replies.length - visibleReplies.length;
                return (
                  <div
                    className="comment-thread"
                    key={root.id}
                    data-thread-id={root.id}
                  >
                    {renderComment(root)}
                    {visibleReplies.map((reply) => renderComment(reply, root))}
                    {resolved && (hiddenCount > 0 || expanded) && (
                      <button
                        className="text-button comment-thread-toggle"
                        aria-expanded={expanded}
                        onClick={() =>
                          setExpandedThreads((current) => {
                            const next = new Set(current);
                            next.has(root.id)
                              ? next.delete(root.id)
                              : next.add(root.id);
                            return next;
                          })
                        }
                      >
                        {expanded
                          ? "Hide replies"
                          : `Show ${hiddenCount || replies.length} ${hiddenCount === 1 ? "reply" : "replies"}`}
                      </button>
                    )}
                    {!issueReadOnly && (
                      <div className="comment-thread-reply-composer">
                        <IssueCommentComposer
                          key={`${store.data.workspaceId}:${store.user?.id}:${issue.id}:${root.id}`}
                          issueId={issue.id}
                          parentId={root.id}
                          onCancelReply={() => {}}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
              {!issueReadOnly && (
                <IssueCommentComposer
                  key={`${store.data.workspaceId}:${store.user?.id}:${issue.id}:root`}
                  issueId={issue.id}
                  parentId={null}
                  onCancelReply={() => {}}
                />
              )}
            </section>
          </article>
        </main>
        {showProperties && (
          <fieldset
            disabled={issueReadOnly}
            className="issue-properties-panel"
            style={{ border: 0, margin: 0, minWidth: 0 }}
          >
            <h3>Properties</h3>
            <CustomerAssignmentControl entity={issue} kind="issues" disabled={issueReadOnly}/>
            {(
              ["statusId", "priority", "assigneeId", "estimate"] as Property[]
            ).map((field) => (
              <div key={field} className="issue-detail-project-cycle">
                <PropertyPicker
                  detail
                  key={field}
                  field={field}
                  value={issue[field]}
                  teamId={issue.teamId}
                  optionsOverride={
                    field === "statusId"
                      ? issue.sharedStatuses
                      : field === "estimate"
                        ? sharedEstimateOptions(issue)
                        : undefined
                  }
                  onChange={(value) =>
                    void store.update("issues", issue.id, { [field]: value })
                  }
                >
                  {field === "estimate" && issue.estimate != null ? (
                    <>
                      <EntityIcon
                        entity={{ icon: "Estimate", color: "var(--muted)" }}
                        size={16}
                      />
                      <span>
                        {estimateLabel(issue.estimate, team)}
                        {String(team?.estimateScale).toLowerCase() === "t-shirt"
                          ? ""
                          : issue.estimate === 1
                            ? " Point"
                            : " Points"}
                      </span>
                    </>
                  ) : undefined}
                </PropertyPicker>
                {field === "assigneeId" &&
                  issue.assigneeId &&
                  !issue.sharedAccess && (
                    <Link
                      className="issue-property-open-link"
                      aria-label="Go to user"
                      to={"/profiles/" + issue.assigneeId}
                    >
                      <span>
                        <svg
                          width="9"
                          height="5"
                          viewBox="0 0 9 5"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path d="M1.915.557a.667.667 0 0 0-.943.943l2.862 2.862a.942.942 0 0 0 1.333 0L8.028 1.5a.667.667 0 0 0-.943-.943L4.5 3.14 1.915.557Z" />
                        </svg>
                      </span>
                    </Link>
                  )}
              </div>
            ))}
            <h3>Labels</h3>
            <div className="detail-labels">
              {(issue.labelIds ?? []).map((id: string) => {
                const label =
                  store.data.labels.find((l) => l.id === id) ??
                  issue.sharedLabels?.find((l: any) => l.id === id);
                return label ? (
                  <Badge
                    key={id}
                    color={label.color}
                    description={label.description}
                  >
                    {store.data.labels.some((l) => l.id === label.id) ? (
                      <Link to={`/label/${label.id}`}>{label.name}</Link>
                    ) : (
                      label.name
                    )}
                  </Badge>
                ) : null;
              })}
            </div>
            <PropertyPicker
              detail
              field="labelIds"
              emptyLabel="Add labels"
              teamId={issue.teamId}
              optionsOverride={issue.sharedLabels}
              value={issue.labelIds ?? []}
              onChange={(labelIds) =>
                void store.update("issues", issue.id, { labelIds })
              }
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 11.5V13H5.132v-1.5H12Zm1.5-1.5V6a1.5 1.5 0 0 0-1.346-1.492L12 4.5H5.133a.5.5 0 0 0-.303.103l-.08.076-2.382 2.834a.5.5 0 0 0-.11.234l-.008.087v.331a.5.5 0 0 0 .118.321l2.382 2.835a.5.5 0 0 0 .383.179V13l-.22-.012a2 2 0 0 1-1.16-.54l-.15-.16L1.218 9.45a2 2 0 0 1-.46-1.11L.75 8.165v-.331a2 2 0 0 1 .363-1.147l.106-.14 2.383-2.834a2 2 0 0 1 1.312-.701L5.134 3H12a3 3 0 0 1 3 3v4a3 3 0 0 1-3.002 3v-1.5c.778 0 1.417-.59 1.494-1.347L13.5 10Z" />
                <path d="M5.5 8a1 1 0 1 1 2 0 1 1 0 0 1-2 0Z" />
              </svg>
              <span>Add label</span>
            </PropertyPicker>
            {(issue.sharedAccess
              ? []
              : ([
                  "projectId",
                  ...(issue.projectId || issue.milestoneId
                    ? ["milestoneId"]
                    : []),
                  ...(team?.cycleEnabled || issue.cycleId ? ["cycleId"] : []),
                ] as Property[])
            ).map((field) => (
              <React.Fragment key={field}>
                {field !== "milestoneId" && (
                  <h3>
                    {field === "projectId"
                      ? "Project"
                      : field === "cycleId"
                        ? "Cycle"
                        : "Milestone"}
                  </h3>
                )}
                <div
                  className={
                    field === "milestoneId"
                      ? "issue-detail-milestone"
                      : "issue-detail-project-cycle"
                  }
                >
                  {field === "milestoneId" && (
                    <svg
                      className="issue-milestone-connector"
                      width="10"
                      height="9"
                      viewBox="0 0 10 9"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M0 0h1v1c0 2.5 2.212 3.546 2.212 3.546L9.737 8.06c.568.306.094 1.186-.474.88l-6.48-3.488S0 4 0 1V0Z" />
                    </svg>
                  )}
                  <PropertyPicker
                    detail
                    field={field}
                    emptyLabel={
                      field === "projectId"
                        ? "Add to project"
                        : field === "milestoneId"
                          ? "Set milestone"
                          : undefined
                    }
                    value={issue[field]}
                    teamId={issue.teamId}
                    projectId={issue.projectId}
                    onChange={(value) =>
                      void store.update("issues", issue.id, { [field]: value })
                    }
                  >
                    {field === "milestoneId" && !issue.milestoneId ? (
                      <>
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path
                            d="M7.3406 2.32C7.68741 1.89333 8.31259 1.89333 8.6594 2.32L12.7903 7.402C13.0699 7.74597 13.0699 8.25403 12.7903 8.598L8.6594 13.68C8.31259 14.1067 7.68741 14.1067 7.3406 13.68L3.2097 8.598C2.9301 8.25403 2.9301 7.74597 3.2097 7.402L7.3406 2.32Z"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeDasharray="2 1.93"
                            strokeDashoffset="0.15"
                          />
                        </svg>
                        <span>Set milestone</span>
                      </>
                    ) : undefined}
                  </PropertyPicker>
                  {field === "projectId" && issue.projectId && (
                    <Link
                      className="issue-property-open-link"
                      aria-label="Open project"
                      to={`/project/${issue.projectId}/overview`}
                    >
                      <span>
                        <svg
                          width="9"
                          height="5"
                          viewBox="0 0 9 5"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path d="M1.915.557a.667.667 0 0 0-.943.943l2.862 2.862a.942.942 0 0 0 1.333 0L8.028 1.5a.667.667 0 0 0-.943-.943L4.5 3.14 1.915.557Z" />
                        </svg>
                      </span>
                    </Link>
                  )}
                </div>
              </React.Fragment>
            ))}
            {(issue.slaDueAt || issue.dueDate) && (
              <>
                <h3>{issue.slaDueAt ? "SLA" : "Due date"}</h3>
                {issue.slaDueAt ? (
                  <SlaIndicator
                    issue={issue}
                    onClick={() => setSlaOpen(true)}
                  />
                ) : (
                  <DatePicker
                    value={issue.dueDate}
                    onChange={(dueDate) =>
                      void store.update("issues", issue.id, {
                        dueDate: dueDate || null,
                      })
                    }
                  />
                )}
              </>
            )}
            <IssueRelations issue={issue} />
            {!!issue.links?.length && (
              <section className="issue-links" data-shortcut="links-section">
                <h3>Links</h3>
                {(issue.links ?? []).map((link: any, index: number) => (
                  <div className="relation-row" key={`${link.url}:${index}`}>
                    <Icon name="Link" size={13} />
                    <a href={link.url} target="_blank" rel="noreferrer">
                      {link.title ?? link.url}
                    </a>
                    <button
                      className="icon-button"
                      aria-label="Remove link"
                      onClick={() =>
                        void store.update("issues", issue.id, {
                          links: issue.links.filter(
                            (_: any, i: number) => i !== index,
                          ),
                        })
                      }
                    >
                      <Icon name="X" size={12} />
                    </button>
                  </div>
                ))}
                <button
                  className="text-button"
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent("workspace-command", {
                        detail: { command: "link-url" },
                        cancelable: true,
                      }),
                    )
                  }
                >
                  <Icon name="Plus" size={12} />
                  Add link
                </button>
              </section>
            )}
            <div className="issue-metadata" hidden>
              <span>Created {relativeDate(issue.createdAt)}</span>
              <span>Updated {relativeDate(issue.updatedAt)}</span>
            </div>
          </fieldset>
        )}
      </div>
      {slaOpen && <SlaPicker issue={issue} onClose={() => setSlaOpen(false)} />}{" "}
      {deletingComment && (
        <CommentDeleteDialog
          replyCount={
            commentThreads(comments).find(
              (thread) => thread.root.id === deletingComment.id,
            )?.replies.length ?? 0
          }
          onClose={() => setDeletingComment(null)}
          onDelete={() => store.remove("comments", deletingComment.id)}
        />
      )}
      {editingComment && (
        <Modal title="Edit comment" onClose={() => setEditingComment(null)}>
          <div className="modal-body">
            <RichEditor
              attachmentContext={{ issueId: issue.id }}
              value={editedCommentBody}
              onChange={setEditedCommentBody}
            />
          </div>
          <div className="modal-footer">
            <Button onClick={() => setEditingComment(null)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!textContent(editedCommentBody)}
              onClick={async () => {
                await store.update("comments", editingComment.id, {
                  body: editedCommentBody,
                  editedAt: new Date().toISOString(),
                });
                setEditingComment(null);
              }}
            >
              Save comment
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function VirtualBoardItems({
  issues,
  focusedId,
  renderItem,
  overscan = 5,
}: {
  issues: Entity[];
  focusedId: string;
  renderItem: (issue: Entity) => React.ReactNode;
  overscan?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragEdgeScroll = useDragEdgeScroll(ref, false, true);
  const virtual = useVirtualizer({
    count: issues.length,
    getScrollElement: () => ref.current,
    estimateSize: () => 155,
    overscan,
  });
  useEffect(() => {
    const index = issues.findIndex((i) => i.id === focusedId);
    if (index >= 0) virtual.scrollToIndex(index, { align: "auto" });
  }, [focusedId]);
  return (
    <div
      ref={ref}
      className="board-virtual-scroll"
      data-total-issues={issues.length}
      {...dragEdgeScroll}
    >
      <div style={{ height: virtual.getTotalSize(), position: "relative" }}>
        {virtual.getVirtualItems().map((row) => (
          <div
            key={issues[row.index].id}
            data-index={row.index}
            ref={virtual.measureElement}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${row.start}px)`,
            }}
          >
            {renderItem(issues[row.index])}
          </div>
        ))}
      </div>
    </div>
  );
}
