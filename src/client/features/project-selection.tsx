import {PeekPreview} from '../peek-preview';
import React, {useEffect, useRef, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {Dropdown, Icon, MenuItem} from '../components/ui';
import {dispatchWorkspaceCommand} from '../shortcut-actions';
import type {Row} from './shared';
import './project-selection.css';

export function useProjectSelection(projects: Row[], host: React.RefObject<HTMLDivElement|null>, timeline: boolean) {
  const [selected, setSelected] = useState<string[]>([]), [focused, setFocused] = useState<string|null>(null), [peek,setPeek]=useState<string|null>(null);
  const anchor = useRef<string|null>(null), rangeBase = useRef<string[]>([]), navigate = useNavigate();
  const ids = [...new Set(projects.map(project => project.id))], visible = new Set(ids);
  const active = selected.filter(id => visible.has(id)), focusedId = focused && visible.has(focused) ? focused : null;
  const select = (id: string, range = false) => {
    if (range && anchor.current && visible.has(anchor.current)) {
      const a = ids.indexOf(anchor.current), b = ids.indexOf(id);
      setSelected([...new Set([...rangeBase.current.filter(id=>visible.has(id)), ...ids.slice(Math.min(a,b),Math.max(a,b)+1)])]);
    } else {anchor.current = id; rangeBase.current=active.filter(value=>value!==id); setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current,id])}
    setFocused(id);
  };
  useEffect(()=>{const element=host.current;const key=(event:KeyboardEvent)=>{const row=(event.target as HTMLElement).closest<HTMLElement>('[data-project-row]');if(timeline||event.key!==' '||event.repeat||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey||!row||event.target!==row)return;event.preventDefault();event.stopPropagation();const id=row.dataset.projectRow;if(id){setFocused(id);setPeek(id)}};element?.addEventListener('keydown',key);return()=>element?.removeEventListener('keydown',key)},[timeline]);
  useEffect(() => {
    setSelected(current => current.every(id => visible.has(id)) ? current : current.filter(id => visible.has(id)));
  }, [ids.join(',')]);
  useEffect(() => {
    const listener = (event: Event) => {
      if (event.defaultPrevented) return;
      const command = (event as CustomEvent).detail?.command, value = (event as CustomEvent).detail?.value;
      // Timeline milestone selection owns these commands while a marker is focused.
      if (timeline && (command === 'select-all' || command === 'clear-selection')) return;
      if (command === 'select-all') setSelected(ids);
      else if (command === 'clear-selection') setSelected([]);
      else if (command === 'command-menu' && active.length) host.current?.querySelector<HTMLButtonElement>('[aria-label="Open project selection commands"]')?.click();
      else if (timeline) return;
      else if (command === 'toggle-selection' && (focusedId || ids[0])) select(focusedId || ids[0]);
      else if (command === 'focus-item' || command === 'extend-selection') {
        const index = ids.indexOf(focusedId || ''), next = ids[Math.max(0, Math.min(ids.length-1,index+(value==='up'?-1:1)))];
        if (!next) return;
        if (command === 'extend-selection') {anchor.current ||= focusedId || next;select(next,true)}
        setFocused(next);
        host.current?.querySelector<HTMLElement>(`[data-project-row="${next}"]`)?.focus();
      } else if (command === 'peek-item' && (focusedId||ids[0])) setPeek(focusedId||ids[0]);
      else if (command === 'open-focused-item' && focusedId) navigate('/project/'+focusedId+'/overview');
      else return;
      event.preventDefault();
    };
    window.addEventListener('workspace-command',listener,true);
    return () => window.removeEventListener('workspace-command',listener,true);
  }, [ids.join(','),active.join(','),focusedId,timeline]);
  return {ids: active, setSelected, focusedId, setFocused, select, clear: () => setSelected([]), preview:peek&&visible.has(peek)?<PeekPreview kind="projects" id={peek} ids={ids} onFocus={id=>{setPeek(id);setFocused(id)}} onClose={()=>setPeek(null)}/>:null};
}

const commands = [
  ['Change project status…','edit-property','status'], ['Change project priority…','edit-property','priority'],
  ['Add labels…','edit-property','labelIds'], ['Set project target date…','edit-property','targetDate'],
  ['Set project start date…','edit-property','startDate'], ['Set project lead…','edit-property','leadId'],
  ['Change project members…','edit-property','memberIds'], ['Change project teams…','edit-property','teamIds'],
  ['Add customer request to project…','new-customer-request'],
  ['Create new project milestone…','new-project-milestone'],
  ['Remind me about these projects…','remind'], ['Favorite projects','favorite-projects'],
  ['Copy project URLs','copy-entity-url'], ['Copy project titles','copy-entity-title'],
  ['Copy titles as links','copy-project-links'], ['Copy project overviews as Markdown','copy-project-markdown'],
  ['Copy project customer requests as Markdown','copy-project-requests-markdown'],
  ['Archive projects','archive-projects'], ['Delete projects…','delete-issue'],
] as const;

export function ProjectSelectionBar({count,onClear}: {count: number;onClear: () => void}) {
  const [query,setQuery] = useState('');
  if (!count) return null;
  const available = count===1 ? [
    ['Edit project…','edit-selected-project'],
    ['Rename project','rename-project'],
    ['Change project dependencies…','edit-project-dependencies'],
    ['Create new document…','new-project-document'],
    ['Open project updates and activity','open-updates'],
    ...commands,
  ] as readonly (readonly string[])[] : commands;
  return <div className="project-selection-bar" role="toolbar" aria-label="Selected projects">
    <span role="status">{count} selected</span>
    <Dropdown trigger={<button type="button" className="icon-button" aria-label="Open project selection commands" onClick={()=>setQuery('')}><Icon name="Command" size={16}/></button>}>
      <input autoFocus className="project-selection-search" aria-label="Search project commands" placeholder="Type a command…" value={query} onChange={event=>setQuery(event.target.value)}/>
      {available.filter(([title])=>title.toLowerCase().includes(query.toLowerCase())).map(([title,command,field])=><MenuItem key={command+field} danger={command==='delete-issue'} onClick={()=>dispatchWorkspaceCommand({command,...(field?{field}:{})})}>{title}</MenuItem>)}
      {!available.some(([title])=>title.toLowerCase().includes(query.toLowerCase()))&&<div className="menu-empty">No matching commands</div>}
    </Dropdown>
    <button type="button" className="icon-button" aria-label="Clear selected projects" onClick={onClear}><Icon name="X" size={16}/></button>
  </div>;
}
