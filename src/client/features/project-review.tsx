import React, { useState } from "react";
import { Icon, RichEditor } from "../components/ui";
import { reactionEntries, toggleReaction } from "../../shared/reactions";
import { EmojiPicker, EmojiGlyph } from "../components/emoji-picker";
import { commentThreads, threadIsResolved } from "../comment-threads";
import { CommentDeleteDialog } from "../comment-delete";
import {
  Action,
  FormDialog,
  Person,
  date,
  live,
  plain,
  useActions,
  type Row,
} from "./shared";

export function ProjectDescriptionHistory({
  project,
  onClose,
}: {
  project: Row;
  onClose: () => void;
}) {
  const { update, act } = useActions(),
    [selected, setSelected] = useState<any>(null);
  return (
    <aside
      className="feature-properties-panel feature-history project-description-history"
      aria-label="Project description history"
    >
      <div className="feature-between">
        <h3>Version history</h3>
        <button
          className="feature-icon-button"
          aria-label="Close version history"
          onClick={onClose}
        >
          <Icon name="X" size={15} />
        </button>
      </div>
      <p className="muted">Previous descriptions are saved as you edit.</p>
      {!(project.history || []).length && (
        <p className="muted">No previous versions yet.</p>
      )}
      {[...(project.history || [])]
        .reverse()
        .map((revision: any, index: number) => (
          <button
            className="feature-history-version"
            key={revision.id || index}
            onClick={() => setSelected(revision)}
          >
            <Icon name="History" size={14} />
            <span>
              {new Date(revision.at).toLocaleString()}
              <small><Person id={revision.contentAuthorId} empty="Unknown author"/></small>
              <small>
                {plain(revision.content).slice(0, 90) || "Empty description"}
              </small>
            </span>
          </button>
        ))}
      {selected && (
        <FormDialog
          title="Restore project description?"
          fields={[]}
          submit="Restore version"
          onClose={() => setSelected(null)}
          onSave={() =>
            act(() =>
              update("projects", project.id, {
                description: selected.content || "",
              }),
            )
          }
        >
          <p className="muted">
            The current description will be kept in version history.
          </p>
          {selected.userId && <Person id={selected.userId} />}
          <div className="feature-version-preview">
            <RichEditor
              value={selected.content || ""}
              onChange={() => {}}
              readOnly
            />
          </div>
        </FormDialog>
      )}
    </aside>
  );
}

