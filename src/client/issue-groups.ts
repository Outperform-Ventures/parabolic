import {priorityPosition} from './priority-order';
import {isIssueLabelGroup,issueLabelsInGroup} from './issue-label-grouping';
import {myActivityGroupDate,myActivityGroupLabel} from './my-issues-state';
import {projectLabelIndex} from '../shared/project-label-filter';
import {displayNameFor} from './display-name';
import type { Entity, WorkspaceData } from "../shared/types";
import { getSlaStatus } from "./query";

export type IssueGroup = {
  id: string;
  name: string;
  color?: string;
  entity?: Entity;
  issues: Entity[];
};
const focusNames: Record<string, string> = {
  urgent: "Urgent",
  sla: "SLA",
  blockers: "Blocking others",
  cycle: "Current cycle",
  active: "Other active",
  triage: "Triage",
  backlog: "Backlog",
  completed: "Completed",
  canceled: "Canceled",
};
const priorityNames = ["No priority", "Urgent", "High", "Medium", "Low"];
const statusIdentity=(status:Entity)=>`${status.type??''}:${String(status.name??'').trim().toLocaleLowerCase()}`;
const slaNames: Record<string, string> = {
  none: "No SLA",
  lowRisk: "Low risk",
  mediumRisk: "Medium risk",
  highRisk: "High risk",
  breached: "Breached",
  achieved: "Achieved",
  failed: "Failed",
  paused: "Paused",
};
const kinds: Record<string, keyof WorkspaceData> = {
  statusId: "statuses",
  assigneeId: "users",
  projectId: "projects",
  cycleId: "cycles",
  parentId: "issues",
  labelIds: "labels",
  projectLabelIds: "labels",
  teamId: "teams",
  customerId: "customers",
  milestoneId: "milestones",
};

