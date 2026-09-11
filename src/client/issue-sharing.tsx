import {estimateOptions} from '../shared/estimates';
import {issueSubscribedBy,targetsIssue} from '../shared/issue-subscriptions';
import {displayNameFor} from './display-name';
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Icon, Modal, TextInput } from "./components/ui";
import { useAppStore } from "./store";
import type { Entity } from "../shared/types";

export function isIssueSubscribed(
  store: ReturnType<typeof useAppStore>,
  issue: Entity,
) {
  return issueSubscribedBy(issue,store.data.subscriptions,store.user?.id);
}
export function sharedEstimateOptions(issue: Entity) {
  const config = issue.sharedEstimateConfig;
  if (!config) return undefined;
  return estimateOptions(config);
}
export async function toggleIssueSubscription(
  store: ReturnType<typeof useAppStore>,
  issue: Entity,
) {
  const userId=store.user?.id;
  if(!userId)return;
  if(isIssueSubscribed(store,issue)) {
    const records=store.data.subscriptions.filter(s=>s.userId===userId&&targetsIssue(s,issue.id));
    return store.batch([
      ...((issue.subscriberIds??[]).includes(userId)?[{kind:'issues' as const,id:issue.id,data:{subscriberIds:issue.subscriberIds.filter((id:string)=>id!==userId)}}]:[]),
      ...records.map(record=>({kind:'subscriptions' as const,id:record.id,action:'delete' as const})),
    ]);
  }
  return issue.sharedAccess
    ? store.create('subscriptions',{userId,issueId:issue.id,entityId:issue.id,entityKind:'issues'})
    : store.update('issues',issue.id,{subscriberIds:[...(issue.subscriberIds??[]),userId]});
}

export function inheritedIssueShares(
  issue: Entity,
  issues: Entity[],
): string[] {
  const seen = new Set<string>();
  let current: Entity | undefined = issue;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    if (Array.isArray(current.sharedWithIds)) return current.sharedWithIds;
    const next = issues.find((i) => i.id === current?.parentId);
    current = next;
  }
  return [];
}
export function IssueSharingDialog({
  issue,
  onClose,
}: {
  issue: Entity;
  onClose: () => void;
}) {
  const store = useAppStore();
  const [selected, setSelected] = useState<string[]>(
      inheritedIssueShares(issue, store.data.issues),
    ),
    [query, setQuery] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [inherit, setInherit] = useState(
      !!issue.parentId && !Array.isArray(issue.sharedWithIds),
    );
  const team = store.data.teams.find((t) => t.id === issue.teamId);
  const teamMembers = new Set([
    ...(team?.memberIds ?? []),
    ...store.data.memberships
      .filter((m) => m.teamId === issue.teamId && !m.deletedAt)
      .map((m) => m.userId),
    team?.creatorId,
  ]);
  const users = store.data.users.filter(
    (u) =>
      !u.deletedAt &&
      (!teamMembers.has(u.id) || selected.includes(u.id)) &&
      `${u.name} ${u.email}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <Modal title="Share issue" onClose={onClose}>
      <div className="modal-body issue-sharing-dialog">
        <p className="muted">
          People you select can view and edit this issue and its sub-issues.
          Team, project, cycle, and milestone details stay private.
        </p>
        <div className="sharing-link-row">
          <TextInput
            aria-label="Shared issue link"
            readOnly
            value={`${location.origin}/issues/${issue.id}`}
          />
          <Button
            onClick={async () => {
              await navigator.clipboard.writeText(
                `${location.origin}/issues/${issue.id}`,
              );
              store.toast("Issue link copied");
            }}
          >
            Copy link
          </Button>
        </div>
        {issue.canManageSharing ? (
          <>
            <TextInput
              aria-label="Find people to share with"
              placeholder="Search people…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {issue.parentId && (
              <label className="sharing-person">
                <input
                  type="checkbox"
                  checked={inherit}
                  onChange={(e) => {
                    setInherit(e.target.checked);
                    if (e.target.checked) {
                      const parent = store.data.issues.find(
                        (i) => i.id === issue.parentId,
                      );
                      if (parent)
                        setSelected(
                          inheritedIssueShares(parent, store.data.issues),
                        );
                    }
                  }}
                />
                Inherit access from the parent issue
              </label>
            )}
            <div className="sharing-people">
              {users.map((person) => (
                <label className="sharing-person" key={person.id}>
                  <input
                    type="checkbox"
                    aria-label={`Share with ${person.name}`}
                    checked={selected.includes(person.id)}
                    disabled={inherit}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...selected, person.id]
                          : selected.filter((id) => id !== person.id),
                      )
                    }
                  />
                  <span className="avatar" style={{ background: person.color }}>
                    {person.name?.slice(0, 1)}
                  </span>
                  <span>
                    <strong>{person.name}</strong>
                    <small>{person.email}</small>
                  </span>
                </label>
              ))}
            </div>
            <p className="muted small">
              {team?.name
                ? `Members of ${team.name} already have access.`
                : "Only selected people receive access."}
            </p>
          </>
        ) : (
          <p className="muted">
            A team member with sharing permission can change who has access.
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
      <footer className="modal-footer">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        {issue.canManageSharing && (
          <Button
            variant="primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await store.update("issues", issue.id, {
                  sharedWithIds: inherit ? null : selected,
                });
                onClose();
              } catch (error) {
                setError(
                  error instanceof Error
                    ? error.message
                    : "Could not change sharing",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Save access
          </Button>
        )}
      </footer>
    </Modal>
  );
}
export function IssueSharingControl({ issue }: { issue: Entity }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.command === "share-issue" && !event.defaultPrevented && (!detail.value || detail.value===issue.id) && (issue.canManageSharing || issue.sharedAccess)) {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("workspace-command", handler);
    return () => window.removeEventListener("workspace-command", handler);
  }, [issue.id,issue.canManageSharing,issue.sharedAccess]);
  return (
    <>
      {(issue.canManageSharing || issue.sharedAccess) && (
        <Button variant="ghost" onClick={() => setOpen(true)}>
          <Icon name="Users" size={14} />
          Share
        </Button>
      )}
      {open && (
        <IssueSharingDialog issue={issue} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
export function IssueSharingBanner({ issue }: { issue: Entity }) {
  const { data } = useAppStore(),
    ids = inheritedIssueShares(issue, data.issues);
  if (!issue.sharedAccess && !ids.length) return null;
  return (
    <div className="shared-issue-banner">
      <Icon name="Users" size={14} />
      <span>
        {issue.sharedAccess
          ? "This issue has been shared with you."
          : `Shared with ${ids.map((id) => displayNameFor(data.users.find((u) => u.id === id),data,"a workspace member")).join(", ")}.`}
      </span>
      {issue.sharedAccess && (
        <Link to="/my-issues?tab=Shared">View shared issues</Link>
      )}
    </div>
  );
}
