import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Entity, EntityKind } from "../shared/types";
import { Button, Dropdown, Field, Icon, MenuItem, Modal, TextInput } from "./components/ui";
import { IssueActionFilter } from "./issue-action-filter";
import { IssueActionSubmenu } from "./issue-action-submenu";
import { useAppStore } from "./store";

type LabelKind = Extract<EntityKind, "labels" | "labelGroups">;

function canManageLabel(entity: Entity, data: ReturnType<typeof useAppStore>["data"], userId?: string) {
  const membership = data.memberships.find(
    (item) => !item.deletedAt && !item.teamId && item.userId === userId,
  );
  if (!membership || membership.role === "guest") return false;
  if (!entity.teamId) return true;
  const team = data.teams.find((item) => item.id === entity.teamId);
  if (!team || team.labelManagement !== "owners") return true;
  if (["owner", "admin"].includes(membership.role)) return true;
  return [team.ownerId, ...(team.ownerIds ?? [])].filter(Boolean).includes(userId);
}

export function LabelViewOptions({
  entity,
  kind,
  members = [],
  trigger = "header",
}: {
  entity: Entity;
  kind: LabelKind;
  members?: Entity[];
  trigger?: "header" | "details";
}) {
  const store = useAppStore();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"rename" | "move" | null>(null);
  const [name, setName] = useState(entity.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const manageable = canManageLabel(entity, store.data, store.user?.id);
  const subscription = store.data.subscriptions.find(
    (item) =>
      !item.deletedAt &&
      item.userId === store.user?.id &&
      item.entityKind === kind &&
      item.entityId === entity.id,
  );
  const label = kind === "labelGroups" ? "label group" : "label";
  const titleLabel = kind === "labelGroups" ? "Label group" : "Label";
  const groupChoices = store.data.labelGroups
    .filter(
      (group) =>
        !group.deletedAt &&
        (group.entityType || "issues") === (entity.entityType || "issues") &&
        (group.teamId || null) === (entity.teamId || null),
    )
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const close = () => {
    if (busy) return;
    setError("");
    setMode(null);
  };
  const run = async (action: () => Promise<unknown>, after?: () => void) => {
    setBusy(true);
    setError("");
    try {
      await action();
      setMode(null);
      after?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };
  const updateSubscription = async (
    field: "notifyOnAdded" | "notifyOnClosed",
    checked: boolean,
  ) => {
    const values = {
      notifyOnAdded: subscription?.notifyOnAdded === true,
      notifyOnClosed: subscription?.notifyOnClosed === true,
      [field]: checked,
    };
    if (!values.notifyOnAdded && !values.notifyOnClosed) {
      if (subscription) await store.remove("subscriptions", subscription.id);
      return;
    }
    if (subscription) await store.update("subscriptions", subscription.id, values);
    else
      await store.create("subscriptions", {
        ...values,
        entityKind: kind,
        entityId: entity.id,
      });
  };
  const activeItems = (
    <>
      {manageable && (
        <MenuItem
          icon="Pencil"
          shortcut="⇧ R"
          onClick={() => {
            setName(entity.name);
            setMode("rename");
          }}
        >
          Rename…
        </MenuItem>
      )}
      {manageable && kind === "labels" && (
        <IssueActionSubmenu label="Move to group" icon="ArrowRight">
          <button
            className="menu-item"
            role="menuitemradio"
            aria-checked={!entity.labelGroupId && !entity.group}
            onClick={() =>
              void run(
                () =>
                  store.update("labels", entity.id, {
                    group: null,
                    labelGroupId: null,
                  }),
                () => store.toast("Label moved"),
              )
            }
          >
            <Icon name={!entity.labelGroupId && !entity.group ? "Check" : "Tag"} />
            <span>No group</span>
          </button>
          {groupChoices.map((group) => {
            const selected =
              entity.labelGroupId === group.id ||
              (!entity.labelGroupId && entity.group === group.name);
            return (
              <button
                key={group.id}
                className="menu-item"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() =>
                  void run(
                    () =>
                      store.update("labels", entity.id, {
                        group: group.name,
                        labelGroupId: group.id,
                      }),
                    () => store.toast("Label moved"),
                  )
                }
              >
                <Icon name={selected ? "Check" : "Tag"} />
                <span>{group.name}</span>
              </button>
            );
          })}
        </IssueActionSubmenu>
      )}
      {manageable && entity.teamId && (
        <MenuItem icon="Building2" onClick={() => setMode("move")}>
          Move to workspace…
        </MenuItem>
      )}
      {manageable && (
        <MenuItem icon="Settings" onClick={() => navigate("/settings/labels")}>
          Open issue label settings
        </MenuItem>
      )}
      <IssueActionSubmenu label="Subscribe" icon="Bell" filter={false}>
        {(
          [
            [
              "notifyOnAdded",
              kind === "labels"
                ? "The label is added to an issue"
                : "A label in the group is added to an issue",
            ],
            ["notifyOnClosed", "An issue is marked completed or canceled"],
          ] as const
        ).map(([field, text]) => (
          <button
            key={field}
            className="menu-item"
            role="menuitemcheckbox"
            aria-checked={subscription?.[field] === true}
            onClick={() => void updateSubscription(field, subscription?.[field] !== true)}
          >
            <input type="checkbox" tabIndex={-1} readOnly checked={subscription?.[field] === true} />
            <span>{text}</span>
          </button>
        ))}
      </IssueActionSubmenu>
      <MenuItem
        icon="Link"
        onClick={() =>
          void navigator.clipboard
            .writeText(window.location.href)
            .then(() => store.toast("Label link copied"))
        }
      >
        Copy link
      </MenuItem>
      <div className="menu-separator" />
      {manageable && (
        <MenuItem
          icon="Archive"
          onClick={() =>
            void run(
              () => store.update(kind, entity.id, { archivedAt: new Date().toISOString() }),
              () => store.toast(`${titleLabel} archived`),
            )
          }
        >
          Archive…
        </MenuItem>
      )}
      {manageable && (
        <MenuItem
          icon="Trash2"
          danger
          onClick={() =>
            void run(
              () => store.remove(kind, entity.id),
              () => {
                store.toast(`${titleLabel} deleted`);
                navigate("/settings/labels");
              },
            )
          }
        >
          Delete
        </MenuItem>
      )}
    </>
  );
  const archivedItems = (
    <>
      {manageable && (
        <MenuItem icon="Settings" onClick={() => navigate("/settings/labels")}>Open issue label settings</MenuItem>
      )}
      <MenuItem icon="Link" onClick={() => void navigator.clipboard.writeText(window.location.href).then(() => store.toast("Label link copied"))}>Copy link</MenuItem>
      <div className="menu-separator" />
      {manageable && (
        <MenuItem
          icon="Archive"
          onClick={() => void run(() => store.update(kind, entity.id, { archivedAt: null }), () => store.toast(`${titleLabel} restored`))}
        >
          Restore
        </MenuItem>
      )}
      {manageable && (
        <MenuItem icon="Trash2" danger onClick={() => void run(() => store.remove(kind, entity.id), () => { store.toast(`${titleLabel} deleted`); navigate("/settings/labels"); })}>Delete</MenuItem>
      )}
    </>
  );
  return (
    <>
      <Dropdown
        align="right"
        trigger={
          <button className="icon-button" aria-label={trigger === "header" ? "Label options" : "Actions"}>
            <Icon name="MoreHorizontal" size={14} />
          </button>
        }
      >
        <IssueActionFilter status searchLabel="Filter label actions">
          {entity.archivedAt ? archivedItems : activeItems}
        </IssueActionFilter>
      </Dropdown>
      {mode === "rename" && (
        <Modal title={kind === "labelGroups" ? "Rename label group" : "Rename label"} onClose={close}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const next = name.trim();
              if (next) void run(() => store.update(kind, entity.id, { name: next }));
            }}
          >
            <div className="modal-body">
              <Field label="Name">
                <TextInput autoFocus required value={name} onChange={(event) => setName(event.target.value)} />
              </Field>
              {error && <p role="alert">{error}</p>}
            </div>
            <div className="modal-footer">
              <Button type="button" onClick={close}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={busy || !name.trim()}>Save</Button>
            </div>
          </form>
        </Modal>
      )}
      {mode === "move" && (
        <Modal title={`Move "${entity.name}" to workspace?`} onClose={close}>
          <div className="modal-body">
            <p>This {label} will be made available to the workspace. This cannot be undone.</p>
            {kind === "labelGroups" && members.length > 0 && (
              <p>{members.length} {members.length === 1 ? "label" : "labels"} in this group will move with it.</p>
            )}
            {error && <p role="alert">{error}</p>}
          </div>
          <div className="modal-footer">
            <Button onClick={close}>Cancel</Button>
            <Button variant="primary" disabled={busy} onClick={() => void run(() => store.update(kind, entity.id, { teamId: null }))}>Move {label}</Button>
          </div>
        </Modal>
      )}
    </>
  );
}
