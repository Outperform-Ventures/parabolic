import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAppStore } from "./store";
import { Button, Dropdown, Icon, MenuItem, Modal } from "./components/ui";
import { FormDialog } from "./features/shared";
import { IssueActionSubmenu } from "./issue-action-submenu";
import { IssueActionFilter } from "./issue-action-filter";
import type { Entity } from "../shared/types";

function subscriptionFor(store: ReturnType<typeof useAppStore>, view: Entity) {
  return store.data.subscriptions.find(
    (subscription) =>
      subscription.entityKind === "views" &&
      subscription.entityId === view.id &&
      subscription.userId === store.user?.id &&
      !subscription.deletedAt &&
      !subscription.archivedAt,
  );
}

function viewUrl(view: Entity) {
  return `${window.location.origin}/view/${view.id}`;
}

function PersonalViewCopyDialog({
  view,
  onClose,
}: {
  view: Entity;
  onClose: () => void;
}) {
  const store = useAppStore(),
    [visibility, setVisibility] = useState("personal"),
    [busy, setBusy] = useState(false);
  return (
    <Modal title="Personal views can't be shared" onClose={onClose}>
      <div className="modal-body">
        <p className="muted">
          Would you like to update the visibility of this view before sharing?
        </p>
        <label className="field">
          <select
            className="input select"
            aria-label="Visibility"
            value={visibility}
            onChange={(event) => setVisibility(event.target.value)}
          >
            <option value="personal">Personal</option>
            <option value="workspace">Workspace</option>
          </select>
        </label>
      </div>
      <div className="modal-footer">
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          disabled={visibility === "personal" || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await store.update("views", view.id, {
                visibility: "workspace",
              });
              await navigator.clipboard.writeText(viewUrl(view));
              store.toast("View link copied");
              onClose();
            } finally {
              setBusy(false);
            }
          }}
        >
          Change visibility
        </Button>
      </div>
    </Modal>
  );
}

function useViewCopy(view: Entity) {
  const store = useAppStore(),
    [copyingPersonal, setCopyingPersonal] = useState(false);
  const copy = () => {
    if (view.visibility === "personal" || view.visibility === "private") {
      setCopyingPersonal(true);
      return;
    }
    void navigator.clipboard
      .writeText(viewUrl(view))
      .then(() => store.toast("View link copied"));
  };
  return { copy, copyingPersonal, setCopyingPersonal };
}

export function ViewSubscriptionDialog({
  view,
  onClose,
}: {
  view: Entity;
  onClose: () => void;
}) {
  const store = useAppStore(),
    subscription = subscriptionFor(store, view);
  return (
    <FormDialog
      title="View subscription"
      submit="Save subscription"
      initial={{
        notifyOnAdded: subscription?.notifyOnAdded !== false,
        notifyOnClosed: subscription?.notifyOnClosed !== false,
      }}
      fields={[
        {
          key: "notifyOnAdded",
          label: "Issue added to view",
          type: "checkbox",
        },
        {
          key: "notifyOnClosed",
          label: "Issue completed or canceled",
          type: "checkbox",
        },
      ]}
      onClose={onClose}
      onSave={async (values) => {
        if (!values.notifyOnAdded && !values.notifyOnClosed) {
          if (subscription)
            await store.remove("subscriptions", subscription.id);
          return true;
        }
        const fields = {
          ...values,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
        return subscription
          ? store.update("subscriptions", subscription.id, fields)
          : store.create("subscriptions", {
              ...fields,
              entityKind: "views",
              entityId: view.id,
            });
      }}
    >
      <p className="muted">
        Get notifications for {view.name}. Your own changes won't notify you.
        Clear both options to unsubscribe.
      </p>
    </FormDialog>
  );
}

export function ViewSubscriptionMenu({
  view,
  onEdit,
  onDuplicate,
  onMove,
  onDelete,
}: {
  view: Entity;
  onEdit: () => void;
  onDuplicate: () => void;
  onMove: (location: string) => void;
  onDelete: () => void;
}) {
  const store = useAppStore(),
    subscription = subscriptionFor(store, view);
  const { copy, copyingPersonal, setCopyingPersonal } = useViewCopy(view);
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
    if (subscription)
      await store.update("subscriptions", subscription.id, values);
    else
      await store.create("subscriptions", {
        ...values,
        entityKind: "views",
        entityId: view.id,
      });
  };
  return (
    <>
      <Dropdown
        trigger={
          <button className="icon-button" aria-label="Issue view options">
            <Icon name="MoreHorizontal" size={16} />
          </button>
        }
      >
        <IssueActionFilter>
          <MenuItem icon="Settings" onClick={onEdit}>
            Edit…
          </MenuItem>
          <MenuItem icon="Copy" onClick={onDuplicate}>
            Duplicate…
          </MenuItem>
          <IssueActionSubmenu label="Move to" icon="Move" filter={false}>
            {[
              ["personal", "Personal"],
              ["workspace", "Workspace"],
              ...store.data.teams
                .filter((team) => !team.deletedAt && !team.archivedAt)
                .map((team) => [`team:${team.id}`, team.name]),
            ].map(([location, label]) => {
              const current = view.teamId
                ? `team:${view.teamId}`
                : view.visibility === "personal"
                  ? "personal"
                  : "workspace";
              return (
                <button
                  key={location}
                  className="menu-item"
                  role="menuitemradio"
                  aria-checked={current === location}
                  onClick={() => onMove(location)}
                >
                  <Icon name={current === location ? "Check" : "Minus"} />
                  <span>{label}</span>
                </button>
              );
            })}
          </IssueActionSubmenu>
          <IssueActionSubmenu label="Subscribe" icon="Bell" filter={false}>
            {(
              [
                ["notifyOnAdded", "An issue is added to the view"],
                ["notifyOnClosed", "An issue is marked completed or canceled"],
              ] as const
            ).map(([field, label]) => (
              <button
                key={field}
                className="menu-item"
                role="menuitemcheckbox"
                aria-checked={subscription?.[field] === true}
                onClick={() =>
                  void updateSubscription(field, subscription?.[field] !== true)
                }
              >
                <input
                  type="checkbox"
                  tabIndex={-1}
                  readOnly
                  checked={subscription?.[field] === true}
                />
                <span>{label}</span>
              </button>
            ))}
          </IssueActionSubmenu>
          <MenuItem icon="Slack" disabled>
            Configure custom view Slack notifications…
          </MenuItem>
          <MenuItem icon="Link" onClick={copy}>
            Copy link
          </MenuItem>
          <MenuItem icon="Trash2" danger onClick={onDelete}>
            Delete
          </MenuItem>
        </IssueActionFilter>
      </Dropdown>
      {copyingPersonal && (
        <PersonalViewCopyDialog
          view={view}
          onClose={() => setCopyingPersonal(false)}
        />
      )}
    </>
  );
}

