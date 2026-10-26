export type SectionOrders = Record<string, string[]>;

export function orderSections<T extends { id: string }>(sections: T[], order: string[] = []): T[] {
  const rank = new Map(order.map((id, index) => [id, index]));
  return [...sections].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));
}

export function moveSection(order: string[], from: string, to: string, edge: 'before' | 'after'): string[] {
  if (from === to || !order.includes(from) || !order.includes(to)) return order;
  const next = order.filter(id => id !== from);
  next.splice(next.indexOf(to) + (edge === 'after' ? 1 : 0), 0, from);
  return next;
}

/** Keep temporarily filtered/hidden groups in their existing slots. */
export function mergeSectionOrder(previous: string[] = [], visible: string[]): string[] {
  const present = new Set(visible), pending = [...new Set(visible)];
  const next = [...new Set(previous)].map(id => present.has(id) ? pending.shift()! : id);
  return [...next, ...pending];
}