export function groupIssues(
  issues: Entity[],
  field: string,
  data: WorkspaceData,
  teamId?: string,
  showEmpty = false,
  groupOrder: string[] = [],
): IssueGroup[] {
  if(isIssueLabelGroup(field)){
    const labels=issueLabelsInGroup(field,data),ids=new Set(labels.map(l=>l.id)),originals=new Map(issues.map(i=>[i.id,i]));
    return groupIssues(issues.map(i=>({...i,labelIds:(i.labelIds||[]).filter((id:string)=>ids.has(id))})),'labelIds',{...data,labels},teamId,showEmpty,groupOrder).map(group=>({...group,issues:group.issues.map(i=>originals.get(i.id)!)}));
  }
  const groups = new Map<string, IssueGroup>();
  const availableStatuses = [
    ...new Map(
      [
        ...data.statuses,
        ...issues.flatMap((issue) => issue.sharedStatuses ?? []),
      ].map((status) => [status.id, status]),
    ).values(),
  ];
  const entities = [
    ...((field === "statusId"
      ? availableStatuses
      : (data[kinds[field]] ?? [])) as Entity[]),
  ];
  if (field === 'labelIds' || field === 'projectLabelIds') {
    const expected=field==='projectLabelIds'?'projects':'issues';
    for(let i=entities.length-1;i>=0;i--)if(entities[i].deletedAt||(entities[i].entityType||'issues')!==expected)entities.splice(i,1);
  }
  const upstream=field==='projectLabelIds'?projectLabelIndex(data.projects,data.labels):null;
  if (field === "statusId")
    entities.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const lookup = new Map(entities.map((e) => [e.id, e]));
  const statusGroups=new Map<string,string>(),canonicalStatusIds=new Map<string,string>();
  if(field==='statusId'&&!teamId)for(const status of entities){if(status.deletedAt)continue;const identity=statusIdentity(status),id=statusGroups.get(identity)??status.id;statusGroups.set(identity,id);canonicalStatusIds.set(status.id,id);}
  const groupId=(id:string)=>canonicalStatusIds.get(id)??id;
  const states = new Map(availableStatuses.map((s) => [s.id, s.type]));
  const blocked = new Set<string>();
  const openIssues=new Map(data.issues.filter(issue=>!issue.deletedAt&&!issue.archivedAt&&!['completed','canceled','duplicate'].includes(states.get(issue.statusId)??'')).map(issue=>[issue.id,issue]));
  if (field === "focus")
    for (const issue of openIssues.values())
      for (const relation of issue.relations ?? []) {
        if (relation.type === "blockedBy"&&openIssues.has(relation.issueId)) blocked.add(relation.issueId);
        if (relation.type === "blocks"&&openIssues.has(relation.issueId)) blocked.add(issue.id);
      }
  const currentCycles = new Set(
    data.cycles
      .filter(
        (c) =>
          !c.deletedAt&&!c.archivedAt&&
          Date.parse(c.startDate) <= Date.now() &&
          Date.parse(c.endDate) > Date.now(),
      )
      .map((c) => c.id),
  );
  const add = (id: string) => {
    id=groupId(id);
    if (groups.has(id)) return;
    const entity = lookup.get(id);
    groups.set(id, {
      id,
      name:
        field === "none"
          ? "All issues"
          : field === "focus"
            ? focusNames[id]
            : field === "priority"
              ? (priorityNames[Number(id)] ?? "No priority")
              : field === "slaStatus"
                ? slaNames[id]
                : field === "activityAt"
                  ? myActivityGroupLabel(id)
                  : (field==='assigneeId'&&entity?displayNameFor(entity,data):entity?.name ??
                    entity?.title ??
                    `No ${field
                      .replace(/Ids?$/, "")
                      .replace(/([A-Z])/g, " $1")
                      .toLowerCase()}`),
      color: entity?.color,
      entity,
      issues: [],
    });
  };
  if (showEmpty && kinds[field])
    for (const entity of entities.filter(
      (e) =>
        !e.deletedAt &&
        !e.archivedAt &&
        (!teamId || !e.teamId || e.teamId === teamId),
    ))
      add(entity.id);
  if (showEmpty && field === "priority")
    for (const id of ["1", "2", "3", "4", "0"]) add(id);
  if(showEmpty && field==='projectLabelIds')add("none");
  for (const issue of issues) {
    let values: string[];
    if (field === "focus") {
      const type = states.get(issue.statusId);
      values = [
        type === "completed"
          ? "completed"
          : type === "canceled"||type === "duplicate"
            ? "canceled"
            : issue.priority === 1
              ? "urgent"
              : issue.slaDueAt
                ? "sla"
                : blocked.has(issue.id)
                  ? "blockers"
                  : currentCycles.has(issue.cycleId)
                    ? "cycle"
                    : ["started", "unstarted"].includes(type)
                      ? "active"
                      : type === "triage"
                        ? "triage"
                        : "backlog",
      ];
    } else if (field === "slaStatus") values = [getSlaStatus(issue)];
    else if (field === "activityAt")
      values = [myActivityGroupDate(String(issue.activityAt ?? issue.updatedAt))];
    else if (field === "none") values = ["all"];
    else if (field === "projectLabelIds") {const ids=upstream!.get(issue.projectId)||[];values=ids.length?ids:["none"];}
    else if (field === "labelIds")
      values = issue.labelIds?.length ? issue.labelIds : ["none"];
    else values = [String(issue[field] ?? "none")];
    for (const id of values) {
      add(id);
      groups.get(groupId(id))!.issues.push(issue);
    }
  }
  let result = [...groups.values()];
  if (field === "focus") {
    const order = Object.keys(focusNames);
    result.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    for (const group of result)
      group.issues.sort(
        (a, b) =>
          (a.priority || 5) - (b.priority || 5) ||
          (states.get(a.statusId) === "started" ? -1 : 0) -
            (states.get(b.statusId) === "started" ? -1 : 0) || priorityPosition(a)-priorityPosition(b),
      );
  }
  if (field === "activityAt") result.sort((a, b) => b.id.localeCompare(a.id));
  if (field === "priority")
    result.sort((a, b) => (Number(a.id) || 5) - (Number(b.id) || 5));
  if (field === "statusId")
    result.sort(
      (a, b) =>
        (a.entity?.position ?? Number.MAX_SAFE_INTEGER) -
        (b.entity?.position ?? Number.MAX_SAFE_INTEGER),
    );
  if (field === "projectId" && !groupOrder.length)
    result.sort((a, b) =>
      a.id === "none"
        ? 1
        : b.id === "none"
          ? -1
          : a.name.localeCompare(b.name),
    );
  if(groupOrder.length){
    const rank=new Map(groupOrder.map((id,index)=>[groupId(id),index]));
    const position=(group:IssueGroup)=>rank.get(group.id)??rank.get(group.name)??Infinity;
    result.sort((a,b)=>position(a)-position(b));
  }
  return result;
}

