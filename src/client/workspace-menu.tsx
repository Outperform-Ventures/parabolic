import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {useNavigate} from 'react-router-dom';
import {apiRequest,useAppStore,authenticate} from './store';
import {Modal,Button} from './components/ui';
import { Icon } from './components/ui';
import './workspace-menu.css';

type Workspace = { id: string; name?: string };
export function WorkspaceMenu({ name, workspaceId, workspaces, canManageMembers=true, onSettings, onMembers, onSwitch, onCreate, onLogout, onError }: {
  canManageMembers?:boolean; name: string; workspaceId?: string; workspaces: Workspace[];
  onSettings: () => void; onMembers: () => void; onSwitch: (id: string) => Promise<void>;
  onCreate: () => void; onLogout: () => Promise<void>; onError: (message: string) => void;
}) {
  const navigate=useNavigate(),store=useAppStore(),[adding,setAdding]=useState(false),[accounts,setAccounts]=useState<{id:string;email:string;name:string}[]>([]);
  const [open, setOpen] = useState(false), [switching, setSwitching] = useState(false),[query,setQuery]=useState('');
  useEffect(()=>{if(switching)void apiRequest('/auth/accounts').then(r=>setAccounts(r.nodes||[])).catch(()=>{});},[switching]);
  const [point, setPoint] = useState({ left: 12, top: 82 }), [subpoint, setSubpoint] = useState({ left: 247, top: 158 });
  const trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null), submenu = useRef<HTMLDivElement>(null), switcher = useRef<HTMLButtonElement>(null),filter=useRef<HTMLInputElement>(null);
  const initialFocus = useRef<'first'|'last'|null>(null), subFocus = useRef(false), hoverTimer = useRef<ReturnType<typeof setTimeout>|undefined>(undefined), typeahead = useRef({ value: '', at: 0 });
  const rootActionLabels = ['Settings', ...(canManageMembers ? ['Invite and manage members'] : []), 'Switch workspace', 'Log out'];
  const visibleRootItemCount = rootActionLabels.filter(label => label.toLowerCase().includes(query.toLowerCase())).length;
  const cancelHover = useCallback(() => { clearTimeout(hoverTimer.current); }, []);
  const close = useCallback((restore = true) => { cancelHover(); setOpen(false); setSwitching(false); setQuery(''); if (restore) trigger.current?.focus(); }, [cancelHover]);
  const openSwitch = (focus = false) => { cancelHover(); subFocus.current = focus; setSwitching(true); };
  const run = (action: () => void | Promise<void>) => { close(); void Promise.resolve().then(action).catch(error => onError(error instanceof Error ? error.message : 'Unable to complete workspace action')); };
  const items = (element: HTMLDivElement | null) => Array.from(element?.querySelectorAll<HTMLButtonElement>(':scope > [role="menuitem"]') ?? []).filter(item => !item.hidden);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const anchor = trigger.current?.getBoundingClientRect(), box = menu.current?.getBoundingClientRect();
      if (!anchor || !box) return;
      setPoint({ left: Math.max(8, Math.min(anchor.left, innerWidth - box.width - 8)), top: Math.max(8, anchor.bottom + 4 + box.height <= innerHeight - 8 ? anchor.bottom + 4 : anchor.top - box.height - 4) });
    };
    place();
    if (initialFocus.current) { const choices = items(menu.current); (initialFocus.current === 'last' ? choices.at(-1) : choices[0])?.focus(); initialFocus.current = null; }
    else filter.current?.focus({preventScroll:true});
    const observer = new ResizeObserver(place); if (menu.current) observer.observe(menu.current);
    window.addEventListener('resize', place); window.addEventListener('scroll', place, true);
    return () => { observer.disconnect(); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open]);
  useLayoutEffect(() => {
    if (!switching) return;
    const row = switcher.current?.getBoundingClientRect(), box = submenu.current?.getBoundingClientRect();
    if (row && box) setSubpoint({ left: row.right + 5 + box.width <= innerWidth - 8 ? row.right + 5 : Math.max(8, row.left - box.width - 5), top: Math.max(8, Math.min(row.top - 7, innerHeight - box.height - 8)) });
    if (subFocus.current) { items(submenu.current)[0]?.focus(); subFocus.current = false; }
  }, [switching, point, workspaces.length]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => { if (![trigger.current, menu.current, submenu.current].some(element => element?.contains(event.target as Node))) close(false); };
    const key = (event: KeyboardEvent) => {
      const inSubmenu = switching && submenu.current?.contains(document.activeElement);
      if (event.key === 'Escape' || (event.key === 'ArrowLeft' && switching)) {
        event.preventDefault(); event.stopPropagation();
        if (switching) { setSwitching(false); switcher.current?.focus(); } else close();
        return;
      }
      if (event.key === 'Tab') { close(); return; }
      if (event.key === 'ArrowRight' && document.activeElement === switcher.current) { event.preventDefault(); event.stopPropagation(); openSwitch(true); return; }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if(inSubmenu&&/^[1-9]$/.test(event.key)){const workspace=workspaces[Number(event.key)-1];if(workspace){event.preventDefault();event.stopPropagation();run(()=>onSwitch(workspace.id));return;}}
      const choices = items(inSubmenu ? submenu.current : menu.current);
      if(document.activeElement===filter.current){
        if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();event.stopPropagation();(event.key==='ArrowUp'?choices.at(-1):choices[0])?.focus();}
        else if(event.key==='Enter'){event.preventDefault();event.stopPropagation();choices[0]?.click();}
        return;
      }
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault(); event.stopPropagation();
        const current = choices.indexOf(document.activeElement as HTMLButtonElement), last = choices.length - 1;
        const index = event.key === 'Home' ? 0 : event.key === 'End' ? last : current < 0 ? event.key === 'ArrowUp' ? last : 0 : (current + (event.key === 'ArrowUp' ? last : 1)) % choices.length;
        choices[index]?.focus();
      } else if(event.key==='Enter'&&choices.includes(document.activeElement as HTMLButtonElement)) {
        event.preventDefault(); event.stopPropagation(); (document.activeElement as HTMLButtonElement).click();
      } else if (event.key.length === 1 && event.key !== ' ') {
        event.preventDefault(); event.stopPropagation();
        const value = (Date.now() - typeahead.current.at > 650 ? '' : typeahead.current.value) + event.key.toLowerCase();
        typeahead.current = { value, at: Date.now() };
        choices.find(item => item.querySelector('span')?.textContent?.trim().toLowerCase().startsWith(value))?.focus();
      }
    };
    document.addEventListener('mousedown', outside); document.addEventListener('keydown', key, true);
    return () => { cancelHover(); document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', key, true); };
  }, [open, switching, close, cancelHover]);
  const closeSubSoon = () => { cancelHover(); hoverTimer.current = setTimeout(() => setSwitching(false), 180); };
  const clearSub = () => { cancelHover(); setSwitching(false); };
  return <>
    <button ref={trigger} className="workspace-name" aria-label={`${name} Workspace Menu`} aria-haspopup="menu" aria-expanded={open}
      onClick={() => open ? close() : setOpen(true)} onKeyDown={event => { if (!open && ['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); initialFocus.current = event.key === 'ArrowUp' ? 'last' : 'first'; setOpen(true); } }}>
      <span className="brand-mark"/><strong>{name}</strong><Icon name="ChevronDown" size={11}/>
    </button>
    {open && createPortal(<>
      <div ref={menu} className="workspace-popup" role="menu" aria-label="Workspace actions" style={point}>
        <span className="native-visually-hidden" role="status">{query?`Showing ${visibleRootItemCount} ${visibleRootItemCount === 1 ? 'item' : 'items'}`:'Showing all items'}</span>
        <input ref={filter} className="native-visually-hidden" type="search" aria-label="Filter…" placeholder="Filter…" value={query} onChange={event=>setQuery(event.target.value)}/>
        <button hidden={!!query&&!('Settings'.toLowerCase().includes(query.toLowerCase()))} role="menuitem" className="workspace-popup-item" onMouseEnter={clearSub} onClick={() => run(onSettings)}><span>Settings</span><kbd>G then S</kbd></button>
        {canManageMembers&&<button hidden={!!query&&!('Invite and manage members'.toLowerCase().includes(query.toLowerCase()))} role="menuitem" className="workspace-popup-item" onMouseEnter={clearSub} onClick={() => run(onMembers)}><span>Invite and manage members</span></button>}
        <div className="workspace-popup-separator" role="separator"/>
        <button hidden={!!query&&!('Switch workspace'.toLowerCase().includes(query.toLowerCase()))} ref={switcher} role="menuitem" className="workspace-popup-item" aria-haspopup="menu" aria-expanded={switching}
          onMouseEnter={() => { cancelHover(); hoverTimer.current = setTimeout(() => openSwitch(), 100); }} onMouseLeave={closeSubSoon}
          onClick={() => openSwitch(true)}><span>Switch workspace</span><kbd>O then W</kbd><Icon name="ChevronRight" size={9}/></button>
        <button hidden={!!query&&!('Log out'.toLowerCase().includes(query.toLowerCase()))} role="menuitem" className="workspace-popup-item" onMouseEnter={clearSub} onClick={() => run(onLogout)}><span>Log out</span><kbd>{/Mac|iPhone|iPad/.test(navigator.platform) ? '⌥⇧Q' : 'Alt⇧Q'}</kbd></button>
      </div>
      {switching && <div ref={submenu} className="workspace-popup workspace-popup-submenu" role="menu" aria-label="Switch workspace" style={subpoint} onMouseEnter={cancelHover} onMouseLeave={closeSubSoon}>
        <div className="workspace-account-heading">{store.user?.email}</div>
        {workspaces.map((workspace,index) => <button key={workspace.id} aria-label={workspace.name||'Workspace'} role="menuitem" className="workspace-popup-item" onClick={() => run(() => workspace.id === workspaceId ? undefined : onSwitch(workspace.id))}><i className="brand-mark workspace-menu-mark" aria-hidden="true"/><span>{workspace.name || 'Workspace'}</span>{workspace.id === workspaceId && <Icon name="Check" size={13}/>}<kbd>{index<9?index+1:''}</kbd></button>)}
        {accounts.filter(a=>a.id!==store.user?.id).map(a=><button key={a.id} role="menuitem" className="workspace-popup-item" onClick={()=>run(async()=>{await apiRequest('/auth/accounts/switch',{method:'POST',body:JSON.stringify({userId:a.id})});await store.reload();navigate('/my-issues');})}><span>{a.email}</span></button>)}
        <div className="workspace-account-heading">Account</div>
        <button role="menuitem" className="workspace-popup-item" onClick={() => run(onCreate)}><span>Create or join a workspace…</span></button>
        <button role="menuitem" className="workspace-popup-item" onClick={() => run(()=>setAdding(true))}><span>Add an account…</span></button>
      </div>}
    </>, document.body)}
    {adding&&<AddSidebarAccount onClose={()=>setAdding(false)}/>}
  </>;
}

function AddSidebarAccount({onClose}:{onClose:()=>void}){const navigate=useNavigate(),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');return <Modal title="Add an account" onClose={onClose}><form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await authenticate('login',{email,password});navigate('/my-issues');onClose();}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}}><div className="modal-body"><label className="field">Email<input className="input" autoFocus type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label className="field">Password<input className="input" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<p role="alert" className="error-text">{error}</p>}</div><div className="modal-footer"><Button type="button" onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy}>{busy?'Signing in…':'Sign in'}</Button></div></form></Modal>;}
