import {guestCapabilities} from '../shared/guest-capabilities';
import {insightIntervals} from './features/insight-options';
import React, { useEffect, useMemo, useState } from "react";
import {AddViewInsight} from "./features/add-view-insight";
import { useNavigate, useParams } from "react-router-dom";
import type { Entity } from "../shared/types";
import type { FilterSpec } from "./query";
import { useAppStore } from "./store";
import { Icon } from "./components/ui";
import { InsightChart, InsightControls } from "./features/insights";
import {
  calculateInsight,
  defaultInsight,
  measures,
  slices,
  percentile,
  type InsightConfig,
  type InsightDatum,
} from "./features/insight-data";
import "./view-insights.css";

const format = (n: number) =>
  Number.isInteger(n) ? String(n) : n.toFixed(n < 1 ? 2 : 1);
function readConfig(key: string): InsightConfig {
  try {
    const raw = JSON.parse(
      new URLSearchParams(location.search).get("insights") ||
        localStorage.getItem(`insights:${key}`) ||
        "{}",
    );
    return {
      ...defaultInsight,
      measure: measures.includes(raw.measure)
        ? raw.measure
        : defaultInsight.measure,
      group: slices.includes(raw.group) ? raw.group : defaultInsight.group,
      segment: ["None", ...slices].includes(raw.segment) ? raw.segment : "None",
      chartType: ["Auto", "Bar", "Scatter", "Table", "Metric"].includes(
        raw.chartType,
      )
        ? raw.chartType
        : "Auto",
      interval: insightIntervals.includes(raw.interval)?raw.interval:"month",
      showArchived: raw.showArchived === true,
      excludeNoPriority: raw.excludeNoPriority === true,
      measureStatusTypes:Array.isArray(raw.measureStatusTypes)?raw.measureStatusTypes.filter((value:unknown)=>typeof value==='string'):undefined,
      measureStatusIds:Array.isArray(raw.measureStatusIds)?raw.measureStatusIds.filter((value:unknown)=>typeof value==='string'):undefined,
      latencyPercentiles:Array.isArray(raw.latencyPercentiles)?raw.latencyPercentiles.filter((value:unknown)=>[.25,.5,.75,.95].includes(Number(value))):undefined,
      colorScale:raw.colorScale==='categorical'?'categorical':'default',
      hideEmptyDimension:raw.hideEmptyDimension===true,hideEmptySegment:raw.hideEmptySegment===true,hideUnknownCustomer:raw.hideUnknownCustomer===true,order:typeof raw.order==='string'?raw.order:undefined,direction:raw.direction==='desc'?'desc':'asc',fiscalMonth:Number.isInteger(raw.fiscalMonth)?Math.max(0,Math.min(11,raw.fiscalMonth)):undefined,
      groupLabelGroupId:typeof raw.groupLabelGroupId==='string'?raw.groupLabelGroupId:undefined,
      segmentLabelGroupId:typeof raw.segmentLabelGroupId==='string'?raw.segmentLabelGroupId:undefined,
      latencyScale:raw.latencyScale==='linear'?'linear':'log',
    };
  } catch {
    return defaultInsight;
  }
}
type Criterion = { bucket?: string; segment?: string;threshold?:number;percentile?:number;operator?:'lte'|'gt' };
export function ViewInsights({
  rows,
  scopeKey,
  title,
  context,
  onClose,
  onSelect,
  onArchived,
  resetKey,
}: {
  rows: Entity[];
  scopeKey: string;
  title: string;
  context: {
    filter: FilterSpec;
    query: string;
    showCompleted: boolean;
    showSubIssues: boolean;
  };
  resetKey: number;
  onClose: () => void;
  onSelect: (ids: string[] | null) => void;
  onArchived: (enabled: boolean) => void;
}) {
  const store = useAppStore(),
    navigate = useNavigate();
  const {viewId}=useParams(),sourceView=store.data.views.find(view=>view.id===viewId);
  const guestAccess=guestCapabilities(store.data,store.user?.id),canEdit=!guestAccess.guest||!!sourceView&&guestAccess.canEntity(sourceView);
  const [adding,setAdding]=useState(false);
  const [config, setConfig] = useState(() => sourceView?.insightConfig || readConfig(scopeKey)),
    [expanded, setExpanded] = useState(false),
    [criterion, setCriterion] = useState<Criterion | null>(null),
    [hover, setHover] = useState<Criterion | null>(null);
  const result = useMemo(
    () => calculateInsight({ ...store.data, issues: rows }, config),
    [
      rows,
      store.data.statuses,
      store.data.users,
      store.data.projects,
      store.data.cycles,
      store.data.teams,
      store.data.labels,
      store.data.labelGroups,
      store.data.customers,
      store.data.requests,
      store.data.initiatives,
      store.data.milestones,
      store.data.templates,
      store.data.workspaces,
      store.data.activities,
      config,
    ],
  );
  useEffect(()=>{if(sourceView?.insightConfig)setConfig(sourceView.insightConfig)},[sourceView?.insightConfig]);
  const segments = [...new Set(result.rows.flatMap((row) => row.segmentKeys || row.segments || [row.segment]))];
  useEffect(() => {
    setCriterion(null);
  }, [resetKey]);
  useEffect(() => {
    try {
      localStorage.setItem(`insights:${scopeKey}`, JSON.stringify(config));
    } catch {}
    onArchived(config.showArchived);
  }, [scopeKey, config, onArchived]);
  useEffect(() => {
    if (!criterion) {
      onSelect(null);
      return;
    }
    onSelect(
      result.rows
        .filter(
          (row) =>
            (!criterion.bucket || (row.groupKeys??row.groups).includes(criterion.bucket)) &&
            (!criterion.segment || (row.segmentKeys || row.segments || [row.segment]).includes(criterion.segment))&&
            (criterion.threshold===undefined||(criterion.operator==='gt'?row.value>criterion.threshold:row.value<=criterion.threshold)),
        )
        .map((row) => row.issue.id),
    );
  }, [criterion, result, onSelect]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        expanded &&
        !document.querySelector('[role="dialog"]')
      ) {
        event.preventDefault();
        setExpanded(false);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [expanded]);
  const choose = (value: Criterion) =>
    setCriterion((current) =>
      JSON.stringify(current) === JSON.stringify(value) ? null : value,
    );
  const selectChart = (selected: InsightDatum[], selection?: Criterion) => {
    if (
      (config.chartType === "Scatter" ||
        (config.chartType === "Auto" && result.duration)) &&
      selected.length === 1
    )
      navigate(`/issues/${selected[0].issue.id}`);
    else if (selection) choose(selection);
    else choose({});
  };
  const configure = (next: InsightConfig) => {
    setConfig(next);
    if(canEdit&&sourceView?.insightConfig)void store.update("views",sourceView.id,{insightConfig:next}).catch(error=>store.toast(error.message));
    setCriterion(null);
    setHover(null);
  };
  const share = async () => {
    const url = new URL(location.href);
    url.searchParams.set("insights", JSON.stringify(config));
    url.searchParams.set("insightContext", JSON.stringify(context));
    try {
      await navigator.clipboard.writeText(url.href);
      store.toast("Insight link copied");
    } catch {
      store.toast("Unable to copy insight link");
    }
  };
  return (
    <aside
      className={`view-insights ${expanded ? "expanded" : ""}`}
      aria-label="View insights"
    >
      {adding&&<AddViewInsight config={config} filter={context.filter} viewId={viewId} title={title} onClose={()=>setAdding(false)}/>}
      <header>
        <div>
          <strong>Insights</strong>
          <small>{title}</small>
        </div>
        {canEdit&&<button className="icon-button" aria-label="Add to dashboard" onClick={()=>setAdding(true)}><Icon name="Plus" size={15}/></button>}
        <button
          className="icon-button"
          aria-label="Copy insight link"
          onClick={() => void share()}
        >
          <Icon name="Link" size={15} />
        </button>
        <button
          className="icon-button"
          aria-label={expanded ? "Collapse insights" : "Expand insights"}
          onClick={() => setExpanded(!expanded)}
        >
          <Icon name={expanded ? "Minimize2" : "Maximize2"} size={15} />
        </button>
        <button
          className="icon-button"
          aria-label="Close insights"
          onClick={onClose}
        >
          <Icon name="X" size={15} />
        </button>
      </header>
      <div className="view-insights-body">
        <InsightControls
          value={config}
          onChange={configure}
          showFilters={false}
        />
        {criterion && (
          <button
            className="insight-selection-chip"
            onClick={() => setCriterion(null)}
            aria-label="Clear insight selection"
          >
            <Icon name="Filter" size={13} />
            {[criterion.bucket?(result.buckets.find(bucket=>(bucket.key??bucket.label)===criterion.bucket)?.label??config.group):undefined,criterion.segment?(result.segmentLabels?.[criterion.segment]??config.segment):undefined,criterion.percentile!==undefined?`${criterion.operator==='gt'?'Above':'At or below'} P${criterion.percentile*100}`:undefined]
              .filter(Boolean)
              .join(" · ") || "All measured issues"}
            <Icon name="X" size={12} />
          </button>
        )}
        {result.rows.length ? (
          <>
            <InsightChart
              result={result}
              config={config}
              onSelect={selectChart}
              highlight={hover}
              onHover={setHover}
            />
            {config.chartType !== "Metric" && (
              <div className="feature-insight-table-scroll">
                <table className="feature-table feature-insight-table view-insight-table">
                  <thead>
                    <tr>
                      <th>
                        {config.group === "Burn-up" ? "Measure" : config.group}
                      </th>
                      <th>
                        <button onClick={() => choose({})}>
                          {result.duration?"Issues":config.measure}
                        </button>
                      </th>
                      {config.segment !== "None" &&
                        segments.map((segment) => (
                          <th key={segment}>
                            <button
                              onClick={() => choose({ segment })}
                              onMouseEnter={() => setHover({ segment })}
                              onMouseLeave={() => setHover(null)}
                            >
                              {result.segmentLabels?.[segment]??segment}
                            </button>
                          </th>
                        ))}
                      {result.duration&&(config.latencyPercentiles??[.5,.95]).map((value:number)=><th key={value}><button aria-label={'Filter at or below P'+value*100} onClick={()=>choose({percentile:value,threshold:percentile(result.rows.map(row=>row.value),value)})}>P{value*100}</button><button aria-label={'Filter above P'+value*100} onClick={()=>choose({percentile:value,threshold:percentile(result.rows.map(row=>row.value),value),operator:'gt'})}>Above</button></th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {result.buckets.map((bucket) => (
                      <tr
                        key={bucket.key??bucket.label}
                        data-highlighted={hover?.bucket === (bucket.key??bucket.label)}
                      >
                        <td>
                          <button
                            aria-label={`Filter view by ${bucket.label}`}
                            aria-pressed={
                              criterion?.bucket === (bucket.key??bucket.label) &&
                              !criterion.segment
                            }
                            onClick={() => choose({ bucket: bucket.key??bucket.label })}
                            onMouseEnter={() =>
                              setHover({ bucket: bucket.key??bucket.label })
                            }
                            onMouseLeave={() => setHover(null)}
                          >
                            {bucket.label}
                          </button>
                        </td>
                        <td>
                          <button
                            onClick={() => choose({ bucket: bucket.key??bucket.label })}
                          >
                            {result.duration?bucket.count:format(bucket.value)} {result.duration?"issues":result.unit}
                          </button>
                        </td>
                        {config.segment !== "None" &&
                          segments.map((segment) => {
                            const cell = bucket.segments.find(
                              (item) => (item.key??item.label) === segment,
                            );
                            return (
                              <td key={segment}>
                                <button
                                  disabled={!cell}
                                  aria-label={`Filter ${bucket.label}, ${result.segmentLabels?.[segment]??segment}`}
                                  onClick={() =>
                                    choose({ bucket: bucket.key??bucket.label, segment })
                                  }
                                  onMouseEnter={() =>
                                    setHover({ bucket: bucket.key??bucket.label, segment })
                                  }
                                  onMouseLeave={() => setHover(null)}
                                >
                                  {format(cell?.value ?? 0)}
                                </button>
                              </td>
                            );
                          })}
                        {result.duration&&(config.latencyPercentiles??[.5,.95]).map((value:number)=>{const threshold=percentile(bucket.rows.map(row=>row.value),value);return <td key={value}><button aria-label={'Filter '+bucket.label+' at or below P'+value*100} onClick={()=>choose({bucket:bucket.key??bucket.label,percentile:value,threshold})} onMouseEnter={()=>setHover({bucket:bucket.key??bucket.label})} onMouseLeave={()=>setHover(null)}>{format(threshold)} d</button><button aria-label={'Filter '+bucket.label+' above P'+value*100} onClick={()=>choose({bucket:bucket.key??bucket.label,percentile:value,threshold,operator:'gt'})}>{bucket.rows.filter(row=>row.value>threshold).length} above</button></td>})}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="feature-analysis-total" aria-live="polite">
              {result.rows.length} {result.duration ? "measured" : "matching"}{" "}
              issues
              {result.duration ? ` · ${format(result.total)} days average` : ""}
            </div>
          </>
        ) : (
          <div className="view-insight-empty">
            <Icon name="ChartNoAxesColumn" size={24} />
            <strong>No matching data</strong>
            <p>
              {result.duration
                ? "This measure needs issues with the relevant recorded timestamps."
                : "Adjust the view filters to include issues."}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