export function issueGroupPatch(
  field: string,
  id: string,
  data: WorkspaceData,
  issue?: Entity,
  sourceGroup?: string,
): Record<string, any> {
  if(isIssueLabelGroup(field)){
    const members=issueLabelsInGroup(field,data),ids=new Set(members.map(l=>l.id));
    const selected=members.find(l=>l.id===id);
    return {...(!issue&&selected?.teamId?{teamId:selected.teamId}:{}),labelIds:[...(issue?.labelIds||[]).filter((value:string)=>!ids.has(value)),...(id!=='none'&&ids.has(id)?[id]:[])]};
  }
  if (["none", "focus", "slaStatus", "activityAt", "projectLabelIds"].includes(field)) return {};
  if (field === "priority") return { priority: id === "none" ? 0 : Number(id) };
  if(field==='statusId'&&issue&&id!=='none'){
    const target=data.statuses.find(status=>status.id===id&&!status.deletedAt);
    if(target&&target.teamId!==issue.teamId){const equivalent=data.statuses.find(status=>!status.deletedAt&&!status.archivedAt&&status.teamId===issue.teamId&&statusIdentity(status)===statusIdentity(target));return equivalent?{statusId:equivalent.id}:{};}
  }
  if (field === "labelIds") {
    const selected = data.labels.find((l) => l.id === id);
    return {
      labelIds:
        id === "none"
          ? []
          : [
              ...(issue?.labelIds ?? []).filter(
                (value: string) =>
                  value !== id &&
                  value !== sourceGroup &&
                  (!selected?.group ||
                    !data.labels.some(
                      (l) =>
                        l.id === value &&
                        l.group === selected.group &&
                        l.teamId === selected.teamId,
                    )),
              ),
              id,
            ],
    };
  }
  if (field === "teamId" && id !== "none" && issue) {
    const status = data.statuses.find((s) => s.id === issue.statusId);
    const statuses = data.statuses.filter(
      (s) => s.teamId === id && !s.deletedAt,
    );
    return {
      teamId: id,
      statusId: (
        statuses.find((s) => s.type === status?.type) ??
        statuses.find((s) => s.type === "unstarted") ??
        statuses[0]
      )?.id,
      cycleId: null,
      labelIds: (issue.labelIds ?? []).filter((value: string) =>
        data.labels.some(
          (l) => l.id === value && (!l.teamId || l.teamId === id),
        ),
      ),
    };
  }
  return { [field]: id === "none" ? null : id };
}

export type IssueGroupPath = { field: string; id: string }[];
export type NestedIssueGroup = IssueGroup & {
  key: string;
  path: IssueGroupPath;
  subgroups?: NestedIssueGroup[];
};
export type IssueSwimlane = IssueGroup & {
  cells: Map<string, NestedIssueGroup>;
};
export const groupPathKey = (path: IssueGroupPath) =>
  JSON.stringify(path.map((item) => [item.field, item.id]));

/** Build each property index once; avoid rescanning all issues for every cell. */
export function nestIssueGroups(
  issues: Entity[],
  field: string,
  secondary: string,
  data: WorkspaceData,
  teamId?: string,
  showEmpty = false,
  groupOrder: string[] = [],
) {
  const columns: NestedIssueGroup[] = groupIssues(
    issues,
    field,
    data,
    teamId,
    showEmpty,
    groupOrder,
  ).map((group) => ({
    ...group,
    key: group.id,
    path: [{ field, id: group.id }],
  }));
  if (!secondary || secondary === "none" || secondary === field)
    return { columns, rows: [] as IssueSwimlane[] };
  const rows: IssueSwimlane[] = groupIssues(
    issues,
    secondary,
    data,
    teamId,
    showEmpty,
  ).map((group) => ({ ...group, cells: new Map() }));
  const memberships = new Map<string, IssueSwimlane[]>();
  for (const row of rows)
    for (const issue of row.issues) {
      const values = memberships.get(issue.id) || [];
      values.push(row);
      memberships.set(issue.id, values);
    }
  for (const column of columns) {
    for (const issue of column.issues)
      for (const row of memberships.get(issue.id) || []) {
        let cell = row.cells.get(column.id);
        if (!cell) {
          const path = [...column.path, { field: secondary, id: row.id }];
          cell = { ...row, issues: [], path, key: groupPathKey(path) };
          row.cells.set(column.id, cell);
        }
        cell.issues.push(issue);
      }
    column.subgroups = rows.flatMap((row) => {
      const cell = row.cells.get(column.id);
      return cell ? [cell] : [];
    });
  }
  return { columns, rows };
}
export function issueGroupPathPatch(
  group: Pick<NestedIssueGroup, "path">,
  data: WorkspaceData,
  issue?: Entity,
  source: IssueGroupPath = [],
) {
  const result: Record<string, any> = {};
  let next = issue;
  for (const item of group.path) {
    const patch = issueGroupPatch(
      item.field,
      item.id,
      data,
      next,
      source.find((value) => value.field === item.field)?.id,
    );
    Object.assign(result, patch);
    next = { ...next, ...patch } as Entity;
  }
  return result;
}

