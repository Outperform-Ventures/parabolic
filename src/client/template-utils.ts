import {templateLabelDefaults} from '../shared/template-labels';
import type { Entity, WorkspaceData } from "../shared/types";
import {initialWorkflowStatus,isWorkflowTeamMember} from './issue-workflow';

export interface TemplateField {
  id: string;
  label: string;
  description?: string;
  type:
    | "text"
    | "textarea"
    | "select"
    | "checkboxes"
    | "checkbox"
    | "number"
    | "date"
    | "file"
    | "instructions"
    | "property";
  required?: boolean;
  options?: (string|{value?:string|number;id?:string;label:string})[];
  property?: string;
  group?: string;
}
export function issueTemplates(
  data: WorkspaceData,
  teamId?: string,
  parentId?: string,
) {
  const teams = new Set<string>();
  let team = data.teams.find((t) => t.id === teamId);
  while (team && !teams.has(team.id)) {
    teams.add(team.id);
    team = data.teams.find((t) => t.id === team!.parentId);
  }
  return data.templates.filter(
    (t) =>
      !t.deletedAt &&
      !t.archivedAt &&
      (!t.type || t.type === "issue") &&
      (!t.teamId || teams.has(t.teamId)) &&
      (!parentId || !t.subIssues?.length),
  );
}
export function templateFields(template: Entity, base: Record<string, any>, labels:Entity[] = []) {
  return {
    ...base,
    ...templateLabelDefaults(template.properties||{},id=>labels.find(label=>label.id===id)),
    teamId: base.teamId,
    title: template.title ?? template.properties?.title ?? base.title,
    description:
      template.description ??
      template.properties?.description ??
      base.description,
    templateId: template.id,
    templateAnswers: {},
  };
}
export function initialIssueFields(
  defaults: Record<string, any>,
  data: WorkspaceData,
  userId?: string,
) {
  const parent = defaults.parentId
    ? data.issues.find((i) => i.id === defaults.parentId)
    : undefined;
  const teamId = defaults.teamId ?? parent?.teamId ?? data.teams[0]?.id,
    team = data.teams.find((t) => t.id === teamId);
  const member = isWorkflowTeamMember(data,teamId,userId);
  const templateId =
    defaults.templateId === undefined
      ? member
        ? team?.defaultTemplateId
        : team?.nonMemberDefaultTemplateId
      : defaults.templateId;
  const template =
    !defaults.__draftId &&
    (issueTemplates(data, teamId, defaults.parentId).find(
      (t) => t.id === templateId,
    ) ??
      defaults.__template);
  const base = {
    teamId,
    title: "",
    description: "",
    statusId: initialWorkflowStatus(data,teamId,userId)?.id,
    priority: 0,
    labelIds: [],
    ...(parent
      ? {
          priority: parent.priority ?? 0,
          projectId: parent.projectId ?? null,
          cycleId: teamId === parent.teamId ? parent.cycleId ?? null : null,
          assigneeId:
            parent.assigneeId &&
            (parent.assigneeId === userId ||
              data.issues
                .filter((i) => !i.deletedAt && i.parentId === parent.id)
                .every((i) => i.assigneeId === parent.assigneeId))
              ? parent.assigneeId
              : null,
        }
      : {}),
  };
  const fields = {
    ...(template ? templateFields(template, base, data.labels) : base),
    ...defaults,
    teamId,
  };
  if (
    parent &&
    fields.cycleId &&
    ["triage", "backlog", "completed", "canceled", "duplicate"].includes(
      data.statuses.find((s) => s.id === fields.statusId)?.type,
    )
  )
    fields.cycleId = null;
  return fields;
}
export function incompleteTemplateFields(
  template: Entity | undefined,
  fields: Record<string, any>,
  labels?: Entity[],
) {
  return ((template?.formFields ?? []) as TemplateField[])
    .filter((f) => {
      let value = f.property
        ? fields[f.property]
        : fields.templateAnswers?.[f.id];
      if(f.property==='labelIds'&&f.group&&labels&&Array.isArray(value))value=value.filter(id=>labels.some(label=>label.id===id&&label.group===f.group&&!label.deletedAt&&!label.archivedAt));
      if(f.type==='file'&&Array.isArray(value)&&value.some(v=>typeof v!=='string'))return true;
      if (!f.required || f.type === "instructions") return false;
      return (
        value == null || (typeof value === "string" && !value.trim()) || (f.type==='checkbox'&&value!==true) || (Array.isArray(value) && !value.length)
      );
    });
}

export function missingTemplateFields(template:Entity|undefined,fields:Record<string,any>,labels?:Entity[]){return incompleteTemplateFields(template,fields,labels).map(field=>field.label);}
