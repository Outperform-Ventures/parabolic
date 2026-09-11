import React from 'react';
import {useLocation} from 'react-router-dom';
import {CalendarDays} from 'lucide-react';
import {FeaturePropertyPicker} from './property-picker';
import {TargetDateControl, formatTargetDate} from './date-picker';
import {EntityIcon, EntityIconPicker} from './entity-icon';
import {ProjectListLead, ProjectListPriority, ProjectListStatus} from './project-list-cells';
import {projectStatuses} from './project-statuses';
import {displayNameFor} from '../display-name';
import {live, priorities, useActions, type Row} from './shared';
import type {ProgressPoint} from './progress-data';
import './project-inline-properties.css';

export function ProjectInlineIcon({project}: {project: Row}) {
  const {update} = useActions();
  return <span className="project-cell-icon"><EntityIconPicker label="Change project icon" icon={project.icon} color={project.color} size={16} onChange={value => update('projects', project.id, value)}/></span>;
}

export function ProjectInlineProperty({project, field, history, ordinalDay=false, overviewMenu=false}: {
  project: Row; field: 'priority' | 'leadId' | 'status' | 'teamIds' | 'startDate' | 'targetDate';
  history?: {percentage: number; points: ProgressPoint[]};
  ordinalDay?: boolean;
  overviewMenu?: boolean;
}) {
  const {data, update} = useActions();
  const location=useLocation();overviewMenu=overviewMenu||/\/project\/[^/]+\/overview\/?$/.test(location.pathname);
  const patch = (value: Record<string, unknown>) => update('projects', project.id, value);
  if (field === 'targetDate' || field === 'startDate') {
    const target = field === 'targetDate', value = project[field], precision = target ? project.datePrecision || 'day' : project.startDatePrecision || 'day';
    return <TargetDateControl label={target ? 'Target date' : 'Start date'} triggerLabel={target ? 'Change project target date' : 'Change project start date'} value={value} precision={precision}
      triggerClassName={'project-inline-trigger project-cell-date project-date-'+field+' ' + (!value ? 'empty' : '')}
      triggerContent={value ? <span>{ordinalDay&&precision==='day'?formatOrdinalDate(value):formatTargetDate(value, precision)}</span> : <CalendarDays size={16}/>}
      minDate={target ? project.startDate : undefined} maxDate={target ? undefined : project.targetDate}
      onChange={(date, datePrecision) => patch(target ? {targetDate: date, datePrecision} : {startDate: date, startDatePrecision:datePrecision})}/>;
  }
  if (field === 'priority') return <FeaturePropertyPicker label="Priority" triggerLabel="Change project priority" values={[String(project.priority || 0)]}
    options={priorities.map(option => ({...option, shortcut: option.value}))} triggerClassName="project-inline-trigger"
    triggerContent={<ProjectListPriority value={Number(project.priority) || 0}/>} onChange={values => patch({priority: Number(values[0]) || 0})}/>;
  if (field === 'status') {
    const statuses = projectStatuses(data);
    return <FeaturePropertyPicker label="Status" triggerLabel="Change project status" values={[project.status || 'planned']}
      options={statuses.map((status, index) => ({value: status.id, label: status.name, shortcut: index < 9 ? String(index + 1) : undefined}))}
      triggerClassName="project-inline-trigger" triggerContent={<ProjectListStatus project={project} status={statuses.find(status => status.id === project.status)} history={history}/>}
      onChange={values => patch({status: values[0]})}/>;
  }
  const teamIds = [...new Set<string>([...(project.teamIds || []), ...(project.teamId ? [project.teamId] : [])])];
  if (field === 'teamIds') {
    const teams = live(data.teams);
    return <FeaturePropertyPicker label="Teams" triggerLabel="Change project teams" multiple values={teamIds} {...(overviewMenu?{searchLabel:'Change teams…',dialogLabel:'Menu',shortcutHint:'P, then T'}:{})}
      options={teams.map(team => ({value: team.id, label: team.name, ...(overviewMenu?{group:'Your teams',detail:`${live(data.issues).filter(issue=>issue.projectId===project.id&&issue.teamId===team.id).length} issues`}:{})}))} triggerClassName="project-inline-trigger project-cell-teams"
      triggerContent={<>{teamIds.length ? teams.filter(team => teamIds.includes(team.id)).map(team => <span key={team.id}><EntityIcon entity={team} fallback="Layers" size={14}/>{team.name}</span>) : <span>No team</span>}</>}
      onChange={values => patch({teamIds: values, teamId: values.includes(project.teamId) ? project.teamId : values[0] || null})}/>;
  }
  const members = new Set(live(data.memberships).filter(member => teamIds.includes(member.teamId)).map(member => member.userId));
  const users = live(data.users).sort((a, b) => Number(members.has(b.id)) - Number(members.has(a.id)) || displayNameFor(a, data).localeCompare(displayNameFor(b, data)));
  return <FeaturePropertyPicker label="Lead" triggerLabel="Change project lead" values={[project.leadId || '']}
    options={[{value: '', label: 'No lead', shortcut: '0'}, ...users.map(user => ({value: user.id, label: displayNameFor(user, data), group: members.has(user.id) ? 'Users from the project team' : 'Other users'}))]}
    triggerClassName="project-inline-trigger" triggerContent={<ProjectListLead user={data.users.find(user => user.id === project.leadId)} data={data}/>}
    onChange={values => patch({leadId: values[0] || null})}/>;
}

function formatOrdinalDate(value:string){
  const date=new Date(value.slice(0,10)+'T12:00:00Z'),day=date.getUTCDate(),mod100=day%100,suffix=mod100>=11&&mod100<=13?'th':day%10===1?'st':day%10===2?'nd':day%10===3?'rd':'th';
  return `${date.toLocaleDateString('en-US',{month:'short',timeZone:'UTC'})} ${day}${suffix}`;
}
