import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { INITIATIVE_STATUSES } from "../../shared/initiatives";
import { EntityIconPicker } from "./entity-icon";
import {
  Action,
  MultipleProperty,
  Property,
  TargetDateControl,
  optionList,
  priorities,
  useActions,
} from "./shared";
export function InlineInitiative({
  onClose,
  parentId,
  teamId,
}: {
  onClose: () => void;
  parentId?: string;
  teamId?: string;
}) {
  const { data, create, act } = useActions(),
    nav = useNavigate(),
    nativeWorkspace = !teamId && !parentId;
  const [draft, setDraft] = useState<Record<string, any>>({
      name: "",
      summary: "",
      status: "active",
      priority: 0,
      ownerId: "",
      leadTeamId:
        teamId ||
        data.initiatives.find((item) => item.id === parentId)?.leadTeamId ||
        null,
      targetDate: null,
      datePrecision: "day",
      labelIds: [],
      parentIds: parentId ? [parentId] : [],
    }),
    [busy, setBusy] = useState(false);
  const set = (patch: Record<string, any>) =>
    setDraft((current) => ({ ...current, ...patch }));
  return (
    <form
      className="feature-inline-initiative"
      aria-label="New initiative"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!draft.name.trim() || busy) return;
        setBusy(true);
        const result = await act(() =>
          create("initiatives", { ...draft, name: draft.name.trim() }),
        );
        setBusy(false);
        if (result) {
          onClose();
          nav(`/initiative/${result.id}`);
        }
      }}
    >
      <span className="feature-initiative-icon">
        <EntityIconPicker
          label="Choose icon"
          fallback="Layers"
          size={20}
          icon={draft.icon}
          color={draft.color}
          onChange={set}
        />
      </span>
      <div className="feature-initiative-draft-fields">
        <input
          autoFocus
          required
          aria-label={nativeWorkspace ? "Initiative name" : "Name"}
          className="feature-initiative-name-input"
          placeholder="New initiative"
          value={draft.name}
          onChange={(e) => set({ name: e.target.value })}
        />
        <input
          aria-label={nativeWorkspace ? "Initiative summary" : "Summary"}
          className="feature-initiative-summary-input"
          placeholder="Add a short summary…"
          value={draft.summary}
          onChange={(e) => set({ summary: e.target.value })}
        />
        <div className="feature-initiative-chips">
          {nativeWorkspace ? (
            <>
              <Property
                label="Status"
                triggerLabel="Change status"
                value={draft.status}
                options={INITIATIVE_STATUSES}
                onChange={(status) => set({ status })}
              />
              <Property
                label="Priority"
                triggerLabel="Change priority"
                value={draft.priority}
                options={priorities}
                onChange={(priority) => set({ priority: Number(priority) })}
              />
              <Property
                label="Owner"
                triggerLabel="Change initiative owner"
                value={draft.ownerId}
                options={optionList(data.users, "Owner")}
                onChange={(ownerId) => set({ ownerId })}
              />
            </>
          ) : (
            <>
              <select
                aria-label="Status"
                value={draft.status}
                onChange={(e) => set({ status: e.target.value })}
              >
                {INITIATIVE_STATUSES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <select
                aria-label="Priority"
                value={draft.priority}
                onChange={(e) => set({ priority: Number(e.target.value) })}
              >
                {priorities.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <select
                aria-label="Owner"
                value={draft.ownerId}
                onChange={(e) => set({ ownerId: e.target.value })}
              >
                {optionList(data.users, "Owner").map((o) => (
                  <option value={o.value} key={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <select
                aria-label="Lead team"
                value={draft.leadTeamId || ""}
                onChange={(e) => set({ leadTeamId: e.target.value || null })}
              >
                {optionList(data.teams, "No lead team").map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </>
          )}
          <TargetDateControl
            showFooter={!nativeWorkspace}
            triggerLabel={
              nativeWorkspace ? "Change initiative target date" : undefined
            }
            value={draft.targetDate}
            precision={draft.datePrecision}
            onChange={(targetDate, datePrecision) =>
              set({ targetDate, datePrecision })
            }
          />
          {!nativeWorkspace && (
            <MultipleProperty
              label="Parents"
              values={draft.parentIds || []}
              options={optionList(data.initiatives).filter((o) => o.value)}
              onChange={(parentIds) => set({ parentIds })}
            />
          )}
          <MultipleProperty
            label={nativeWorkspace ? "Change labels" : "Labels"}
            values={draft.labelIds}
            options={optionList(data.labels)}
            onChange={(labelIds) => set({ labelIds })}
          />
          <span className="feature-inline-create-actions">
            <Action onClick={onClose}>Cancel</Action>
            <button
              className="button feature-button primary"
              type="submit"
              disabled={!draft.name.trim() || busy}
            >
              {busy ? "Creating…" : "Create"}
            </button>
          </span>
        </div>
      </div>
    </form>
  );
}
