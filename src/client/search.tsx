import {SearchIssueFavorite,SearchIssueCopyActions} from './search-issue-actions';
import {projectStatuses} from './features/project-statuses';
import {SearchFilterMenu} from './search-filter-menu';
import {NativeControlIcon} from './components/sidebar-icons';
import {parseRouteFilter} from './route-filter';
import {filterConditionCount} from '../shared/filter-groups';
import {useCalendarDay} from './due-date';
import {resolveCalendarFilter} from '../shared/relative-date-filter';
import {filterLabelRecords} from '../shared/label-filter-values';
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Entity, EntityKind } from "../shared/types";
import { apiRequest, useAppStore } from "./store";
import { FilterBuilder, IssuePage, IssueActions } from "./issues";
import { expandLabelFilter, type FilterSpec } from "./query";
import {
  Button,
  Dropdown,
  EmptyState,
  Icon,
  MenuItem,
  RichEditor,
  StatusIcon,
} from "./components/ui";
import "./search.css";

const categories: Record<
  string,
  { kind: EntityKind; route: string; icon: string }
> = {
  Issues: { kind: "issues", route: "issues", icon: "Circle" },
  Projects: { kind: "projects", route: "project", icon: "Box" },
  Documents: { kind: "documents", route: "document", icon: "FileText" },
  Initiatives: { kind: "initiatives", route: "initiative", icon: "Layers" },
  Customers: { kind: "customers", route: "customer", icon: "Building2" },
};
const allKinds = Object.values(categories).map((c) => c.kind),
  emptyFilter: FilterSpec = { conditions: [], match: "all" };
const plain = (value: any) =>
  String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
type Hit = Entity & { kind: EntityKind; matchSnippet?: string };
const shortAge = (value: string) => {
  const seconds = Math.max(0, (Date.now() - Date.parse(value)) / 1000);
  return seconds < 60
    ? "now"
    : seconds < 3600
      ? `${Math.floor(seconds / 60)}m`
      : seconds < 86400
        ? `${Math.floor(seconds / 3600)}h`
        : seconds < 604800
          ? `${Math.floor(seconds / 86400)}d`
          : seconds < 31536000
            ? `${Math.floor(seconds / 604800)}w`
            : `${Math.floor(seconds / 31536000)}y`;
};
const pathFor = (hit: Hit) =>
  `/${Object.values(categories).find((c) => c.kind === hit.kind)?.route ?? hit.kind}/${hit.id}`;
