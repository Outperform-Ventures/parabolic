import {NativeControlIcon} from './components/sidebar-icons';
import {FilterMenuIcon} from './filter-menu-icons';
import React, { useEffect, useState } from "react";
import type { Entity, WorkspaceData } from "../shared/types";
import { Dropdown, Icon } from "./components/ui";
import { displayNameFor } from "./display-name";
export type InboxFilterSpec = Record<string, string[]>;
export const inboxFilterFields = [
  ["type", "Notification type"],
  ["actorId", "From"],
  ["teamId", "Team"],
  ["projectId", "Project"],
  ["priority", "Issue priority"],
  ["statusType", "Issue status type"],
] as const;
export function matchesInboxFilters(
  notification: Entity,
  issue: Entity | undefined,
  statusType: string | undefined,
  filters: InboxFilterSpec,
) {
  return Object.entries(filters).every(
    ([field, values]) =>
      !values.length ||
      values.some((value) => {
        if (field === "type")
          return (
            Array.isArray(notification.reasons)
              ? notification.reasons
              : [notification.type]
          ).includes(value);
        const actual =
          field === "actorId"
            ? notification.actorId
            : field === "statusType"
              ? statusType
              : field === "priority"
                ? issue?.priority
                : (issue?.[field] ?? notification[field]);
        return String(actual ?? "") === value;
      }),
  );
}
const typeNames: Record<string, string> = {
  assigned: "Assignments",
  mentioned: "Mentions",
  comments: "Comments",
  status: "Status changes",
  projectUpdates: "Project updates",
  issueCreated: "New issues",
  documentContentChange: "Document changes",
  documentDeleted: "Deleted documents",
  documentSubscribed: "Document subscriptions",
  documentUnsubscribed: "Document subscriptions",
  projectDescriptionContentChange: "Project description changes",
  initiativeUpdates: "Initiative updates",
  updateReminders: "Update reminders",
  requests: "Customer requests",
  reminder: "Reminders",
  reminders: "Reminders",
  shared: "Shared issues",
  sla: "Service level alerts",
  slaBreached: "Service level alerts",
  slaWarning: "Service level alerts",
  workspaceWelcome: "System notifications",
};
function options(field: string, data: WorkspaceData, notifications: Entity[]) {
  if (field === "type")
    return Array.from(
      new Set(
        notifications
          .flatMap((item) =>
            Array.isArray(item.reasons) ? item.reasons : [item.type],
          )
          .filter(Boolean),
      ),
    ).map((id) => ({
      id: String(id),
      name: typeNames[id] || String(id).replace(/([A-Z])/g, " $1"),
    }));
  if (field === "priority")
    return ["No priority", "Urgent", "High", "Medium", "Low"].map(
      (name, id) => ({ id: String(id), name }),
    );
  if (field === "statusType")
    return [
      ["triage", "Triage"],
      ["backlog", "Backlog"],
      ["unstarted", "Todo"],
      ["started", "In progress"],
      ["completed", "Done"],
      ["canceled", "Canceled"],
      ["duplicate", "Duplicate"],
    ].map(([id, name]) => ({ id, name }));
  if (field === "actorId")
    return [
      { id: "", name: "System" },
      ...data.users.map((user) => ({
        id: user.id,
        name: displayNameFor(user, data),
      })),
    ];
  return data[field === "teamId" ? "teams" : "projects"]
    .filter((item) => !item.deletedAt)
    .map((item) => ({ id: item.id, name: item.name }));
}
export function InboxFilters({
  data,
  notifications,
  value,
  onChange,
}: {
  data: WorkspaceData;
  notifications: Entity[];
  value: InboxFilterSpec;
  onChange: (value: InboxFilterSpec) => void;
}) {
  const [field, setField] = useState(""),
    [query, setQuery] = useState(""),
    [showUnavailable,setShowUnavailable]=useState(false);
  const count = Object.values(value).filter((values) => values.length).length;
  useEffect(()=>{
    if(!field)return;
    const close=(event:KeyboardEvent)=>{
      if(event.key!=='Escape'||event.isComposing||event.keyCode===229)return;
      event.preventDefault();event.stopImmediatePropagation();setField("");setShowUnavailable(false);
    };
    document.addEventListener('keydown',close,true);return()=>document.removeEventListener('keydown',close,true);
  },[field]);
  const fieldOptions=field?options(field,data,notifications):[];
  const typeCounts=new Map<string,number>();
  for(const notification of notifications)for(const reason of(Array.isArray(notification.reasons)?notification.reasons:[notification.type]).filter(Boolean))typeCounts.set(String(reason),(typeCounts.get(String(reason))??0)+1);
  const canonicalTypeOptions=Array.from(new Map(Object.entries(typeNames).map(([id,name])=>[name,{id,name}])).values());
  const shownOptions=field==='type'?canonicalTypeOptions:fieldOptions;
  const availableOptions=field==='type'?shownOptions.filter(option=>typeCounts.has(option.id)):shownOptions;
  const unavailableOptions=field==='type'?shownOptions.filter(option=>!typeCounts.has(option.id)):[];
  return (
    <Dropdown
      align="left"
      sideOffset={4.5}
      menuClassName="inbox-filter-menu"
      trigger={
        <button
          className={`icon-button ${count ? "active" : ""}`}
          aria-label="Add filter"
          title="Add filter"
          onClick={() => {
            setField("");
            setQuery("");
            setShowUnavailable(false);
          }}
        >
          <NativeControlIcon name="Add filter" />
          {count > 0 && <span className="inbox-filter-count">{count}</span>}
        </button>
      }
    >
      <div className="inbox-filter-popover" data-keep-open>
        <div className="inbox-filter-search">
        <input
          className="input"
          autoFocus
          aria-label="Search notification filters"
          placeholder="Add Filter…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <kbd aria-hidden="true">F</kbd>
        </div>
        {inboxFilterFields
            .filter(([, label]) =>
              label.toLowerCase().includes(query.toLowerCase()),
            )
            .map(([key, label]) => (
              <button
                className="menu-item"
                key={key}
                onClick={() => {
                  setField(key);
                  setShowUnavailable(false);
                }}
              >
                {key==='type'?<Icon name="Inbox" size={14}/>:<FilterMenuIcon name={key==='actorId'?'Assignee':key==='priority'?'Priority':key==='statusType'?'Status':label}/>}
                {label}
                <span className="spacer" />
                <svg className="inbox-filter-branch" width="6" height="8" viewBox="0 0 6 8" aria-hidden="true"><path d="M1 1.25 4 4 1 6.75" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            ))}
        {field&&<div className="menu inbox-filter-values-panel" role="menu" aria-label={inboxFilterFields.find(([key])=>key===field)?.[1]} data-dropdown-escape-layer style={{top:36+Math.max(0,inboxFilterFields.findIndex(([key])=>key===field))*32}}>
          <div className="inbox-filter-values">
            {availableOptions.map((option) => (
                <label key={option.id} className="menu-item">
                  <input
                    type="checkbox"
                    checked={(value[field] || []).includes(option.id)}
                    onChange={(event) =>
                      onChange({
                        ...value,
                        [field]: event.target.checked
                          ? [...(value[field] || []), option.id]
                          : (value[field] || []).filter(
                              (id) => id !== option.id,
                            ),
                      })
                    }
                  />
                  {option.name}
                  {field==='type'&&<small>{typeCounts.get(option.id)} notification{typeCounts.get(option.id)===1?'':'s'}</small>}
                </label>
              ))}
            {field!=='type'&&!availableOptions.length&&<p className="muted">No matching options</p>}
            {field==='type'&&unavailableOptions.length>0&&<><button className="menu-item inbox-filter-unavailable" aria-expanded={showUnavailable} onClick={()=>setShowUnavailable(open=>!open)}><Icon name="Inbox" size={14}/>{unavailableOptions.length} options not matching any notifications</button>{showUnavailable&&unavailableOptions.map(option=><label key={option.id} className="menu-item inbox-filter-unavailable-option"><input type="checkbox" checked={(value[field]||[]).includes(option.id)} onChange={event=>onChange({...value,[field]:event.target.checked?[...(value[field]||[]),option.id]:(value[field]||[]).filter(id=>id!==option.id)})}/>{option.name}</label>)}</>}
          </div>
        </div>}
        {count > 0 && (
          <button className="menu-item" onClick={() => onChange({})}>
            <Icon name="X" size={14} />
            Clear notification filters
          </button>
        )}
      </div>
    </Dropdown>
  );
}
export function InboxFilterChips({
  data,
  notifications,
  value,
  onChange,
}: {
  data: WorkspaceData;
  notifications: Entity[];
  value: InboxFilterSpec;
  onChange: (value: InboxFilterSpec) => void;
}) {
  return (
    <div className="inbox-filter-chips">
      {inboxFilterFields
        .filter(([field]) => value[field]?.length)
        .map(([field, label]) => (
          <button
            key={field}
            className="button"
            aria-label={`Remove ${label} filter`}
            onClick={() => {
              const next = { ...value };
              delete next[field];
              onChange(next);
            }}
          >
            {label}:{" "}
            {value[field]
              .map(
                (id) =>
                  options(field, data, notifications).find(
                    (option) => option.id === id,
                  )?.name || id,
              )
              .join(", ")}
            <Icon name="X" size={12} />
          </button>
        ))}
    </div>
  );
}