function labelPathError(path:IssueGroupPath,issue:Entity,data:WorkspaceData,projected:Entity):string|null{
  for(const target of path.filter(item=>item.field==='labelIds'||isIssueLabelGroup(item.field))){
    if(target.id!=='none'){
      if(isIssueLabelGroup(target.field)&&!issueLabelsInGroup(target.field,data).some(l=>l.id===target.id))return 'This label is no longer available in the selected label group.';
      const label=data.labels.find(l=>l.id===target.id&&!l.deletedAt&&!l.isGroup&&(l.entityType||'issues')==='issues');
      if(!label)return 'This label is no longer available.';
      if(label.archivedAt&&!(issue.labelIds||[]).includes(label.id))return 'Archived labels cannot be assigned to new issues. Unarchive the label first.';
      if(label.teamId&&label.teamId!==projected.teamId)return 'This label belongs to another team.';
    }
    if(!groupIssues([projected],target.field,data).some(g=>g.id===target.id))return 'These label groups require conflicting labels. Choose a compatible group.';
  }
  return null;
}

/** Derived project labels cannot be changed by writing an issue property. */
export function acceptsIssueGroupPath(path: IssueGroupPath, issue: Entity, data: WorkspaceData) {
  const derived=new Set(['focus','slaStatus','activityAt','projectLabelIds']);
  const projected={...issue,...issueGroupPathPatch({path:path.filter(item=>!derived.has(item.field))},data,issue)};
  if(labelPathError(path,issue,data,projected))return false;
  for(const item of path.filter(item=>item.field==='statusId'&&item.id!=='none')){const requested=data.statuses.find(status=>status.id===item.id),actual=data.statuses.find(status=>status.id===projected.statusId);if(!requested||!actual||statusIdentity(requested)!==statusIdentity(actual))return false;}
  if(projected.statusId&&data.statuses.find(status=>status.id===projected.statusId)?.teamId!==projected.teamId)return false;
  return path.filter(item=>derived.has(item.field)).every(item=>groupIssues([projected],item.field,data).some(group=>group.id===item.id));
}

/** A historical label bucket is navigable, but cannot seed a retired label on new work. */
export function issueGroupCreationDefaults(group: Pick<NestedIssueGroup, 'path'>, data: WorkspaceData) {
  const defaults = issueGroupPathPatch(group, data);
  if (Array.isArray(defaults.labelIds)) {
    defaults.labelIds = defaults.labelIds.filter((id: string) => data.labels.some(label =>
      label.id === id && !label.deletedAt && !label.archivedAt && (label.entityType || 'issues') === 'issues'));
    defaults.teamId??=data.labels.find(label=>defaults.labelIds.includes(label.id)&&label.teamId)?.teamId;
    if(defaults.teamId===undefined)delete defaults.teamId;
    else defaults.labelIds=defaults.labelIds.filter((id:string)=>{const label=data.labels.find(l=>l.id===id);return !label?.teamId||label.teamId===defaults.teamId});
  }
  return defaults;
}

export function issueGroupMoveError(path: IssueGroupPath, issue: Entity, data: WorkspaceData, multiple=false): string | null {
 if(acceptsIssueGroupPath(path,issue,data))return null;
 const projected={...issue,...issueGroupPathPatch({path:path.filter(item=>!['focus','slaStatus','activityAt','projectLabelIds'].includes(item.field))},data,issue)};
 if(projected.statusId&&data.statuses.find(status=>status.id===projected.statusId)?.teamId!==projected.teamId)return 'Status belongs to another team';
 const labelError=labelPathError(path,issue,data,projected);if(labelError)return labelError;
 if(path.some(item=>['focus','slaStatus','activityAt'].includes(item.field)))return 'This group is calculated from issue activity or properties. Change those properties to move the issue.';
 return multiple?'Change the parent project’s labels to move these issues into that group.':'Change the parent project’s labels to move this issue into that group.';
}
