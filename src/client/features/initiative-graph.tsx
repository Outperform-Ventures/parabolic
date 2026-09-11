import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Entity } from "../../shared/types";
import { useAppStore } from "../store";
import { Icon } from "../components/ui";
import { EntityIcon } from "./entity-icon";
import { initiativeCompletionGraph } from "./initiative-graph-data";
import "./initiative-graph.css";

const W = 900,
  H = 280,
  L = 4,
  R = 4,
  T = 16,
  B = 28;
function curve(points: { x: number; y: number }[]) {
  if (!points.length) return "";
  let path = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const previous = points[i - 1],
      current = points[i],
      center = (previous.x + current.x) / 2;
    path += ` C${center},${previous.y} ${center},${current.y} ${current.x},${current.y}`;
  }
  return path;
}
export function InitiativeGraph({
  initiative,
  directOnly = false,
}: {
  initiative: Entity;
  directOnly?: boolean;
}) {
  const { data } = useAppStore();
  const graph = useMemo(
    () => initiativeCompletionGraph(data, initiative.id, directOnly),
    [
      initiative.id,
      directOnly,
      data.initiatives,
      data.projects,
      data.issues,
      data.statuses,
      data.activities,
    ],
  );
  const [focused, setFocused] = useState<string | null>(null),
    [hovered, setHovered] = useState<string | null>(null),
    [week, setWeek] = useState<number | null>(null),
    [query, setQuery] = useState("");
  const active = focused ?? hovered,
    selectedWeek = Math.max(
      0,
      Math.min(graph.weeks.length - 1, week ?? graph.weeks.length - 1),
    );
  const totals = graph.weeks.map((_, index) =>
      graph.series.reduce((sum, series) => sum + series.values[index], 0),
    ),
    peak = Math.max(1, ...totals);
  const x = (index: number) =>
      L + (index / Math.max(1, graph.weeks.length - 1)) * (W - L - R),
    y = (value: number) => H - B - (value / peak) * (H - B - T);
  const base = graph.weeks.map(() => 0),
    shapes = graph.series.map((series) => {
      const bottom = base.map((value, index) => ({ x: x(index), y: y(value) }));
      const top = series.values.map((value, index) => {
        base[index] += value;
        return { x: x(index), y: y(base[index]) };
      });
      return {
        series,
        area:
          curve(top) +
          " L" +
          bottom.at(-1)!.x +
          "," +
          bottom.at(-1)!.y +
          curve(bottom.slice().reverse()).replace(/^M[^ ]+/, "") +
          " Z",
        line: curve(top),
      };
    });
  const label = (index: number) =>
    new Date(graph.weeks[index]).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  const ranking = graph.series
    .slice()
    .sort(
      (a, b) =>
        b.values[selectedWeek] - a.values[selectedWeek] || b.total - a.total,
    );
  const activeSeries = graph.series.find(
    (series) => series.project.id === active,
  );
  return (
    <section
      className="initiative-completion-graph"
      aria-label="Initiative project progress"
    >
      <header>
        <h3>Progress</h3>
        <span>
          {graph.total} completed {graph.total === 1 ? "issue" : "issues"}
        </span>
        {focused && (
          <button onClick={() => setFocused(null)}>
            <Icon name="X" size={12} />
            Clear project focus
          </button>
        )}
      </header>
      {!graph.series.length ? (
        <p className="muted">Add projects to see their progress over time.</p>
      ) : (
        <>
          <div
            className="initiative-graph-plot"
            onMouseLeave={() => {
              setHovered(null);
              setWeek(null);
            }}
          >
            <svg
              viewBox={`0 0 ${W} ${H}`}
              role="group"
              aria-label="Project completion activity by week"
              tabIndex={0}
              onKeyDown={(event) => {
                if (
                  ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
                ) {
                  event.preventDefault();
                  setWeek(
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? graph.weeks.length - 1
                        : Math.max(
                            0,
                            Math.min(
                              graph.weeks.length - 1,
                              selectedWeek +
                                (event.key === "ArrowLeft" ? -1 : 1),
                            ),
                          ),
                  );
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setFocused(null);
                  setHovered(null);
                  setWeek(null);
                }
              }}
              onMouseMove={(event) => {
                const bounds = event.currentTarget.getBoundingClientRect();
                setWeek(
                  Math.max(
                    0,
                    Math.min(
                      graph.weeks.length - 1,
                      Math.round(
                        ((((event.clientX - bounds.left) / bounds.width) * W -
                          L) /
                          (W - L - R)) *
                          (graph.weeks.length - 1),
                      ),
                    ),
                  ),
                );
              }}
            >
              <line
                x1={L}
                x2={W - R}
                y1={H - B}
                y2={H - B}
                stroke="var(--border)"
              />
              {shapes.map(({ series, area, line }) => {
                const chosen = active === series.project.id,
                  color = chosen
                    ? series.project.color || "#d88464"
                    : "#82828a";
                return (
                  <g
                    key={series.project.id}
                    data-initiative-graph-project={series.project.id}
                    data-focused={chosen}
                  >
                    <path
                      d={area}
                      fill={color}
                      fillOpacity={chosen ? 0.3 : active ? 0.04 : 0.085}
                      onMouseEnter={() => setHovered(series.project.id)}
                      onClick={() =>
                        setFocused(
                          focused === series.project.id
                            ? null
                            : series.project.id,
                        )
                      }
                    >
                      <title>
                        {series.project.name}: {series.total} completed{" "}
                        {series.total === 1 ? "issue" : "issues"}
                      </title>
                    </path>
                    <path
                      d={line}
                      fill="none"
                      stroke={color}
                      strokeOpacity={chosen ? 1 : active ? 0.25 : 0.55}
                      strokeWidth={chosen ? 2 : 1.25}
                      pointerEvents="none"
                    />
                  </g>
                );
              })}
              {week !== null && (
                <line
                  x1={x(selectedWeek)}
                  x2={x(selectedWeek)}
                  y1={T}
                  y2={H - B}
                  stroke="var(--muted)"
                  strokeDasharray="3 4"
                  pointerEvents="none"
                />
              )}
              <text x={L} y={H - 5}>
                {label(0)}
              </text>
              <text x={W - R} y={H - 5} textAnchor="end">
                {label(graph.weeks.length - 1)}
              </text>
            </svg>
            {week !== null && (
              <div className="initiative-graph-tooltip" aria-live="polite">
                <strong>Week of {label(selectedWeek)}</strong>
                {(activeSeries
                  ? [activeSeries]
                  : ranking
                      .filter((series) => series.values[selectedWeek])
                      .slice(0, 4)
                ).map((series) => (
                  <div key={series.project.id}>
                    <EntityIcon
                      entity={series.project}
                      fallback="Box"
                      size={14}
                    />
                    <span>{series.project.name}</span>
                    <b>{series.values[selectedWeek]} completed</b>
                  </div>
                ))}
                {!activeSeries && !totals[selectedWeek] && (
                  <span>No completions recorded this week</span>
                )}
              </div>
            )}
          </div>
          <details className="initiative-graph-projects">
            <summary>
              Projects <span>{graph.series.length}</span>
              <Icon name="ChevronDown" size={12} />
            </summary>
            <input
              aria-label="Find project in progress graph"
              placeholder="Find a project…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div>
              {ranking
                .filter((series) =>
                  series.project.name
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .map((series) => (
                  <div
                    key={series.project.id}
                    className="initiative-graph-project-row"
                  >
                    <button
                      aria-label={`Focus ${series.project.name} in graph`}
                      aria-pressed={focused === series.project.id}
                      onClick={() =>
                        setFocused(
                          focused === series.project.id
                            ? null
                            : series.project.id,
                        )
                      }
                      onMouseEnter={() => setHovered(series.project.id)}
                      onMouseLeave={() => setHovered(null)}
                    >
                      <EntityIcon
                        entity={series.project}
                        fallback="Box"
                        size={14}
                      />
                      <span>{series.project.name}</span>
                      <small>{series.total} completed</small>
                    </button>
                    <Link
                      to={`/project/${series.project.id}`}
                      aria-label={`Open ${series.project.name}`}
                    >
                      <Icon name="ArrowUpRight" size={13} />
                    </Link>
                  </div>
                ))}
            </div>
          </details>
        </>
      )}
    </section>
  );
}
