import React, { useState } from "react";
import { useAppStore } from "./store";
import { Button, Icon, Modal } from "./components/ui";
import { textContent } from "./query";
import { draftKey, saveDraft } from "./drafts";
import { openComposer } from "./issues";
const display = (value: any) =>
  typeof value === "string"
    ? textContent(value)
    : (JSON.stringify(value, null, 2) ?? "Empty");
export function SyncStatus() {
  const store = useAppStore();
  const [review, setReview] = useState<"conflicts" | "failures" | null>(null),
    [confirmDiscard, setConfirmDiscard] = useState(false);
  const conflict = store.conflicts[0],
    failure = store.failures[0];
  if (!store.user) return null;
  const recoverDraft = async () => {
    if (!failure) return;
    const {
      id,
      identifier,
      number,
      version,
      createdAt,
      updatedAt,
      workspaceId,
      deletedAt,
      ...fields
    } = failure.data ?? {};
    const draftId = crypto.randomUUID();
    saveDraft(
      draftKey(store.user!.id, store.data.workspaceId),
      draftId,
      fields,
    );
    await store.resolveFailure(failure.id, "discard");
    setReview(null);
    openComposer({ ...fields, __draftId: draftId });
  };
  return (
    <>
      {(conflict || failure) && (
        <div className="sync-conflict-banner" role="status">
          <Icon name="RefreshCw" />
          <div>
            <strong>
              {store.conflicts.length + store.failures.length}{" "}
              {store.conflicts.length + store.failures.length === 1
                ? "change needs"
                : "changes need"}{" "}
              review
            </strong>
            <p>Your changes are saved on this device.</p>
          </div>
          {failure && (
            <Button
              onClick={() => {
                setReview("failures");
                setConfirmDiscard(false);
              }}
            >
              Review unsent changes
            </Button>
          )}
          {conflict && (
            <Button onClick={() => setReview("conflicts")}>
              Review conflicts
            </Button>
          )}
        </div>
      )}
      {review === "conflicts" && conflict && (
        <Modal
          wide
          title="Review conflicting changes"
          onClose={() => setReview(null)}
        >
          <div className="modal-body">
            <h3>
              {conflict.server.title ??
                conflict.server.name ??
                "Workspace item"}
            </h3>
            <p className="muted">
              Choose which version to keep for the fields that changed in both
              places.
            </p>
            {conflict.fields.map((field) => (
              <section key={field} className="conflict-field">
                <h4>{field.replace(/Id$/, "")}</h4>
                <div className="conflict-versions">
                  <div>
                    <strong>Your edit</strong>
                    <pre>{display(conflict.local[field])}</pre>
                  </div>
                  <div>
                    <strong>On the server</strong>
                    <pre>{display(conflict.server[field])}</pre>
                  </div>
                </div>
              </section>
            ))}
          </div>
          <div className="modal-footer">
            <Button onClick={() => setReview(null)}>Review later</Button>
            <span className="spacer" />
            <Button
              onClick={() =>
                void store.resolveConflict(conflict.id, "use-server")
              }
            >
              Use server version
            </Button>
            <Button
              variant="primary"
              onClick={() =>
                void store.resolveConflict(conflict.id, "keep-local")
              }
            >
              Keep my edit
            </Button>
          </div>
        </Modal>
      )}
      {review === "failures" && failure && (
        <Modal
          wide
          title="Review unsent change"
          onClose={() => setReview(null)}
        >
          <div className="modal-body">
            <h3>
              {failure.data?.title ??
                failure.data?.name ??
                `${failure.action} ${failure.kind}`}
            </h3>
            <p className="error-text" role="alert">
              {failure.message}
            </p>
            <p className="muted">
              This change was rejected by the workspace. Your original entry is
              preserved here.
            </p>
            <div className="failed-change-fields">
              {Object.entries(failure.data ?? {})
                .filter(
                  ([field]) =>
                    ![
                      "id",
                      "workspaceId",
                      "createdAt",
                      "updatedAt",
                      "version",
                      "creatorId",
                    ].includes(field),
                )
                .map(([field, value]) => (
                  <section key={field}>
                    <strong>
                      {field
                        .replace(/([A-Z])/g, " $1")
                        .replace(/Ids?$/, "")
                        .trim()}
                    </strong>
                    <pre>{display(value)}</pre>
                  </section>
                ))}
            </div>
            {confirmDiscard && (
              <p className="error-text">
                Discard this saved change from this device?
              </p>
            )}
          </div>
          <div className="modal-footer">
            <Button onClick={() => setReview(null)}>Review later</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (confirmDiscard) {
                  void store.resolveFailure(failure.id, "discard");
                  setConfirmDiscard(false);
                } else setConfirmDiscard(true);
              }}
            >
              {confirmDiscard ? "Confirm discard" : "Discard change"}
            </Button>
            <span className="spacer" />
            {failure.kind === "issues" && failure.action === "create" && (
              <Button onClick={() => void recoverDraft()}>
                Reopen as draft
              </Button>
            )}
            <Button
              variant="primary"
              onClick={() => void store.resolveFailure(failure.id, "retry")}
            >
              Try again
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
