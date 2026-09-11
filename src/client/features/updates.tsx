import {projectStatuses} from './project-statuses';
import { EmojiPicker, EmojiGlyph } from "../components/emoji-picker";
import { displayNameFor } from "../display-name";
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  Info,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Smile,
  Trash2,
} from "lucide-react";
import { Button, Dropdown, Modal, RichEditor } from "../components/ui";
import { richTextToMarkdown } from "../markdown";
import {
  defaultUpdateSchedule,
  updateSnapshot,
  updateProgressDetails,
  previousUpdateSnapshot,
  type UpdateSchedule,
} from "../../shared/updates";
import {
  Action,
  Blank,
  Confirm,
  FormDialog,
  Person,
  date,
  live,
  plain,
  useActions,
  type Row,
} from "./shared";

const emojiOptions = [
  "👍",
  "❤️",
  "🎉",
  "🚀",
  "👀",
  "🙌",
  "✋",
  "▶️",
  "🥳",
  "✅",
  "💡",
  "🙏",
];
function SlackLogo(){return <svg viewBox="0 0 122.8 122.8" aria-hidden="true"><path fill="#36C5F0" d="M30.3 77.5a15.1 15.1 0 1 1-15.1-15.1h15.1v15.1Zm7.6 0a15.1 15.1 0 0 1 30.2 0v37.8a15.1 15.1 0 0 1-30.2 0V77.5Z"/><path fill="#2EB67D" d="M45.4 30.3a15.1 15.1 0 1 1 15.1-15.1v15.1H45.4Zm0 7.6a15.1 15.1 0 0 1 0 30.2H7.6a15.1 15.1 0 0 1 0-30.2h37.8Z"/><path fill="#ECB22E" d="M92.5 45.4a15.1 15.1 0 1 1 15.1 15.1H92.5V45.4Zm-7.6 0a15.1 15.1 0 0 1-30.2 0V7.6a15.1 15.1 0 0 1 30.2 0v37.8Z"/><path fill="#E01E5A" d="M77.5 92.5a15.1 15.1 0 1 1-15.1 15.1V92.5h15.1Zm0-7.6a15.1 15.1 0 0 1 0-30.2h37.8a15.1 15.1 0 0 1 0 30.2H77.5Z"/></svg>}
function Reactions({
  kind,
  item,
  readOnly = false,
}: {
  kind: "updates" | "comments";
  item: Row;
  readOnly?: boolean;
}) {
  const { user, update, act } = useActions();
  const [emoji, setEmoji] = useState("");
  const toggle = (value: string) => {
    if (readOnly || !value.trim()) return;
    const previous = item.reactions?.[value] ?? [],
      ids = previous.includes(user?.id)
        ? previous.filter((id: string) => id !== user?.id)
        : [...previous, user?.id];
    void act(() =>
      update(kind, item.id, { reactions: { ...item.reactions, [value]: ids } }),
    );
  };
  return (
    <span className="update-reactions">
      {Object.entries(item.reactions ?? {})
        .filter(([, ids]) => Array.isArray(ids) && ids.length)
        .map(([emoji, ids]) => (
          <button
            type="button"
            disabled={readOnly}
            key={emoji}
            className={
              (ids as string[]).includes(user?.id ?? "") ? "active" : ""
            }
            aria-label={`React ${emoji}`}
            aria-pressed={(ids as string[]).includes(user?.id ?? "")}
            onClick={() => toggle(emoji)}
          >
            <EmojiGlyph emoji={emoji} /> {(ids as string[]).length}
          </button>
        ))}
      {!readOnly && <EmojiPicker onSelect={toggle} />}
    </span>
  );
}
function ProgressDetails({
  details,
}: {
  details: ReturnType<typeof updateProgressDetails>;
}) {
  const { data } = useActions();
  if (!details.length) return null;
  const value = (field: string, v: any) =>
    field === "ownerId"
      ? displayNameFor(
          data.users.find((u) => u.id === v),
          data,
        )
      : field === "progress"
        ? `${Math.round(v)}%`
        : field === "milestone"
          ? `${v?.name ?? "New milestone"} · ${v?.completed ?? 0}/${v?.total ?? 0} issues complete`
          : field==='status'?(projectStatuses(data).find(status=>status.id===v)?.name??v??'Not set'):(v ?? "Not set");
  return (
    <div className="update-progress-details">
      {details.map((detail, index) => (
        <div key={index}>
          <span>
            {
              (
                {
                  status: "Status",
                  ownerId: "Lead / owner",
                  targetDate: "Target date",
                  progress: "Progress",
                  milestone: "Milestone",
                } as any
              )[detail.field]
            }
          </span>
          <span>
            {detail.field === "milestone" ? (
              detail.to?value(detail.field, detail.to):`${detail.from?.name||"Milestone"} removed`
            ) : (
              <>
                <s>{value(detail.field, detail.from)}</s> →{" "}
                {value(detail.field, detail.to)}
              </>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

export function activitySummary(
  activity: Row,
  data: ReturnType<typeof useActions>["data"],
) {
  const hidden = new Set([
    "health",
    "latestUpdateAt",
    "lastUpdateId",
    "updateHealthStatus",
    "updatedAt",
    "version",
    "history",
    "lastEditedBy",
    "lastEditedAt",
  ]);
  const names: Record<string, string> = {
    leadId: "Lead",
    ownerId: "Owner",
    targetDate: "Target date",
    startDate: "Start date",
    teamIds: "Teams",
    projectIds: "Projects",
    initiativeIds: "Initiatives",
    parentIds: "Parent initiatives",
    memberIds: "Members",
    labelIds: "Labels",
    description: "Description",
    updateSchedule: "Update reminders",
    dependencyIds: "Blocked by",
    subscriberIds: "Subscribers",
    datePrecision: "Target date precision",
  };
  const describe = (key: string, value: any): string => {
    if (
      value == null ||
      value === "" ||
      (Array.isArray(value) && !value.length)
    )
      return "Not set";
    if (key === "description") return plain(String(value)) || "Not set";
    if (Array.isArray(value))
      return value.map((v) => describe(key, v)).join(", ");
    if (key === "status" && activity.entityKind === "projects") return projectStatuses(data).find(status => status.id === value)?.name ?? "Unavailable";
    if (key === "priority") return ["No priority", "Urgent", "High", "Medium", "Low"][Number(value)] ?? String(value);
    const collection = /^(leadId|ownerId|memberIds|subscriberIds)$/.test(key)
      ? data.users
      : /teamId/i.test(key)
        ? data.teams
        : /projectId|dependencyIds/i.test(key)
          ? data.projects
          : /(initiativeId|parentId)/i.test(key)
            ? data.initiatives
            : /labelId/i.test(key)
              ? data.labels
              : null;
    if (collection)
      return (
        collection.find((item) => item.id === value)?.name ?? "Unavailable"
      );
    if (typeof value === "boolean") return value ? "Enabled" : "Disabled";
    if (typeof value === "object") return "Updated";
    return String(value);
  };
  return Object.entries(activity.changes ?? {})
    .filter(
      ([key, change]: [string, any]) =>
        !hidden.has(key) &&
        describe(key, change.from) !== describe(key, change.to),
    )
    .map(([key, change]: [string, any]) =>
      key === "description"
        ? "Updated description"
        : `${names[key] ?? key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1")}: ${describe(key, change.from)} → ${describe(key, change.to)}`,
    )
    .join(" · ");
}

export function Updates({
  kind,
  item,
  history = false,
}: {
  kind: "project" | "initiative";
  item: Row;
  history?: boolean;
}) {
  const { data, user, create, update, remove, act, toast } = useActions(),
    location = useLocation(), navigate = useNavigate();
  const [writing, setWriting] = useState(false),
    [body, setBody] = useState(""),
    [health, setHealth] = useState("On track"),
    [healthOpen,setHealthOpen] = useState(false),
    [editing, setEditing] = useState<Row | null>(null),
    [deleting, setDeleting] = useState<Row | null>(null),
    [hideDetails, setHideDetails] = useState(false),
    [activeUpdate,setActiveUpdate] = useState<string|null>(null),
    [includeChildren, setIncludeChildren] = useState(false),
    [loadedDraftKey, setLoadedDraftKey] = useState("");
  useEffect(()=>{
    const openActions=()=>{
      const focused=document.activeElement?.closest<HTMLElement>('[data-update-id]')?.dataset.updateId,selected=focused||activeUpdate;
      if(!selected||document.querySelector('[role=dialog],dialog[open]'))return false;
      const target=document.querySelector<HTMLButtonElement>('[data-update-id="'+selected+'"] [aria-label="Update actions"]');
      if(!target)return false;target.click();return true;
    };
    const listener=(event:Event)=>{if(!event.defaultPrevented&&(event as CustomEvent).detail?.command==='command-menu'&&openActions())event.preventDefault()};
    const key=(event:KeyboardEvent)=>{if(!event.defaultPrevented&&(event.metaKey||event.ctrlKey)&&!event.altKey&&!event.shiftKey&&event.key.toLowerCase()==='k'&&!(event.target as Element)?.closest('input,textarea,[contenteditable=true]')&&openActions()){event.preventDefault();event.stopPropagation()}};
    window.addEventListener('workspace-command',listener,true);window.addEventListener('keydown',key,true);
    return()=>{window.removeEventListener('workspace-command',listener,true);window.removeEventListener('keydown',key,true)};
  },[activeUpdate]);
  const draftKey = `parabolic:update-draft:${data.workspaceId}:${user?.id}:${kind}:${item.id}`;
  const ownUpdates = live(data.updates)
    .filter((u) => u[`${kind}Id`] === item.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const isRetired = (parent: Row | undefined, type: "project" | "initiative") => {
    if (!parent) return true;
    const ids: string[] = type === "project" ? [...new Set([parent.teamId, ...(parent.teamIds || [])].filter(Boolean))] : [parent.leadTeamId || parent.teamId].filter(Boolean);
    return ids.length > 0 && ids.every(id => { const team = data.teams.find(team => team.id === id); return !team || !!team.archivedAt || !!team.deletedAt; });
  };
  const readOnly = isRetired(item, kind);
  const updateReadOnly = (value: Row) => value.projectId ? isRetired(data.projects.find(parent => parent.id === value.projectId), "project") : isRetired(data.initiatives.find(parent => parent.id === value.initiativeId), "initiative");
  const firstOwner = kind === "project" ? item.leadId : item.ownerId,
    canPost = !readOnly && (!!ownUpdates.length || !firstOwner || firstOwner === user?.id);
  useEffect(() => {
    try {
      const draft = JSON.parse(localStorage.getItem(draftKey) ?? "null");
      if (draft) {
        setBody(draft.body ?? "");
        setHealth(draft.health ?? "On track");
        setHideDetails(!!draft.hideDetails);
        setWriting(true);
      } else {
        setBody("");
        setHealth("On track");
        setHideDetails(false);
        setWriting(false);
      }
    } catch {}
    setEditing(null);
    setLoadedDraftKey(draftKey);
  }, [draftKey]);
  useEffect(() => {
    if (loadedDraftKey === draftKey && writing && !editing) {
      if (plain(body))
        localStorage.setItem(
          draftKey,
          JSON.stringify({ body, health, hideDetails }),
        );
      else localStorage.removeItem(draftKey);
    }
  }, [body, health, hideDetails, writing, editing, draftKey, loadedDraftKey]);
  useEffect(() => {
    if (location.hash) {
      const id = location.hash.slice(1);
      requestAnimationFrame(() =>
        document.getElementById(id)?.scrollIntoView({ block: "center" }),
      );
    }
  }, [location.hash, ownUpdates.length]);
  useEffect(() => {
    if (
      loadedDraftKey === draftKey &&
      canPost &&
      new URLSearchParams(location.search).get("compose") === "1"
    )
      setWriting(true);
  }, [loadedDraftKey, draftKey, canPost, location.search]);
  const reset = () => {
    setBody("");
    setHealth("On track");
    setHideDetails(false);
    setEditing(null);
    setWriting(false);
    localStorage.removeItem(draftKey);
  };
  const snapshot = updateSnapshot(kind, item, data),
    previous = ownUpdates.find((u) => u.id !== editing?.id)?.progressSnapshot;
  const details = updateProgressDetails(snapshot, previous);
  const scope = useMemo(() => {
    const ids = new Set([item.id]);
    if (includeChildren && kind === "initiative") {
      let changed = true;
      while (changed) {
        changed = false;
        for (const initiative of live(data.initiatives))
          if (
            [initiative.parentId, ...(initiative.parentIds ?? [])].some((id) =>
              ids.has(id),
            ) &&
            !ids.has(initiative.id)
          ) {
            ids.add(initiative.id);
            changed = true;
          }
      }
    }
    const projects = new Set(
      includeChildren && kind === "initiative"
        ? data.projects
            .filter((p) =>
              [p.initiativeId, ...(p.initiativeIds ?? [])].some((id) =>
                ids.has(id),
              ),
            )
            .map((p) => p.id)
        : [],
    );
    return { ids, projects };
  }, [includeChildren, kind, item.id, data.initiatives, data.projects]);
  const scopedUpdates = live(data.updates)
    .filter((u) =>
      kind === "project"
        ? u.projectId === item.id
        : scope.ids.has(u.initiativeId) || scope.projects.has(u.projectId),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const copyMarkdown = (value: Row) => {
    const changes = value.hideDetails || !value.progressSnapshot ? [] : updateProgressDetails(value.progressSnapshot, previousUpdateSnapshot(value, scopedUpdates));
    const display = (field: string, item: any): string => field === "ownerId" ? displayNameFor(data.users.find(user => user.id === item), data) : field === "status" ? projectStatuses(data).find(status => status.id === item)?.name || item || "Not set" : field === "progress" ? `${Math.round(item)}%` : field === "milestone" ? item ? `${item.name}: ${item.completed}/${item.total} issues complete${item.targetDate ? ", target " + item.targetDate : ""}` : "Removed" : String(item ?? "Not set");
    const names: Record<string,string> = {ownerId:"Lead / owner",targetDate:"Target date",status:"Status",progress:"Progress",milestone:"Milestone"};
    return `## ${value.health}\n\n${richTextToMarkdown(value.body)}` + (changes.length ? "\n\n" + changes.map(change => `- ${names[change.field] || change.field}: ${display(change.field, change.from)} → ${display(change.field, change.to)}`).join("\n") : "");
  };
  const timeline = history
    ? [
        ...scopedUpdates.map((value) => ({ type: "update", value })),
        ...live(data.activities)
          .filter(a => {
            const projects = kind === "project" ? new Set([item.id]) : scope.projects;
            const milestoneProject = a.entityKind === "milestones" ? data.milestones.find(milestone => milestone.id === a.entityId)?.projectId || a.changes?.projectId?.to || a.changes?.projectId?.from : undefined;
            const included = a.entityKind === "initiatives" && kind === "initiative" && scope.ids.has(a.entityId) || a.entityKind === "projects" && projects.has(a.entityId) || a.entityKind === "milestones" && projects.has(milestoneProject);
            return included && !!activitySummary(a, data);
          })
          .map((value) => ({ type: "activity", value })),
      ].sort((a, b) => b.value.createdAt.localeCompare(a.value.createdAt))
    : scopedUpdates.slice(0, 1).map((value) => ({ type: "update", value }));
  return (
    <div className="feature-updates">
      {history && kind === "initiative" && (
        <label className="update-descendants">
          <input
            type="checkbox"
            checked={includeChildren}
            onChange={(e) => setIncludeChildren(e.target.checked)}
          />
          Include updates from sub-initiatives and projects
        </label>
      )}
      {!writing || readOnly ? (
        <button
          className="feature-update-prompt"
          disabled={!canPost}
          onClick={() => setWriting(true)}
        >
          <MessageSquare size={15} />
          {readOnly ? "Retired work is read-only" : canPost
            ? ownUpdates.length
              ? "Write an update"
              : `Write first ${kind} update`
            : "Waiting for the owner to post the first update"}
        </button>
      ) : (
        <div className="feature-update-compose">
          <div className="feature-between project-update-compose-head">
            {kind==='project'&&!editing?<div className="project-update-kind-tabs" role="tablist" aria-label="Project activity composer"><button type="button" role="tab" aria-selected="false" onClick={()=>navigate(`/project/${item.id}/overview#project-comments`)}>Comment</button><button type="button" role="tab" aria-selected="true">Update</button></div>:<strong>{editing ? "Edit update" : "New update"}</strong>}
            <Dropdown align="left" menuClassName="project-health-menu" onOpenChange={setHealthOpen} trigger={<button type="button" className={`project-health-trigger ${health.toLowerCase().replaceAll(' ','-')}`} aria-label={healthOpen?'Set project health':health}><span/>{health}</button>}>
              <label className="project-health-search"><input autoFocus aria-label="Set project health" placeholder="Set project health"/></label>
              {["On track", "At risk", "Off track"].map(value=><button type="button" role="option" aria-selected={health===value} key={value} onClick={()=>setHealth(value)}><span className={value.toLowerCase().replaceAll(' ','-')}/>{value}{health===value&&<Check size={13}/>}</button>)}
            </Dropdown>
          </div>
          <RichEditor
            value={body}
            onChange={setBody}
            ariaLabel={kind==='project'?'Project update':undefined}
            attachmentContext={
              editing ? (editing.projectId ? {projectId:editing.projectId} : {initiativeId:editing.initiativeId}) : kind === "project"
                ? { projectId: item.id }
                : { initiativeId: item.id }
            }
            placeholder={kind==='project'?'Write a project update...':'What’s changed? Share progress, plans, and blockers…'}
          />
          {details.length > 0 && !editing && (
            <>
              <button
                className="text-button"
                onClick={() => setHideDetails(!hideDetails)}
              >
                {hideDetails ? "Show details" : "Hide details"}
              </button>
              {!hideDetails && <ProgressDetails details={details} />}
            </>
          )}
          <div className="feature-actions">
            <span className="muted small">
              {!editing && plain(body) ? "Draft saved on this device" : ""}
            </span>
            <Action onClick={reset}>Cancel</Action>
            <Action
              primary
              disabled={!plain(body).trim()}
              onClick={async () => {
                const values = {
                  body,
                  health,
                  ...(!editing ? {[`${kind}Id`]: item.id} : {}),
                  hideDetails,
                };
                const saved = await act(() =>
                  editing
                    ? update("updates", editing.id, values)
                    : create("updates", values),
                );
                if (saved) reset();
              }}
            >
              {editing ? "Save changes" : kind==='project' ? "Submit update" : "Post update"}
            </Action>
          </div>
        </div>
      )}
      {timeline.map(({ type, value: u }, index) =>
        type === "activity" ? (
          <div className="feature-activity" key={u.id}>
            <Person id={u.actorId} />
            <span>{activitySummary(u, data)}</span>
            <time>{date(u.createdAt)}</time>
          </div>
        ) : (
          <article
            className="feature-update"
            id={`update-${u.id}`}
            data-update-id={u.id}
            key={u.id}
            tabIndex={0}
            onMouseEnter={()=>setActiveUpdate(u.id)}
            onMouseLeave={()=>setActiveUpdate(null)}
            onFocus={()=>setActiveUpdate(u.id)}
          >
            <div className="feature-between">
              <span className="feature-inline">
                <Person id={u.authorId || u.userId} />
                <span className="muted">
                  {date(u.createdAt)}
                  {u.editedAt ? " · Edited" : ""}
                </span>
                {includeChildren && u[`${kind}Id`] !== item.id && (
                  <span className="muted">
                    {data.projects.find((p) => p.id === u.projectId)?.name ??
                      data.initiatives.find((i) => i.id === u.initiativeId)
                        ?.name}
                  </span>
                )}
              </span>
              <span
                className={`feature-health ${String(u.health).replace(/\s/g, "-").toLowerCase()}`}
              >
                {u.health}
              </span>
              <Dropdown
                align="right"
                trigger={
                  <button
                    className="feature-icon-button"
                    aria-label="Update actions"
                  >
                    <MoreHorizontal size={15} />
                  </button>
                }
              >
                {!updateReadOnly(u) && (u.authorId || u.userId) === user?.id && (
                  <button
                    onClick={() => {
                      setEditing(u);
                      setBody(u.body);
                      setHealth(u.health);
                      setHideDetails(!!u.hideDetails);
                      setWriting(true);
                    }}
                  >
                    <Pencil size={14} />
                    Edit update
                  </button>
                )}
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(
                      `${locationOrigin()}/${u.projectId ? "project" : "initiative"}/${u.projectId || u.initiativeId}/updates#update-${u.id}`,
                    );
                    toast("Update link copied");
                  }}
                >
                  <Copy size={14} />
                  Copy link
                </button>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(
                      copyMarkdown(u),
                    );
                    toast("Update copied as Markdown");
                  }}
                >
                  <Copy size={14} />
                  Copy as Markdown
                </button>
                {!updateReadOnly(u) && (u.authorId || u.userId) === user?.id && (
                  <button className="danger" onClick={() => setDeleting(u)}>
                    <Trash2 size={14} />
                    Delete update
                  </button>
                )}
              </Dropdown>
            </div>
            <RichEditor value={u.body || ""} onChange={() => {}} readOnly />
            {!u.hideDetails && u.progressSnapshot && (
              <ProgressDetails
                details={updateProgressDetails(
                  u.progressSnapshot,
                  previousUpdateSnapshot(u,scopedUpdates),
                )}
              />
            )}
            <div className="update-discussion-actions">
              <Reactions kind="updates" item={u} readOnly={updateReadOnly(u)} />
            </div>
            <UpdateComments item={u} readOnly={updateReadOnly(u)} />
          </article>
        ),
      )}
      {history && !timeline.length && !writing && (
        <Blank title="No updates yet" />
      )}
      {deleting && (
        <Confirm
          title="Delete update?"
          description="The update will move to Recently deleted."
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            const result = await act(() => remove("updates", deleting.id));
            setDeleting(null);
            return result;
          }}
        />
      )}
    </div>
  );
}
function locationOrigin() {
  return window.location.origin;
}
function UpdateComments({ item, readOnly = false }: { item: Row; readOnly?: boolean }) {
  const { data, user, create, update, remove, act } = useActions();
  const [expanded, setExpanded] = useState(false),
    [body, setBody] = useState(""),
    [reply, setReply] = useState<string | null>(null),
    [editing, setEditing] = useState<Row | null>(null),
    [editedBody, setEditedBody] = useState("");
  const comments = live(data.comments)
    .filter((c) => c.updateId === item.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const render = (comment: Row, depth = 0): React.ReactNode => (
    <div
      className="update-comment"
      style={{ marginLeft: depth * 18 }}
      key={comment.id}
      data-comment-id={comment.id}
    >
      <div className="feature-between">
        <Person id={comment.authorId} />
        <time className="muted">{date(comment.createdAt)}</time>
      </div>
      <RichEditor readOnly value={comment.body} onChange={() => {}} />
      <div className="update-discussion-actions">
        <Reactions kind="comments" item={comment} readOnly={readOnly} />
        <button
          className="text-button"
          disabled={readOnly}
          onClick={() => {
            setReply(comment.parentId ?? comment.id);
            setExpanded(true);
          }}
        >
          Reply
        </button>
        {!readOnly && comment.authorId === user?.id && (
          <>
            <button
              className="text-button"
              onClick={() => {
                setEditing(comment);
                setEditedBody(comment.body);
              }}
            >
              Edit
            </button>
            <button
              className="text-button"
              onClick={() => void act(() => remove("comments", comment.id))}
            >
              Delete
            </button>
          </>
        )}
      </div>
      {comments
        .filter((c) => c.parentId === comment.id)
        .map((c) => render(c, Math.min(2, depth + 1)))}
    </div>
  );
  const submit = async () => {
    if (readOnly || !plain(body).trim()) return;
    const result = await act(() =>
      create("comments", {
        body,
        updateId: item.id,
        projectId: item.projectId ?? null,
        initiativeId: item.initiativeId ?? null,
        parentId: reply,
      }),
    );
    if (result) {
      setBody("");
      setReply(null);
      setExpanded(true);
    }
  };
  return (
    <div className="update-discussion">
      <button
        className="text-button"
        disabled={readOnly && !comments.length}
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      >
        <MessageSquare size={13} />
        {comments.length
          ? `${comments.length} ${comments.length === 1 ? "comment" : "comments"}`
          : "Add comment"}
        <ChevronDown size={12} />
      </button>
      {expanded && (
        <>
          {comments
            .filter(
              (c) => !c.parentId || !comments.some((p) => p.id === c.parentId),
            )
            .map((c) => render(c))}
          {!readOnly && <div
            className="update-comment-compose"
            onKeyDownCapture={(e) => {
              if (
                e.key === "Enter" &&
                (e.metaKey || e.ctrlKey) &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                e.stopPropagation();
                void submit();
              }
            }}
          >
            {reply && (
              <div className="feature-between muted">
                <span>Replying to thread</span>
                <button className="text-button" onClick={() => setReply(null)}>
                  Cancel reply
                </button>
              </div>
            )}
            <RichEditor
              value={body}
              onChange={setBody}
              attachmentContext={
                item.projectId
                  ? { projectId: item.projectId }
                  : { initiativeId: item.initiativeId }
              }
              placeholder="Write a comment…"
            />
            <div className="feature-actions">
              <Action
                disabled={!plain(body).trim()}
                primary
                onClick={() => void submit()}
              >
                Post comment
              </Action>
            </div>
          </div>}
        </>
      )}
      {editing && !readOnly && (
        <FormDialog
          title="Edit comment"
          fields={[]}
          submit="Save changes"
          onClose={() => setEditing(null)}
          onSave={() =>
            act(() => update("comments", editing.id, { body: editedBody }))
          }
        >
          <RichEditor value={editedBody} onChange={setEditedBody} />
        </FormDialog>
      )}
    </div>
  );
}

function ScheduleFields({
  value,
  onChange,
  individual = false,
}: {
  value: UpdateSchedule;
  onChange: (value: UpdateSchedule) => void;
  individual?: boolean;
}) {
  const set = (patch: Partial<UpdateSchedule>) =>
    onChange({ ...value, ...patch });
  return (
    <div className="update-schedule-fields">
      {individual ? (
        <label className="feature-field">
          <span>Reminder schedule</span>
          <select
            className="input"
            aria-label="Reminder schedule"
            value={value.mode ?? "default"}
            onChange={(e) =>
              set({ mode: e.target.value as UpdateSchedule["mode"] })
            }
          >
            <option value="default">Follow workspace schedule</option>
            <option value="custom">Custom schedule</option>
            <option value="never">Never remind me</option>
          </select>
        </label>
      ) : (
        <label className="feature-check-field">
          <span>Enable update reminders</span>
          <input
            type="checkbox"
            checked={!!value.enabled}
            onChange={(e) => set({ enabled: e.target.checked })}
          />
        </label>
      )}
      {(individual ? value.mode === "custom" : value.enabled) && (
        <>
          <label className="feature-field">
            <span>Frequency</span>
            <select
              className="input"
              aria-label="Update reminder frequency"
              value={value.frequency}
              onChange={(e) =>
                set({ frequency: e.target.value as "daily" | "weekly" })
              }
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </label>
          <label className="feature-field">
            <span>Every</span>
            <input
              className="input"
              aria-label="Update reminder interval"
              type="number"
              min={1}
              max={52}
              value={value.interval}
              onChange={(e) => set({ interval: Number(e.target.value) })}
            />
          </label>
          {value.frequency === "weekly" && (
            <label className="feature-field">
              <span>Day</span>
              <select
                className="input"
                aria-label="Update reminder weekday"
                value={value.weekday}
                onChange={(e) => set({ weekday: Number(e.target.value) })}
              >
                {[
                  "Sunday",
                  "Monday",
                  "Tuesday",
                  "Wednesday",
                  "Thursday",
                  "Friday",
                  "Saturday",
                ].map((day, index) => (
                  <option key={day} value={index}>
                    {day}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="feature-field">
            <span>Time in the owner’s timezone</span>
            <select
              className="input"
              aria-label="Update reminder hour"
              value={value.hour}
              onChange={(e) => set({ hour: Number(e.target.value) })}
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")}:00
                </option>
              ))}
            </select>
          </label>
          <p className="muted">
            Active projects and initiatives remind their lead or owner. Missed
            updates receive follow-ups after one and three working days.
          </p>
        </>
      )}
    </div>
  );
}
export function UpdateSubscription({
  kind,
  item,
}: {
  kind: "project" | "initiative";
  item: Row;
}) {
  const { data, user, create, update, remove, act } = useActions();
  const [open, setOpen] = useState(false),
    [schedule, setSchedule] = useState<UpdateSchedule>({
      ...defaultUpdateSchedule,
      ...item.updateSchedule,
    });
  const subscribed = live(data.subscriptions).find(
    (s) =>
      s.userId === user?.id &&
      (s.entityId === item.id || s[`${kind}Id`] === item.id),
  );
  return (
    <>
      <Action
        aria-label={`Setup ${kind} notifications`}
        title="Notifications and update reminders"
        onClick={() => {
          setSchedule({ ...defaultUpdateSchedule, ...item.updateSchedule });
          setOpen(true);
        }}
      >
        <Bell size={15} />
        {subscribed && <Check size={11} />}
      </Action>
      {open && (
        <FormDialog
          title="Notifications and update reminders"
          fields={[]}
          submit="Save schedule"
          onClose={() => setOpen(false)}
          onSave={() =>
            act(() =>
              update(kind === "project" ? "projects" : "initiatives", item.id, {
                updateSchedule: schedule,
              }),
            )
          }
        >
          <div className="feature-between">
            <div>
              <strong>Subscribe to {kind}</strong>
              <p className="muted">
                Get Inbox notifications for new updates and activity.
              </p>
            </div>
            <Action
              onClick={() =>
                act(() =>
                  subscribed
                    ? remove("subscriptions", subscribed.id)
                    : create("subscriptions", {
                        entityId: item.id,
                        [`${kind}Id`]: item.id,
                        entityKind:
                          kind === "project" ? "projects" : "initiatives",
                      }),
                )
              }
            >
              {subscribed ? "Unsubscribe" : "Subscribe"}
            </Action>
          </div>
          <ScheduleFields value={schedule} onChange={setSchedule} individual />
        </FormDialog>
      )}
    </>
  );
}

function UpdateScheduleSelect({label,options,value,onChange}:{label:string;options:{value:string;label:string}[];value:string;onChange:(value:string)=>void}){
  const [open,setOpen]=useState(false);
  return <span className="project-update-select"><button type="button" aria-label={label} aria-expanded={open} onClick={()=>setOpen(value=>!value)}>{label}<ChevronDown size={12}/></button>{open&&<span role="menu">{options.map(option=><button type="button" role="menuitemradio" aria-checked={value===option.value} key={option.value} onClick={()=>{onChange(option.value);setOpen(false)}}>{option.label}</button>)}</span>}</span>;
}

export function UpdateSettings({ kind,embedded=false }: { kind: "project" | "initiative";embedded?:boolean }) {
  const { data, update, act } = useActions(),navigate=useNavigate(),
    workspace = data.workspaces.find((w) => w.id === data.workspaceId),
    [value, setValue] = useState<UpdateSchedule>({
      ...defaultUpdateSchedule,
      ...workspace?.[`${kind}UpdateSchedule`],
    }),
    [saved, setSaved] = useState(false),
    [editingSchedule,setEditingSchedule]=useState(false);
  useEffect(() => {
    setValue({
      ...defaultUpdateSchedule,
      ...workspace?.[`${kind}UpdateSchedule`],
    });
  }, [workspace?.id, workspace?.version]);
  const saveSchedule=async()=>{if(!workspace)return;const result=await act(()=>update("workspaces",workspace.id,{[`${kind}UpdateSchedule`]:value}));if(result){setSaved(true);setEditingSchedule(false)}};
  const scheduleSummary=value.enabled?`${value.frequency==='daily'?'Daily':`Every ${value.interval>1?value.interval+' weeks':'week'}`} · ${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][value.weekday??1]} at ${String(value.hour??9).padStart(2,'0')}:00`:'No expectation for updates';
  return (
    <div className={`project-update-settings ${embedded?'embedded':''}`}>
      {embedded?<h2>Initiative updates</h2>:<h1>{kind === "project" ? "Project" : "Initiative"} updates</h1>}
      <p className="project-update-intro">{kind==='project'?<>Short status reports about the progress and health of your projects. Project members regularly<br/> post updates, and subscribers automatically receive them in their inbox. <a href="https://parabolic.app/docs/project-updates" target="_blank" rel="noreferrer">Docs ↗</a></>:<>Short status reports about the progress and health of your initiative. Updates are ideally written<br/> regularly by the owner of the initiative. Subscribers receive these updates directly in their inbox.<br/> You can also configure a Slack channel where all initiative updates are posted.</>}</p>
      <section className="project-update-section"><h2>Update schedule</h2><p>Configure how often updates are expected on {kind}s. {kind==='project'?'Project leads':'Initiative owners'} will receive reminders to<br/> post updates.</p><div className={`project-update-card${editingSchedule?' is-editing':''}`}>{editingSchedule?<div className="project-update-inline-editor"><UpdateScheduleSelect label={value.enabled?(value.interval===1?'Every week':`Every ${value.interval} weeks`):'No expectation for updates'} value={value.enabled?String(value.interval||1):'0'} options={[{value:'0',label:'No expectation for updates'},...Array.from({length:8},(_,index)=>({value:String(index+1),label:index?'Every '+(index+1)+' weeks':'Every week'}))]} onChange={next=>setValue({...value,enabled:next!=='0',frequency:'weekly',interval:Number(next)||1})}/>{value.enabled&&<><span>on</span><UpdateScheduleSelect label={['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][value.weekday??5]} value={String(value.weekday??5)} options={['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((label,index)=>({label,value:String(index)}))} onChange={next=>setValue({...value,weekday:Number(next)})}/><span>between</span><UpdateScheduleSelect label={`${((value.hour??14)+11)%12+1}${(value.hour??14)<12?'AM':'PM'} - ${((value.hour??14)+12)%12+1}${(value.hour??14)+1<12?'AM':'PM'}`} value={String(value.hour??14)} options={Array.from({length:24},(_,hour)=>({value:String(hour),label:`${(hour+11)%12+1}${hour<12?'AM':'PM'} - ${(hour+12)%12+1}${hour+1<12?'AM':'PM'}`}))} onChange={next=>setValue({...value,hour:Number(next)})}/></>}<span className="project-update-inline-actions"><Button onClick={()=>{setValue({...defaultUpdateSchedule,...workspace?.[`${kind}UpdateSchedule`]});setEditingSchedule(false)}}>Cancel</Button><Button variant="primary" onClick={()=>void saveSchedule()}>Save</Button></span></div>:<><span>{scheduleSummary}</span><Button onClick={()=>setEditingSchedule(true)}>Edit</Button></>}</div>{saved&&<span className="project-update-saved" role="status">Saved</span>}</section>
      <section className="project-update-section project-update-slack"><h2>Slack notifications</h2><p>{kind==='project'?'Updates are only posted to Slack when associated with at least one non-private team':'Updates are only posted to Slack for workspace-level initiatives or initiatives led by a public team'}</p><div className="project-update-card project-update-integration"><span className="project-update-provider"><span className="project-update-slack-icon"><SlackLogo/></span><span><strong>Send {kind} updates to a Slack channel</strong><small>Connect a channel to send all {kind} updates to</small></span></span><Info size={14}/><Button aria-label="Connect slack channel" onClick={()=>navigate('/settings/integrations')}>Connect <ExternalLink size={13}/></Button></div></section>
    </div>
  );
}

function projectActivityEntries(project:Row,data:any){
 return live(data.activities).filter(activity=>activity.entityKind==='projects'&&activity.entityId===project.id).map(activity=>({activity,summary:activity.message || (activity.action==='create'?'Created project':activity.action==='delete'?'Deleted project':activity.action==='restore'?'Restored project':activitySummary(activity,data))})).filter(entry=>entry.summary).sort((a,b)=>b.activity.createdAt.localeCompare(a.activity.createdAt)||(b.activity.entityVersion||0)-(a.activity.entityVersion||0)||b.activity.id.localeCompare(a.activity.id));
}

export function ProjectActivity({project}:{project:Row}) {
 const {data}=useActions(),entries=projectActivityEntries(project,data);
 return <div className="feature-readable project-activity-history" aria-label="Project activity"><h3>Activity</h3>{entries.length?entries.map(({activity,summary})=><div className="feature-activity" data-project-activity={activity.id} key={activity.id}><Person id={activity.actorId} empty="Unknown user"/><span>{summary}</span><time dateTime={activity.createdAt} title={new Date(activity.createdAt).toLocaleString()}>{date(activity.createdAt)}</time></div>):<p className="muted">No activity yet</p>}</div>;
}

export function ProjectActivityPreview({project}:{project:Row}){
 const {data}=useActions(),[open,setOpen]=useState(true),entry=projectActivityEntries(project,data)[0],actor=entry&&data.users.find((user:Row)=>user.id===entry.activity.actorId),name=displayNameFor(actor,data,'Unknown user');
 return <section className="project-sidebar-activity" aria-label="Project sidebar activity">
  <div className="project-sidebar-section-heading"><button type="button" className="project-sidebar-section-toggle" aria-label={`${open?'Collapse':'Expand'} activity section`} aria-expanded={open} onClick={()=>setOpen(value=>!value)}><span>Activity</span>{open?<ChevronDown size={12}/>:<ChevronRight size={12}/>}</button><Link to={`/project/${project.id}/activity`}>See all</Link></div>
  {open&&(entry?<div className="project-sidebar-activity-row" data-project-sidebar-activity={entry.activity.id}><Link to={actor?`/profiles/${actor.id}`:`/project/${project.id}/activity`}>{name}</Link><span>{entry.summary==='Created project'?'created the project':entry.summary} · <time dateTime={entry.activity.createdAt}>{date(entry.activity.createdAt)}</time></span></div>:<p className="muted">No activity yet</p>)}
 </section>;
}
