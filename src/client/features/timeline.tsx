import {TimelineProperties} from './timeline-properties';
import {timelineAutoPan,timelineScrollParent} from './timeline-auto-pan';
import {ProjectActions} from './project-actions';
import {useTimelineOverlays} from './timeline-overlays';
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Box,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  PanelLeft,
  X,
  Link2,
} from "lucide-react";
import { Action, FormDialog, Row, date, useActions, live } from "./shared";
import { projectStatusCategory } from "./project-statuses";
import { buildProgressHistory, projectGraphAvailable } from "./progress-data";
import {
  DAY,
  isoDate as iso,
  timelineWindow,
  timelineTicks,
  zoomTimeline,
  timelineScales as scales,
  dependencyProblem,
  dependencyChain,
  type TimelineScale as Scale,
  type TimelineWindow,
} from "./timeline-data";
import "./timeline.css";
type Dates = { start: number; end: number };
type Drag = {
  id: string;
  kind: "move" | "start" | "end";
  x: number;
  width: number;
  span: number;
  baseIds: string[];
  original: Map<string, Dates>;
  affected: string[];
  delta: number;
  panDays?: number;
};
type Connection = {
  sourceId: string;
  side: "start" | "end";
  targetId?: string;
  x: number;
  y: number;
  dragged: boolean;
  error?: string | null;
};
type Edge = { blocker: Row; blocked: Row; path: string; violated: boolean };
export type ProjectTimelineSettings = {scale:Scale;start:number;span:number;anchor:number;showList:boolean};
export function ProjectTimeline({ projects,groups,collapsedGroups=[],onToggleGroup,propertyFields=[],selectedIds,onSelectionChange,onFocusedChange,initialSettings,onSettingsChange }: { projects: Row[];groups?:{id:string;name:string;projects:Row[]}[];collapsedGroups?:string[];onToggleGroup?:(id:string)=>void;propertyFields?:string[];selectedIds?:string[];onSelectionChange?:React.Dispatch<React.SetStateAction<string[]>>;onFocusedChange?:(id:string|null)=>void;initialSettings?:ProjectTimelineSettings;onSettingsChange?:(settings:ProjectTimelineSettings)=>void }) {
  const store = useActions(),
    { data, update, act, toast, reload } = store,
    navigate = useNavigate(),
    location = useLocation();
  const timelineRows:({group:{id:string;name:string;projects:Row[]};project?:never;key:string}|{project:Row;group?:never;key:string})[]=groups?groups.flatMap(group=>[{group,key:'group:'+group.id},...(collapsedGroups.includes(group.id)?[]:group.projects.map(project=>({project,key:group.id+':'+project.id}))) ] as any):projects.map(project=>({project,key:project.id}));
  const projectY=new Map<string,number>();let totalHeight=0;for(const row of timelineRows){if(row.project&&!projectY.has(row.project.id))projectY.set(row.project.id,totalHeight+24);totalHeight+=row.group?32:49;}
  const key = `timeline:${data.workspaceId}:${location.pathname}`;
  const [projectContext,setProjectContext]=useState<{project:Row;x:number;y:number;key:number}|null>(null);
  const openProjectContext=(event:React.MouseEvent,project:Row)=>{event.preventDefault();event.stopPropagation();setFocused(project.id);if(selected.length>1&&selected.includes(project.id)){const commands=event.currentTarget.closest("[data-selected-project-ids]")?.querySelector<HTMLButtonElement>('[aria-label="Open project selection commands"]');if(commands){commands.click();return}}if(!selected.includes(project.id))setSelected([project.id]);setProjectContext({project,x:event.clientX,y:event.clientY,key:Date.now()})};
  const [scale, setScale] = useState<Scale>("month"),
    [view, setView] = useState<TimelineWindow>(() => timelineWindow("month")),
    [showList, setShowList] = useState(true),
    [localSelected, setLocalSelected] = useState<string[]>([]),
    [focused, setFocused] = useState<string | null>(null),
    [drag, setDrag] = useState<Drag | null>(null),
    [editing, setEditing] = useState<Row | null>(null),
    [connection, setConnection] = useState<Connection | null>(null),
    [dependencyPicker, setDependencyPicker] = useState<{
      id: string;
      side: "start" | "end";
    } | null>(null),
    [edgeMenu, setEdgeMenu] = useState<{
      edge: Edge;
      x: number;
      y: number;
    } | null>(null);
  const selected=selectedIds??localSelected,setSelected=onSelectionChange??setLocalSelected;
  useEffect(()=>{onFocusedChange?.(focused)},[focused,onFocusedChange]);
  const root = useRef<HTMLDivElement>(null),
    body = useRef<HTMLDivElement>(null),
    dragRef = useRef<Drag | null>(null),
    connectionRef = useRef<Connection | null>(null),
    viewRef = useRef(view),
    suppressClick = useRef(false),
    anchorTime = useRef(Date.now());
  viewRef.current = view;
  dragRef.current = drag;
  connectionRef.current = connection;
  const allProjects = live(data.projects),
    allRef = useRef(allProjects);
  allRef.current = allProjects;
  const overlays=useTimelineOverlays({projects,view,onSelectMilestone:()=>setSelected([]),onPan:offset=>{anchorTime.current+=offset;setView(v=>({...v,start:v.start+offset}))}}),overlaysRef=useRef(overlays);overlaysRef.current=overlays;
  const settingsCallback=useRef(onSettingsChange),settingsReady=useRef(false);settingsCallback.current=onSettingsChange;
  useEffect(() => {
    try {
      const saved = initialSettings || JSON.parse(localStorage.getItem(key) || "{}");
      if (scales.includes(saved.scale)) setScale(saved.scale);
      if (
        Number.isFinite(saved.start) &&
        Number.isFinite(saved.span) &&
        saved.span >= 7 * DAY &&
        saved.span <= 36525 * DAY
      )
        setView({ start: saved.start, span: saved.span });
      if (Number.isFinite(saved.anchor)) anchorTime.current = saved.anchor;
      if (typeof saved.showList === "boolean") setShowList(saved.showList);
    } catch {}
  }, [key]);
  useEffect(() => {
    if(!settingsReady.current){settingsReady.current=true;return;}
    localStorage.setItem(
      key,
      JSON.stringify({ ...view, scale, showList, anchor: anchorTime.current }),
    );
    settingsCallback.current?.({...view,scale,showList,anchor:anchorTime.current});
  }, [key, view, scale, showList]);
  const ticks = useMemo(() => timelineTicks(view), [view]),
    end = view.start + view.span,
    position = (time: number) => ((time - view.start) / view.span) * 100;
  const trackBounds = () =>
    root.current
      ?.querySelector(".feature-timeline-track")
      ?.getBoundingClientRect() ?? root.current?.getBoundingClientRect();
  const zoom = (value: string, anchor = 0.5) => {
    const next = scales.includes(value as Scale)
      ? (value as Scale)
      : scales[
          Math.max(
            0,
            Math.min(
              scales.length - 1,
              scales.indexOf(scale) + (value === "in" ? -1 : 1),
            ),
          )
        ];
    setScale(next);
    setView(timelineWindow(next, anchorTime.current));
  };
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const wheel = (event: WheelEvent) => {
      if (dragRef.current || connectionRef.current || overlaysRef.current.dragging) return;
      const rect = trackBounds();
      if (!rect) return;
      const factor =
        event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.width : 1;
      if (event.ctrlKey) {
        event.preventDefault();
        const anchor = Math.max(
          0,
          Math.min(1, (event.clientX - rect.left) / rect.width),
        );
        anchorTime.current =
          viewRef.current.start + viewRef.current.span * anchor;
        setView((v) =>
          zoomTimeline(v, Math.exp(-event.deltaY * factor * 0.004), anchor),
        );
      } else if (event.deltaX || event.shiftKey) {
        event.preventDefault();
        const amount = (event.deltaX || event.deltaY) * factor;
        anchorTime.current += (amount / rect.width) * viewRef.current.span;
        setView((v) => ({
          ...v,
          start: v.start + (amount / rect.width) * v.span,
        }));
      }
    };
    let gesture: { view: TimelineWindow; anchor: number } | null = null;
    const start = (event: Event) => {
      if (dragRef.current || connectionRef.current || overlaysRef.current.dragging) return;
      event.preventDefault();
      const e = event as Event & { clientX?: number };
      const rect = trackBounds();
      gesture = {
        view: viewRef.current,
        anchor:
          rect && Number.isFinite(e.clientX)
            ? Math.max(0, Math.min(1, (e.clientX! - rect.left) / rect.width))
            : 0.5,
      };
      anchorTime.current = gesture.view.start + gesture.view.span * gesture.anchor;
    };
    const change = (event: Event) => {
      if (!gesture) return;
      event.preventDefault();
      setView(
        zoomTimeline(
          gesture.view,
          (event as Event & { scale: number }).scale || 1,
          gesture.anchor,
        ),
      );
    };
    const stop = () => {
      gesture = null;
    };
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("gesturestart", start, { passive: false });
    el.addEventListener("gesturechange", change, { passive: false });
    el.addEventListener("gestureend", stop);
    return () => {
      el.removeEventListener("wheel", wheel);
      el.removeEventListener("gesturestart", start);
      el.removeEventListener("gesturechange", change);
      el.removeEventListener("gestureend", stop);
    };
  }, []);
  useEffect(() => {
    const visibleProjects=projects.filter(project=>projectY.has(project.id));
    const listener = (raw: Event) => {
      const event = raw as CustomEvent<{ command: string; value?: string }>;
      if (event.defaultPrevented) return;
      const { command, value } = event.detail || {};
      if (command === "timeline-zoom") zoom(value || "in");
      else if (command === "timeline-toggle-list") setShowList((v) => !v);
      else if (command === "timeline-select") {
        const index = Math.max(
          0,
          visibleProjects.findIndex((p) => p.id === focused),
        );
        const next =
          visibleProjects[
            Math.max(
              0,
              Math.min(
                visibleProjects.length - 1,
                index + (value === "previous" ? -1 : 1),
              ),
            )
          ];
        if (next) {
          setFocused(next.id);
          setSelected([next.id]);
          root.current
            ?.querySelector<HTMLElement>(`[data-project-id="${next.id}"]`)
            ?.focus();
        }
      } else if (command === "select-all")
        setSelected(visibleProjects.map((p) => p.id));
      else if (command === "select-group") {
        const p = projects.find((p) => p.id === focused);
        if (p)
          setSelected(
            (groups?.find(group=>group.projects.some(project=>project.id===p.id))?.projects||visibleProjects.filter((x) => x.status === p.status)).filter(project=>projectY.has(project.id)).map((x) => x.id),
          );
      } else if (command === "clear-selection") setSelected([]);
      else if (command === "toggle-selection" && focused)
        setSelected((ids) =>
          ids.includes(focused)
            ? ids.filter((id) => id !== focused)
            : [...ids, focused],
        );
      else return;
      event.preventDefault();
    };
    window.addEventListener("workspace-command", listener);
    return () => window.removeEventListener("workspace-command", listener);
  }, [projects, focused, scale, groups, collapsedGroups]);
  const forecasts = useMemo(() => {
    const result = new Map<string, number>(),
      needed = new Set(projects.flatMap((p) => p.dependencyIds || []));
    for (const p of projects)
      if (needed.has(p.id) && !p.targetDate && projectGraphAvailable(p,data.activities,status=>projectStatusCategory(status,data))) {
        const prediction = buildProgressHistory({
          collection: p,
          kind: "project",
          issues: data.issues,
          activities: data.activities,
          statuses: data.statuses,
          teams: data.teams,
          workspaces: data.workspaces,
        }).prediction;
        if (prediction) result.set(p.id, prediction.date);
      }
    return result;
  }, [projects, data.issues, data.activities, data.statuses, data.teams, data.workspaces]);
  const datesFor = (project: Row): Dates => {
    const original = drag?.original.get(project.id);
    if (original && drag?.affected.includes(project.id)) {
      const d = drag.delta * DAY;
      return {
        start:
          drag.kind === "end"
            ? original.start
            : drag.kind === "start"
              ? Math.min(original.end, original.start + d)
              : original.start + d,
        end:
          drag.kind === "start"
            ? original.end
            : drag.kind === "end"
              ? Math.max(original.start, original.end + d)
              : original.end + d,
      };
    }
    return {
      start: Date.parse(project.startDate || project.targetDate),
      end: Date.parse(project.targetDate) || forecasts.get(project.id) || NaN,
    };
  };
  const saveSchedule = async (current: Drag) => {
    const changes = current.affected.flatMap((id) => {
      const dates = current.original.get(id);
      if (!dates) return [];
      let s = dates.start,
        e = dates.end;
      if (current.kind === "move") {
        s += current.delta * DAY;
        e += current.delta * DAY;
      } else if (current.kind === "start")
        s = Math.min(e, s + current.delta * DAY);
      else e = Math.max(s, e + current.delta * DAY);
      return s !== dates.start || e !== dates.end
        ? [
            {
              kind: "projects" as const,
              id,
              data: {
                startDate: iso(s),
                targetDate: iso(e),
                datePrecision: "day",
              },
            },
          ]
        : [];
    });
    if (!changes.length) return;
    await act(()=>store.batch(changes));
  };
  useEffect(() => {
    if (!drag) return;
    let pointer:PointerEvent|null=null;
    const auto=timelineAutoPan({bounds:trackBounds,onPan:pixels=>{const current=dragRef.current;if(!current)return;const offset=pixels/current.width*current.span;current.panDays=(current.panDays||0)+offset/DAY;anchorTime.current+=offset;setView(v=>({...v,start:v.start+offset}));if(pointer)move(pointer)},scrollElement:()=>timelineScrollParent(root.current)});
    const move = (e: PointerEvent) => {
      pointer=e;auto.move(e);
      const current = dragRef.current;
      if (!current || !(e.target instanceof Element)) return;
      const delta = Math.round(
          (((e.clientX - current.x) / current.width) * current.span) / DAY+(current.panDays||0),
        ),
        mode = e.metaKey || e.ctrlKey ? "none" : e.shiftKey ? "all" : "planned",
        affected =
          current.kind === "move"
            ? dependencyChain(allRef.current, current.baseIds, mode, (p) =>
                projectStatusCategory(p.status, data),
              )
            : current.baseIds;
      const next = { ...current, delta, affected };
      dragRef.current = next;
      setDrag(next);
      if (delta) setSelected(current.baseIds);
    };
    const up = () => {
      const current = dragRef.current;
      if (!current) return;
      suppressClick.current = current.delta !== 0;
      dragRef.current = null;
      setDrag(null);
      void saveSchedule(current);
    };
    const cancel = (event?: KeyboardEvent) => {
      if (event && event.key !== "Escape") return;
      event?.preventDefault();
      event?.stopPropagation();
      dragRef.current = null;
      setDrag(null);
      suppressClick.current = true;
    };
    const canceled = () => cancel();
    window.addEventListener("pointercancel", canceled, { once: true });
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    window.addEventListener("keydown", cancel, true);
    document.body.style.cursor =
      drag.kind === "move" ? "grabbing" : "ew-resize";
    return () => {
      auto.stop();
      window.removeEventListener("pointercancel", canceled);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("keydown", cancel, true);
      document.body.style.cursor = "";
    };
  }, [!!drag]);
  const begin = (e: React.PointerEvent, project: Row, kind: Drag["kind"]) => {
    if (e.button !== 0 || !project.startDate || !project.targetDate) return;
    suppressClick.current = false;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const track = e.currentTarget.closest(
        ".feature-timeline-track",
      ) as HTMLElement,
      baseIds =
        kind === "move" && selected.includes(project.id)
          ? selected
          : [project.id],
      mode = e.metaKey || e.ctrlKey ? "none" : e.shiftKey ? "all" : "planned",
      affected =
        kind === "move"
          ? dependencyChain(allProjects, baseIds, mode, (p) =>
              projectStatusCategory(p.status, data),
            )
          : baseIds,
      original = new Map<string, Dates>();
    for (const p of allProjects)
      if (p.startDate && p.targetDate)
        original.set(p.id, {
          start: Date.parse(p.startDate),
          end: Date.parse(p.targetDate),
        });
    setFocused(project.id);
    const next = {
      id: project.id,
      kind,
      x: e.clientX,
      width: track.getBoundingClientRect().width,
      span: view.span,
      baseIds,
      original,
      affected,
      delta: 0,
    };
    dragRef.current = next;
    setDrag(next);
  };
  const connect = async (
    sourceId: string,
    side: "start" | "end",
    targetId: string,
  ) => {
    const blockerId = side === "end" ? sourceId : targetId,
      blockedId = side === "end" ? targetId : sourceId,
      error = dependencyProblem(blockerId, blockedId, allRef.current);
    if (error) {
      toast(error);
      return null;
    }
    const blocked = allRef.current.find((p) => p.id === blockedId)!;
    return act(
      () =>
        update("projects", blocked.id, {
          dependencyIds: [
            ...new Set([...(blocked.dependencyIds || []), blockerId]),
          ],
        }),
      "Dependency created",
    );
  };
  const beginConnection = (
    e: React.PointerEvent,
    project: Row,
    side: "start" | "end",
  ) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const next = {
      sourceId: project.id,
      side,
      x: e.clientX,
      y: e.clientY,
      dragged: false,
    };
    connectionRef.current = next;
    setConnection(next);
  };
  useEffect(() => {
    if (!connection) return;
    let pointer:PointerEvent|null=null;
    const auto=timelineAutoPan({bounds:trackBounds,onPan:pixels=>{const bounds=trackBounds();if(!bounds)return;const offset=pixels/bounds.width*viewRef.current.span;anchorTime.current+=offset;setView(v=>({...v,start:v.start+offset}));if(pointer)move(pointer)},onMove:()=>{if(pointer)move(pointer)},scrollElement:()=>timelineScrollParent(root.current)});
    const move = (e: PointerEvent) => {
      pointer=e;auto.move(e);
      const current = connectionRef.current;
      if (!current) return;
      const target = document
          .elementFromPoint(e.clientX, e.clientY)
          ?.closest<HTMLElement>("[data-timeline-project]")
          ?.dataset.timelineProject,
        blocker = current.side === "end" ? current.sourceId : target,
        blocked = current.side === "end" ? target : current.sourceId,
        error =
          blocker && blocked
            ? dependencyProblem(blocker, blocked, allRef.current)
            : null;
      const next = {
        ...current,
        x: e.clientX,
        y: e.clientY,
        targetId: target,
        error,
        dragged: true,
      };
      connectionRef.current = next;
      setConnection(next);
    };
    const up = () => {
      const current = connectionRef.current;
      if (!current) return;
      connectionRef.current = null;
      setConnection(null);
      suppressClick.current = true;
      if (!current.dragged)
        setDependencyPicker({ id: current.sourceId, side: current.side });
      else if (current.targetId)
        void connect(current.sourceId, current.side, current.targetId);
    };
    const cancel = (event?: KeyboardEvent) => {
      if (event && event.key !== "Escape") return;
      event?.preventDefault();
      event?.stopPropagation();
      connectionRef.current = null;
      setConnection(null);
    };
    const canceled = () => cancel();
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    window.addEventListener("pointercancel", canceled, { once: true });
    window.addEventListener("keydown", cancel, true);
    return () => {
      auto.stop();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", canceled);
      window.removeEventListener("keydown", cancel, true);
    };
  }, [!!connection]);
  useEffect(() => {
    if (!edgeMenu) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          setEdgeMenu(null);
        }
      } else if (!(e.target as Element)?.closest(".timeline-dependency-menu"))
        setEdgeMenu(null);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close, true);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close, true);
    };
  }, [edgeMenu]);
  const edges: Edge[] = projects.flatMap((p, index) =>
    (p.dependencyIds || []).flatMap((id: string) => {
      const depIndex = projects.findIndex((d) => d.id === id),
        dependency = projects[depIndex];
      if (!dependency||!projectY.has(p.id)||!projectY.has(id)) return [];
      const from = position(datesFor(dependency).end) * 10,
        to = position(datesFor(p).start) * 10;
      if (
        !Number.isFinite(from) ||
        !Number.isFinite(to) ||
        Math.max(from, to) < 0 ||
        Math.min(from, to) > 1000
      )
        return [];
      return [
        {
          blocker: dependency,
          blocked: p,
          violated: datesFor(dependency).end > datesFor(p).start,
          path: `M ${from} ${projectY.get(id)} C ${from + 30} ${projectY.get(id)}, ${to - 30} ${projectY.get(p.id)}, ${to} ${projectY.get(p.id)}`,
        },
      ];
    }),
  );
  const draftPath = (() => {
    if (!connection) return "";
    const source = projects.find((p) => p.id === connection.sourceId),
      index = projects.findIndex((p) => p.id === connection.sourceId),
      bounds = trackBounds(),
      bodyBounds = body.current?.getBoundingClientRect();
    if (!source || !bounds || !bodyBounds) return "";
    const x =
        position(
          datesFor(source)[connection.side === "end" ? "end" : "start"],
        ) * 10,
      y = projectY.get(connection.sourceId)??24,
      toX = ((connection.x - bounds.left) / bounds.width) * 1000,
      toY = connection.y - bodyBounds.top;
    return `M ${x} ${y} C ${x + 30} ${y}, ${toX - 30} ${toY}, ${toX} ${toY}`;
  })();
  return (
    <div
      ref={root}
      className={`feature-timeline ${showList ? "" : "hide-list"}`}
      data-timeline-start={view.start}
      data-timeline-span={view.span}
    >
      <div className="feature-timeline-controls">
        {overlays.controls}
        <Action
          onClick={() => setShowList(!showList)}
          title="Toggle project list"
        >
          <PanelLeft size={14} />
        </Action>
        <div className="feature-segment">
          <button aria-label="Zoom out" onClick={() => zoom("out")}>
            <Minus size={13} />
          </button>
          <select
            aria-label="Timeline scale"
            value={scale}
            onChange={(e) => {
              setScale(e.target.value as Scale);
              setView(
                timelineWindow(e.target.value as Scale, anchorTime.current),
              );
            }}
          >
            {scales.map((s) => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
          <button aria-label="Zoom in" onClick={() => zoom("in")}>
            <Plus size={13} />
          </button>
        </div>
        <span className="muted">
          {selected.length ? `${selected.length} selected` : ""}
        </span>
        <div className="feature-inline" style={{ marginLeft: "auto" }}>
          <Action
            title="Previous period"
            onClick={() => {
              anchorTime.current -= view.span / Math.max(1, ticks.length - 1);
              setView((v) => ({
                ...v,
                start: v.start - v.span / Math.max(1, ticks.length - 1),
              }));
            }}
          >
            <ChevronLeft size={14} />
          </Action>
          <Action
            onClick={() => {
              anchorTime.current = Date.now();
              setView(timelineWindow(scale));
            }}
          >
            Today
          </Action>
          <Action
            title="Next period"
            onClick={() => {
              anchorTime.current += view.span / Math.max(1, ticks.length - 1);
              setView((v) => ({
                ...v,
                start: v.start + v.span / Math.max(1, ticks.length - 1),
              }));
            }}
          >
            <ChevronRight size={14} />
          </Action>
        </div>
      </div>
      <div className="feature-timeline-head">
        <span>Project</span>
        <div className="timeline-tick-header">
          {ticks.map((c) => (
            <span key={c.time} style={{ left: `${position(c.time)}%` }}>
              {c.label}
            </span>
          ))}
        </div>
      </div>
      {projectContext&&<ProjectActions key={projectContext.key} project={projectContext.project} position={{x:projectContext.x,y:projectContext.y}} onEdit={()=>setEditing(projectContext.project)} onRemoveFromTimeline={['planned','backlog'].includes(projectStatusCategory(projectContext.project.status,data))&&(projectContext.project.startDate||projectContext.project.targetDate)?()=>void act(async()=>{await update('projects',projectContext.project.id,{startDate:null,targetDate:null});setProjectContext(null)},'Removed from timeline'):undefined}/>}
      {overlays.cycleRow}
      <div className="feature-timeline-body" ref={body}>
        {overlays.bands}
        {timelineRows.map((row) => {
          if(row.group)return <button type="button" className="timeline-group-heading" data-timeline-group={row.group.id} aria-expanded={!collapsedGroups.includes(row.group.id)} key={row.key} onClick={()=>onToggleGroup?.(row.group!.id)}><ChevronRight size={13} style={{transform:collapsedGroups.includes(row.group.id)?undefined:"rotate(90deg)"}}/>{row.group.name}<span>{row.group.projects.length}</span></button>;
          const p=row.project;
          const dates = datesFor(p),
            dated = Number.isFinite(dates.start) && Number.isFinite(dates.end),
            isVisible = dated && dates.end >= view.start && dates.start <= end;
          return (
            <div
              className={`feature-timeline-row ${selected.includes(p.id) ? "selected" : ""} ${connection?.targetId === p.id ? (connection.error ? "dependency-invalid" : "dependency-target") : ""}`}
              data-timeline-project={p.id}
              key={row.key}
            >
              <div className="timeline-project-label" onContextMenu={event=>openProjectContext(event,p)}><Link to={`/project/${p.id}`}>
                <Box size={15} />
                {p.name}
              </Link><TimelineProperties project={p} fields={propertyFields} data={data}/></div>
              <div
                className="feature-timeline-track"
                onContextMenu={event=>overlays.onTrackContextMenu(event,p)}
                style={{ backgroundImage: "none" }}
              >
                {ticks.map((t) => (
                  <i
                    className="timeline-grid-line"
                    key={t.time}
                    style={{ left: `${position(t.time)}%` }}
                  />
                ))}
                {isVisible ? (
                  <div
                    role="button"
                    tabIndex={0}
                    data-project-id={p.id}
                    aria-label={`${p.name}, ${date(iso(dates.start))} to ${date(iso(dates.end))}`}
                    aria-pressed={selected.includes(p.id)}
                    title={`${p.name}: ${date(iso(dates.start))} – ${date(iso(dates.end))}${!p.targetDate ? " (estimated)" : ""}`}
                    className={`feature-timeline-bar ${selected.includes(p.id) ? "selected" : ""} ${!p.targetDate ? "timeline-estimated" : ""}`}
                    style={{
                      left: `${Math.max(0, position(dates.start))}%`,
                      width: `${Math.max(2, Math.min(100, position(dates.end)) - Math.max(0, position(dates.start)))}%`,
                      background: p.color || "#5755a4",
                    }}
                    onContextMenu={event=>openProjectContext(event,p)}
                    onFocus={() => setFocused(p.id)}
                    onClick={(e) => {
                      overlays.clearSelection();
                      if (suppressClick.current) {
                        suppressClick.current = false;
                        return;
                      }
                      if (e.shiftKey || e.metaKey || e.ctrlKey)
                        setSelected((ids) =>
                          ids.includes(p.id)
                            ? ids.filter((id) => id !== p.id)
                            : [...ids, p.id],
                        );
                      else setSelected([p.id]);
                    }}
                    onDoubleClick={() => navigate(`/project/${p.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") navigate(`/project/${p.id}`);
                    }}
                    onPointerDown={(e) => begin(e, p, "move")}
                  >
                    <button
                      className="timeline-connection-handle start"
                      aria-label={`Add blocking dependency for ${p.name}`}
                      onPointerDown={(e) => beginConnection(e, p, "start")}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          setDependencyPicker({ id: p.id, side: "start" });
                        }
                      }}
                    />
                    <span
                      className="feature-timeline-resize start"
                      aria-label={`Resize start of ${p.name}`}
                      onPointerDown={(e) => begin(e, p, "start")}
                    />
                    <span className="feature-timeline-bar-label">{p.name}</span>
                    <span
                      className="feature-timeline-resize end"
                      aria-label={`Resize end of ${p.name}`}
                      onPointerDown={(e) => begin(e, p, "end")}
                    />
                    <button
                      className="timeline-connection-handle end"
                      aria-label={`Create dependency from ${p.name}`}
                      onPointerDown={(e) => beginConnection(e, p, "end")}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          setDependencyPicker({ id: p.id, side: "end" });
                        }
                      }}
                    />
                  </div>
                ) : (
                  <button
                    className="feature-timeline-unscheduled"
                    onClick={() => {
                      if(dated){anchorTime.current=(dates.start + dates.end) / 2;setView(timelineWindow(scale,anchorTime.current))}
                      else setEditing(p);
                    }}
                  >
                    {dated ? `Go to ${date(p.startDate)}` : "Set dates"}
                  </button>
                )}
                {overlays.renderMilestones(p)}
              </div>
            </div>
          );
        })}
        <svg
          className="feature-timeline-dependencies"
          viewBox={`0 0 1000 ${Math.max(1, totalHeight)}`}
          preserveAspectRatio="none"
          style={{ height: projects.length * 49 }}
        >
          <defs>
            <marker
              id="timeline-dependency-arrow"
              markerWidth="6"
              markerHeight="6"
              refX="5"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L6,3 L0,6" fill="context-stroke" />
            </marker>
          </defs>
          {(overlays.showDependencies?edges:[]).map((edge) => (
            <g
              key={`${edge.blocked.id}-${edge.blocker.id}`}
              role="button"
              tabIndex={0}
              aria-label={`${edge.blocker.name} blocks ${edge.blocked.name}${edge.violated ? ", dates conflict" : ""}`}
              data-dependency-from={edge.blocker.id}
              data-dependency-to={edge.blocked.id}
              data-violated={edge.violated}
              onClick={(e) => {
                e.stopPropagation();
                setEdgeMenu({ edge, x: e.clientX, y: e.clientY });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  setEdgeMenu({
                    edge,
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2,
                  });
                }
              }}
            >
              <path
                d={edge.path}
                fill="none"
                stroke="transparent"
                strokeWidth="14"
                className="timeline-edge-hit"
              />
              <path
                d={edge.path}
                fill="none"
                stroke={edge.violated ? "#d57178" : "#7087dc"}
                strokeWidth="1.5"
                markerEnd="url(#timeline-dependency-arrow)"
              />
            </g>
          ))}
          {draftPath && (
            <path
              d={draftPath}
              fill="none"
              stroke={connection?.error ? "#d57178" : "#7087dc"}
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
          )}
        </svg>
        {Date.now() >= view.start && Date.now() <= end && (
          <div
            className="feature-timeline-today"
            style={{
              left: showList
                ? `calc(240px + (100% - 240px) * ${position(Date.now()) / 100})`
                : `${position(Date.now())}%`,
            }}
          />
        )}
      </div>
      {overlays.dialogUi}
      {connection?.error && (
        <p role="status" className="timeline-connection-error">
          {connection.error}
        </p>
      )}
      {edgeMenu &&
        createPortal(
          <div
            className="timeline-dependency-menu"
            role="dialog"
            aria-label="Project dependency"
            style={{
              left: Math.max(8, Math.min(window.innerWidth - 280, edgeMenu.x)),
              top: Math.max(8, Math.min(window.innerHeight - 190, edgeMenu.y)),
            }}
          >
            <div>
              <strong>
                {edgeMenu.edge.violated
                  ? "Dates conflict"
                  : "Project dependency"}
              </strong>
              <button
                aria-label="Close dependency menu"
                onClick={() => setEdgeMenu(null)}
              >
                <X size={13} />
              </button>
            </div>
            <p>
              {edgeMenu.edge.blocker.name} blocks {edgeMenu.edge.blocked.name}
            </p>
            {edgeMenu.edge.violated && (
              <p className="feature-error">
                The blocking project finishes after the dependent project
                starts.
              </p>
            )}
            <button
              onClick={() => navigate(`/project/${edgeMenu.edge.blocker.id}`)}
            >
              Open blocking project
            </button>
            <button
              onClick={() => navigate(`/project/${edgeMenu.edge.blocked.id}`)}
            >
              Open dependent project
            </button>
            <button
              onClick={() => {
                void act(() =>
                  update("projects", edgeMenu.edge.blocked.id, {
                    dependencyIds: (
                      edgeMenu.edge.blocked.dependencyIds || []
                    ).filter((id: string) => id !== edgeMenu.edge.blocker.id),
                  }),
                );
                setEdgeMenu(null);
              }}
            >
              Remove dependency
            </button>
          </div>,
          document.body,
        )}
      {dependencyPicker && (
        <FormDialog
          title="Add project dependency"
          fields={[
            {
              key: "projectId",
              label:
                dependencyPicker.side === "end"
                  ? "Dependent project"
                  : "Blocked by project",
              required: true,
              type: "select",
              options: [
                { value: "", label: "Choose project" },
                ...allProjects
                  .filter((p) => p.id !== dependencyPicker.id)
                  .map((p) => ({ value: p.id, label: p.name })),
              ],
            },
          ]}
          submit="Add dependency"
          onClose={() => setDependencyPicker(null)}
          onSave={(v) =>
            connect(dependencyPicker.id, dependencyPicker.side, v.projectId)
          }
        />
      )}{" "}
      {editing && (
        <FormDialog
          title={`Schedule ${editing.name}`}
          fields={[
            {
              key: "startDate",
              label: "Start date",
              required: true,
              type: "date",
            },
            {
              key: "targetDate",
              label: "Target date",
              required: true,
              type: "date",
            },
          ]}
          initial={{
            startDate: iso(Date.now()),
            targetDate: iso(Date.now() + 14 * DAY),
          }}
          submit="Set dates"
          onClose={() => setEditing(null)}
          onSave={(v) => {
            if (v.targetDate < v.startDate)
              throw Error("Target date must be on or after the start date.");
            return act(() =>
              update("projects", editing.id, { ...v, datePrecision: "day" }),
            );
          }}
        />
      )}
    </div>
  );
}