export function ViewDetailsMenu({
  view,
  onEdit,
  onDelete,
}: {
  view: Entity;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { copy, copyingPersonal, setCopyingPersonal } = useViewCopy(view);
  return (
    <>
      <Dropdown
        align="right"
        menuClassName="saved-view-details-menu"
        trigger={
          <button className="icon-button" aria-label="Open menu">
            <Icon name="MoreHorizontal" size={14} />
          </button>
        }
      >
        <IssueActionFilter compact searchLabel="Filter view actions">
          <MenuItem icon="Settings" onClick={onEdit}>
            Edit…
          </MenuItem>
          <MenuItem icon="Link" onClick={copy}>
            Copy link
          </MenuItem>
          <MenuItem icon="Trash2" danger onClick={onDelete}>
            Delete
          </MenuItem>
        </IssueActionFilter>
      </Dropdown>
      {copyingPersonal && (
        <PersonalViewCopyDialog
          view={view}
          onClose={() => setCopyingPersonal(false)}
        />
      )}
    </>
  );
}

export function ViewSubscriptionSettings() {
  const store = useAppStore(),
    [editing, setEditing] = useState<Entity | null>(null),
    subscriptions = store.data.subscriptions.filter(
      (s) =>
        s.entityKind === "views" &&
        s.userId === store.user?.id &&
        !s.deletedAt &&
        !s.archivedAt,
    );
  const views = subscriptions
    .map((subscription) => ({
      subscription,
      view: store.data.views.find(
        (view) =>
          view.id === subscription.entityId &&
          !view.deletedAt &&
          !view.archivedAt,
      ),
    }))
    .filter((row) => row.view);
  return (
    <>
      <p className="muted">
        Choose Subscribe in an issue view's options menu to add notifications.
      </p>
      {views.map(({ subscription, view }) => (
        <div className="feature-settings-row" key={subscription.id}>
          <div>
            <Link to={`/view/${view!.id}`}>{view!.name}</Link>
            <p className="muted">
              {[
                subscription.notifyOnAdded !== false ? "Issue added" : null,
                subscription.notifyOnClosed !== false
                  ? "Completed or canceled"
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <button
            className="button"
            onClick={() => setEditing(view!)}
            aria-label={`Manage subscription to ${view!.name}`}
          >
            Manage
          </button>
        </div>
      ))}
      {editing && (
        <ViewSubscriptionDialog
          view={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
