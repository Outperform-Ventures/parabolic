import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Building2, Check, Lock, Users } from "lucide-react";
import { guestCapabilities } from "../shared/guest-capabilities";
import { Dropdown } from "./components/ui";
import { EntityIconPicker } from "./features/entity-icon";
import { IssueList } from "./issues";
import { useAppStore } from "./store";
import type { Entity } from "../shared/types";
import "./duplicate-issue-view.css";

type DuplicateLocationState = { sourceViewId?: string; returnTo?: string };

export function duplicateIssueViewRouteState(view: Entity, returnTo: string) {
  return { sourceViewId: view.id, returnTo } satisfies DuplicateLocationState;
}

export function DuplicateIssueViewPage() {
  const store = useAppStore();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as DuplicateLocationState;
  const source = store.data.views.find(
    (view) =>
      view.id === state.sourceViewId &&
      !view.deletedAt &&
      (view.entityType || "issues") === "issues",
  );
  const returnTo = state.returnTo || (source ? `/view/${source.id}` : "/views");
  const [name, setName] = useState("All issues");
  const [description, setDescription] = useState("");
  const [saveTo, setSaveTo] = useState("personal");
  const [appearance, setAppearance] = useState(() => ({
    icon: source?.icon || "CustomView",
    color: source?.color || "#26b5ce",
  }));
  const [busy, setBusy] = useState(false);
  const capabilities = guestCapabilities(store.data, store.user?.id);
  const destinations = [
    { value: "personal", label: "Personal", icon: Lock },
    { value: "workspace", label: "Workspace", icon: Building2 },
    ...store.data.teams
      .filter((team) => !team.deletedAt && capabilities.canTeam(team.id))
      .map((team) => ({
        value: `team:${team.id}`,
        label: team.name,
        icon: Users,
      })),
  ];
  const destination =
    destinations.find((option) => option.value === saveTo) || destinations[0];

  if (state.sourceViewId && !source)
    return <div className="app-loading">Loading view…</div>;

  const save = async () => {
    if (busy || !name.trim()) return;
    setBusy(true);
    try {
      const created = await store.create("views", {
        name: name.trim(),
        description: description.trim(),
        entityType: "issues",
        visibility: saveTo === "personal" ? "personal" : "workspace",
        ownerId: store.user?.id,
        teamId: saveTo.startsWith("team:")
          ? saveTo.slice("team:".length)
          : (source?.teamId ?? null),
        projectId: source?.projectId ?? null,
        initiativeId: source?.initiativeId ?? null,
        placement: source?.placement,
        layout: source?.layout || "List",
        icon: appearance.icon,
        color: appearance.color,
        filters: source?.filters ??
          source?.filter ?? {
            conditions: [],
            match: "all",
          },
        display: source?.display ?? {},
        searchQuery: source?.searchQuery ?? "",
      });
      navigate(`/view/${created.id}`, { replace: true });
    } catch (error) {
      store.toast(
        error instanceof Error ? error.message : "Could not save view",
      );
      setBusy(false);
    }
  };

  return (
    <section className="duplicate-issue-view" aria-label="New issue view">
      <header className="duplicate-view-breadcrumb">
        <Link to="/views">Views</Link>
        <span aria-hidden="true">›</span>
        <strong>All issues</strong>
        <span className="spacer" />
        <button
          type="button"
          className="icon-button"
          aria-label="Copy URL"
          title="Copy URL"
          onClick={() =>
            void navigator.clipboard
              .writeText(window.location.href)
              .then(() => store.toast("Copied to clipboard"))
          }
        >
          ↗
        </button>
      </header>
      <div className="duplicate-view-editor">
        <span className="duplicate-view-icon">
          <EntityIconPicker
            compact
            label="Choose icon"
            fallback="CustomView"
            size={16}
            icon={appearance.icon}
            color={appearance.color}
            onChange={(next) => {
              setAppearance(next);
              return true;
            }}
          />
        </span>
        <div className="duplicate-view-fields">
          <input
            autoFocus
            required
            aria-label="View title"
            placeholder="All issues"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <input
            aria-label="Description"
            placeholder="Description (optional)"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <div className="duplicate-view-actions">
          <span className="duplicate-view-save-label">Save to</span>
          <Dropdown
            align="right"
            menuClassName="duplicate-view-save-menu"
            trigger={
              <button type="button" aria-label="Save to">
                <destination.icon size={13} />
                {destination.label}
              </button>
            }
          >
            <div role="listbox" aria-label="Save to destinations">
              {destinations.map((option) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={option.value === saveTo}
                  key={option.value}
                  onClick={() => setSaveTo(option.value)}
                >
                  <option.icon size={14} />
                  <span>{option.label}</span>
                  {option.value === saveTo && <Check size={14} />}
                </button>
              ))}
            </div>
          </Dropdown>
          <button
            type="button"
            onClick={() => navigate(returnTo, { replace: true })}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !name.trim()}
            onClick={() => void save()}
          >
            Save
          </button>
        </div>
      </div>
      <nav className="duplicate-view-types" aria-label="View type">
        <Link to="/views/issues/new" aria-current="page">
          Issues
        </Link>
        <Link to="/views?type=projects">Projects</Link>
      </nav>
      <div className="duplicate-issue-view-list">
        <IssueList
          viewId={source?.id}
          embedded
          filterButtonLabel="Add filter"
        />
      </div>
    </section>
  );
}
