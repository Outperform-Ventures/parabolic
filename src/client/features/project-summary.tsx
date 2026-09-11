import {CurrentViewOwner} from './view-owner';
import React, {useId, useMemo, useRef, useState} from 'react';
import {Avatar, Icon} from '../components/ui';
import {displayNameFor} from '../display-name';
import {EntityIcon} from './entity-icon';
import {type Row, useActions} from './shared';
import './project-summary.css';
import {matchesProjectSummary, projectSummaryValues} from './project-summary-health';

export {matchesProjectSummary, projectSummaryValues} from './project-summary-health';

const tabs = ['Health', 'Teams', 'Leads'] as const;
type SummaryTab = typeof tabs[number];
export type ProjectSummarySelection = {tab: SummaryTab; value: string};

export function ProjectSummary({projects, updates, selection, onSelect}: {
  projects: Row[]; updates: Map<string, Row>; selection: ProjectSummarySelection | null;
  onSelect: (selection: ProjectSummarySelection | null) => void;
}) {
  const {data} = useActions(), [tab, setTab] = useState<SummaryTab>('Health');
  const id = useId(), tabList = useRef<HTMLDivElement>(null);
  const groups = useMemo(() => {
    const counts = new Map<string, {value: string; name: string; count: number; entity?: Row}>();
    const entities = new Map((tab === 'Teams' ? data.teams : tab === 'Leads' ? data.users : []).map(entity => [entity.id, entity]));
    for (const project of projects) for (const value of projectSummaryValues(project, tab, updates)) {
      let group = counts.get(value);
      if (!group) {
        const entity = entities.get(value);
        const name = tab === 'Health' ? value : tab === 'Teams' ? entity?.name || (value ? 'Unknown team' : 'No team') : value ? displayNameFor(entity, data, 'Unknown lead') : 'No lead';
        group = {value, name, count: 0, entity};
        counts.set(value, group);
      }
      group.count++;
    }
    return [...counts.values()].sort((a, b) => b.count - a.count || (a.value === '' ? -1 : b.value === '' ? 1 : a.name.localeCompare(b.name)));
  }, [projects, updates, tab, data.teams, data.users, data]);
  const chooseTab = (next: SummaryTab) => {setTab(next); onSelect(null)};
  return <aside className="project-summary" aria-label="Project summary"><CurrentViewOwner/><div className="project-summary-card">
    <div ref={tabList} role="tablist" aria-label="Summarize projects by" className="project-summary-tabs" onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (tabs.indexOf(tab) + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
      chooseTab(tabs[index]); (tabList.current?.querySelectorAll('[role=tab]')[index] as HTMLElement)?.focus();
    }}>{tabs.map(name => <button type="button" key={name} role="tab" id={`${id}-${name}`} aria-controls={`${id}-panel`} aria-selected={tab === name} tabIndex={tab === name ? 0 : -1} onClick={() => chooseTab(name)}>{name}</button>)}</div>
    <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${tab}`} className="project-summary-rows">
      {groups.map(group => {
        const active = selection?.tab === tab && selection.value === group.value;
        return <button type="button" key={group.value} className={'project-summary-row ' + (active ? 'selected' : '')} aria-label={`Filter by ${group.name}`} aria-pressed={active} onClick={() => onSelect(active ? null : {tab, value: group.value})}>
          {tab === 'Leads' ? <Avatar user={group.entity} size={16}/> : tab === 'Teams' ? <EntityIcon entity={group.entity} fallback="Layers" size={16}/> : <span className={'project-health-symbol ' + group.value.toLowerCase().replaceAll(' ', '-')}/>}
          <span className="project-summary-name">{group.name}</span>{active && <Icon name="X" size={12}/>}
          <span className="project-summary-count" aria-label={`${group.count} ${group.count === 1 ? 'project' : 'projects'}`}>{group.count}</span>
        </button>;
      })}
      {!groups.length && <p className="muted">No projects in this view</p>}
    </div>
  </div></aside>;
}
