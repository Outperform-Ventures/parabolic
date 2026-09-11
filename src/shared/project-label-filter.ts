import type { Entity } from './types';

/** Callers supply only projects and labels visible to the current viewer. */
export function projectLabelIndex(projects: Entity[], labels: Entity[]) {
  const available = new Set(labels.filter(label => !label.deletedAt && label.entityType === 'projects').map(label => label.id));
  return new Map(projects.filter(project => !project.deletedAt).map(project => [project.id,
    [...new Set<string>((project.labelIds ?? []).filter((id: string) => available.has(id)))],
  ]));
}
export function withProjectLabels<T extends Entity>(entity: T, index: Map<string, string[]>) {
  return {...entity, projectLabelIds: index.get(entity.projectId) ?? []};
}
export function usesProjectLabels(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(usesProjectLabels);
  if (!value || typeof value !== 'object') return value === 'projectLabelIds';
  return Object.entries(value).some(([key, item]) => key === 'projectLabelIds' || usesProjectLabels(item));
}
