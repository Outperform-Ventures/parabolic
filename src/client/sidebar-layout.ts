export const SIDEBAR_MIN_WIDTH = 180;
export const SIDEBAR_MAX_WIDTH = 480;
export const SIDEBAR_COLLAPSE_WIDTH = 120;
export const SIDEBAR_CONTENT_RESERVE = 360;

export type SidebarLayout = { width: number | null; collapsed: boolean };

export function normalizeSidebarLayout(value: unknown): SidebarLayout {
  const saved = value && typeof value === 'object' ? value as Partial<SidebarLayout> : {};
  return {
    width: typeof saved.width === 'number' && Number.isFinite(saved.width)
      ? Math.round(Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, saved.width))) : null,
    collapsed: saved.collapsed === true,
  };
}

export function sidebarMaxWidth(available: number) {
  return Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, available - SIDEBAR_CONTENT_RESERVE));
}

export function sidebarDragLayout(width: number, available: number, previous: SidebarLayout): SidebarLayout {
  // Collapsing must not overwrite the width used when the sidebar is reopened.
  return width < SIDEBAR_COLLAPSE_WIDTH
    ? { ...previous, collapsed: true }
    : { width: Math.round(Math.max(SIDEBAR_MIN_WIDTH, Math.min(sidebarMaxWidth(available), width))), collapsed: false };
}

export function sidebarLayoutKey(userId: string, workspaceId: string) {
  return `sidebar-layout:${userId}:${workspaceId}`;
}
