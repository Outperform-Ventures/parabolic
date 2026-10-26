export const composerFields = [
  ['customers', 'Customer', 'Building2'],
  ['statusId', 'Status', 'Circle'],
  ['priority', 'Priority', 'ChartNoAxesColumnIncreasing'],
  ['assigneeId', 'Assignee', 'User'],
  ['projectId', 'Project', 'Box'],
  ['milestoneId', 'Milestone', 'Diamond'],
  ['estimate', 'Estimate', 'Estimate'],
  ['labelIds', 'Labels', 'Tag'],
  ['cycleId', 'Cycle', 'Repeat'],
  ['dueDate', 'Due date', 'Calendar'],
  ['recurrence', 'Recurring', 'Repeat'],
] as const;
export type ComposerField = typeof composerFields[number][0];
export type ComposerFieldLayout = {order: ComposerField[]; hidden: ComposerField[]};
export const COMPOSER_LAYOUT_PREFERENCE = 'issueComposerFields';
const ids = composerFields.map(([id]) => id);
const valid = (value: unknown): value is ComposerField => ids.includes(value as ComposerField);
export function normalizeComposerFieldLayout(value: unknown): ComposerFieldLayout {
  const source = value && typeof value === 'object' ? value as Partial<ComposerFieldLayout> : {};
  return {
    order: [...new Set([...(Array.isArray(source.order) ? source.order.filter(valid) : []), ...ids])],
    hidden: [...new Set(Array.isArray(source.hidden) ? source.hidden.filter(valid) : ['cycleId', 'dueDate', 'recurrence'] as ComposerField[])],
  };
}
type ComposerContext = {
  customized: boolean; inline: boolean; expanded: boolean; projectId?: string;
  estimateDisabled: boolean; dueDate?: string; recurrence?: unknown;
};
export function composerLayoutForContext(layout: ComposerFieldLayout, context: ComposerContext): ComposerFieldLayout {
  if (context.customized) return layout;
  const hidden = new Set(layout.hidden);
  if (context.inline) for (const id of ['statusId', 'projectId', 'milestoneId'] as const) hidden.add(id);
  if (context.expanded) hidden.delete('cycleId');
  if (context.dueDate) hidden.delete('dueDate');
  if (context.recurrence) hidden.delete('recurrence');
  return {...layout, hidden: [...hidden]};
}
export function visibleComposerFields(layout: ComposerFieldLayout, context: ComposerContext) {
  layout = composerLayoutForContext(layout, context);
  return layout.order.filter(id => {
    if (id === 'milestoneId' && !context.projectId || id === 'estimate' && context.estimateDisabled) return false;
    return !layout.hidden.includes(id);
  });
}