export function EntityDiscussion({
  kind,
  item,
  resolvedVisibility,
  readOnly = false,
}: {
  kind: "documents" | "projects";
  item: Row;
  resolvedVisibility?: {value:boolean;onChange:(value:boolean)=>void};
  readOnly?: boolean;
}) {
  const { data, user, create, update, remove, act } = useActions();
  const [body, setBody] = useState(""),
    [editing, setEditing] = useState<Row | null>(null),
    [reply, setReply] = useState<Row | null>(null),
    [deleting, setDeleting] = useState<Row | null>(null),
    [localShowResolved, setLocalShowResolved] = useState(false);
  const showResolved=resolvedVisibility?.value??localShowResolved,setShowResolved=resolvedVisibility?.onChange??setLocalShowResolved;
  const parentField = kind === "documents" ? "documentId" : "projectId";
  const comments = live(data.comments).filter(
    (c) => c[parentField] === item.id && !c.updateId,
  );
  const threadRoots = new Map(
    commentThreads(comments).flatMap(({ root, replies }) =>
      [root, ...replies].map((comment) => [comment.id, root] as const),
    ),
  );
  const rootOf = (comment: Row) => threadRoots.get(comment.id) ?? comment;
  const visible = comments.filter(
    (c) => showResolved || !threadIsResolved(rootOf(c)),
  );
  const reset = () => {
    setBody("");
    setEditing(null);
    setReply(null);
  };
  const react = (c: Row, emoji: string) =>
    act(() =>
      update("comments", c.id, {
        reactions: toggleReaction(c.reactions, emoji, user!.id),
      }),
    );
  const submit = async () => {
    if (!plain(body)) return;
    const result = await act(() =>
      editing
        ? update("comments", editing.id, { body })
        : create("comments", {
            [parentField]: item.id,
            body,
            userId: user?.id,
            parentId: reply?.id || null,
          }),
    );
    if (result) reset();
  };
  const preferences =
    (data.users.find((u) => u.id === user?.id) || user)?.preferences || {};
  return (
    <section className="feature-section">
      <div className="feature-between">
        <h3>
          Comments <span className="muted">{comments.length}</span>
        </h3>
        <Action onClick={() => setShowResolved(!showResolved)}>
          {showResolved ? "Hide resolved" : "Show resolved"}
        </Action>
      </div>
      {visible.map((c) => (
        <article
          className={`feature-comment ${c.parentId ? "feature-comment-reply" : ""} ${c.resolved ? "resolved" : ""}`}
          key={c.id}
        >
          <div className="feature-between">
            <Person id={c.userId || c.authorId || c.creatorId} />
            <span className="muted">
              {date(c.createdAt)}
              {c.resolved ? " · Resolved" : ""}
              {threadIsResolved(rootOf(c)) &&
              rootOf(c).resolutionCommentId === c.id
                ? " · Resolution"
                : ""}
            </span>
          </div>
          {c.anchor?.quote && (
            <button
              type="button"
              className="feature-comment-quote"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("open-inline-comment", {
                    detail: { [parentField]: item.id, commentId: c.id },
                  }),
                )
              }
            >
              {c.anchor.quote}
            </button>
          )}
          <RichEditor value={c.body || ""} onChange={() => {}} readOnly />
          <div className="feature-between">
            {!readOnly&&<div className="feature-reactions">
              {Array.from(
                new Set(reactionEntries(c.reactions).map((r: any) => r.emoji)),
              ).map((emoji) => (
                <button
                  key={String(emoji)}
                  className={
                    reactionEntries(c.reactions).some(
                      (r: any) => r.emoji === emoji && r.userId === user?.id,
                    )
                      ? "active"
                      : ""
                  }
                  onClick={() => react(c, String(emoji))}
                >
                  <EmojiGlyph emoji={String(emoji)} />{" "}
                  {
                    reactionEntries(c.reactions).filter(
                      (r: any) => r.emoji === emoji,
                    ).length
                  }
                </button>
              ))}
              <EmojiPicker onSelect={(emoji) => react(c, emoji)} />
            </div>}
            {!readOnly&&<div className="feature-actions">
              <Action
                onClick={() => {
                  setReply(rootOf(c));
                  setEditing(null);
                  setBody("");
                }}
              >
                Reply
              </Action>
              <Action
                onClick={() =>
                  act(() =>
                    update(
                      "comments",
                      rootOf(c).id,
                      threadIsResolved(rootOf(c))
                        ? { resolved: false }
                        : {
                            resolved: true,
                            resolutionCommentId:
                              c.id === rootOf(c).id ? null : c.id,
                          },
                    ),
                  )
                }
              >
                {threadIsResolved(rootOf(c)) ? "Reopen" : "Resolve"}
              </Action>
              {(c.userId || c.creatorId) === user?.id && (
                <>
                  <Action
                    onClick={() => {
                      setEditing(c);
                      setReply(null);
                      setBody(c.body);
                    }}
                  >
                    Edit
                  </Action>
                  <Action
                    onClick={() =>
                      commentThreads(comments).some(
                        (thread) =>
                          thread.root.id === c.id && thread.replies.length,
                      )
                        ? setDeleting(c)
                        : act(() => remove("comments", c.id))
                    }
                  >
                    Delete
                  </Action>
                </>
              )}
            </div>}
          </div>
        </article>
      ))}
      {!readOnly&&<div
        className="feature-document-comment-compose"
        onKeyDownCapture={(e) => {
          if (
            e.key !== "Enter" ||
            e.shiftKey ||
            e.currentTarget.querySelector('.slash-menu,[role="dialog"]')
          )
            return;
          const shortcut =
            preferences.commentSubmit === "Command + Enter"
              ? e.metaKey || e.ctrlKey
              : !e.metaKey && !e.ctrlKey;
          if (shortcut && plain(body)) {
            e.preventDefault();
            e.stopPropagation();
            void submit();
          }
        }}
      >
        {(reply || editing) && (
          <div className="feature-between">
            <span className="muted">
              {editing
                ? "Editing comment"
                : `Replying to ${plain(reply?.body).slice(0, 80)}`}
            </span>
            <Action onClick={reset}>Cancel</Action>
          </div>
        )}
        <RichEditor
          value={body}
          onChange={setBody}
          placeholder="Leave a comment…"
        />
        <div className="feature-actions">
          <Action primary disabled={!plain(body)} onClick={submit}>
            {editing ? "Save changes" : reply ? "Reply" : "Comment"}
          </Action>
        </div>
      </div>}
      {deleting && (
        <CommentDeleteDialog
          replyCount={
            commentThreads(comments).find(
              (thread) => thread.root.id === deleting.id,
            )?.replies.length ?? 0
          }
          onClose={() => setDeleting(null)}
          onDelete={() => remove("comments", deleting.id)}
        />
      )}
    </section>
  );
}
