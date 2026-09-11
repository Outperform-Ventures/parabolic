import type { Entity } from "../shared/types";

/** Follow legacy nested replies as well as the canonical one-level thread form. */
function commentThreadRoot(
  comment: Entity,
  comments: Map<string, Entity>,
): Entity {
  const seen = new Set<string>();
  let root = comment;
  while (root.parentId && !seen.has(root.id)) {
    seen.add(root.id);
    const parent = comments.get(root.parentId);
    if (!parent || seen.has(parent.id)) break;
    root = parent;
  }
  return root;
}
export function commentThreads(comments: Entity[]) {
  const byId = new Map(comments.map((comment) => [comment.id, comment]));
  const groups = new Map<string, { root: Entity; replies: Entity[] }>();
  for (const comment of comments) {
    const root = commentThreadRoot(comment, byId);
    if (!groups.has(root.id)) groups.set(root.id, { root, replies: [] });
    if (comment.id !== root.id) groups.get(root.id)!.replies.push(comment);
  }
  return [...groups.values()].sort((a, b) =>
    a.root.createdAt.localeCompare(b.root.createdAt),
  );
}
export const threadIsResolved = (root: Entity) =>
  typeof root.resolved === "boolean" ? root.resolved : !!root.resolvedAt;
