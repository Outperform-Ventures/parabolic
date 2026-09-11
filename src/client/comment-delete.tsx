import React, { useState } from "react";
import { Button, Modal } from "./components/ui";

export function CommentDeleteDialog({
  replyCount,
  onClose,
  onDelete,
}: {
  replyCount: number;
  onClose: () => void;
  onDelete: () => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal
      title="Delete this comment?"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="modal-body">
        <p>
          This will also delete {replyCount}{" "}
          {replyCount === 1 ? "reply" : "replies"} in this thread.
        </p>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="modal-footer">
        <Button disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="danger"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await onDelete();
              onClose();
            } catch (error) {
              setError(
                error instanceof Error
                  ? error.message
                  : "Unable to delete comment.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Deleting…" : "Delete"}
        </Button>
      </div>
    </Modal>
  );
}
