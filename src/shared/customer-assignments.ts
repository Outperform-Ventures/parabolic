import type {Entity} from './types';

/** Assignments are independent of feedback/request metrics (legacy customerIds). */
export const customerAssignmentFields = ['directCustomerIds', 'inheritedCustomerIds', 'effectiveCustomerIds'] as const;
export function directCustomerIds(entity: Partial<Entity>): string[] {
  return [...new Set<string>([...(Array.isArray(entity.directCustomerIds) ? entity.directCustomerIds : []), ...(entity.customerId ? [entity.customerId] : [])])];
}
export function customerAssignments(entity: Partial<Entity>, projects: Entity[] | Map<string,Entity> = [], customers?: Entity[]) {
  const project = entity.projectId && entity.inheritProjectCustomers !== false
    ? (projects instanceof Map ? projects.get(entity.projectId) : projects.find(p => p.id === entity.projectId)) : undefined;
  const allowed = customers && new Set(customers.filter(c => !c.deletedAt).map(c => c.id));
  const readable = (ids: string[]) => allowed ? ids.filter(id => allowed.has(id)) : ids;
  const direct = readable(directCustomerIds(entity));
  const inherited = readable(project && !project.deletedAt ? directCustomerIds(project) : []);
  return {directCustomerIds: direct, inheritedCustomerIds: inherited, effectiveCustomerIds: [...new Set([...direct, ...inherited])]};
}
export function withCustomerAssignments<T extends Entity>(entity: T, projects: Entity[] | Map<string,Entity>, customers: Entity[]): T {
  return {...entity, ...customerAssignments(entity, projects, customers)};
}
export function usesCustomerAssignments(value: unknown): boolean {
  if (typeof value === 'string') return customerAssignmentFields.some(field => field === value);
  if (Array.isArray(value)) return value.some(usesCustomerAssignments);
  return !!value && typeof value === 'object' && Object.entries(value).some(([key,item]) => usesCustomerAssignments(key) || usesCustomerAssignments(item));
}
