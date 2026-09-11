import {entityLink} from './entity-link';

export function documentLink(id: string, origin = location.origin): string {
  return entityLink('documents', id, origin)!;
}
