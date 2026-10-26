import type { Entity } from '../shared/types';

export const legacyProfileProperties = ['identifier', 'statusId', 'assigneeId', 'priority', 'projectId', 'dueDate', 'milestoneId', 'estimate', 'labelIds', 'links', 'customerCount', 'customerRevenue', 'timeInStatus', 'createdAt', 'updatedAt'];
const profileProperties = ['identifier', 'statusId', 'assigneeId', 'priority', 'projectId', 'dueDate', 'estimate', 'labelIds', 'createdAt'];

export function profileIssueDisplay(tab: string) {
  return {
    groupBy: tab === 'Created' ? 'none' : 'statusId',
    groupCount: 'estimate' as const,
    orderBy: 'createdAt', direction: 'desc' as const,
    showCompleted: true, completedWindow: 'all', showEmpty: false,
    showSubIssues: true, nestedSubIssues: true, properties: [...profileProperties],
  };
}

/** Member views prioritize actionable work without changing team workflows. */
export function profileStatusOrder(statuses: Entity[]) {
  const types = ['started', 'unstarted', 'backlog', 'triage', 'completed', 'canceled', 'duplicate'];
  const rank = (status: Entity) => { const index = types.indexOf(status.type); return index < 0 ? types.length : index; };
  return [...statuses].sort((a, b) => rank(a) - rank(b) || (a.position ?? 0) - (b.position ?? 0)).map(status => status.id);
}

/** Old defaults were automatically persisted as a complete display object.
 * Rebase that exact column preset once, preserving unrelated/custom settings. */
export function migrateProfileDisplay<T extends Record<string, any>>(
  storage: Pick<Storage, 'getItem' | 'setItem'>, key: string, saved: T, tab: string,
): T {
  const marker = key + ':profile-display-v2';
  try {
    if (storage.getItem(marker) === '1') return saved;
    const next = { ...saved };
    if (Array.isArray(saved.properties) && saved.properties.length === legacyProfileProperties.length && legacyProfileProperties.every(field => saved.properties.includes(field))) {
      delete next.properties;
      if (next.groupCount === 'issues') delete next.groupCount;
      if (tab === 'Assigned' && next.orderBy === 'priority' && next.direction === 'asc' && !next.sortRules?.length) {
        delete next.orderBy;
        delete next.direction;
      }
      storage.setItem(key, JSON.stringify(next));
    }
    storage.setItem(marker, '1');
    return next;
  } catch { return saved; }
}
