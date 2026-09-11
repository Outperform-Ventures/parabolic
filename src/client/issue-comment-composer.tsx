import React, {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { getAppSnapshot, useAppStore } from "./store";
import { Avatar, RichEditor } from "./components/ui";
import { NativeIssueActionIcon } from "./components/issue-action-icons";
import {
  commentDraftId,
  commentDraftKey,
  commentDraftSnapshot,
  hasCommentContent,
  isCommentDraftSending,
  parseCommentDrafts,
  readCommentDrafts,
  removeCommentDraft,
  saveCommentDraft,
  sendCommentDraftOnce,
  subscribeCommentDrafts,
} from "./comment-drafts";

export function IssueCommentComposer({
  issueId,
  parentId,
  onCancelReply,
}: {
  issueId: string;
  parentId: string | null;
  onCancelReply: () => void;
}) {
  const store = useAppStore();
  const key = commentDraftKey(store.user!.id, store.data.workspaceId);
  const id = commentDraftId(issueId, parentId);
  const snapshot = useSyncExternalStore(subscribeCommentDrafts, () =>
    commentDraftSnapshot(key),
  );
  const draft = parseCommentDrafts(snapshot).find((row) => row.id === id);
  const body = draft?.body ?? "";
  const sharedBusy = useSyncExternalStore(subscribeCommentDrafts, () =>
    isCommentDraftSending(key, draft),
  );
  const [busy, setBusy] = useState(false);
  const sending = useRef(false),
    mounted = useRef(true),
    storageWarning = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const send = async () => {
    if (!draft || !hasCommentContent(body) || sending.current) return;
    sending.current = true;
    setBusy(true);
    try {
      const userId = store.user!.id,
        workspaceId = store.data.workspaceId;
      await sendCommentDraftOnce(key, draft, async (commentId) => {
        const current = getAppSnapshot();
        if (
          current.user?.id !== userId ||
          current.data.workspaceId !== workspaceId
        )
          throw new Error(
            "The workspace changed before this comment was saved.",
          );
        const alreadySaved = () => {
          const latest = getAppSnapshot();
          if (
            latest.user?.id !== userId ||
            latest.data.workspaceId !== workspaceId
          )
            return false;
          return latest.data.comments.some(
            (comment) =>
              comment.id === commentId &&
              !comment.deletedAt &&
              comment.workspaceId === workspaceId &&
              (comment.authorId ?? comment.userId) === userId &&
              (comment.issueId ??
                (comment.entityType === "issue"
                  ? comment.entityId
                  : undefined)) === issueId &&
              (comment.parentId ?? null) === parentId,
          );
        };
        if (alreadySaved()) return;
        try {
          await current.create("comments", {
            id: commentId,
            entityType: "issue",
            entityId: issueId,
            issueId,
            body,
            parentId,
            userId,
          });
        } catch (error) {
          // Another local caller may have queued the same revision while this
          // action waited for the store lock. Its existing record is success.
          if (!alreadySaved()) throw error;
        }
      });
      const cleared = removeCommentDraft(key, id, draft.revision);
      if (
        (cleared || !readCommentDrafts(key).some((row) => row.id === id)) &&
        mounted.current
      )
        onCancelReply();
    } catch (error) {
      store.toast(
        error instanceof Error ? error.message : "Unable to send comment.",
      );
    } finally {
      sending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return (
    <div
      className={
        "comment-composer" + (hasCommentContent(body) ? " has-content" : "")
      }
      onKeyDownCapture={(event) => {
        if (
          (event.metaKey || event.ctrlKey) &&
          event.shiftKey &&
          !event.altKey &&
          event.key.toLowerCase() === "a" &&
          !event.nativeEvent.isComposing
        ) {
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget
            .querySelector<HTMLInputElement>(
              ':scope > .rich-editor > input[type="file"]',
            )
            ?.click();
          return;
        }
        const preference =
          store.data.users.find((user) => user.id === store.user?.id)
            ?.preferences?.commentSubmit ?? "Enter";
        if (
          event.key === "Enter" &&
          !!(event.target as HTMLElement).closest('[contenteditable="true"]') &&
          !event.shiftKey &&
          !event.nativeEvent.isComposing &&
          ((preference === "Enter" && !event.metaKey && !event.ctrlKey) ||
            (preference !== "Enter" && (event.metaKey || event.ctrlKey))) &&
          !(event.target as HTMLElement)
            .closest(".rich-editor")
            ?.querySelector(".slash-menu,[role=dialog]")
        ) {
          event.preventDefault();
          event.stopPropagation();
          void send();
        }
      }}
    >
      <RichEditor
        attachmentContext={{ issueId }}
        value={body}
        onChange={(next) => {
          const saved = saveCommentDraft(key, issueId, parentId, next);
          if (!saved && !storageWarning.current)
            store.toast(
              "This draft is kept in memory because browser storage is full. Keep this window open until you send it.",
            );
          storageWarning.current = !saved;
        }}
        placeholder={parentId ? "Leave a reply…" : "Leave a comment…"}
      />
      <div className="comment-composer-footer">
        <Avatar user={store.user} />
        <span className="spacer" />
        <button
          type="button"
          className="icon-button"
          aria-label="Attach images, files, or videos"
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) =>
            event.currentTarget
              .closest(".comment-composer")
              ?.querySelector<HTMLInputElement>(
                ':scope > .rich-editor > input[type="file"]',
              )
              ?.click()
          }
        >
          <NativeIssueActionIcon name="attachment" />
        </button>
        <button
          className="send-comment"
          aria-label="Submit comment"
          disabled={!hasCommentContent(body) || busy || sharedBusy}
          onClick={() => void send()}
        >
          <NativeIssueActionIcon name="send" />
        </button>
      </div>
    </div>
  );
}
