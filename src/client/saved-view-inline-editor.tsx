import React, { useEffect, useState } from "react";
import { Button } from "./components/ui";
import { EntityIconPicker } from "./features/entity-icon";
import "./saved-view-inline-editor.css";

type SavedViewDraft = {
  name: string;
  description: string;
  visibility: string;
  icon: string;
  color: string;
};

export function SavedViewInlineEditor({
  view,
  onCancel,
  onSave,
  onAddFilter,
  onDisplayOptions,
  columnControl,
}: {
  view: Record<string, any>;
  onCancel: () => void;
  onSave: (draft: SavedViewDraft) => Promise<unknown>;
  onAddFilter: () => void;
  onDisplayOptions: () => void;
  columnControl?: React.ReactNode;
}) {
  const [draft, setDraft] = useState<SavedViewDraft>(() => ({
    name: view.name || "",
    description: view.description || "",
    visibility: view.visibility || "personal",
    icon: view.icon || "CustomView",
    color: view.color || "#4eaaa2",
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const openOverlay = Array.from(
        document.querySelectorAll<HTMLElement>(
          ".dropdown-content,[role='dialog'],[role='listbox'],[data-dropdown-escape-layer],.issue-column-editor",
        ),
      ).some((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0
        );
      });
      if (openOverlay) return;
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    };
    document.addEventListener("keydown", cancel, true);
    return () => document.removeEventListener("keydown", cancel, true);
  }, [onCancel]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await onSave({ ...draft, name: draft.name.trim() });
      if (result === null) throw Error("Could not save the view");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not save the view",
      );
      setBusy(false);
    }
  };

  return (
    <form
      className="saved-view-inline-editor"
      aria-label="Edit view"
      onSubmit={(event) => void save(event)}
    >
      <div className="saved-view-inline-main">
        <EntityIconPicker
          label="Choose icon"
          fallback="CustomView"
          size={20}
          icon={draft.icon}
          color={draft.color}
          onChange={(appearance) =>
            setDraft((current) => ({ ...current, ...appearance }))
          }
        />
        <div className="saved-view-inline-copy">
          <input
            aria-label="Title"
            placeholder="All issues"
            value={draft.name}
            onChange={(event) =>
              setDraft((current) => ({ ...current, name: event.target.value }))
            }
          />
          <input
            aria-label="Description"
            placeholder="Description (optional)"
            value={draft.description}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
          />
        </div>
        <div className="saved-view-inline-actions">
          <label>
            <span>Save to</span>
            <select
              aria-label="Save to"
              value={draft.visibility}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  visibility: event.target.value,
                }))
              }
            >
              <option value="personal">Personal</option>
              <option value="workspace">Workspace</option>
            </select>
          </label>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={!draft.name.trim() || busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      <div className="saved-view-inline-tools">
        {columnControl}
        <button type="button" onClick={onAddFilter}>
          Add filter
        </button>
        <button type="button" data-saved-view-display-trigger onClick={onDisplayOptions}>
          Display options
        </button>
      </div>
    </form>
  );
}
