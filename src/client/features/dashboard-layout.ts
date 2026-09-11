export type WidgetBox = { x: number; y: number; w: number; h: number };
export type LayoutWidget = {
  id: string;
  name?: string;
  layout?: Partial<WidgetBox>;
  [key: string]: any;
};
export const dashboardColumns = 12,
  dashboardRowHeight = 64,
  dashboardGap = 12;
const integer = (value: unknown, fallback: number) =>
  Number.isFinite(Number(value)) ? Math.round(Number(value)) : fallback;
export function widgetBox(widget: LayoutWidget, index: number): WidgetBox {
  const w = Math.max(3, Math.min(12, integer(widget.layout?.w, 6))),
    h = Math.max(
      3,
      Math.min(
        16,
        integer(widget.layout?.h, widget.chartType === "Metric" ? 4 : 6),
      ),
    );
  return {
    w,
    h,
    x: Math.max(
      0,
      Math.min(12 - w, integer(widget.layout?.x, (index % 2) * 6)),
    ),
    y: Math.max(0, integer(widget.layout?.y, Math.floor(index / 2) * 6)),
  };
}
const overlaps = (a: WidgetBox, b: WidgetBox) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
/** The active widget stays where placed; deterministic downward collision resolution preserves peers. */
export function dashboardLayout(
  widgets: LayoutWidget[],
  active?: { id: string; box: WidgetBox },
) {
  const positions = new Map<string, WidgetBox>(),
    sorted = widgets.map((widget, index) => ({
      widget,
      box: widgetBox(widget, index),
    }));
  if (active) {
    const normalized = widgetBox(
      {
        ...widgets.find((w) => w.id === active.id),
        id: active.id,
        layout: active.box,
      },
      0,
    );
    positions.set(active.id, normalized);
  }
  for (const { widget, box: original } of sorted) {
    if (widget.id === active?.id) continue;
    const box = { ...original };
    let colliding: WidgetBox | undefined;
    while (
      (colliding = [...positions.values()].find((other) =>
        overlaps(box, other),
      ))
    )
      box.y = colliding.y + colliding.h;
    positions.set(widget.id, box);
  }
  return positions;
}
export function dashboardResponsiveLayout(
  widgets: LayoutWidget[],
  layout: Map<string, WidgetBox>,
  narrow: boolean,
) {
  if (!narrow) return layout;
  let y = 0;
  const result = new Map<string, WidgetBox>();
  for (const widget of [...widgets].sort((a, b) => {
    const x = layout.get(a.id)!,
      z = layout.get(b.id)!;
    return x.y - z.y || x.x - z.x;
  })) {
    const box = layout.get(widget.id)!;
    result.set(widget.id, { ...box, x: 0, w: 12, y });
    y += box.h;
  }
  return result;
}
export function persistDashboardLayout(
  widgets: LayoutWidget[],
  layout: Map<string, WidgetBox>,
) {
  return widgets
    .map((w) => ({ ...w, layout: layout.get(w.id) }))
    .sort((a, b) => a.layout!.y - b.layout!.y || a.layout!.x - b.layout!.x);
}
