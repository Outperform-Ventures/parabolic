import {guestCapabilities} from '../../shared/guest-capabilities';
import {useInsightTheme} from './insight-theme';
import {insightColorChoice,insightColors} from './insight-colors';
import {availableInsightDimensions,availableInsightIntervals,availableInsightSegments,insightIntervals,type InsightInterval} from './insight-options';
import {dashboardSource,dashboardIssueVisible} from "./dashboard-source";
import {useCalendarDay} from '../due-date';
import { InsightScatter, InsightIssueList } from "./insight-scatter";
import { DashboardGrid } from "./dashboard-grid";
import { dashboardLayout } from "./dashboard-layout";
import React, { useMemo, useState } from "react";
import {
  Link,
  useNavigate,
  useLocation,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ChartNoAxesColumn,
  LayoutDashboard,
  Plus,
  ArrowUp,
  ArrowDown,
  Pencil,
  Trash2,
  Copy,
  RefreshCw,
  Filter,
  X,
} from "lucide-react";
import { FilterBuilder } from "../issues";
import { type FilterSpec } from "../query";
import {
  Action,
  AddButton,
  Blank,
  EntityMenu,
  FormDialog,
  Header,
  IssueLinks,
  live,
  Metric,
  MultipleProperty,
  optionList,
  useActions,
  type Row,
} from "./shared";
import {
  calculateInsight,
  defaultInsight,
  measures,
  percentile,
  slices,
  type InsightConfig,
  type InsightDatum,
  type InsightData,
} from "./insight-data";
const palette = [
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
const decodeConfig = (value: any): InsightConfig => ({
  ...defaultInsight,
  ...value,
  filters: value?.filters || {
    conditions: value?.teamId
      ? [{ field: "teamId", operator: "eq", value: value.teamId }]
      : [],
    match: "all",
  },
});

export function InsightControls({
  value,
  onChange,
  showFilters = true,
}: {
  value: InsightConfig;
  onChange: (v: InsightConfig) => void;
  showFilters?: boolean;
}) {
  const {data}=useActions(),params=useParams(),location=useLocation();
  const scopedTeams=params.teamId?data.teams.filter(team=>team.id===params.teamId):params.projectId?data.teams.filter(team=>data.projects.find(project=>project.id===params.projectId)?.teamIds?.includes(team.id)):data.teams.filter(team=>!team.deletedAt);
  const context={project:!!params.projectId||location.pathname.startsWith('/project/'),cycle:!!params.cycleId,customers:data.workspaces[0]?.customersEnabled!==false};
  const available=availableInsightDimensions(slices,value.measure,scopedTeams,context);
  const set = (patch: Partial<InsightConfig>) =>{const next={...value,...patch};if(patch.group){next.hideEmptyDimension=false;const intervals=availableInsightIntervals(next.group,context.cycle);if(!intervals.includes(next.interval))next.interval=intervals[0];const choices=availableInsightSegments(next.group,available);if(!choices.includes(next.segment))next.segment='None';}if(patch.segment)next.hideEmptySegment=false;if(patch.measure){const choices=availableInsightDimensions(slices,next.measure,scopedTeams,context);if(!choices.includes(next.group))next.group=choices.includes('Created date')?'Created date':choices[0];if(!['Issue count','Effort'].includes(next.measure))next.segment='None';}onChange(next);};
  const duration = !["Issue count", "Effort"].includes(value.measure);
  return (
    <>
      <div className="feature-analysis-controls">
        <label>
          Measure
          <select
            className="input"
            aria-label="Measure"
            value={value.measure}
            onChange={(e) =>
              set({
                measure: e.target.value,
                ...(!["Issue count", "Effort"].includes(e.target.value) &&
                value.group === "Burn-up"
                  ? { group: "Status" }
                  : {}),
              })
            }
          >
            {measures.filter(measure=>measure===value.measure||measure!=='Triage Time'&&(measure!=='Effort'||!scopedTeams.length||scopedTeams.some(team=>team.estimateScale!=='None'))).map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <label>
          Slice
          <select
            className="input"
            aria-label="Slice"
            value={value.group}
            onChange={(e) => set({ group: e.target.value })}
          >
            {[...new Set([value.group,...available])]
              .map((m) => (
                <option key={m}>{m}</option>
              ))}
          </select>
        </label>
        {!duration&&<label>
          Segment
          <select
            className="input"
            aria-label="Segment"
            value={value.segment}
            onChange={(e) => set({ segment: e.target.value })}
          >
            {["None", ...availableInsightSegments(value.group,available)].map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>}
        <label>
          Display
          <select
            className="input"
            aria-label="Insight display"
            value={value.chartType}
            onChange={(e) => set({ chartType: e.target.value })}
          >
            {["Auto", duration?"Scatter":"Bar", "Table", "Metric"].map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        {(value.group === "Burn-up" || value.group.endsWith(" date") || value.segment.endsWith(" date")) && (
          <label>
            Interval
            <select
              className="input"
              aria-label="Interval"
              value={value.interval}
              onChange={(e) =>
                set({ interval: e.target.value as InsightInterval })
              }
            >
              {availableInsightIntervals(value.group,context.cycle).map(interval=><option key={interval} value={interval}>{{thirtyMinutes:'Every 30 minutes',day:'Daily',week:'Weekly',month:'Monthly',quarter:'Quarterly',year:'Yearly'}[interval]}</option>)}
            </select>
          </label>
        )}
      </div>
      {(['group','segment'] as const).filter(slot=>['Label group','Project label group'].includes(value[slot])).map(slot=><label key={slot}>{slot==='group'?'Slice label group':'Segment label group'}<select className="input" aria-label={slot==='group'?'Slice label group':'Segment label group'} value={(slot==='group'?value.groupLabelGroupId:value.segmentLabelGroupId)??''} onChange={event=>set(slot==='group'?{groupLabelGroupId:event.target.value}:{segmentLabelGroupId:event.target.value})}><option value="">All label groups</option>{[...data.labelGroups,...data.labels.filter(label=>label.isGroup)].filter((group,index,groups)=>!group.deletedAt&&groups.findIndex(other=>other.id===group.id)===index).map(group=><option key={group.id} value={group.id}>{group.name}</option>)}</select></label>)}
      {value.measure==='Time in status'&&<div className="feature-analysis-controls"><MultipleProperty label="Status types" values={value.measureStatusTypes??['started']} options={['triage','backlog','unstarted','started','completed','canceled'].map(type=>({value:type,label:{triage:'Triage',backlog:'Backlog',unstarted:'Todo',started:'In progress',completed:'Completed',canceled:'Canceled'}[type]!}))} onChange={measureStatusTypes=>set({measureStatusTypes})}/><MultipleProperty label="Specific statuses" values={value.measureStatusIds??[]} options={data.statuses.filter(status=>!status.deletedAt).map(status=>({value:status.id,label:status.name+' · '+(data.teams.find(team=>team.id===status.teamId)?.name||'')}))} onChange={measureStatusIds=>set({measureStatusIds})}/></div>}
      {duration&&<div className="feature-analysis-controls"><MultipleProperty label="Percentiles" values={(value.latencyPercentiles??[.5,.95]).map(String)} options={[.25,.5,.75,.95].map(number=>({value:String(number),label:'P'+number*100}))} onChange={values=>set({latencyPercentiles:values.map(Number)})}/><label>Scale<select className="input" aria-label="Latency scale" value={value.latencyScale??'log'} onChange={event=>set({latencyScale:event.target.value as 'linear'|'log'})}><option value="linear">Uniform</option><option value="log">Logarithmic</option></select></label></div>}
      <div className="feature-analysis-controls"><label>Order<select className="input" aria-label="Insight order" value={value.order??''} onChange={event=>set({order:event.target.value||undefined})}><option value="">Default</option><option value="dimension">Slice</option><option value="total">Issue count</option>{duration?[.25,.5,.75,.95].map(q=><option key={q} value={String(q)}>P{q*100}</option>):<option value="value">{value.measure}</option>}</select></label><label>Direction<select className="input" aria-label="Insight direction" value={value.direction??'asc'} onChange={event=>set({direction:event.target.value as 'asc'|'desc'})}><option value="asc">Ascending</option><option value="desc">Descending</option></select></label></div>
      {insightColorChoice(value)&&<label>Colors<select className="input" aria-label="Insight colors" value={value.colorScale??'default'} onChange={event=>set({colorScale:event.target.value as 'default'|'categorical'})}><option value="default">Default</option><option value="categorical">Auto-color</option></select></label>}
      <div className="feature-insight-options">
        <label><input type="checkbox" checked={!!value.hideEmptyDimension} onChange={event=>set({hideEmptyDimension:event.target.checked})}/>Hide empty slices</label>
        {!duration&&value.segment!=='None'&&<label><input type="checkbox" checked={!!value.hideEmptySegment} onChange={event=>set({hideEmptySegment:event.target.checked})}/>Hide empty segments</label>}
        {(value.group==='Customer'||value.segment==='Customer')&&<label><input type="checkbox" checked={!!value.hideUnknownCustomer} onChange={event=>set({hideUnknownCustomer:event.target.checked})}/>Hide unknown customers</label>}
        <label>
          <input
            type="checkbox"
            checked={value.showArchived}
            onChange={(e) => set({ showArchived: e.target.checked })}
          />
          Show archived issues
        </label>
        <label>
          <input
            type="checkbox"
            checked={value.excludeNoPriority}
            onChange={(e) => set({ excludeNoPriority: e.target.checked })}
          />
          Exclude issues with no priority
        </label>
      </div>
      {showFilters && (
        <FilterBuilder
          value={value.filters}
          onChange={(filters) => set({ filters })}
        />
      )}
    </>
  );
}
export function InsightChart({
  result,
  config,
  onSelect,
  highlight,
  onHover,
}: {
  result: InsightData;
  config: InsightConfig;
  onSelect: (rows: InsightDatum[], selection?: {bucket?:string;segment?:string;threshold?:number;percentile?:number;operator?:'lte'|'gt'}) => void;
  highlight?: {bucket?:string;segment?:string}|null;
  onHover?: (value:{bucket?:string;segment?:string}|null)=>void;
}) {
  const {data:colorSource}=useActions();
  const [hover, setHover] = useState<string | null>(null),
    [cap, setCap] = useState<number | null>(null);
  const { buckets, rows } = result;
  const kind =
    config.chartType === "Auto"
      ? result.duration
        ? "Scatter"
        : "Bar"
      : config.chartType;
  const max = Math.max(1, ...buckets.map((b) => Math.max(b.value,b.segments.reduce((sum,s)=>sum+(result.duration?s.value*s.rows.length/Math.max(1,b.rows.length):s.value),0))));
  const theme=useInsightTheme();
  const colors=useMemo(()=>insightColors(colorSource,config,result,theme),[colorSource,config,result,theme]);
  if(kind==='Metric'&&result.duration)return <div className="feature-insight-percentile-metrics">{(config.latencyPercentiles??[.5,.95]).map(fraction=>{const threshold=percentile(rows.map(row=>row.value),fraction);return <button key={fraction} className="feature-insight-metric" aria-label={'Explore '+config.measure+' P'+fraction*100} onClick={()=>onSelect(rows.filter(row=>row.value>threshold),{percentile:fraction,threshold,operator:'gt'})}><span>{config.measure} · P{fraction*100}</span><strong>{format(threshold)}</strong><span>{result.unit}</span></button>})}</div>;
  if (kind === "Metric")
    return (
      <button
        className="feature-insight-metric"
        onClick={() => onSelect(rows, {})}
        aria-label={`Explore ${config.measure}`}
      >
        <span>
          {config.measure}
          {result.duration ? " · Average" : ""}
        </span>
        <strong>{format(result.total)}</strong>
        <span>{result.unit}</span>
      </button>
    );
  if (config.group === "Burn-up" && kind !== "Table") {
    const points = result.burnup,
      segments = [...new Set(points.flatMap((p) => Object.keys(p.segments)))],
      peak = Math.max(1, ...points.map((p) => p.value)),
      timeStart = points[0]?.time || 0,
      timeEnd = points.at(-1)?.time || 1;
    const x = (time: number) =>
        50 + ((time - timeStart) / Math.max(1, timeEnd - timeStart)) * 820,
      y = (v: number) => 220 - (v / peak) * 185;
    return (
      <div className="feature-insight-plot">
        <svg
          viewBox="0 0 900 260"
          role="img"
          aria-label="Historical burn-up chart"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((p) => (
            <g key={p}>
              <line
                x1="50"
                x2="870"
                y1={y(p * peak)}
                y2={y(p * peak)}
                stroke="var(--border)"
              />
              <text x="40" y={y(p * peak) + 4} textAnchor="end">
                {format(p * peak)}
              </text>
            </g>
          ))}
          {segments.map((segment, index) => (
            <path
              key={segment}
              d={points
                .map(
                  (p, i) =>
                    `${i ? "L" : "M"}${x(p.time)} ${y(segments.slice(0, index + 1).reduce((sum, s) => sum + (p.segments[s] || 0), 0))}`,
                )
                .join(" ")}
              fill="none"
              stroke={colors.get(segment)??palette[index % palette.length]}
              strokeWidth="2"
            >
              <title>{result.segmentLabels?.[segment]??segment}</title>
            </path>
          ))}
          {points
            .filter(
              (_, i) =>
                i % Math.max(1, Math.ceil(points.length / 6)) === 0 ||
                i === points.length - 1,
            )
            .map((p) => (
              <text key={p.time} x={x(p.time)} y="247" textAnchor="middle">
                {p.label}
              </text>
            ))}
        </svg>
        <div className="feature-insight-legend">
          {segments.map((name, i) => (
            <span key={name}>
              <i style={{ background: colors.get(name)??palette[i % palette.length] }} />
              {result.segmentLabels?.[name]??name}
            </span>
          ))}
        </div>
      </div>
    );
  }
  if (kind === "Scatter")
    return <InsightScatter result={result} onSelect={onSelect} highlight={highlight} onHover={onHover} percentileValues={config.latencyPercentiles} scale={config.latencyScale} colorMap={colors} colorByBucket={config.segment==='None'} />;
  if (kind === "Table") return null;
  return (
    <div className="feature-insight-bars">
      {buckets.map((bucket) => (
        <div key={bucket.key??bucket.label} className="feature-insight-bar-group" data-highlighted={!!highlight && (!highlight.bucket || highlight.bucket===(bucket.key??bucket.label)) && (!highlight.segment || bucket.segments.some(segment=>(segment.key??segment.label)===highlight.segment))}>
          <div className="feature-insight-bar-value">
            {format(bucket.value)}
          </div>
          <div
            className="feature-insight-bar-track"
            role="group"
            aria-label={bucket.label}
          >
            {bucket.segments.map((segment) => (
              <button
                key={segment.key??segment.label}
                aria-label={`${bucket.label}, ${segment.label}: ${format(segment.value)} ${result.unit}`}
                style={{
                  height: `${Math.max(0, ((result.duration ? (segment.value * segment.rows.length) / bucket.rows.length : segment.value) / max) * 180)}px`,
                  background: colors.get(config.segment==='None'?(bucket.key??bucket.label):(segment.key??segment.label)),
                }}
                onMouseEnter={() => {
                  onHover?.({bucket:bucket.key??bucket.label,segment:segment.key??segment.label}); setHover(
                    `${bucket.label} · ${segment.label}: ${format(segment.value)} ${result.unit}`,
                  ); }
                }
                onMouseLeave={() => {setHover(null);onHover?.(null);}}
                onClick={() => onSelect(segment.rows, {bucket:bucket.key??bucket.label,segment:segment.key??segment.label})}
              />
            ))}
          </div>
          <button
            className="feature-insight-bar-label"
            title={bucket.label}
            onClick={() => onSelect(bucket.rows, {bucket:bucket.key??bucket.label})}
          >
            {bucket.label}
          </button>
        </div>
      ))}
      {hover && <div className="feature-insight-tooltip">{hover}</div>}
    </div>
  );
}
function Insight({
  config,
  globalFilters,
  scopeTeamId,
  excludePrivate = false,
}: {
  config: InsightConfig;
  globalFilters?: FilterSpec;
  scopeTeamId?: string;
  excludePrivate?: boolean;
}) {
  const { data, user } = useActions();
  const [highlight,setHighlight] = useState<{bucket?:string;segment?:string}|null>(null);
  const calendarDay=useCalendarDay([config.filters,globalFilters]);
  const result = useMemo(
    () =>
      calculateInsight(
        {
          ...data,
          user,
          issues: data.issues.filter(
            (i) =>
              dashboardIssueVisible(i,data.teams,scopeTeamId,excludePrivate),
          ),
        },
        config,
        globalFilters,
        +calendarDay,
      ),
    [
      scopeTeamId,
      excludePrivate,
      calendarDay,
      user?.id,
      data.milestones,
      data.issues,
      data.statuses,
      data.users,
      data.projects,
      data.cycles,
      data.teams,
      data.labels,
      data.labelGroups,
      data.customers,
      data.requests,
      data.initiatives,
      data.milestones,
      data.templates,
      data.workspaces,
      data.activities,
      config,
      globalFilters,
    ],
  );
  const [selected, setSelected] = useState<InsightDatum[] | null>(null);
  const navigate = useNavigate();
  const open = (rows: InsightDatum[]) => {
    if (rows.length === 1) navigate(`/issues/${rows[0].issue.id}`);
    else setSelected(rows);
  };
  return (
    <>
      {result.rows.length ? (
        <>
          <InsightChart result={result} config={config} onSelect={open} highlight={highlight} onHover={setHighlight} />
          {config.chartType !== "Metric" && (
            <div className="feature-insight-table-scroll">
              <table className="feature-table feature-insight-table">
                <thead>
                  <tr>
                    <th>
                      {config.group === "Burn-up" ? "Measure" : config.group}
                    </th>
                    {!result.duration&&<th>{config.measure}</th>}
                    <th>Issues</th>
                    {config.segment!=='None'&&[...new Set(result.rows.flatMap(row=>row.segmentKeys||row.segments||[row.segment]))].map(segment=><th key={segment}><button onMouseEnter={()=>setHighlight({segment})} onMouseLeave={()=>setHighlight(null)} onClick={()=>open(result.rows.filter(row=>(row.segmentKeys||row.segments||[row.segment]).includes(segment)))}>{result.segmentLabels?.[segment]??segment}</button></th>)}
                    {result.duration&&(config.latencyPercentiles??[.5,.95]).map(value=><th key={value}><button onClick={()=>open(result.rows.filter(row=>row.value<=percentile(result.rows.map(row=>row.value),value)))}>P{value*100}</button><button aria-label={'Explore above P'+value*100} onClick={()=>{const threshold=percentile(result.rows.map(row=>row.value),value);open(result.rows.filter(row=>row.value>threshold));}}>Above</button></th>)}
                  </tr>
                </thead>
                <tbody>
                  {result.buckets.map((bucket) => (
                    <tr
                      key={bucket.key??bucket.label}
                      data-highlighted={highlight?.bucket===(bucket.key??bucket.label)}
                      tabIndex={0}
                      onMouseEnter={()=>setHighlight({bucket:bucket.key??bucket.label})}
                      onMouseLeave={()=>setHighlight(null)}
                      onClick={() => open(bucket.rows)}
                      onKeyDown={(e) => e.key === "Enter" && open(bucket.rows)}
                    >
                      <td>{bucket.label}</td>
                      {!result.duration&&<td>{format(bucket.value)} {result.unit}</td>}
                      <td>{bucket.count}</td>
                      {config.segment!=='None'&&[...new Set(result.rows.flatMap(row=>row.segmentKeys||row.segments||[row.segment]))].map(segment=>{const cell=bucket.segments.find(cell=>(cell.key??cell.label)===segment);return <td key={segment}><button disabled={!cell} aria-label={`Explore ${bucket.label}, ${result.segmentLabels?.[segment]??segment}`} onMouseEnter={()=>setHighlight({bucket:bucket.key??bucket.label,segment})} onMouseLeave={()=>setHighlight({bucket:bucket.key??bucket.label})} onClick={event=>{event.stopPropagation();if(cell)open(cell.rows)}}>{format(cell?.value||0)}</button></td>})}
                      {result.duration&&(config.latencyPercentiles??[.5,.95]).map(value=>{const threshold=percentile(bucket.rows.map(row=>row.value),value);return <td key={value}><button onClick={event=>{event.stopPropagation();open(bucket.rows.filter(row=>row.value<=threshold))}}>{format(threshold)} d</button><button aria-label={'Explore '+bucket.label+' above P'+value*100} onClick={event=>{event.stopPropagation();open(bucket.rows.filter(row=>row.value>threshold));}}>{bucket.rows.filter(row=>row.value>threshold).length} above</button></td>})}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="feature-analysis-total">
            {result.rows.length} {result.duration ? "measured" : "matching"}{" "}
            issues
            {result.duration ? ` · ${format(result.total)} days average` : ""}
            {config.group === "Label"
              ? " · Issues can appear in multiple labels"
              : ""}
          </div>
        </>
      ) : (
        <Blank
          title="No matching data"
          description={
            result.duration
              ? "This measure requires issues with the relevant recorded timestamps."
              : "Adjust the filters to include issues."
          }
        />
      )}{" "}
      {selected && (
        <FormDialog
          title={`${selected.length} issues`}
          fields={[]}
          submit="Done"
          onClose={() => setSelected(null)}
          onSave={async () => true}
        >
          <InsightIssueList rows={selected} />
        </FormDialog>
      )}
    </>
  );
}

export function InsightsPage() {
  const { data, user, create, update, act, toast } = useActions();
  const canEdit=data.memberships.find(member=>!member.deletedAt&&!member.teamId&&member.userId===user?.id)?.role!=="guest";
  const [params, setParams] = useSearchParams();
  const [config, setConfig] = useState<InsightConfig>(() => {
      try {
        return decodeConfig(JSON.parse(params.get("config") || "{}"));
      } catch {
        return defaultInsight;
      }
    }),
    [save, setSave] = useState(false),
    [filters, setFilters] = useState(true);
  const configure = (value: InsightConfig) => {
    setConfig(value);
    setParams({ config: JSON.stringify(value) }, { replace: true });
  };
  const calendarDay=useCalendarDay(config.filters);
  const result = useMemo(
    () => calculateInsight({...data,user}, config,undefined,+calendarDay),
    [
      calendarDay,
      data.issues,
      data.statuses,
      data.users,
      data.projects,
      data.cycles,
      data.teams,
      data.labels,
      data.labelGroups,
      data.customers,
      data.requests,
      data.initiatives,
      data.milestones,
      data.templates,
      data.workspaces,
      data.activities,
      config,
    ],
  );
  return (
    <section className="feature-page">
      <Header title="Insights" icon={<ChartNoAxesColumn size={16} />}>
        <Link className="button feature-button" to="/dashboards">
          Dashboards
        </Link>
        <Action
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(location.href);
              toast("Insight link copied");
            } catch {
              toast("Unable to copy link");
            }
          }}
        >
          <Copy size={13} />
          Copy link
        </Action>
        {canEdit&&<Action onClick={() => setSave(true)}>Add to dashboard</Action>}
      </Header>
      <div className="feature-analysis">
        <div className="feature-between">
          <h2>Analyze issues</h2>
          <Action onClick={() => setFilters(!filters)}>
            <Filter size={13} />
            {filters ? "Hide filters" : "Show filters"}
          </Action>
        </div>
        <InsightControls
          value={config}
          onChange={configure}
          showFilters={filters}
        />
        <div className="feature-metric-row">
          <Metric
            label={config.measure}
            value={format(result.total)}
            detail={result.unit}
          />
          <Metric label="Matching issues" value={result.issues.length} />
          <Metric label="Measured issues" value={result.rows.length} />
          {result.duration && (
            <Metric
              label="Median"
              value={`${format(
                percentile(
                  result.rows.map((r) => r.value),
                  0.5,
                ),
              )}d`}
            />
          )}
        </div>
        <section className="feature-chart-card">
          <h3>
            {config.measure} by {config.group.toLowerCase()}
          </h3>
          <Insight config={config} />
        </section>
      </div>
      {save && (
        <FormDialog
          title="Add to dashboard"
          fields={[
            {
              key: "dashboardId",
              label: "Dashboard",
              type: "select",
              options: optionList(data.dashboards, "Create new dashboard"),
            },
            { key: "name", label: "Name", required: true },
          ]}
          initial={{
            name: `${config.measure} by ${config.group.toLowerCase()}`,
          }}
          submit="Add insight"
          onClose={() => setSave(false)}
          onSave={(v) => {
            const widget = { ...config, name: v.name, id: crypto.randomUUID() };
            const dashboard = data.dashboards.find(
              (d) => d.id === v.dashboardId,
            );
            return act(
              () =>
                dashboard
                  ? update("dashboards", dashboard.id, {
                      widgets: [...(dashboard.widgets || []), widget],
                    })
                  : create("dashboards", {
                      name: v.name,
                      visibility: "workspace",
                      widgets: [widget],
                    }),
              "Insight added to dashboard",
            );
          }}
        />
      )}
    </section>
  );
}

function WidgetEditor({
  widget,
  onClose,
  onSave,
}: {
  widget?: Row;
  onClose: () => void;
  onSave: (value: Row) => Promise<any>;
}) {
  const [config, setConfig] = useState<InsightConfig>(decodeConfig(widget));
  return (
    <FormDialog
      title={widget ? "Edit insight" : "Add insight"}
      fields={[{ key: "name", label: "Title", required: true }]}
      initial={{ name: widget?.name || "Issues by status" }}
      submit={widget ? "Save insight" : "Add insight"}
      onClose={onClose}
      onSave={(v) =>
        onSave({
          ...widget,
          ...config,
          ...v,
          id: widget?.id || crypto.randomUUID(),
        } as Row)
      }
    >
      <InsightControls value={config} onChange={setConfig} />
    </FormDialog>
  );
}
export function DashboardEditor({
  dashboard,
  initialTeamId,
  onClose,
  onSave,
}: {
  dashboard?: Row;
  initialTeamId?: string;
  onClose: () => void;
  onSave: (value: Record<string, any>) => Promise<any>;
}) {
  const { data, user } = useActions(),capabilities=guestCapabilities(data,user?.id);
  const [filters, setFilters] = useState<FilterSpec>(
    dashboard?.filters || { conditions: [], match: "all" },
  );
  return (
    <FormDialog
      title={dashboard ? "Edit dashboard" : "New dashboard"}
      fields={[
        { key: "name", label: "Name", required: true },
        {
          key: "visibility",
          label: "Visibility",
          type: "select" as const,
          options: [
            { value: "workspace", label: "Workspace" },
            ...(!capabilities.guest||!dashboard||dashboard.ownerId===user?.id?[{ value: "private", label: "Personal" }]:[]),
          ],
        },
        {
          key: "teamId",
          label: "Team",
          type: "select" as const,
          options: capabilities.guest?optionList(data.teams.filter(team=>capabilities.canTeam(team.id))).filter(option=>option.value):optionList(data.teams, "Workspace"),
        },
        {
          key: "ownerId",
          label: "Owner",
          type: "select" as const,
          options: optionList(data.users),
        },
      ].filter(field=>field.key!=="ownerId"||!dashboard||!["private","personal"].includes(dashboard.visibility))}
      initial={dashboard || { visibility: "workspace", ownerId: user?.id, teamId: initialTeamId }}
      submit={dashboard ? "Save changes" : "Create dashboard"}
      onClose={onClose}
      onSave={(v) => onSave({ ...v, filters })}
    >
      {dashboard&&["private","personal"].includes(dashboard.visibility)&&<p className="muted">Owner: {data.users.find(person=>person.id===(dashboard.ownerId||dashboard.creatorId))?.name||"Unknown"}</p>}
      <p className="muted">
        These filters apply to every insight in this dashboard.
      </p>
      <FilterBuilder value={filters} onChange={setFilters} />
    </FormDialog>
  );
}
export function DashboardsPage() {
  const { dashboardId } = useParams();
  const { data, user, create, update, reload, act, toast } = useActions();
  const guestAccess=guestCapabilities(data,user?.id),canCreate=!guestAccess.guest;
  const nav = useNavigate();
  const [adding, setAdding] = useState(false),
    [widget, setWidget] = useState<Row | boolean>(false),
    [editing, setEditing] = useState(false),
    [showFilters, setShowFilters] = useState(true);
  const dashboard = live(data.dashboards).find((d) => d.id === dashboardId);
  const canEdit=!!dashboard&&!dashboard.archivedAt&&guestAccess.canEntity(dashboard);
  const saveWidgets = (widgets: any[]) =>
    act(() => update("dashboards", dashboard!.id, { widgets }));
  const move = (index: number, delta: number) => {
    const widgets = [...(dashboard?.widgets || [])],
      layout = dashboardLayout(widgets),
      first = widgets[index],
      second = widgets[index + delta];
    if (!first || !second) return;
    const firstLayout = layout.get(first.id),
      secondLayout = layout.get(second.id);
    widgets[index] = { ...first, layout: secondLayout };
    widgets[index + delta] = { ...second, layout: firstLayout };
    const [item] = widgets.splice(index, 1);
    widgets.splice(index + delta, 0, item);
    void saveWidgets(widgets);
  };
  return (
    <section className="feature-page">
      <Header
        title={dashboard?.name || "Dashboards"}
        icon={<LayoutDashboard size={16} />}
        breadcrumb={
          dashboard ? { title: "Dashboards", to: "/dashboards" } : undefined
        }
      >
        {dashboard ? (
          <>
            <Action onClick={() => setShowFilters(!showFilters)}>
              <Filter size={13} />
              {showFilters ? "Hide saved filters" : "Saved filters"}
            </Action>
            <Action
              onClick={async () => {
                await reload();
                toast("Dashboard data refreshed");
              }}
            >
              <RefreshCw size={13} />
              Refresh
            </Action>
            {canEdit&&<AddButton onClick={() => setWidget(true)}>Add widget</AddButton>}
            {canEdit?<EntityMenu
              kind="dashboards"
              item={dashboard}
              onEdit={() => setEditing(true)}
              onDeleted={() => nav("/dashboards")}
            />:<Action onClick={()=>void act(()=>navigator.clipboard.writeText(new URL(`/dashboards/${dashboard.id}`,location.origin).href),"Link copied")}>Copy dashboard link</Action>}
          </>
        ) : (
          canCreate?<AddButton onClick={() => setAdding(true)}>New dashboard</AddButton>:null
        )}
      </Header>
      {dashboard ? (
        <>
          {showFilters && (
            <fieldset disabled={!canEdit} className="feature-dashboard-filters" style={{border:0,margin:0,minWidth:0}}>
              <FilterBuilder
                value={dashboard.filters || { conditions: [], match: "all" }}
                onChange={(filters) =>
                  void act(() =>
                    update("dashboards", dashboard.id, { filters }),
                  )
                }
              />
            </fieldset>
          )}
          <DashboardGrid
            readOnly={!canEdit}
            widgets={dashboard.widgets || []}
            onChange={(widgets) => void saveWidgets(widgets)}
            renderWidget={(w, index) => (
              <>
                <div className="feature-between">
                  <h3>{w.name}</h3>
                  <div className="feature-widget-actions" hidden={!canEdit} style={canEdit?undefined:{display:"none"}}>
                    <button
                      className="feature-icon-button"
                      aria-label={`Move ${w.name} earlier`}
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      className="feature-icon-button"
                      aria-label={`Move ${w.name} later`}
                      disabled={index === dashboard.widgets.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown size={13} />
                    </button>
                    <button
                      className="feature-icon-button"
                      aria-label={`Edit ${w.name}`}
                      onClick={() => w.sourceViewId ? nav(`/view/${w.sourceViewId}?insights=${encodeURIComponent(JSON.stringify(decodeConfig(w)))}`) : setWidget(w as Row)}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      className="feature-icon-button"
                      aria-label={`Duplicate ${w.name}`}
                      onClick={() =>
                        void saveWidgets([
                          ...dashboard.widgets,
                          {
                            ...w,
                            id: crypto.randomUUID(),
                            name: `${w.name} copy`,
                          },
                        ])
                      }
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      className="feature-icon-button"
                      aria-label={`Remove ${w.name}`}
                      onClick={() =>
                        void saveWidgets(
                          dashboard.widgets.filter((x: any) => x.id !== w.id),
                        )
                      }
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <div className="feature-dashboard-widget-body">
                  {dashboardSource(w,data.views)?<Insight
                    config={decodeConfig(dashboardSource(w,data.views))}
                    globalFilters={dashboard.filters}
                    scopeTeamId={dashboard.teamId || undefined}
                    excludePrivate={
                      !dashboard.teamId && !["private","personal"].includes(dashboard.visibility)
                    }
                  />:<p className="muted">Source insight is unavailable or you do not have access.</p>}
                </div>
              </>
            )}
          />
          {!dashboard.widgets?.length && (
            <Blank
              title="Build your dashboard"
              action={
                canEdit?<AddButton onClick={() => setWidget(true)}>
                  Add widget
                </AddButton>:null
              }
            />
          )}
        </>
      ) : (
        <div className="feature-initiative-list">
          {live(data.dashboards).map((d) => (
            <Link
              className="feature-initiative-card"
              key={d.id}
              to={`/dashboards/${d.id}`}
            >
              <LayoutDashboard size={22} />
              <h3>{d.name}</h3>
              <p className="muted">
                {d.widgets?.length || 0} insights ·{" "}
                {d.visibility === "private"
                  ? "Personal"
                  : data.teams.find((t) => t.id === d.teamId)?.name ||
                    "Workspace"}
              </p>
            </Link>
          ))}
          {!live(data.dashboards).length && (
            <Blank
              icon={<LayoutDashboard size={30} />}
              title="Dashboards"
              description="Keep important insights together in a shared dashboard."
              action={
                canCreate?<AddButton onClick={() => setAdding(true)}>
                  New dashboard
                </AddButton>:null
              }
            />
          )}
        </div>
      )}
      {(adding || editing) && (
        <DashboardEditor
          dashboard={editing ? dashboard : undefined}
          onClose={() => {
            setAdding(false);
            setEditing(false);
          }}
          onSave={async (values) => {
            const saved = await act(() =>
              editing && dashboard
                ? update("dashboards", dashboard.id, values)
                : create("dashboards", { ...values, widgets: [] }),
            );
            if (saved) nav(`/dashboards/${saved.id}`);
            return saved;
          }}
        />
      )}
      {widget && dashboard && (
        <WidgetEditor
          widget={typeof widget === "object" ? widget : undefined}
          onClose={() => setWidget(false)}
          onSave={(value) =>
            saveWidgets(
              typeof widget === "object"
                ? dashboard.widgets.map((w: any) =>
                    w.id === widget.id ? value : w,
                  )
                : [...(dashboard.widgets || []), value],
            )
          }
        />
      )}
    </section>
  );
}