function Highlight({ text, query }: { text: string; query: string }) {
  const words =
    query
      .match(/[^\s"@]+/g)
      ?.filter((word) => word.length > 1)
      .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) ?? [];
  if (!words.length) return <>{text}</>;
  const pattern = new RegExp(`(${words.join("|")})`, "gi");
  return (
    <>
      {text
        .split(pattern)
        .map((part, index) =>
          index % 2 ? <mark key={index}>{part}</mark> : part,
        )}
    </>
  );
}

export function SearchPage({ previewId, initialSearch }: { previewId?: string; initialSearch?: string } = {}) {
  const store = useAppStore(),
    navigate = useNavigate(),
    [routeParams, setRouteParams] = useSearchParams(),
    params = initialSearch ? new URLSearchParams(initialSearch) : routeParams,
    query = params.get("q") ?? "",
    type = Object.hasOwn(categories, params.get("type") ?? "")
      ? params.get("type")!
      : "All",
    orderBy = ["updatedAt", "createdAt"].includes(params.get("sort") ?? "")
      ? params.get("sort")!
      : "relevance",
    includeArchived = params.get("archived") === "1",
    showIds=params.get("ids")!=="0";
  const filter = useMemo<FilterSpec>(() => parseRouteFilter(params.get('filter')) ?? emptyFilter, [params.get('filter')]);
  const calendarDay=useCalendarDay(filter);
  const [draftQuery,setDraftQuery]=useState(query);
  const composingQuery=useRef(false);
  const compositionSelection=useRef<[number|null,number|null]>([null,null]);
  const compositionOriginal=useRef(query),compositionCancelled=useRef(false),cancelEscapeAt=useRef(-Infinity);
  useEffect(()=>{if(!composingQuery.current)setDraftQuery(query)},[query]);
  const [results, setResults] = useState<Hit[]>([]),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [selected, setSelected] = useState(0),
    [selectionVisible, setSelectionVisible] = useState(false),
    [context, setContext] = useState<{ item: Hit; x: number; y: number } | null>(null),
    [showFilters, setShowFilters] = useState(false),
    [showPreview, setShowPreview] = useState(!!previewId),
    [offline, setOffline] = useState(!store.online),
    [offlineRevision, setOfflineRevision] = useState(0),
    [mentionIndex, setMentionIndex] = useState(0),
    [mentionDismissed, setMentionDismissed] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    scroll = useRef<HTMLDivElement>(null),
    previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    requestId = useRef(0),
    worker = useRef<Worker | null>(null);
  const historyKey = `parabolic:searches:${store.data.workspaceId}:${store.user?.id}`,
    recentKey = `parabolic:recent-routes:${store.data.workspaceId}:${store.user?.id}`;
  const [history, setHistory] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(historyKey) ?? "[]");
    } catch {
      return [];
    }
  });
  const virtual = useVirtualizer({
    count: results.length,
    getScrollElement: () => scroll.current,
    estimateSize: () => 40,
    overscan: 4,
  });
  const kinds = type === "All" ? allKinds : [categories[type].kind],
    hit = results[selected];
  const setParam = (name: string, value: string | null) =>
    initialSearch
      ? (() => {
          const next = new URLSearchParams(params);
          value ? next.set(name, value) : next.delete(name);
          navigate(`/search${next.size ? `?${next}` : ""}`, { replace: true });
        })()
      : setRouteParams(
          (old) => {
            const next = new URLSearchParams(old);
            value ? next.set(name, value) : next.delete(name);
            return next;
          },
          { replace: true },
        );
  const changeQuery = (value: string) => {
    setDraftQuery(value);
    setMentionDismissed(false);
    setMentionIndex(0);
    setParam("q", value || null);
  };
  const remember = () => {
    if (!query.trim()) return;
    const next = [
      query.trim(),
      ...history.filter((item) => item !== query.trim()),
    ].slice(0, 12);
    setHistory(next);
    localStorage.setItem(historyKey, JSON.stringify(next));
  };
  const open = (item: Hit) => {
    remember();
    try {
      const previous = JSON.parse(localStorage.getItem(recentKey) ?? "[]");
      const route = pathFor(item);
      localStorage.setItem(
        recentKey,
        JSON.stringify(
          [
            route,
            ...(Array.isArray(previous) ? previous : []).filter(
              (value) => value !== route,
            ),
          ].slice(0, 30),
        ),
      );
    } catch {}
    void store.loadEntity(item.kind, item.id).catch(() => {});
    navigate(pathFor(item));
  };
  const preview = (item: Hit) => {
    remember();
    void store.loadEntity(item.kind, item.id).catch(() => {});
    navigate(pathFor(item), {
      state: {
        searchPreview: {
          search: `?${params.toString()}`,
          selectedId: item.id,
        },
      },
    });
  };
  useEffect(() => {
    setOffline(!store.online);
  }, [store.online]);
  useEffect(() => {
    try {
      setHistory(JSON.parse(localStorage.getItem(historyKey) ?? "[]"));
    } catch {
      setHistory([]);
    }
  }, [historyKey]);
  useEffect(() => {
    const instance = new Worker(
      new URL("./search-worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.current = instance;
    instance.onmessage = (event) => {
      if (event.data.type === "indexed") setOfflineRevision((n) => n + 1);
      else if (
        event.data.type === "results" &&
        event.data.id === requestId.current
      ) {
        setResults(event.data.nodes);
        setTotal(event.data.totalCount);
        setLoading(false);
      }
    };
    instance.onerror = () => {
      setLoading(false);
      setError(
        "Cached search could not start. Reconnect and open search once to make it available offline.",
      );
    };
    return () => {
      instance.terminate();
      if (worker.current === instance) worker.current = null;
    };
  }, []);
  useEffect(() => () => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
  }, []);
  useEffect(() => {
    if (offline && worker.current)
      worker.current.postMessage({
        type: "index",
        records: allKinds.flatMap((kind) =>
          store.data[kind].map((entity) => ({ ...entity, kind })),
        ),
        comments: store.data.comments,
        statuses: store.data.statuses,
        labels: filterLabelRecords(store.data),
        projects: store.data.projects,
        cycles: store.data.cycles,
        milestones: store.data.milestones,
        currentUserId: store.user?.id,
      });
  }, [offline, store.data, store.user?.id]);
  useEffect(() => {
    setSelected(0);
    setSelectionVisible(false);
    setContext(null);
    scroll.current?.scrollTo({ top: 0 });
  }, [query, type, orderBy, includeArchived, filter]);
  useEffect(() => {
    if (!previewId || !results.length) return;
    const index = results.findIndex((result) => result.id === previewId);
    if (index < 0) return;
    setSelected(index);
    setSelectionVisible(true);
    setShowPreview(true);
    virtual.scrollToIndex(index);
  }, [previewId, results]);
  const [clockRevision,setClockRevision]=useState(0);
  // A moving boundary must not abort a slower in-flight search on every tick.
  const appliedClock=useRef(calendarDay);
  useEffect(()=>{if(!loading&&appliedClock.current!==calendarDay){appliedClock.current=calendarDay;setClockRevision(value=>value+1)}},[calendarDay,loading]);
  useEffect(() => {
    const id = ++requestId.current;
    setError("");
    if (!query.trim() && !filterConditionCount(filter)) {
      setResults([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController(),
      timer = setTimeout(() => {
        const cleanQuery = query.replace(/(^|\s)@[^@]*$/, "").trim();
        if (!cleanQuery && !filterConditionCount(filter)) {
          setLoading(false);
          setResults([]);
          setTotal(0);
          return;
        }
        if (offline) {
          worker.current?.postMessage({
            type: "search",
            id,
            query: cleanQuery,
            kinds,
            filter:resolveCalendarFilter(filter,{now:calendarDay}),
            orderBy,
            includeArchived,
          });
          return;
        }
        const search = new URLSearchParams({
          q: cleanQuery,
          kinds: kinds.join(","),
          first: "500",
          orderBy,
          includeArchived: String(includeArchived),
        });
        if (filterConditionCount(filter))
          search.set("filter", JSON.stringify(expandLabelFilter(filter, filterLabelRecords(store.data))));
        apiRequest(`/api/v1/search?${search}`, { signal: controller.signal })
          .then((result) => {
            if (id !== requestId.current) return;
            setResults(result.nodes);
            setTotal(result.totalCount);
            setLoading(false);
          })
          .catch((error) => {
            if (controller.signal.aborted) return;
            if (id === requestId.current) {
              setLoading(false);
              if (!error.status || error.status >= 500) {
                setOffline(true);
                setError(
                  "Showing cached results while the server is unavailable.",
                );
              } else {
                setResults([]);
                setTotal(0);
                setError(error.message);
              }
            }
          });
      }, 45);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    clockRevision,
    query,
    type,
    orderBy,
    includeArchived,
    filter,
    offline,
    offlineRevision,
    store.data.issues,
    store.data.projects,
    store.data.documents,
    store.data.initiatives,
    store.data.customers,
    store.data.comments,
    store.data.statuses,
    store.data.labels,
    store.data.labelGroups,
  ]);
  useEffect(() => {
    if (hit) void store.loadEntity(hit.kind, hit.id).catch(() => {});
  }, [hit?.id, hit?.kind]);
  useEffect(() => {
    setSelected((value) => Math.max(0, Math.min(value, results.length - 1)));
  }, [results.length]);
  const mention = query.match(/(?:^|\s)@([^@]*)$/)?.[1],
    mentionQuery = mention?.toLowerCase();
  const mentions =
    mention === undefined || mentionDismissed
      ? []
      : [
          ...store.data.teams
            .filter((e) => !e.deletedAt)
            .map((e) => ({
              field: "teamId",
              id: e.id,
              name: e.name,
              icon: "Users",
              category: "Team",
            })),
          ...store.data.users.map((e) => ({
            field: "assigneeId",
            id: e.id,
            name: e.name,
            icon: "User",
            category: "Assignee",
          })),
          ...store.data.statuses
            .filter((e) => !e.deletedAt)
            .map((e) => ({
              field: "statusId",
              id: e.id,
              name: e.name,
              icon: "Circle",
              category:
                store.data.teams.find((t) => t.id === e.teamId)?.name ??
                "Status",
            })),
          ...store.data.projects
            .filter((e) => !e.deletedAt)
            .map((e) => ({
              field: "projectId",
              id: e.id,
              name: e.name,
              icon: "Box",
              category: "Project",
            })),
          ...store.data.labels
            .filter((e) => !e.deletedAt)
            .map((e) => ({
              field: "labelIds",
              id: e.id,
              name: e.name,
              icon: "Hash",
              category: "Label",
            })),
        ]
          .filter((e) => e.name.toLowerCase().includes(mentionQuery ?? ""))
          .slice(0, 12);
  const chooseMention = (option: (typeof mentions)[number]) => {
    const next = new URLSearchParams(params);
    next.set(
      "filter",
      JSON.stringify({
        ...filter,
        conditions: [
          ...filter.conditions,
          { field: option.field, operator: "eq", value: option.id },
        ],
      }),
    );
    next.set("q", query.replace(/(^|\s)@[^@]*$/, "").trim());
    if (initialSearch) navigate(`/search?${next}`, { replace: true });
    else setRouteParams(next, { replace: true });
    setShowFilters(true);
    setMentionDismissed(true);
    input.current?.focus();
  };
  const recent = useMemo(() => {
    let routes: string[] = [];
    try {
      routes = JSON.parse(localStorage.getItem(recentKey) ?? "[]");
    } catch {}
    return routes
      .flatMap((route) => {
        const [, prefix, id] = route.split("/"),
          category = Object.values(categories).find((c) => c.route === prefix);
        const entity = category
          ? store.data[category.kind].find((e) => e.id === id && !e.deletedAt)
          : undefined;
        return entity && category
          ? [{ ...entity, kind: category.kind } as Hit]
          : [];
      })
      .slice(0, 10);
  }, [recentKey, store.data]);
  const key = (event: React.KeyboardEvent) => {
    if(event.key==='Escape'&&composingQuery.current){compositionCancelled.current=true;cancelEscapeAt.current=performance.now();event.stopPropagation();return;}
    // macOS emits a second non-composing Escape immediately after cancelling marked text.
    if(event.key==='Escape'&&performance.now()-cancelEscapeAt.current<100){cancelEscapeAt.current=-Infinity;event.preventDefault();event.stopPropagation();return;}
    if (composingQuery.current || event.nativeEvent.isComposing || event.keyCode===229) {event.stopPropagation();return;}
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (mentions.length) setMentionDismissed(true);
      else input.current?.blur();
      return;
    }
    if (["ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      if (mentions.length)
        setMentionIndex(
          (i) =>
            (i + (event.key === "ArrowDown" ? 1 : mentions.length - 1)) %
            mentions.length,
        );
      else {
        const next = Math.max(
          0,
          Math.min(
            results.length - 1,
            selectionVisible
              ? selected + (event.key === "ArrowDown" ? 1 : -1)
              : event.key === "ArrowDown"
                ? 0
                : results.length - 1,
          ),
        );
        setSelected(next);
        setSelectionVisible(true);
        virtual.scrollToIndex(next);
        const nextHit = results[next];
        if (nextHit?.kind === "issues" && innerWidth > 800) preview(nextHit);
      }
    }
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      if (mentions.length)
        chooseMention(mentions[mentionIndex % mentions.length]);
      else if (hit && !(showPreview && previewId === hit.id)) open(hit);
    }
  };
  return (
    <section
      className={`global-search-page ${showPreview && hit ? "has-preview" : ""}`}
    >
      <div className="global-search-input">
        <Icon name="Search" size={15} />
        <input
          ref={input}
          autoFocus={!previewId}
          aria-label="Search workspace content"
          placeholder="Search issues, projects, and documents…"
          value={draftQuery}
          onCompositionStart={(event)=>{compositionOriginal.current=event.currentTarget.value;compositionSelection.current=[event.currentTarget.selectionStart,event.currentTarget.selectionEnd];compositionCancelled.current=false;composingQuery.current=true}}
          onCompositionEnd={(event)=>{composingQuery.current=false;if(compositionCancelled.current){event.currentTarget.value=compositionOriginal.current;setDraftQuery(compositionOriginal.current);event.currentTarget.setSelectionRange(...compositionSelection.current);compositionCancelled.current=false;}else changeQuery(event.currentTarget.value)}}
          onChange={(event) => {const value=event.target.value;setDraftQuery(value);if(!composingQuery.current&&!(event.nativeEvent as InputEvent).isComposing)changeQuery(value)}}
          onKeyDown={key}
          role="combobox"
          aria-expanded={mentions.length > 0 || !!query.trim() || !!filterConditionCount(filter)}
          aria-controls={mentions.length ? "search-mentions" : query.trim() || filterConditionCount(filter) ? "search-results" : undefined}
          aria-activedescendant={mentions.length ? `search-mention-${mentionIndex % mentions.length}` : selectionVisible && (query.trim() || filterConditionCount(filter)) && hit ? `search-hit-${hit.id}` : undefined}
        />
        {query && (
          <button
            className="icon-button"
            aria-label="Clear search"
            onClick={() => changeQuery("")}
          >
            <Icon name="X" size={15} />
          </button>
        )}
        {mentions.length > 0 && (
          <div
            className="menu search-mentions"
            id="search-mentions"
            role="listbox"
            aria-label="Search properties"
          >
            {mentions.map((option, index) => (
              <button
                key={`${option.field}:${option.id}`}
                id={`search-mention-${index}`}
                role="option"
                aria-selected={index === mentionIndex % mentions.length}
                className={`menu-item ${index === mentionIndex % mentions.length ? "selected" : ""}`}
                onClick={() => chooseMention(option)}
              >
                <Icon name={option.icon} />
                <span>{option.name}</span>
                <small>{option.category}</small>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="search-controls">
        <div className="page-tabs">
          {(showPreview && hit
            ? ["All", "Issues", "Projects"]
            : ["All", "Issues", "Projects", "Initiatives", "Documents"]
          ).map((category) => {
            const destination=new URLSearchParams(params);
            if(category==='All')destination.delete('type');else destination.set('type',category);
            return <Link
              key={category}
              className={type === category ? "active" : ""}
              aria-current={type===category?'page':undefined}
              to={`/search${destination.size?`?${destination}`:''}`}
            >
              {category}
            </Link>
          })}
          {(showPreview && hit || type==="Customers") && (
            <Dropdown
              trigger={
                <button
                  className={
                    !["All", "Issues", "Projects"].includes(type)
                      ? "active"
                      : ""
                  }
                >
                  {["All", "Issues", "Projects"].includes(type)
                    ? showPreview && hit
                      ? "2 more"
                      : "3 more"
                    : type}
                  <Icon name="ChevronDown" size={11} />
                </button>
              }
            >
              {["Initiatives", "Documents", "Customers"].map((category) => (
                <MenuItem
                  key={category}
                  onClick={() => setParam("type", category)}
                >
                  {category}
                </MenuItem>
              ))}
            </Dropdown>
          )}
        </div>
        <span className="spacer" />

        <SearchFilterMenu data={store.data} value={filter} onChange={value=>setParam("filter",filterConditionCount(value)?JSON.stringify(value):null)} onAdvanced={()=>setShowFilters(true)}/>
        <Dropdown align="right" menuClassName="search-native-display" trigger={<button className="icon-button" aria-label="Display options"><NativeControlIcon name="Display options"/></button>}>
          <div data-keep-open className="search-display-menu">
            <label>Ordering<select className="input" aria-label="Search ordering" value={orderBy} onChange={e=>setParam("sort",e.target.value)}><option value="relevance">Most relevant</option><option value="updatedAt">Last updated</option><option value="createdAt">Last created</option></select></label>
            <label>Include archived<input role="switch" aria-label="Include archived" type="checkbox" checked={includeArchived} onChange={e=>setParam("archived",e.target.checked?"1":"0")}/></label>
            <div className="menu-separator"/>
            <div className="search-display-properties"><span>Display properties</span><button aria-label="ID" aria-pressed={showIds} onClick={()=>setParam("ids",showIds?"0":null)}>ID</button></div>
          </div>
        </Dropdown>
      </div>
      {showFilters && (
        <div className="search-filters"><button className="text-button" onClick={()=>setShowFilters(false)}>Close advanced filter</button>
          <FilterBuilder
            additionalFields={[{field:"leadId",label:"Lead",options:store.data.users.map(u=>({id:u.id,name:u.name}))},{field:"teamIds",label:"Teams",options:store.data.teams.map(t=>({id:t.id,name:t.name}))},{field:"createdBy",label:"Creator identity",options:store.data.users.map(u=>({id:u.id,name:u.name}))},{field:"status",label:"Project status",options:projectStatuses(store.data).map(s=>({id:s.id,name:s.name}))}]}
            value={filter}
            onChange={(value) =>
              setParam(
                "filter",
                (filterConditionCount(value)||value.groups?.length) ? JSON.stringify(value) : null,
              )
            }
          />
        </div>
      )}
      {error && (
        <div className="search-notice" role="status">
          {error}
        </div>
      )}
      {!query.trim() && !filterConditionCount(filter) ? (
        <div className={`search-recents ${history.length?'':'is-empty'}`}>
          {!history.length&&<EmptyState icon="Search" title="Search" description="Find issues, projects, initiatives, and documents"/>}
          {history.length>0&&<><h3>Recent searches</h3>{history.map(item=><div className="search-recent-row" key={item}><button onClick={()=>changeQuery(item)}><Icon name="Search" size={14}/>{item}</button><button className="icon-button search-remove-recent" aria-label={"Remove recent search "+item} onClick={()=>{const next=history.filter(value=>value!==item);setHistory(next);localStorage.setItem(historyKey,JSON.stringify(next))}}><Icon name="X" size={14}/></button></div>)}<button className="search-clear-history" onClick={()=>{setHistory([]);localStorage.removeItem(historyKey)}}><Icon name="X" size={14}/>Clear History</button></>}
        </div>
      ) : (
        <div
          className={`search-split ${showPreview && hit ? "with-preview" : ""}`}
        >
          <div className="search-result-pane">
            <div
              className={`search-result-count ${!loading && !offline ? "search-count-hidden" : ""}`}
              role="status"
            >
              {loading
                ? "Searching…"
                : `${Math.min(total, 500).toLocaleString()}${total > 500 ? " of " + total.toLocaleString() : ""} results`}
              {offline && (
                <span>
                  {" "}
                  · Cached{" "}
                  {store.online && (
                    <button
                      className="text-button"
                      onClick={() => setOffline(false)}
                    >
                      Retry live search
                    </button>
                  )}
                </span>
              )}
            </div>
            <div
              ref={scroll}
              className="search-result-scroll"
              id="search-results"
              tabIndex={0}
              onKeyDown={key}
              role="listbox"
              aria-label="Search results"
              aria-activedescendant={selectionVisible && hit ? `search-hit-${hit.id}` : undefined}
            >
              <div
                style={{ height: virtual.getTotalSize(), position: "relative" }}
              >
                {virtual.getVirtualItems().map((row) => {
                  const result = results[row.index],
                    category = Object.values(categories).find(
                      (c) => c.kind === result.kind,
                    ),
                    status =
                      store.data.statuses.find(
                        (s) => s.id === result.statusId,
                      ) ??
                      result.sharedStatuses?.find(
                        (s: any) => s.id === result.statusId,
                      );
                  return (
                    <button
                      key={`${result.kind}:${result.id}`}
                      id={`search-hit-${result.id}`}
                      className={`global-search-result ${selectionVisible && selected === row.index ? "selected" : ""}`}
                      role="option"
                      aria-selected={selectionVisible && selected === row.index}
                      style={{
                        position: "absolute",
                        top: 0,
                        transform: `translateY(${row.start}px)`,
                        height: row.size,
                        width: "100%",
                      }}
                      onClick={() => {
                        remember();
                        setSelected(row.index);
                        setSelectionVisible(true);
                        if (innerWidth <= 800) open(result);
                        else {
                          if (previewTimer.current) clearTimeout(previewTimer.current);
                          previewTimer.current = setTimeout(() => {
                            preview(result);
                          }, 160);
                        }
                      }}
                      onDoubleClick={() => {
                        if (previewTimer.current) clearTimeout(previewTimer.current);
                        previewTimer.current = null;
                        open(result);
                      }}
                      onContextMenu={(event) => {
                        if (result.kind !== "issues") return;
                        event.preventDefault();
                        event.stopPropagation();
                        setSelected(row.index);
                        setSelectionVisible(true);
                        setContext({ item: result, x: event.clientX, y: event.clientY });
                      }}
                    >
                      <span className="search-result-identity" hidden={!showIds}>
                        {result.identifier ??
                          (result.kind === "documents"
                            ? "Document"
                            : result.kind === "projects"
                              ? "Project"
                              : result.kind === "initiatives"
                                ? "Initiative"
                                : "Customer")}
                      </span>
                      {result.kind === "issues" ? (
                        <StatusIcon status={status} />
                      ) : (
                        <Icon name={category?.icon ?? "Circle"} />
                      )}
                      <div>
                        <div className="search-result-title">
                          <strong>
                            <Highlight
                              text={result.title ?? result.name ?? ""}
                              query={query}
                            />
                          </strong>
                        </div>
                        <p>
                          <Highlight
                            text={plain(
                              result.matchSnippet ??
                                result.description ??
                                result.content ??
                                "",
                            ).slice(0, 180)}
                            query={query}
                          />
                        </p>
                        <small>
                          {result.kind}
                          {result.archivedAt ? " · Archived" : ""}
                        </small>
                      </div>
                      <time
                        className="search-result-age"
                        title={new Date(result.updatedAt).toLocaleString()}
                      >
                        {shortAge(result.updatedAt)}
                      </time>
                    </button>
                  );
                })}
              </div>
              {!loading && !results.length && (
                <EmptyState
                  icon="Search"
                  title="No results"
                  description="Try another search or change the filters."
                />
              )}
              {context && (
                <IssueActions
                  key={`${context.item.id}:${context.x}:${context.y}`}
                  issue={
                    store.data.issues.find((issue) => issue.id === context.item.id) ??
                    context.item
                  }
                  position={{ x: context.x, y: context.y }}
                />
              )}
            </div>
            {total > 500 && (
              <div className="search-result-limit">
                Showing the 500 most relevant matches. Add filters to narrow
                your search.
              </div>
            )}
          </div>
          {showPreview && hit && (
            <aside
              className="search-preview"
              aria-label="Search result preview"
            >
              <header className="search-preview-header">
                <span className="search-preview-identity">
                  {hit.identifier && <span>{hit.identifier}</span>}
                  <span>{hit.title ?? hit.name}</span>
                </span>
                {hit.kind === "issues" && (
                  <><SearchIssueFavorite issue={store.data.issues.find(issue=>issue.id===hit.id)??hit}/><IssueActions trigger={<button className="icon-button" aria-label="Issue options"><Icon name="MoreHorizontal" size={14}/></button>}
                    issue={
                      store.data.issues.find((issue) => issue.id === hit.id) ??
                      hit
                    }
                  /></>
                )}
                <span className="spacer" />
                <Button onClick={() => open(hit)}>
                  Go to{" "}
                  {hit.kind === "issues" ? "issue" : hit.kind.slice(0, -1)}
                </Button>
                <button
                  className="icon-button"
                  aria-label="Close search preview"
                  onClick={() => setShowPreview(false)}
                >
                  <Icon name="X" size={14} />
                </button>
              </header>
              <div className="search-preview-toolbar">
                <span className="spacer" />
                {hit.kind === "issues" ? <SearchIssueCopyActions issue={store.data.issues.find(issue=>issue.id===hit.id)??hit} url={location.origin+pathFor(hit)}/> : <button className="icon-button" aria-label="Copy result link" onClick={()=>void navigator.clipboard.writeText(location.origin+pathFor(hit)).then(()=>store.toast("Link copied"))}><Icon name="Link" size={14}/></button>}
              </div>
              {hit.kind === "issues" ? (
                <IssuePage issueId={hit.id} embedded />
              ) : (
                <div className="search-entity-preview">
                  <Icon
                    name={
                      Object.values(categories).find((c) => c.kind === hit.kind)
                        ?.icon ?? "Circle"
                    }
                    size={25}
                  />
                  <h2>{hit.title ?? hit.name}</h2>
                  <Button onClick={() => open(hit)}>
                    Open{" "}
                    {hit.kind === "projects"
                      ? "project"
                      : hit.kind === "documents"
                        ? "document"
                        : hit.kind === "initiatives"
                          ? "initiative"
                          : "customer"}
                    <Icon name="ArrowUpRight" size={14} />
                  </Button>
                  <RichEditor
                    readOnly
                    value={hit.description ?? hit.content ?? ""}
                    onChange={() => {}}
                  />
                </div>
              )}
            </aside>
          )}
        </div>
      )}
    </section>
  );
}
