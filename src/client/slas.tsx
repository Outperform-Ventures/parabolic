import {projectStatuses} from "./features/project-statuses";
import React, { useEffect, useState } from "react";
import { useAppStore } from "./store";
import { Button, Field, Icon, Modal } from "./components/ui";
import { FilterBuilder } from "./issues";
import { getSlaStatus, type FilterSpec } from "./query";
import type { Entity } from "../shared/types";

export const slaLabels: Record<string, string> = {
  lowRisk: "Low risk",
  mediumRisk: "Medium risk",
  highRisk: "High risk",
  breached: "Breached",
  achieved: "Achieved",
  failed: "Failed",
  none: "No SLA",
};
const units = [
  ["hour", "Hours"],
  ["day", "Days"],
  ["businessDay", "Business days"],
  ["week", "Weeks"],
];
export function SlaIndicator({
  issue,
  onClick,
}: {
  issue: Entity;
  onClick?: () => void;
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => tick((v) => v + 1), 60_000);
    return () => clearInterval(timer);
  }, []);
  if (!issue.slaDueAt) return null;
  const status = getSlaStatus(issue);
  const delta = Date.parse(issue.slaDueAt) - Date.now();
  const hours = Math.ceil(Math.abs(delta) / 3_600_000);
  const time = issue.completedAt
    ? new Date(issue.completedAt).toLocaleString()
    : hours < 24
      ? `${hours}h ${delta < 0 ? "overdue" : "remaining"}`
      : `${Math.ceil(hours / 24)}d ${delta < 0 ? "overdue" : "remaining"}`;
  return (
    <button
      className={`sla-indicator sla-${status}`}
      onClick={onClick}
      title={`SLA: ${slaLabels[status]} · ${time}`}
    >
      <Icon name="Flame" size={14} />
      <span>{slaLabels[status]}</span>
      <small>{time}</small>
    </button>
  );
}
export function SlaPicker({
  issue,
  onClose,
}: {
  issue: Entity;
  onClose: () => void;
}) {
  const store = useAppStore();
  const [duration, setDuration] = useState(
      Number(issue.slaDuration?.value) || 1,
    ),
    [unit, setUnit] = useState(issue.slaDuration?.unit ?? "day");
  const apply = async () => {
    await store.update("issues", issue.id, {
      slaDuration: { value: duration, unit },
      dueDate: null,
    });
    onClose();
  };
  return (
    <Modal title="Set SLA" onClose={onClose}>
      <div className="modal-body">
        <p className="muted">
          Set the time allowed to complete this issue. An SLA replaces its due
          date.
        </p>
        <div className="sla-duration">
          <Field label="Duration">
            <input
              className="input"
              aria-label="SLA duration"
              type="number"
              min="1"
              required
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
          </Field>
          <Field label="Unit">
            <select
              className="input"
              aria-label="SLA unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            >
              {units.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="sla-presets">
          {[
            [12, "hour"],
            [24, "hour"],
            [48, "hour"],
            [1, "week"],
            [2, "week"],
            [4, "week"],
          ].map(([value, type]) => (
            <Button
              key={`${value}:${type}`}
              onClick={() => {
                setDuration(Number(value));
                setUnit(String(type));
              }}
            >
              {value} {type}
              {Number(value) > 1 ? "s" : ""}
            </Button>
          ))}
        </div>
      </div>
      <div className="modal-footer">
        {issue.slaDueAt && (
          <Button
            variant="danger"
            onClick={async () => {
              await store.update("issues", issue.id, {
                slaDuration: null,
                slaDueAt: null,
              });
              onClose();
            }}
          >
            Remove SLA
          </Button>
        )}
        <span className="spacer" />
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          disabled={!Number.isFinite(duration) || duration <= 0}
          onClick={apply}
        >
          Apply SLA
        </Button>
      </div>
    </Modal>
  );
}
export function SlaSettings() {
  const store = useAppStore();
  const workspace = store.data.workspaces.find(
    (w) => w.id === store.data.workspaceId,
  );
  const policies = store.data.slaPolicies
    .filter((p) => !p.deletedAt)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const [edit, setEdit] = useState<Entity | true | null>(null),
    [deleteId, setDeleteId] = useState("");
  const initial = () => {
    for (const [index, [name, duration, unit, priorities, action]] of [
      ["Urgent issues", 24, "hour", [1], "apply"],
      ["High priority issues", 1, "week", [2], "apply"],
      ["Other priorities", 1, "day", [0, 3, 4], "remove"],
    ].entries())
      void store.create("slaPolicies", {
        name,
        duration,
        durationUnit: unit,
        durationMinutes: unit === "week" ? 10080 : 1440,
        enabled: true,
        position: policies.length + index,
        action,
        filter: {
          conditions: [
            { field: "priority", operator: "in", value: priorities },
          ],
          match: "all",
        },
      });
  };
  return (
    <div className="sla-settings-page">
      <div className="feature-setting-title">
        <div><h1>SLAs</h1>
        <p>Service-level agreements (SLAs) automatically apply deadlines to issues when they match<br/> predefined parameters. While often used to define response times to customer issues, they can<br/> also be used to define internal standards for bug and time-sensitive issue resolution. <a href="https://parabolic.app/docs/sla" target="_blank" rel="noreferrer">Docs ↗</a></p></div>
      </div>
      <section className="feature-setting-section sla-work-week">
        <h2>Work week</h2>
        <div className="feature-settings-card">
          <div className="feature-settings-row">
            <div>
              <strong>Business days</strong>
              <p className="muted">Used when calculating SLA deadlines.</p>
            </div>
            <select
              className="input"
              aria-label="Business days"
              value={workspace?.workWeek ?? "mon-fri"}
              onChange={(e) =>
                workspace &&
                void store.update("workspaces", workspace.id, {
                  workWeek: e.target.value,
                })
              }
            >
              <option value="mon-fri">Monday–Friday</option>
              <option value="sun-thu">Sunday–Thursday</option>
            </select>
          </div>
        </div>
      </section>
      <section className="feature-setting-section sla-automation-section">
        <div className="sla-automation-header"><div><h2>Automation rules</h2>
        <p>Use automation rules to automatically add or remove SLAs based on filters.</p></div><Button onClick={() => setEdit(true)}><Icon name="Plus" size={14} />Add rule</Button></div>
        {!!policies.length&&<p className="sla-order-help">The first matching rule applies. Drag rules to change their order.</p>}
        <div className="sla-policy-list">
          {policies.map((policy) => (
            <div
              key={policy.id}
              className="sla-policy"
              draggable
              onDragStart={(e) =>
                e.dataTransfer.setData("text/sla-rule", policy.id)
              }
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const id = e.dataTransfer.getData("text/sla-rule");
                const moved = policies.find((p) => p.id === id);
                if (!moved) return;
                const next = policies.filter((p) => p.id !== id);
                next.splice(
                  next.findIndex((p) => p.id === policy.id),
                  0,
                  moved,
                );
                next.forEach(
                  (p, index) =>
                    void store.update("slaPolicies", p.id, { position: index }),
                );
              }}
            >
              <Icon name="GripVertical" size={14} />
              <input
                type="checkbox"
                aria-label={`Enable ${policy.name}`}
                checked={policy.enabled !== false}
                onChange={(e) =>
                  void store.update("slaPolicies", policy.id, {
                    enabled: e.target.checked,
                  })
                }
              />
              <button className="sla-rule-open" onClick={() => setEdit(policy)}>
                <strong>{policy.name}</strong>
                <span>
                  {policy.action === "remove"
                    ? "Remove SLA"
                    : `${policy.duration ?? Math.round(Number(policy.durationMinutes) / 60)} ${units.find(([u]) => u === policy.durationUnit)?.[1]?.toLowerCase() ?? "hours"}`}
                </span>
              </button>
              <button
                className="icon-button"
                aria-label={`Delete ${policy.name}`}
                onClick={() => setDeleteId(policy.id)}
              >
                <Icon name="Trash2" size={14} />
              </button>
            </div>
          ))}
        </div>
        {!policies.length && (
          <div className="card">
            <p>
              Start with 24 hours for urgent issues and one week for high
              priority issues.
            </p>
            <Button onClick={initial}>Use default rules</Button>
          </div>
        )}
      </section>
      {edit && (
        <SlaRuleForm
          policy={edit === true ? undefined : edit}
          position={policies.length}
          onClose={() => setEdit(null)}
        />
      )}{" "}
      {deleteId && (
        <Modal title="Delete SLA rule?" onClose={() => setDeleteId("")}>
          <div className="modal-body">
            Existing deadlines remain on their issues.
          </div>
          <div className="modal-footer">
            <Button onClick={() => setDeleteId("")}>Cancel</Button>
            <Button
              variant="danger"
              onClick={async () => {
                await store.remove("slaPolicies", deleteId);
                setDeleteId("");
              }}
            >
              Delete rule
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function SlaRuleForm({
  policy,
  position,
  onClose,
}: {
  policy?: Entity;
  position: number;
  onClose: () => void;
}) {
  const store = useAppStore();
  const [name, setName] = useState(policy?.name ?? ""),
    [duration, setDuration] = useState(
      Number(policy?.duration) || Number(policy?.durationMinutes) / 60 || 24,
    ),
    [unit, setUnit] = useState(policy?.durationUnit ?? "hour"),
    [action, setAction] = useState(policy?.action ?? "apply");
  const [filter, setFilter] = useState<FilterSpec>(
    policy?.filter ?? { conditions: [], match: "all" },
  );
  return (
    <Modal
      title={policy ? "Edit SLA rule" : "New SLA rule"}
      wide
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const fields = {
            name:
              name.trim() ||
              `${action === "remove" ? "Remove" : "Apply"} SLA rule`,
            duration,
            durationUnit: unit,
            durationMinutes:
              duration *
              (unit === "hour" ? 60 : unit === "week" ? 10080 : 1440),
            action,
            filter,
            enabled: policy?.enabled !== false,
            position: policy?.position ?? position,
          };
          if (policy) await store.update("slaPolicies", policy.id, fields);
          else await store.create("slaPolicies", fields);
          onClose();
        }}
      >
        <div className="modal-body">
          <Field label="Rule description">
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Urgent customer issues"
            />
          </Field>
          <FilterBuilder value={filter} onChange={setFilter} additionalFields={[{field:"projectStatus",label:"Project status",options:projectStatuses(store.data)},{field:"initiativeIds",label:"Initiative",options:store.data.initiatives.filter(i=>!i.deletedAt&&!i.archivedAt).map(i=>({id:i.id,name:i.name}))}]} />
          <div className="sla-duration">
            <Field label="Action">
              <select
                className="input"
                value={action}
                onChange={(e) => setAction(e.target.value)}
              >
                <option value="apply">Apply SLA</option>
                <option value="remove">Remove SLA</option>
              </select>
            </Field>
            {action === "apply" && (
              <>
                <Field label="Duration">
                  <input
                    className="input"
                    required
                    type="number"
                    min="1"
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                  />
                </Field>
                <Field label="Unit">
                  <select
                    className="input"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                  >
                    {units.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">
            Save rule
          </Button>
        </div>
      </form>
    </Modal>
  );
}
