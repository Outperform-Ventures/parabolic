import React, { useSyncExternalStore } from "react";
import {DurableDraftStorage} from './durable-draft-storage';
import { useNavigate } from "react-router-dom";
import { useAppStore } from "./store";
import { Button, Icon } from "./components/ui";
import { relativeDate, textContent } from "./query";
import {
  commentDraftKey,
  commentDraftSnapshot,
  parseCommentDrafts,
  removeCommentDraft,
  subscribeCommentDrafts,
} from "./comment-drafts";

export type Draft = {
  id: string;
  updatedAt: string;
  fields: Record<string, any>;
};
const listeners = new Set<() => void>();
const draftStorage=new DurableDraftStorage(()=>localStorage);
export const subscribeDrafts = (cb:()=>void) => {listeners.add(cb);return ()=>{listeners.delete(cb);};};
export const draftSnapshot = (key:string) => draftStorage.get(key) ?? '[]';
const notify = () => {
  for (const listener of listeners) listener();
};
window.addEventListener("storage", notify);
export const draftKey = (userId: string, workspaceId: string) =>
  `issue-drafts:${userId}:${workspaceId}`;
export function readDrafts(key: string): Draft[] {return parseDrafts(draftStorage.get(key));}
function parseDrafts(serialized: string|null): Draft[] {
  try {
    const value = JSON.parse(serialized ?? "[]");
    return Array.isArray(value)
      ? value.filter(
          (draft) =>
            draft &&
            typeof draft.id === "string" &&
            typeof draft.updatedAt === "string" &&
            draft.fields &&
            typeof draft.fields === "object",
        )
      : [];
  } catch {
    return [];
  }
}
export function saveDraft(
  key: string,
  id: string,
  fields: Record<string, any>,
) {
  const draft=JSON.parse(JSON.stringify({id,fields,updatedAt:new Date().toISOString()})) as Draft;
  const persisted=draftStorage.update(key,current=>{
    const existing=parseDrafts(current).filter(item=>item.id!==id);
    if(draft.fields.title?.trim()||textContent(draft.fields.description??''))existing.unshift(draft);
    return JSON.stringify(existing);
  },id);
  notify();
  return persisted;
}
export function removeDraft(key: string, id: string) {
  const persisted=draftStorage.update(key,current=>JSON.stringify(parseDrafts(current).filter(draft=>draft.id!==id)),id);
  notify();
  return persisted;
}
export function DraftsPage() {
  const { user, data } = useAppStore();
  const navigate = useNavigate();
  const key = draftKey(user!.id, data.workspaceId);
  const commentsKey = commentDraftKey(user!.id, data.workspaceId);
  const commentSnapshot = useSyncExternalStore(subscribeCommentDrafts, () =>
    commentDraftSnapshot(commentsKey),
  );
  const commentDrafts = parseCommentDrafts(commentSnapshot).filter((draft) =>
    data.issues.some((issue) => issue.id === draft.issueId && !issue.deletedAt),
  );
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => draftStorage.get(key) ?? "[]",
  );
  const drafts = readDrafts(key);
  const count = drafts.length + commentDrafts.length;
  const open = (fields: Record<string, any> = {}) =>
    window.dispatchEvent(new CustomEvent("create-issue", { detail: fields }));
  return (
    <div className="issue-view drafts-page">
      <header className="page-header">
        {count ? (
          <>
            <Icon name="FileText" />
            <strong>Drafts</strong>
            <span className="muted">{count}</span>
            <span className="spacer" />
            <Button onClick={() => open()}>
              <Icon name="Plus" />
              New issue
            </Button>
          </>
        ) : (
          <strong>Drafts</strong>
        )}
      </header>
      {count ? (
        <div className="draft-list">
          {commentDrafts.map((draft) => {
            const issue = data.issues.find(
              (issue) => issue.id === draft.issueId,
            )!;
            const title = `${draft.parentId ? "Reply" : "Comment"} on ${issue.identifier ?? issue.title}`;
            return (
              <div className="draft-row" key={`comment:${draft.id}`}>
                <button
                  className="draft-open"
                  onClick={() =>
                    navigate(`/issues/${draft.issueId}`, {
                      state: {
                        commentDraft: {
                          issueId: draft.issueId,
                          parentId: draft.parentId,
                        },
                      },
                    })
                  }
                >
                  <Icon name="MessageSquare" />
                  <div>
                    <strong>{title}</strong>
                    <p>
                      {textContent(draft.body).slice(0, 160) || "Attachment"}
                    </p>
                  </div>
                  <time>{relativeDate(draft.updatedAt)}</time>
                </button>
                <button
                  className="icon-button"
                  aria-label={`Discard ${title}`}
                  onClick={() => removeCommentDraft(commentsKey, draft.id)}
                >
                  <Icon name="Trash2" />
                </button>
              </div>
            );
          })}
          {drafts.map((d) => (
            <div className="draft-row" key={d.id}>
              <button
                className="draft-open"
                onClick={() => open({ ...d.fields, __draftId: d.id })}
              >
                <Icon name="FileText" />
                <div>
                  <strong>{d.fields.title || "Untitled issue"}</strong>
                  <p>
                    {textContent(d.fields.description ?? "").slice(0, 160) ||
                      data.teams.find((t) => t.id === d.fields.teamId)?.name}
                  </p>
                </div>
                <time>{relativeDate(d.updatedAt)}</time>
              </button>
              <button
                className="icon-button"
                aria-label={`Discard ${d.fields.title || "untitled draft"}`}
                onClick={() => removeDraft(key, d.id)}
              >
                <Icon name="Trash2" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state drafts-empty">
          <svg
            className="drafts-empty-illustration"
            viewBox="0 0 104 96"
            width="104"
            height="96"
            aria-hidden="true"
          >
            <path d="m19 55 34 18 34-18v12L53 85 19 67Z" />
            <path d="m19 45 34 18 34-18v12L53 75 19 57Z" />
            <path d="m19 32 34-16 34 17-34 18Z" />
            <path d="M33 32h27M33 38h21" />
            <path d="m63 43 24-24c3-3 8 2 5 5L68 48l-8 3Z" />
          </svg>
          <h3>No active drafts</h3>
        </div>
      )}
    </div>
  );
}
