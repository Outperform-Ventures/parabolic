export type WindowBounds = { x?: number; y?: number; width: number; height: number };

// Keep a usable portion of a restored window on an attached display. A single
// visible pixel can leave the title bar and every usable control inaccessible.
export function restoredWindowBounds(state: WindowBounds, workAreas: { x: number; y: number; width: number; height: number }[]): WindowBounds {
  const bounds: WindowBounds = {
    width: Math.max(500, Math.min(3200, state.width)),
    height: Math.max(520, Math.min(2200, state.height)),
  };
  if (!Number.isFinite(state.x) || !Number.isFinite(state.y)) return bounds;
  const x = state.x!, y = state.y!;
  if (workAreas.some(area =>
    Math.min(x + bounds.width, area.x + area.width) - Math.max(x, area.x) >= 100 &&
    Math.min(y + bounds.height, area.y + area.height) - Math.max(y, area.y) >= 100
  )) Object.assign(bounds, { x, y });
  return bounds;
}
