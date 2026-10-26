import {projectPropertyIndex,withProjectProperties,usesProjectProperties,projectLabelConditionEntity} from '../shared/project-property-filter';
import {customerAssignments,usesCustomerAssignments} from '../shared/customer-assignments';
import {matchCustomerValue} from '../shared/customer-quick-filter';
import {withIssueQuickFilter,usesIssueQuickFilter} from '../shared/issue-quick-filter';
import {resolveCurrentUserFilter} from '../shared/current-user-filter';
import { classifySla } from '../shared/sla-status';
import {comparePriority} from './priority-order';
import {expandFilterGroups,InvalidFilterGroup} from '../shared/filter-groups';
import {matchesStructuredFilter,UnsupportedStructuredFilter} from '../shared/structured-filter';
import {matchDateRange} from '../shared/date-filter-range';
import {resolveDateCondition,resolveCalendarFilter,type RelativeDateClock} from '../shared/relative-date-filter';
import {labelFilterTargets} from '../shared/label-filter-values';
import {cycleAddition} from '../shared/cycle-addition';
import {projectLabelIndex,withProjectLabels} from '../shared/project-label-filter';
import type { Entity } from "../shared/types";
export type Condition = { field: string; operator: string; value: any };
export type FilterSpec = { conditions: Condition[]; groups?:FilterSpec[]; match: "all" | "any" };
const projectIndexes = new WeakMap<Entity[], WeakMap<Entity[], Map<string,string[]>>>();
const mergeTargets = new WeakMap<Entity[], Map<string,string>>();
const labelIndexes = new WeakMap<Entity[], Map<string, string>>();
function labelIdentity(labels: Entity[]) {
  let index = labelIndexes.get(labels);
  if (!index) {
    index = new Map(labels.filter(label=>!label.deletedAt && label.name).map(label=>[
      label.id, JSON.stringify([label.entityType || 'issues', label.name.toLocaleLowerCase()]),
    ]));
    const targets = new Map<string,string>();
    for (const label of labels) {
      if (label.deletedAt || !index.has(label.id)) continue;
      for (const id of label.mergedLabelIds || []) if (typeof id === 'string' && !index.has(id)) {index.set(id, index.get(label.id)!);targets.set(id,label.id);}
    }
    mergeTargets.set(labels, targets);
    labelIndexes.set(labels, index);
  }
  return index;
}
export function resolveMergedLabelId(id: string, labels: Entity[]) {labelIdentity(labels);return mergeTargets.get(labels)?.get(id) ?? id;}
export function expandLabelFilter(spec: FilterSpec, labels: Entity[]):any {
  if(spec.groups?.length){const walk=(value:any):any=>Array.isArray(value?.conditions)?expandLabelFilter(value,labels):Object.fromEntries(Object.entries(value).map(([key,item])=>[key,Array.isArray(item)?item.map(walk):item]));return walk(expandFilterGroups(spec))}
  if (!spec.conditions.length) return spec;
  return {[spec.match === 'any' ? 'or' : 'and']: spec.conditions.map(condition=>{
    if (!['labelIds','labelId','projectLabelIds'].includes(condition.field) ||
      !['eq','is','equals','contains','includes','in','neq','isNot','notContains','none','all','notAll'].includes(condition.operator))
      return {conditions:[condition],match:'all'};
    const selected = Array.isArray(condition.value) ? condition.value : [condition.value];
    if (condition.operator === 'notAll') return {not:{and:selected.map(id=>({conditions:[{field:condition.field,operator:'in',value:labelFilterTargets(labels,id)}],match:'all'}))}};
    if (condition.operator === 'all') return {and:selected.map(id=>({conditions:[{field:condition.field,operator:'in',value:labelFilterTargets(labels,id)}],match:'all'}))};
    const ids = [...new Set(selected.flatMap(id=>labelFilterTargets(labels,id)))];
    if (!ids.length) return ['neq','isNot','notContains','none'].includes(condition.operator)?{conditions:[],match:'all'}:{conditions:[{field:condition.field,operator:'in',value:[]}],match:'all'};
    const negative = ['neq','isNot','notContains','none'].includes(condition.operator);
    return {conditions:ids.map(id=>({field:condition.field,operator:id===null&&condition.field==='labelIds'?(negative?'notEmpty':'empty'):negative?'neq':'eq',value:id})),match:negative?'all':'any'};
  })};
}
export function matchesCondition(
  entity: Entity,
  condition: Condition,
  labels?: Entity[],
  projects?: Entity[],
  cycles?: Entity[],
  dateClock?: RelativeDateClock,
): boolean {
  entity=projectLabelConditionEntity(entity,condition);
  const customerMatch=matchCustomerValue(entity,condition);if(customerMatch!==undefined)return customerMatch;
  if (condition.field === 'projectLabelIds' && projects && labels && !('projectLabelCount' in entity)) {
    let byLabels = projectIndexes.get(projects);
    if (!byLabels) {byLabels = new WeakMap();projectIndexes.set(projects,byLabels);}
    let index = byLabels.get(labels);
    if (!index) {index=projectLabelIndex(projects,labels);byLabels.set(labels,index);}
    entity=withProjectLabels(entity,index);
  }
  const raw =
    condition.field === "cycleAddition" && cycles ? cycleAddition(entity,cycles.find(c=>c.id===entity.cycleId)) : condition.field === "slaStatus"
      ? getSlaStatus(entity)
      : condition.field.split(".").reduce((o, k) => o?.[k], entity as any);
  const resolvedCondition=resolveDateCondition(condition,dateClock);
  const rangeMatch=matchDateRange(raw,resolvedCondition);if(rangeMatch!==undefined)return rangeMatch;
  const expected = resolvedCondition.value;
  const values = Array.isArray(raw) ? raw : [raw];
  if (labels && ['labelIds','labelId','projectLabelIds'].includes(condition.field)) {
    const selected = Array.isArray(expected) ? expected : [expected];
    const targets = new Set(selected.flatMap(id=>labelFilterTargets(labels,id)));
    const found = values.some(value=>targets.has(value));
    if (condition.operator === 'notAll') return !selected.every(id=>values.some(value=>labelFilterTargets(labels,id).includes(value)));
    if (condition.operator === 'all') return selected.every(id=>values.some(value=>labelFilterTargets(labels,id).includes(value)));
    if (['eq','is','equals','contains','includes','in'].includes(condition.operator)) return found;
    if (['neq','isNot','notContains','none'].includes(condition.operator)) return !found;
  }
  const equals = values.some(
    (x) =>
      String(x ?? "").toLowerCase() === String(expected ?? "").toLowerCase(),
  );
  switch (condition.operator) {
    case "eq":
    case "is":
    case "equals":
      return equals;
    case "neq":
    case "isNot":
      return !equals;
    case "contains":
    case "includes":
      return values.some((x) =>
        String(x ?? "")
          .toLowerCase()
          .includes(String(expected ?? "").toLowerCase()),
      );
    case "notContains":
      return !values.some((x) =>
        String(x ?? "")
          .toLowerCase()
          .includes(String(expected ?? "").toLowerCase()),
      );
    case "notAll":
      return Array.isArray(expected) && !expected.every(value=>values.includes(value));
    case "all":
      return Array.isArray(expected) && expected.every(value=>values.includes(value));
    case "none":
      return Array.isArray(expected) && !values.some(value=>expected.includes(value));
    case "in":
      return values.some((x) => expected?.includes(x??null));
    case "empty":
    case "isEmpty":
      return (
        raw === undefined ||
        raw === null ||
        raw === "" ||
        (Array.isArray(raw) && !raw.length)
      );
    case "notEmpty":
      return (
        raw !== undefined &&
        raw !== null &&
        raw !== "" &&
        (!Array.isArray(raw) || raw.length > 0)
      );
    case "before":
    case "lt":
      return raw != null && raw < expected;
    case "after":
    case "gt":
      return raw != null && raw > expected;
    case "gte":
      return raw != null && raw >= expected;
    case "lte":
      return raw != null && raw <= expected;
    default:
      return true;
  }
}
export function matchesFilter(entity:Entity,spec?:FilterSpec|Condition[]|Record<string,any>,labels?:Entity[],projects?:Entity[],cycles?:Entity[],clock?:RelativeDateClock,currentUserId?:string,issues?:Entity[],milestones?:Entity[]):boolean{
 if(projects&&usesCustomerAssignments(spec))entity={...entity,...customerAssignments(entity,projects)};
 if(projects&&usesProjectProperties(spec))entity=withProjectProperties(entity,projectPropertyIndex(projects,labels,milestones));
 try{return matchesFilterInternal(usesIssueQuickFilter(spec)?withIssueQuickFilter(entity,issues):entity,resolveCurrentUserFilter(spec,currentUserId),labels,projects,cycles,clock)}catch(error){if(error instanceof UnsupportedStructuredFilter||error instanceof InvalidFilterGroup)return false;throw error}
}
function matchesFilterInternal(
  entity: Entity,
  spec?: FilterSpec | Condition[] | Record<string, any>,
  labels?: Entity[],
  projects?: Entity[],
  cycles?: Entity[],
  dateClock?: RelativeDateClock,
): boolean {
  if (!spec) return true;
  if(!Array.isArray(spec)&&spec.groups!==undefined)spec=expandFilterGroups(spec) as Record<string,any>;
  dateClock={...dateClock,now:dateClock?.now??new Date()};
  if (Array.isArray(spec))
    return spec.every((c) => matchesCondition(entity, c, labels, projects, cycles, dateClock));
  if (Array.isArray(spec.conditions)) {
    return spec.match === "any"
      ? spec.conditions.length === 0 ||
          spec.conditions.some((c: Condition) => matchesCondition(entity, c, labels, projects, cycles, dateClock))
      : spec.conditions.every((c: Condition) => matchesCondition(entity, c, labels, projects, cycles, dateClock));
  }
  return matchesStructuredFilter(entity,resolveCalendarFilter(spec,dateClock),(child,filter)=>matchesFilterInternal(child,filter,labels,projects,cycles,dateClock));
}
export function textContent(html: string) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
const collator = new Intl.Collator(undefined, { numeric: true });
export function sortEntities(
  items: Entity[],
  field: string,
  direction: "asc" | "desc" = "asc",
) {
  const dateField = field.endsWith("At") || field.endsWith("Date");
  return [...items].sort((a, b) => {
    if(field==='priority')return comparePriority(a,b,direction);
    if (field === "dueDate" && (!a[field] || !b[field])) {
      return Number(!a[field]) - Number(!b[field]);
    }
    let left = a[field] ?? "",
      right = b[field] ?? "";
    if (field === "priority") {
      left = left || 5;
      right = right || 5;
    }
    const result =
      typeof left === "number" && typeof right === "number"
        ? left - right
        : dateField
          ? left < right
            ? -1
            : left > right
              ? 1
              : 0
          : collator.compare(String(left), String(right));
    return direction === "desc" ? -result : result;
  });
}
export function relativeDate(date?: string | null) {
  if (!date) return "";
  const dt = new Date(date);
  if (!Number.isFinite(dt.getTime())) return date;
  const diff = Date.now() - dt.getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`;
  if (diff < 7 * 86400000) return `${Math.round(diff / 86400000)}d ago`;
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function getSlaStatus(issue: Partial<Entity>, now = Date.now()) {
  return classifySla(issue, now) ?? 'none';
}
