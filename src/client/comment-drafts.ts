import {pendingSaves} from './pending-saves';

export type CommentDraft = {
  id: string;
  issueId: string;
  parentId: string | null;
  body: string;
  updatedAt: string;
  revision: string;
};

const listeners = new Set<() => void>();
// Preserve edits for this session even if the browser's disk quota is exhausted.
const unsaved = new Map<string, string>();
const sends = new Map<string, Promise<void>>();
const sendKey = (key: string, draft: CommentDraft) =>
  JSON.stringify([key, draft.id, draft.revision]);
const notify = () => listeners.forEach((listener) => listener());
if (typeof window !== "undefined") window.addEventListener("storage", notify);
export const subscribeCommentDrafts = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const commentDraftKey = (userId: string, workspaceId: string) =>
  `comment-drafts:${userId}:${workspaceId}`;
export const commentDraftId = (issueId: string, parentId: string | null) =>
  `${issueId}:${parentId ?? "root"}`;
export const hasCommentContent = (body: string) =>
  !!body
    .replace(/<[^>]*>/g, "")
    .replace(/&(?:nbsp|#160);/g, " ")
    .trim() || /<(?:img|hr)\b/i.test(body);
export function commentDraftSnapshot(key: string): string {
  try {
    return unsaved.get(key) ?? localStorage.getItem(key) ?? "[]";
  } catch {
    return unsaved.get(key) ?? "[]";
  }
}
export function parseCommentDrafts(serialized: string): CommentDraft[] {
  try {
    const rows = JSON.parse(serialized);
    return Array.isArray(rows)
      ? rows.filter(
          (row): row is CommentDraft =>
            row &&
            typeof row.issueId === "string" &&
            (row.parentId === null || typeof row.parentId === "string") &&
            row.id === commentDraftId(row.issueId, row.parentId) &&
            typeof row.body === "string" &&
            hasCommentContent(row.body) &&
            typeof row.updatedAt === "string" &&
            typeof row.revision === "string",
        )
      : [];
  } catch {
    return [];
  }
}
export const readCommentDrafts = (key: string) =>
  parseCommentDrafts(commentDraftSnapshot(key));
export const isCommentDraftSending = (key: string, draft?: CommentDraft) =>
  !!draft && sends.has(sendKey(key, draft));
/** Survives composer remounts; the persisted revision also identifies retries in other windows. */
export function sendCommentDraftOnce(
  key: string,
  draft: CommentDraft,
  send: (commentId: string) => Promise<void>,
): Promise<void> {
  const token = sendKey(key, draft), existing = sends.get(token);
  if (existing) return existing;
  const pending = Promise.resolve().then(() => send(draft.revision)).finally(() => {
    if (sends.get(token) === pending) sends.delete(token);
    notify();
  });
  sends.set(token, pending);
  pendingSaves.changed();
  notify();
  return pending;
}
function write(key: string, rows: CommentDraft[]) {
  pendingSaves.changed();
  const serialized = JSON.stringify(rows);
  let persisted = true;
  try {
    localStorage.setItem(key, serialized);
    unsaved.delete(key);
  } catch {
    unsaved.set(key, serialized);
    persisted = false;
  }
  notify();
  return persisted;
}

/** Failed network sends still have their draft; failed disk writes must stop
 * restart until the in-memory fallback can be persisted. */
export async function flushCommentDrafts() {
  await Promise.allSettled([...sends.values()]);
  for (const [key, serialized] of unsaved) {
    localStorage.setItem(key, serialized);
    if (unsaved.get(key) === serialized) unsaved.delete(key);
  }
}
pendingSaves.register(flushCommentDrafts);
export function saveCommentDraft(
  key: string,
  issueId: string,
  parentId: string | null,
  body: string,
) {
  const id = commentDraftId(issueId, parentId);
  const current = readCommentDrafts(key);
  // Editors may emit their current HTML when mounting or changing editable
  // state. That is not a new draft revision and must retain an active send ID.
  if (current.some((row) => row.id === id && row.body === body))
    return write(key, current);
  const rows = current.filter((row) => row.id !== id);
  if (hasCommentContent(body))
    rows.unshift({
      id,
      issueId,
      parentId,
      body,
      updatedAt: new Date().toISOString(),
      revision: crypto.randomUUID(),
    });
  return write(key, rows);
}
/** A delayed send must never delete text entered after that send began. */
export function removeCommentDraft(key: string, id: string, revision?: string) {
  const rows = readCommentDrafts(key);
  const row = rows.find((item) => item.id === id);
  if (!row || (revision && row.revision !== revision)) return false;
  write(
    key,
    rows.filter((item) => item.id !== id),
  );
  return true;
}
