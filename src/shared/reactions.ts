export function reactionUsers(value: unknown): Record<string, string[]> {
  const entries: Record<string, string[]> = Object.create(null);
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item?.emoji === "string" && typeof item?.userId === "string") {
        entries[item.emoji] ??= [];
        if (!entries[item.emoji].includes(item.userId))
          entries[item.emoji].push(item.userId);
      }
    }
  } else if (value && typeof value === "object")
    for (const [emoji, ids] of Object.entries(value))
      if (Array.isArray(ids))
        entries[emoji] = [
          ...new Set(ids.filter((id): id is string => typeof id === "string")),
        ];
  return entries;
}
export function reactionEntries(value: unknown) {
  return Object.entries(reactionUsers(value)).flatMap(([emoji, users]) =>
    users.map((userId) => ({ emoji, userId })),
  );
}
export function toggleReaction(value: unknown, emoji: string, userId: string) {
  const reactions = reactionUsers(value),
    users = reactions[emoji] ?? [];
  return {
    ...reactions,
    [emoji]: users.includes(userId)
      ? users.filter((id) => id !== userId)
      : [...users, userId],
  };
}
