import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Entity } from "../shared/types";
import { apiRequest, useAppStore } from "./store";
import { Button, Field, Modal, TextInput } from "./components/ui";

export function IssueLifecycleDialog({
  issue,
  mode,
  onClose,
}: {
  issue: Entity;
  mode: "duplicate" | "convert";
  onClose: () => void;
}) {
  const store = useAppStore(),
    navigate = useNavigate();
  const mutationId = useRef(crypto.randomUUID());
  const [name, setName] = useState(
      mode === "duplicate" ? `${issue.title} (copy)` : issue.title,
    ),
    [include, setInclude] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const descendants = new Set([issue.id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const child of store.data.issues)
      if (
        !child.deletedAt &&
        descendants.has(child.parentId) &&
        !descendants.has(child.id)
      ) {
        descendants.add(child.id);
        changed = true;
      }
  }
  return (
    <Modal
      title={
        mode === "duplicate" ? "Duplicate issue" : "Convert issue to project"
      }
      onClose={onClose}
    >
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (!name.trim() || busy) return;
          setBusy(true);
          setError("");
          try {
            const result = await apiRequest(
              `/api/v1/issues/${issue.id}/${mode === "duplicate" ? "duplicate" : "convert-to-project"}`,
              {
                method: "POST",
                body: JSON.stringify(
                  mode === "duplicate"
                    ? {
                        title: name.trim(),
                        includeSubIssues: include,
                        clientMutationId: mutationId.current,
                      }
                    : {
                        name: name.trim(),
                        clientMutationId: mutationId.current,
                      },
                ),
              },
            );
            await store.reload();
            onClose();
            navigate(
              mode === "duplicate"
                ? `/issues/${result.issue.id}`
                : `/project/${result.project.id}`,
            );
            store.toast(
              mode === "duplicate"
                ? "Issue duplicated"
                : "Issue converted to project",
            );
          } catch (error) {
            setError(
              error instanceof Error ? error.message : "Could not save changes",
            );
            setBusy(false);
          }
        }}
      >
        <div className="modal-body">
          <Field label={mode === "duplicate" ? "Issue title" : "Project name"}>
            <TextInput
              autoFocus
              aria-label={
                mode === "duplicate"
                  ? "Duplicate issue title"
                  : "Converted project name"
              }
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </Field>
          {mode === "duplicate" ? (
            descendants.size > 1 && (
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={include}
                  onChange={(event) => setInclude(event.target.checked)}
                />
                Include {descendants.size - 1} sub-issue
                {descendants.size === 2 ? "" : "s"}
              </label>
            )
          ) : (
            <p className="muted">
              This issue and its {descendants.size - 1} sub-issue
              {descendants.size === 2 ? "" : "s"} will become standalone issues
              in the new project. Their descriptions and activity will be
              retained.
            </p>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </div>
        <footer className="modal-footer">
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            type="submit"
            disabled={busy || !name.trim()}
          >
            {busy
              ? "Saving…"
              : mode === "duplicate"
                ? "Duplicate issue"
                : "Convert to project"}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}
