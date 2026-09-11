import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Grip, Maximize2 } from "lucide-react";
import {
  dashboardLayout,
  dashboardResponsiveLayout,
  persistDashboardLayout,
  dashboardGap,
  dashboardRowHeight,
  type WidgetBox,
  type LayoutWidget,
} from "./dashboard-layout";
import "./dashboard-grid.css";

type Gesture = {
  id: string;
  mode: "move" | "resize";
  startX: number;
  startY: number;
  scrollTop: number;
  box: WidgetBox;
  preview: Map<string, WidgetBox>;
};
export function DashboardGrid({
  widgets,
  readOnly=false,
  onChange,
  renderWidget,
}: {
  widgets: LayoutWidget[];
  readOnly?: boolean;
  onChange: (widgets: any[]) => void;
  renderWidget: (widget: LayoutWidget, index: number) => React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null),
    gesture = useRef<Gesture | null>(null),
    [width, setWidth] = useState(0),
    [preview, setPreview] = useState<Map<string, WidgetBox> | null>(null),
    [announcement, setAnnouncement] = useState("");
  const layout = useMemo(() => dashboardLayout(widgets), [widgets]),
    narrow = width < 740,
    display = dashboardResponsiveLayout(widgets, preview ?? layout, narrow),
    step = (width + dashboardGap) / 12,
    rowStep = dashboardRowHeight + dashboardGap;
  const contents = useMemo(
    () => new Map(widgets.map((w, i) => [w.id, renderWidget(w, i)])),
    [widgets, renderWidget],
  );
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    setWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);
  const commit = (
    id: string,
    mode: "move" | "resize",
    next: Map<string, WidgetBox>,
  ) => {
    if(readOnly)return;
    onChange(persistDashboardLayout(widgets, next));
    const box = next.get(id)!;
    setAnnouncement(
      `${mode === "move" ? "Moved" : "Resized"} ${widgets.find((w) => w.id === id)?.name ?? "insight"}: column ${box.x + 1}, row ${box.y + 1}, width ${box.w}, height ${box.h}`,
    );
  };
  const cancel = () => {
    gesture.current = null;
    setPreview(null);
    setAnnouncement("Layout change canceled");
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && gesture.current) {
        event.preventDefault();
        event.stopPropagation();
        cancel();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
  const start = (
    event: React.PointerEvent,
    id: string,
    mode: "move" | "resize",
  ) => {
    if (readOnly || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const parent = ref.current?.closest(".feature-page");
    gesture.current = {
      id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      scrollTop: parent?.scrollTop ?? 0,
      box: { ...layout.get(id)! },
      preview: layout,
    };
    setPreview(new Map(layout));
  };
  const move = (event: React.PointerEvent) => {
    const drag = gesture.current;
    if (!drag) return;
    event.preventDefault();
    event.stopPropagation();
    const parent = ref.current?.closest(".feature-page");
    if (parent) {
      const bounds = parent.getBoundingClientRect();
      if (event.clientY > bounds.bottom - 32) parent.scrollTop += 14;
      else if (event.clientY < bounds.top + 70) parent.scrollTop -= 14;
    }
    const dx = narrow
        ? 0
        : Math.round((event.clientX - drag.startX) / Math.max(1, step)),
      dy = Math.round(
        (event.clientY -
          drag.startY +
          (parent?.scrollTop ?? 0) -
          drag.scrollTop) /
          rowStep,
      ),
      box = { ...drag.box };
    if (drag.mode === "move") {
      box.x += dx;
      box.y += dy;
    } else {
      box.w = Math.min(12 - box.x, box.w + dx);
      box.h += dy;
    }
    drag.preview = dashboardLayout(widgets, { id: drag.id, box });
    setPreview(drag.preview);
  };
  const end = (event: React.PointerEvent) => {
    const drag = gesture.current;
    if (!drag) return;
    event.preventDefault();
    event.stopPropagation();
    gesture.current = null;
    setPreview(null);
    if (JSON.stringify([...drag.preview]) !== JSON.stringify([...layout]))
      commit(drag.id, drag.mode, drag.preview);
  };
  const key = (
    event: React.KeyboardEvent,
    id: string,
    mode: "move" | "resize",
  ) => {
    if (
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    const box = { ...layout.get(id)! },
      horizontal = event.key === "ArrowLeft" || event.key === "ArrowRight",
      delta = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
    if (narrow && horizontal) return;
    if (mode === "move") box[horizontal ? "x" : "y"] += delta;
    else {
      box[horizontal ? "w" : "h"] += delta;
      box.w = Math.min(12 - box.x, box.w);
    }
    commit(id, mode, dashboardLayout(widgets, { id, box }));
  };
  const height = Math.max(
    0,
    ...[...display.values()].map(
      (box) => (box.y + box.h) * rowStep - dashboardGap,
    ),
  );
  return (
    <>
      <p className="visually-hidden" id="dashboard-layout-help">
        Drag an insight using its move handle. Arrow keys on the move handle
        change position. Arrow keys on the resize handle change size. Escape
        cancels an active gesture.
      </p>
      <div role="status" className="visually-hidden" aria-live="polite">
        {announcement}
      </div>
      <div
        ref={ref}
        className={
          "feature-dashboard-grid feature-dashboard-layout" +
          (preview ? " is-changing" : "")
        }
        style={{ height: height + 48 }}
      >
        {widgets.map((widget) => {
          const box = display.get(widget.id)!;
          return (
            <section
              className="feature-chart-card feature-dashboard-widget"
              key={widget.id}
              data-widget-id={widget.id}
              data-grid-x={box.x}
              data-grid-y={box.y}
              data-grid-width={box.w}
              data-grid-height={box.h}
              style={{
                left: box.x * step,
                width: Math.max(0, box.w * step - dashboardGap),
                top: box.y * rowStep,
                height: box.h * rowStep - dashboardGap,
              }}
            >
              <button
                type="button"
                hidden={readOnly}
                style={readOnly?{display:"none"}:undefined}
                className="feature-widget-move"
                aria-label={`Move ${widget.name}`}
                aria-describedby="dashboard-layout-help"
                onPointerDown={(e) => start(e, widget.id, "move")}
                onPointerMove={move}
                onPointerUp={end}
                onPointerCancel={cancel}
                onKeyDown={(e) => key(e, widget.id, "move")}
              >
                <Grip size={15} />
              </button>
              {contents.get(widget.id)}
              <button
                type="button"
                hidden={readOnly}
                style={readOnly?{display:"none"}:undefined}
                className="feature-widget-resize"
                aria-label={`Resize ${widget.name}`}
                aria-describedby="dashboard-layout-help"
                onPointerDown={(e) => start(e, widget.id, "resize")}
                onPointerMove={move}
                onPointerUp={end}
                onPointerCancel={cancel}
                onKeyDown={(e) => key(e, widget.id, "resize")}
              >
                <Maximize2 size={12} />
              </button>
            </section>
          );
        })}
      </div>
    </>
  );
}
