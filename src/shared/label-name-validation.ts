export const reservedIssueLabelNames = ['assignee','cycle','effort','estimate','hours','priority','project','state','status'] as const;
const reserved = new Set<string>(reservedIssueLabelNames);
const normalized = (value: unknown) => typeof value === 'string' ? value.trim().toLowerCase() : '';
/** Historical labels remain editable; new names and project-to-issue conversions are validated. */
export function issueLabelNameError(next: Record<string,any>, previous?: Record<string,any>): string | null {
  if ((next.entityType ?? 'issues') !== 'issues' || !reserved.has(normalized(next.name))) return null;
  if (previous && (previous.entityType ?? 'issues') === 'issues' && normalized(previous.name) === normalized(next.name)) return null;
  return `“${String(next.name).trim()}” is reserved for an issue property. Choose another label name.`;
}
