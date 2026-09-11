import React, { useState } from "react";
import { useActions, Progress, type Row } from "./shared";
import { displayNameFor } from "../display-name";
import { issueEffort } from "../../shared/estimates";

const breakdowns = [
  "Assignees",
  "Labels",
  "Priority",
  "Projects",
  "Teams",
] as const;
type Breakdown = (typeof breakdowns)[number];
type Group = {
  id: string;
  name: string;
  total: number;
  done: number;
  started: number;
};

export function CycleAssignees({
  issues,
  team,
  selected,
  onSelect,
}: {
  issues: Row[];
  team?: Row;
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const { data } = useActions();
  const [breakdown, setBreakdown] = useState<Breakdown>("Assignees");
  const points = team?.estimateScale !== "None";
  const statuses = new Map(
    data.statuses.map((status) => [status.id, status.type]),
  );
  const priorities: Record<string, string> = {
    "0": "No priority",
    "1": "Urgent",
    "2": "High",
    "3": "Medium",
    "4": "Low",
  };
  const definitions =
    breakdown === "Labels"
      ? data.labels
      : breakdown === "Projects"
        ? data.projects
        : breakdown === "Teams"
          ? data.teams
          : [];
  const names = new Map(definitions.map((row) => [row.id, row.name]));
  const groups = new Map<string, Group>();
  const groupIds = (issue: Row) =>
    breakdown === "Assignees"
      ? [issue.assigneeId || ""]
      : breakdown === "Labels"
        ? issue.labelIds?.length
          ? issue.labelIds
          : [""]
        : breakdown === "Priority"
          ? [String(issue.priority || 0)]
          : breakdown === "Projects"
            ? [issue.projectId || ""]
            : [issue.teamId || ""];
  const groupName = (id: string) =>
    breakdown === "Assignees"
      ? id
        ? displayNameFor(
            data.users.find((user) => user.id === id),
            data,
            "Member",
          )
        : "No assignee"
      : breakdown === "Priority"
        ? priorities[id] || "No priority"
        : names.get(id) || `No ${breakdown.slice(0, -1).toLowerCase()}`;
  for (const issue of issues)
    for (const id of groupIds(issue)) {
      const row = groups.get(id) || {
        id,
        name: groupName(id),
        total: 0,
        done: 0,
        started: 0,
      };
      const weight = points ? issueEffort(issue, team) : 1;
      row.total += weight;
      if (statuses.get(issue.statusId) === "completed") row.done += weight;
      if (statuses.get(issue.statusId) === "started") row.started += weight;
      groups.set(id, row);
    }
  const rows = [...groups.values()].sort(
    (a, b) => b.total - a.total || a.name.localeCompare(b.name),
  );
  return (
    <section aria-label="Cycle work breakdown" className="cycle-assignees">
      <div role="tablist" aria-label="Cycle statistics breakdown">
        {breakdowns.map((item) => (
          <button
            type="button"
            role="tab"
            aria-selected={breakdown === item}
            key={item}
            onClick={() => setBreakdown(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-label={breakdown}>
        {rows.map((row) =>
          breakdown === "Assignees" ? (
            <button
              type="button"
              key={row.id}
              aria-label={"Filter cycle by " + row.name}
              aria-pressed={selected === row.id}
              onClick={() => onSelect(selected === row.id ? null : row.id)}
            >
              <span>{row.name}</span>
              <span>
                {row.total} {points ? "points" : "issues"}
              </span>
              <Progress value={row.total ? (row.done / row.total) * 100 : 0} />
              <small>
                {row.done} completed · {row.started} started
              </small>
            </button>
          ) : (
            <div className="cycle-breakdown-row" key={row.id}>
              <span>{row.name}</span>
              <span>
                {row.total} {points ? "points" : "issues"}
              </span>
            </div>
          ),
        )}
      </div>
      {breakdown === "Assignees" && selected !== null && (
        <button
          type="button"
          className="text-button"
          onClick={() => onSelect(null)}
        >
          Clear assignee filter
        </button>
      )}
    </section>
  );
}
