import type {Entity,WorkspaceData} from "../shared/types";
import {issueTemplates} from "./template-utils";
export const matchIssueLinkRecord = (items: Entity[], value: string | null) =>
  value
    ? items.find((item) =>
        [
          item.id,
          item.name,
          item.key,
          item.identifier,
          item.number,
          item.name?.split(" ")[0],
        ].some(
          (name) => String(name ?? "").toLowerCase() === value.toLowerCase(),
        ),
      )
    : undefined;
export function issueDefaultsFromLink(
  params: URLSearchParams,
  data: WorkspaceData,
  teamKey?: string,
) {
  const team =
    matchIssueLinkRecord(data.teams.filter(team=>!team.deletedAt&&!team.archivedAt), teamKey ?? params.get("team")) ?? data.teams.find(team=>!team.deletedAt&&!team.archivedAt);
  const template = matchIssueLinkRecord(issueTemplates(data,team?.id), params.get("template"));
  const defaults: Record<string, any> = {
    ...(template ? { templateId: template.id } : {}),
    ...template?.properties,
    teamId: team?.id,
    ...(template?.description ? { description: template.description } : {}),
  };
  const project = matchIssueLinkRecord(
    data.projects.filter(
      (p) => !team || p.teamId === team.id || p.teamIds?.includes(team.id),
    ),
    params.get("project"),
  );
  for (const field of ["title", "description"])
    if (params.has(field)) defaults[field] = params.get(field);
  const status = matchIssueLinkRecord(
    data.statuses.filter((s) => s.teamId === team?.id),
    params.get("status"),
  );
  if (status) defaults.statusId = status.id;
  const assignee = matchIssueLinkRecord(data.users, params.get("assignee"));
  if (assignee) defaults.assigneeId = assignee.id;
  const priority = params.get("priority");
  if (
    priority &&
    ["none", "urgent", "high", "medium", "low"].includes(priority.toLowerCase())
  )
    defaults.priority = ["none", "urgent", "high", "medium", "low"].indexOf(
      priority.toLowerCase(),
    );
  if (
    params.has("estimate") &&
    Number.isFinite(Number(params.get("estimate"))) &&
    Number(params.get("estimate")) >= 0
  )
    defaults.estimate = Number(params.get("estimate"));
  const cycle = matchIssueLinkRecord(
    data.cycles.filter((c) => c.teamId === team?.id),
    params.get("cycle"),
  );
  if (cycle) defaults.cycleId = cycle.id;
  if (project) {
    defaults.projectId = project.id;
    const milestone = matchIssueLinkRecord(
      data.milestones.filter((m) => m.projectId === project.id),
      params.get("projectMilestone"),
    );
    if (milestone) defaults.milestoneId = milestone.id;
  }
  const labelTeamIds=new Set<string>();let labelTeam=team;while(labelTeam&&!labelTeamIds.has(labelTeam.id)){labelTeamIds.add(labelTeam.id);labelTeam=data.teams.find(item=>item.id===(labelTeam!.parentId||labelTeam!.parentTeamId));}
  const labels = (params.get("labels") ?? params.get("label"))
    ?.split(",")
    .map((label) => matchIssueLinkRecord(data.labels.filter(item=>!item.deletedAt&&!item.archivedAt&&(!item.teamId||labelTeamIds.has(item.teamId))), label.trim())?.id)
    .filter(Boolean);
  if (labels?.length) defaults.labelIds = labels;
  return defaults;
}
