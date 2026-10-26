export type IssueColumnDefinition = readonly [id: string, label: string];

export type IssueColumnWidths = Record<string, number>;
export type IssueColumnSettings = { properties: string[]; columnOrder?: string[]; columnWidths?: IssueColumnWidths };

const defaultWidths: IssueColumnWidths = { priority: 88, identifier: 104, statusId: 88, title: 260, labelIds: 128, projectId: 176, dueDate: 112, slaStatus: 88, estimate: 80, effectiveCustomerIds: 192, assigneeId: 88, createdAt: 96, activityAt: 156 };
export const issueColumnDefaultWidth = (id: string) => defaultWidths[id] ?? 144;
export const issueColumnMinWidth = (id: string) => ['priority', 'statusId', 'assigneeId'].includes(id) ? 32 : id === 'estimate' ? 40 : id === 'title' ? 80 : 64;
export const ISSUE_COLUMN_MAX_WIDTH = 1600;
export const clampIssueColumnWidth = (id: string, width: number) => Math.max(issueColumnMinWidth(id), Math.min(ISSUE_COLUMN_MAX_WIDTH, Math.round(width)));

/** Saved widths are pixels, not arbitrary CSS. Retain hidden/custom field widths. */
export function normalizeIssueColumnWidths(value: unknown): IssueColumnWidths {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const known = new Set(issueColumnDefinitions([]).map(([id]) => id));
  return Object.fromEntries(Object.entries(value).filter(([id, width]) =>
    (known.has(id) || (id.startsWith('customFields.') && id.length > 13)) && typeof width === 'number' && Number.isFinite(width) && width > 0,
  ).sort(([a], [b]) => a.localeCompare(b)).map(([id, width]) => [id, clampIssueColumnWidth(id, width as number)]));
}

export function issueColumnGrid(visible: string[], widths: IssueColumnWidths) {
  const customized = Object.keys(widths).length > 0;
  const width = (id: string) => widths[id] ?? issueColumnDefaultWidth(id);
  return {
    tracks: ['18px', ...visible.map(id => id === 'title' && !customized ? `minmax(${width(id)}px, 1fr)` : `${width(id)}px`)].join(' '),
    // 16px left + 26px right, an 18px selection gutter, and 8px between cells.
    minWidth: 60 + visible.reduce((sum, id) => sum + width(id) + 8, 0),
  };
}

/** Compare effective column order, not whether an old view had an order array. */
export function issueColumnSettingsFingerprint(settings: IssueColumnSettings): string {
  const custom = [...new Set([...(settings.columnOrder || []), ...settings.properties].filter(id => id.startsWith('customFields.')))];
  const defaults = issueColumnDefinitions(settings.properties, custom.map(id => [id, id])).map(([id]) => id);
  return JSON.stringify([normalizeIssueColumnOrder(settings.columnOrder, defaults), [...new Set(settings.properties)].sort(), normalizeIssueColumnWidths(settings.columnWidths)]);
}

/** Persist only columns; filters, grouping, sorting and other view metadata stay intact. */
export function withSavedIssueColumns(display: Record<string, unknown> | undefined, columns: IssueColumnSettings): Record<string, unknown> {
  return { ...display, properties: [...columns.properties], columnOrder: [...(columns.columnOrder || [])], columnWidths: normalizeIssueColumnWidths(columns.columnWidths) };
}

const visibilityMarkers: Record<string, string> = {
  title: 'hideTitle', estimate: 'hideEstimate', effectiveCustomerIds: 'hideCustomers',
};

export function isIssueColumnVisible(field: string, properties: string[], projectScoped = false): boolean {
  if (visibilityMarkers[field] && properties.includes(visibilityMarkers[field])) return false;
  if (field === 'title' || field === 'effectiveCustomerIds' || (field === 'estimate' && projectScoped)) return true;
  return properties.includes(field);
}

/** One visibility model for the column panel and the existing Display menu. */
export function setIssueColumnVisible(properties: string[], field: string, visible: boolean): string[] {
  const marker = visibilityMarkers[field];
  const next = properties.filter(value => value !== field && value !== marker);
  if (visible && field !== 'title') next.push(field);
  if (!visible && marker) next.push(marker);
  return next;
}

/** Keep this in the same order as the ordinary, headerless issue row. */
export function issueColumnDefinitions(properties: string[], custom: IssueColumnDefinition[] = []): IssueColumnDefinition[] {
  const extra = ['startDate', 'duration', 'timeEstimate', 'timeLogged', 'taskType', 'completedAt'];
  const labels: Record<string, string> = { startDate: 'Start date', duration: 'Duration', timeEstimate: 'Time estimate', timeLogged: 'Time logged', taskType: 'Task type', completedAt: 'Completed' };
  const extras = [...new Set([...properties.filter(field => extra.includes(field) || field.startsWith('customFields.')), ...extra, ...custom.map(([field]) => field)])];
  return [
    ['priority', 'Priority'], ['identifier', 'Issue ID'], ['statusId', 'Status'], ['title', 'Issue title'],
    ['labelIds', 'Labels'], ['projectId', 'Project'], ['dueDate', 'Due date'], ['slaStatus', 'SLA'],
    ['estimate', 'Effort'], ['effectiveCustomerIds', 'Customers'],
    ...extras.map(field => [field, labels[field] || custom.find(([id]) => id === field)?.[1] || field.slice(13)] as const),
    ['cycleId', 'Cycle'], ['milestoneId', 'Milestone'], ['links', 'Links'],
    ['customerCount', 'Request customers'], ['customerRevenue', 'Customer revenue'],
    ['timeInStatus', 'Time in status'], ['updatedAt', 'Updated'], ['assigneeId', 'Owner'],
    ['activityAt', 'My activity date'], ['createdAt', 'Created'],
  ];
}

/** Old displays need no migration; new/temporarily hidden fields retain a slot. */
export function normalizeIssueColumnOrder(saved: unknown, defaults: readonly string[]): string[] {
  const valid = new Set(defaults);
  return [...new Set([...(Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string' && valid.has(id)) : []), ...defaults])];
}

export function moveIssueColumn(order: readonly string[], source: string, target: string, edge: 'before' | 'after'): string[] {
  if (source === target || !order.includes(source) || !order.includes(target)) return [...order];
  const next = order.filter(id => id !== source);
  next.splice(next.indexOf(target) + (edge === 'after' ? 1 : 0), 0, source);
  return next;
}
