import {customerAssignments} from '../shared/customer-assignments';
import {assert} from './errors';
import type {Actor, RecordEntity, Repository} from './repository';

export function validateCustomerAssignments(repo: Repository, actor: Actor, kind: string, entity: RecordEntity, previous?: RecordEntity) {
  if (kind !== 'issues' && kind !== 'projects') return;
  // These are projections, never writeable copies of a parent project's state.
  delete entity.effectiveCustomerIds;
  delete entity.inheritedCustomerIds;
  // Undo restores absent optional fields as null: treat this as the default (inherit).
  if (entity.inheritProjectCustomers === null) delete entity.inheritProjectCustomers;
  if (entity.inheritProjectCustomers !== undefined) assert(kind === 'issues' && typeof entity.inheritProjectCustomers === 'boolean', 422, 'Project customer inheritance must be a boolean on an issue', 'INVALID_CUSTOMER_ASSIGNMENT');
  if (entity.directCustomerIds === undefined) return;
  assert(Array.isArray(entity.directCustomerIds) && entity.directCustomerIds.length <= 1000 && entity.directCustomerIds.every((id: unknown) => typeof id === 'string' && id.length > 0), 422, 'Customer assignments must be a list of customer IDs', 'INVALID_CUSTOMER_ASSIGNMENT');
  entity.directCustomerIds = [...new Set(entity.directCustomerIds)];
  for (const id of entity.directCustomerIds) {
    // Existing archived/deleted references survive unrelated edits and restoration.
    if (previous?.directCustomerIds?.includes(id) || previous?.customerId === id) continue;
    const customer = repo.raw('customers', id);
    assert(customer && repo.canRead({...actor, scopes:[...actor.scopes,'read']}, 'customers', customer), 422, 'Customer is not accessible in this workspace', 'INVALID_REFERENCE');
    assert(!customer.archivedAt, 422, 'Archived customers cannot be newly assigned', 'ARCHIVED_CUSTOMER');
  }
}
export function presentCustomerAssignments(repo: Repository, actor: Actor, kind: string, entity: RecordEntity): RecordEntity {
  if (kind !== 'issues' && kind !== 'projects') return entity;
  const project = entity.projectId ? repo.cachedRaw(actor, 'projects', entity.projectId) : null;
  const readableProject = project && repo.canRead(actor, 'projects', project) ? project : null;
  const assignments = customerAssignments(entity, readableProject ? [readableProject] : []);
  const readable = (ids: string[]) => ids.filter(id => {const customer = repo.cachedRaw(actor, 'customers', id);return customer && repo.canRead(actor, 'customers', customer);});
  return {...entity, directCustomerIds:readable(assignments.directCustomerIds), inheritedCustomerIds:readable(assignments.inheritedCustomerIds), effectiveCustomerIds:readable(assignments.effectiveCustomerIds)};
}
