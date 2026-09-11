import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  percentile,
  type InsightDatum,
  type InsightData,
} from "./insight-data";
const colors = [
  "#7775df",
  "#e5b65b",
  "#57ad83",
  "#69a8da",
  "#ce83ad",
  "#ca7b69",
  "#8b9d72",
  "#9899a4",
];
const format = (n: number) =>
  Number.isInteger(n) ? String(n) : n.toFixed(n < 1 ? 2 : 1);
type Point = { row: InsightDatum; key: string; bucket: string; segment: string; x: number; y: number; color: string };
export function InsightScatter({
  result,
  onSelect,
  highlight,
  onHover,
  percentileValues=[.5,.95],
  scale='log',
  colorMap,
  colorByBucket=false,
}: {
  result: InsightData;
  onSelect: (rows: InsightDatum[]) => void;
  highlight?: {bucket?:string;segment?:string}|null;
  onHover?: (value:{bucket?:string;segment?:string}|null)=>void;
  percentileValues?:number[];
  colorMap?:Map<string,string>;
  colorByBucket?:boolean;
  scale?:'linear'|'log';
}) {
  const ref = useRef<HTMLCanvasElement>(null),
    [cap, setCap] = useState<number | null>(null),
    [selectedId, setSelectedId] = useState<string | null>(null),
    [size, setSize] = useState({ width: 900, height: 280 });
  const { rows, buckets, unit } = result,
    peak = cap ?? rows.reduce((max, row) => Math.max(max, row.value), 1);
  const { points, index, byIssueId } = useMemo(() => {
    const groupIndex = new Map(buckets.map((b, i) => [b.key??b.label, i])),
      segments = new Map(
        [...new Set(rows.flatMap((r) => r.segmentKeys || r.segments || [r.segment]))].map((s, i) => [
          s,
          colors[i % colors.length],
        ]),
      ),
      width = 820 / Math.max(1, buckets.length),
      points: Point[] = [],
      index = new Map<string, Point[]>();
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.value > peak) continue;
      for (const groupName of row.groupKeys??row.groups) for (const segmentName of row.segmentKeys || row.segments || [row.segment]) {
      const group = groupIndex.get(groupName) ?? 0,
        jitter = (((row.issue.id.charCodeAt(0) + i * 7) % 17) - 8) / 20,
        p = {
          row,
          key: JSON.stringify([row.issue.id, groupName, segmentName]),
          bucket: groupName,
          segment: segmentName,
          x: 50 + width * (group + 0.5 + jitter * 0.7),
          y: 225 - (scale==='log'?Math.log1p(row.value)/Math.log1p(peak):row.value/peak) * 195,
          color: colorMap?.get(colorByBucket?groupName:segmentName)||segments.get(segmentName)!,
        };
      points.push(p);
      const key = Math.floor(p.x / 12) + ":" + Math.floor(p.y / 12),
        values = index.get(key) || [];
      values.push(p);
      index.set(key, values);
      }
    }
    return { points, index, byIssueId: new Map(points.map(point => [point.key, point])) };
  }, [rows, buckets, peak,scale,colorMap,colorByBucket]);
  const selected = selectedId ? byIssueId.get(selectedId) ?? null : null;
  const selectPoint = (point: Point | null) => {setSelectedId(point?.key ?? null);onHover?.(point?{bucket:point.bucket,segment:point.segment}:null)};
  const highlighted = (point:Point) => !!highlight && (!highlight.bucket || point.bucket===highlight.bucket) && (!highlight.segment || point.segment===highlight.segment);
  useEffect(() => { if (selectedId && !byIssueId.has(selectedId)) setSelectedId(null); }, [selectedId, byIssueId]);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() =>
      setSize({ width: canvas.clientWidth, height: canvas.clientHeight }),
    );
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !size.width || !size.height) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size.width * dpr;
    canvas.height = size.height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(canvas.width / 900, 0, 0, canvas.height / 280, 0, 0);
    ctx.clearRect(0, 0, 900, 280);
    for (const color of new Set(points.map((point) => point.color))) {
      ctx.beginPath();
      for (const p of points)
        if (p.color === color) {
          ctx.moveTo(p.x + 3, p.y);
          ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        }
      ctx.fillStyle = color;
      ctx.globalAlpha = highlight ? 0.18 : 0.72;
      ctx.fill();
      if(highlight){ctx.beginPath();for(const point of points)if(point.color===color&&highlighted(point)){ctx.moveTo(point.x+4,point.y);ctx.arc(point.x,point.y,4,0,Math.PI*2)}ctx.globalAlpha=1;ctx.fill();}
    }
    if (selected) {
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(selected.x, selected.y, 6, 0, Math.PI * 2);
      ctx.strokeStyle =
        getComputedStyle(canvas).getPropertyValue("--text") || "#fff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }, [points, selected, size, highlight]);
  const hit = (event: React.MouseEvent) => {
    const bounds = event.currentTarget.getBoundingClientRect(),
      x = ((event.clientX - bounds.left) / bounds.width) * 900,
      y = ((event.clientY - bounds.top) / bounds.height) * 280;
    let best: Point | null = null,
      distance = 64;
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (const point of index.get(
          Math.floor(x / 12) + dx + ":" + (Math.floor(y / 12) + dy),
        ) || []) {
          const d = (point.x - x) ** 2 + (point.y - y) ** 2;
          if (d < distance) {
            distance = d;
            best = point;
          }
        }
    return best;
  };
  const quantiles = useMemo(() => {
    const values = rows.map((r) => r.value);
    return percentileValues.map((p) => ({
      p,
      value: percentile(values, p),
    }));
  }, [rows,percentileValues]);
  return (
    <div className="feature-insight-scatter">
      <div className="feature-scatter-surface">
        <canvas
          ref={ref}
          role="img"
          tabIndex={0}
          aria-label={`Issue scatterplot, ${points.length} plotted issues. Use arrow keys to inspect points and Enter to open an issue.`}
          data-point-count={points.length}
          data-highlighted-point-count={highlight?points.filter(highlighted).length:0}
          onMouseMove={(e) => selectPoint(hit(e))}
          onMouseLeave={() => selectPoint(null)}
          onClick={(e) => {
            const point = hit(e);
            if (point) onSelect([point.row]);
          }}
          onKeyDown={(e) => {
            if (
              [
                "ArrowLeft",
                "ArrowRight",
                "ArrowUp",
                "ArrowDown",
                "Home",
                "End",
              ].includes(e.key)
            ) {
              e.preventDefault();
              e.stopPropagation();
              const current = selected ? points.indexOf(selected) : -1,
                next =
                  e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? points.length - 1
                      : Math.max(
                          0,
                          Math.min(
                            points.length - 1,
                            current +
                              (["ArrowLeft", "ArrowUp"].includes(e.key)
                                ? -1
                                : 1),
                          ),
                        );
              selectPoint(points[next] ?? null);
            } else if (e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              if (selected) onSelect([selected.row]);
            } else if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              selectPoint(null);
            }
          }}
        />
        <svg
          viewBox="0 0 900 280"
          className="feature-scatter-axes"
          aria-hidden="true"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <g key={t}>
              <line
                x1="50"
                x2="870"
                y1={225 - t * 195}
                y2={225 - t * 195}
                stroke="var(--border)"
                strokeDasharray="2 4"
              />
              <text x="40" y={229 - t * 195} textAnchor="end">
                {format(scale==='log'?Math.expm1(Math.log1p(peak)*t):peak*t)}
              </text>
            </g>
          ))}
          {buckets.map((bucket, i) => (
            <text
              key={bucket.key??bucket.label}
              x={50 + (820 / Math.max(1, buckets.length)) * (i + 0.5)}
              y="255"
              textAnchor="middle"
            >
              {bucket.label.length > 17
                ? bucket.label.slice(0, 15) + "…"
                : bucket.label}
            </text>
          ))}
        </svg>
        {selected && (
          <div className="feature-insight-tooltip" role="status">
            {selected.row.issue.identifier} {selected.row.issue.title} ·{" "}
            {format(selected.row.value)} {unit} · {buckets.find(bucket=>(bucket.key??bucket.label)===selected.bucket)?.label??selected.bucket} · {result.segmentLabels?.[selected.segment]??selected.segment}
          </div>
        )}
      </div>
      <div className="feature-percentile-controls">
        {quantiles.map(({ p, value }) => {
          return (
            <button
              className="feature-button"
              key={p}
              aria-label={`Zoom to ${p * 100}th percentile`}
              aria-pressed={cap === value}
              onClick={() => {
                setCap(cap === value ? null : Math.max(0.01, value));
                selectPoint(null);
              }}
            >
              {p * 100}% · {format(value)} {unit}
            </button>
          );
        })}
        {cap !== null && (
          <button className="feature-button" onClick={() => setCap(null)}>
            Reset percentile zoom
          </button>
        )}
      </div>
      <button
        className="feature-scatter-explore"
        onClick={() => onSelect(rows)}
      >
        Explore all {rows.length.toLocaleString()} issues
      </button>
      <span className="muted feature-scatter-count">
        {cap === null
          ? `${points.length.toLocaleString()} points plotted`
          : `${points.length.toLocaleString()} of ${rows.length.toLocaleString()} points within zoom`}
      </span>
    </div>
  );
}
export function InsightIssueList({ rows }: { rows: InsightDatum[] }) {
  const ref = useRef<HTMLDivElement>(null),
    virtual = useVirtualizer({
      count: rows.length,
      getScrollElement: () => ref.current,
      estimateSize: () => 42,
      overscan: 6,
    });
  return (
    <div
      className="feature-insight-drilldown"
      ref={ref}
      data-issue-count={rows.length}
    >
      <div style={{ height: virtual.getTotalSize(), position: "relative" }}>
        {virtual.getVirtualItems().map((item) => {
          const issue = rows[item.index].issue;
          return (
            <Link
              key={issue.id}
              to={"/issues/" + issue.id}
              style={{
                position: "absolute",
                top: item.start,
                left: 0,
                right: 0,
                height: item.size,
              }}
            >
              <span className="muted">{issue.identifier}</span>
              <span>{issue.title}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
