import type {EntityKind} from '../shared/types';

const paths: Partial<Record<EntityKind, string>> = {
  documents: '/document/',
  projects: '/project/',
  initiatives: '/initiative/',
  views: '/view/',
  customers: '/customer/',
  dashboards: '/dashboards/',
  asksForms: '/request/',
  requests: '/customer-request/',
  issues: '/issues/',
  cycles: '/cycles/',
};

export function entityLink(kind: EntityKind, id: string, origin = location.origin): string | undefined {
  if (kind === 'templates' || kind === 'labels') {
    const url = new URL('/settings/' + kind, origin);
    url.searchParams.set(kind === 'templates' ? 'template' : 'label', id);
    return url.href;
  }
  const path = paths[kind];
  return path ? new URL(path + encodeURIComponent(id), origin).href : undefined;
}
