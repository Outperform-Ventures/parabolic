import {pendingSaves} from '../pending-saves';
import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiRequest, useAppStore } from "../store";
import { Button, Icon, Modal } from "../components/ui";
import { displayNameFor } from "../display-name";
import emptyEmojis from "../assets/empty-emojis.svg";
export function CustomEmojisSettings() {
  const store = useAppStore(),
    workspace = store.data.workspaces.find(
      (workspace) => workspace.id === store.data.workspaceId,
    );
  const [query, setQuery] = useState(""),
    [open, setOpen] = useState(false),
    [name, setName] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [removing, setRemoving] = useState<any>(null);
  const input = useRef<HTMLInputElement>(null);
  const items = (workspace?.customEmojis ?? []).filter(
    (emoji: any) =>
      !emoji.deletedAt &&
      emoji.name.toLowerCase().includes(query.toLowerCase()),
  );
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      await pendingSaves.track(async()=>{
      const body = new FormData();
      body.append("name", name.trim());
      body.append("file", file);
      await apiRequest("/api/v1/custom-emojis", { method: "POST", body });
      await store.loadEntity("workspaces", store.data.workspaceId);
      setOpen(false);
      setFile(null);
      setName("");
      store.toast("Emoji added");
      });
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not upload emoji",
      );
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    setError("");
    try {
      await apiRequest(
        `/api/v1/custom-emojis/${encodeURIComponent(removing.id)}`,
        { method: "DELETE" },
      );
      await store.loadEntity("workspaces", store.data.workspaceId);
      setRemoving(null);
      store.toast("Emoji removed");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not remove emoji",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="custom-emojis-settings">
      <h1>Emojis</h1>
      <div className="custom-emoji-toolbar">
        <label className="feature-search">
          <Icon name="Search" size={14} />
          <input
            aria-label="Filter by name…"
            placeholder="Filter by name…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <Button
          onClick={() => {
            setError("");
            input.current?.click();
          }}
        >
          Upload
        </Button>
        <input
          ref={input}
          className="custom-emoji-file-input"
          type="file"
          accept="image/png,image/jpeg,image/gif"
          onChange={(event) => {
            const selected = event.target.files?.[0] ?? null;
            setFile(selected);
            if (selected) {
              setName(selected.name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9_+-]/g, "_"));
              setOpen(true);
            }
            event.target.value = "";
          }}
        />
      </div>
      <div className={`custom-emoji-list ${items.length ? "settings-card" : "custom-emoji-empty"}`}>
        {items.map((emoji: any) => (
          <div key={emoji.id} className="custom-emoji-row">
            <img src={emoji.url} alt={`:${emoji.name}:`} />
            <strong>:{emoji.name}:</strong>
            <span className="muted">
              {displayNameFor(
                store.data.users.find((user) => user.id === emoji.creatorId),
                store.data,
                "Member",
              )}
            </span>
            <span className="spacer" />
            {(emoji.creatorId === store.user?.id ||
              ["owner", "admin"].includes(store.user?.role ?? "")) && (
              <button
                className="icon-button"
                aria-label={`Delete ${emoji.name} emoji`}
                onClick={() => {
                  setRemoving(emoji);
                  setError("");
                }}
              >
                <Icon name="Trash2" size={14} />
              </button>
            )}
          </div>
        ))}
        {!items.length && (
          <div className="custom-emoji-empty-state">
            {!query && <img src={emptyEmojis} alt="" />}
            <span>{query ? "No matching emojis" : "No emojis"}</span>
          </div>
        )}
      </div>
      {open && (
        <Modal
          title="Add emoji"
          className="custom-emoji-upload-dialog"
          onClose={() => {
            if (!busy) setOpen(false);
          }}
        >
          <form onSubmit={save}>
            <div className="modal-body custom-emoji-form">
              <span className="custom-emoji-preview-frame">{preview&&<img src={preview} alt="Emoji preview"/>}</span>
              <input className="input" required autoFocus maxLength={64} pattern="[a-zA-Z0-9_+-]+" value={name} onChange={(event) => setName(event.target.value)} placeholder="Emoji name"/>
              {error && (
                <p className="error-text" role="alert">
                  {error}
                </p>
              )}
            </div>
            <div className="modal-footer">
              <Button disabled={busy} onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={busy || !file || !name.trim()}
              >
                {busy ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {removing && (
        <Modal
          title="Delete emoji"
          onClose={() => {
            if (!busy) setRemoving(null);
          }}
        >
          <div className="modal-body">
            <p>
              Remove :{removing.name}: from the picker? Existing reactions will
              keep their image.
            </p>
            {error && (
              <p className="error-text" role="alert">
                {error}
              </p>
            )}
          </div>
          <div className="modal-footer">
            <Button disabled={busy} onClick={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => void remove()}
            >
              Delete emoji
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
