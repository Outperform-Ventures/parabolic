import {guestCapabilities} from '../../shared/guest-capabilities';
import React,{useMemo,useState} from 'react';
import {Link,useNavigate,useParams} from 'react-router-dom';
import {CalendarDays,ChevronDown,ChevronRight,FileText,Filter,FolderKanban,Link2,ListFilter,MoreHorizontal,SlidersHorizontal,Star,UserRound} from 'lucide-react';
import {Dropdown,MenuItem,Modal,Button} from '../components/ui';
import {apiRequest} from '../store';
import {relativeDate} from '../query';
import {IssueActionFilter} from '../issue-action-filter';
import {IssueActionSubmenu} from '../issue-action-submenu';
import {EntityReminderMenu} from '../issue-reminder-menu';
import {documentLink} from '../document-link';
import {richTextToMarkdown} from '../markdown';
import {contentAttribution} from '../../shared/content-attribution';
import {documentMovePatch} from '../../shared/document-parent';
import {documentReadOnlyReason} from '../document-access';
import {DocumentForm} from './document-form';
import {DocumentHistoryModal} from './content';
import {EntityIcon} from './entity-icon';
import {AddButton,Blank,Confirm,date,live,Person,useActions,type Row} from './shared';
import './team-home.css';

type SortKey='name'|'createdAt'|'updatedAt'|'owner';
type DocumentDisplay={groupBy:'project'|'none';showInactiveProjects:boolean;onlyMyProjects:boolean;createdAt:boolean;updatedAt:boolean;owner:boolean};
type DocumentGroup={id:string;name:string;documents:Row[];project?:Row};

const text=(value:unknown)=>String(value||'').toLocaleLowerCase();

function RenameDocumentCommand({document,onClose}:{document:Row;onClose:()=>void}){
 const {update,act}=useActions(),[title,setTitle]=useState(document.title||'');
 const save=()=>{const value=title.trim();if(value)void act(()=>update('documents',document.id,{title:value}),'Document renamed').then(onClose)};
 return <Modal title="Rename document" onClose={onClose}><div className="modal-body"><input autoFocus className="input" aria-label="Command menu" value={title} onChange={event=>setTitle(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();save()}}}/><div role="listbox" aria-label="Rename actions"><button type="button" role="option" aria-selected="true" className="menu-item" disabled={!title.trim()} onClick={save}>Rename document to “{title.trim()}”</button></div></div><div className="modal-footer"><Button onClick={onClose}>Cancel</Button></div></Modal>;
}

export function TeamDocumentsPage(){
 const {teamId}=useParams(),nav=useNavigate();
 const {data,user,create,remove,update,act,reload,toast}=useActions();
 const access=guestCapabilities(data,user?.id),team=data.teams.find(item=>item.id===teamId);
 const [adding,setAdding]=useState(false),[leaving,setLeaving]=useState(false),[busy,setBusy]=useState(false),[filterOpen,setFilterOpen]=useState(false),[filterMenuQuery,setFilterMenuQuery]=useState(''),[query,setQuery]=useState(''),[collapsed,setCollapsed]=useState<Record<string,boolean>>({}),[selected,setSelected]=useState<string[]>([]),[sort,setSort]=useState<{key:SortKey;direction:1|-1}>({key:'name',direction:1}),[display,setDisplay]=useState<DocumentDisplay>({groupBy:'project',showInactiveProjects:false,onlyMyProjects:false,createdAt:true,updatedAt:true,owner:true}),[context,setContext]=useState<{id:string;x:number;y:number;nonce:number}|null>(null),[renaming,setRenaming]=useState<Row|null>(null),[deleting,setDeleting]=useState<Row|null>(null),[history,setHistory]=useState<Row|null>(null);
 const documents=useMemo(()=>{
  const teamProjects=live(data.projects).filter(project=>project.teamId===teamId||project.teamIds?.includes(teamId));
  const projectIds=new Set(teamProjects.filter(project=>{
   const inactive=!!(project.completedAt||project.canceledAt||['completed','canceled'].includes(String(project.status||'').toLocaleLowerCase()));
   const mine=project.leadId===user?.id||project.ownerId===user?.id||project.memberIds?.includes(user?.id);
   return (display.showInactiveProjects||!inactive)&&(!display.onlyMyProjects||mine);
  }).map(project=>project.id));
  const rows=live(data.documents).filter(item=>((item.teamId===teamId&&!item.projectId)||projectIds.has(item.projectId))&&(!query||text(item.title).includes(text(query))));
  return rows.sort((a,b)=>{
   const owner=(item:Row)=>data.users.find(person=>person.id===(item.userId||item.creatorId||item.createdBy))?.name||'';
   const left=sort.key==='owner'?owner(a):sort.key==='name'?(a.title||'Untitled'):(a[sort.key]||''),right=sort.key==='owner'?owner(b):sort.key==='name'?(b.title||'Untitled'):(b[sort.key]||'');
   return text(left).localeCompare(text(right))*sort.direction;
  });
 },[data.documents,data.projects,data.users,display.onlyMyProjects,display.showInactiveProjects,query,sort,teamId,user?.id]);
 if(!team)return <Blank title="Team not found"/>;
 const favorite=live(data.favorites).find(item=>item.userId===user?.id&&item.entityId===team.id&&(item.entityKind==='teams'||item.type==='team'));
 const toggleFavorite=()=>act(()=>favorite?remove('favorites',favorite.id):create('favorites',{type:'team',entityKind:'teams',entityId:team.id,userId:user?.id,label:team.name,route:`/team/${team.id}/overview`,icon:team.icon,color:team.color}));
 const order=(key:SortKey)=>setSort(current=>({key,direction:current.key===key?(current.direction===1?-1:1):1}));
 const arrow=(key:SortKey)=>sort.key===key?(sort.direction===1?' ↓':' ↑'):'';
 const projectFor=(document:Row)=>data.projects.find(project=>project.id===document.projectId);
 const groups:DocumentGroup[]=display.groupBy==='none'?[{id:'all',name:'Documents',documents}]:[
  {id:'team',name:'Team documents',documents:documents.filter(document=>!projectFor(document))},
  ...live(data.projects).filter(project=>documents.some(document=>document.projectId===project.id)).map(project=>({id:project.id,name:project.name,documents:documents.filter(document=>document.projectId===project.id),project}))
 ].filter(group=>group.documents.length);
 const toggleSelected=(id:string)=>setSelected(current=>current.includes(id)?current.filter(item=>item!==id):[...current,id]);
 const activeDocument=context&&documents.find(document=>document.id===context.id);
 const activeReadOnly=activeDocument?!!documentReadOnlyReason(activeDocument,data):true;
 const copy=(value:string,message:string)=>act(()=>navigator.clipboard.writeText(value),message);
 const toggleDocumentFavorite=(document:Row)=>{const favorite=live(data.favorites).find(item=>item.userId===user?.id&&item.entityId===document.id&&(item.entityKind==='documents'||item.type==='document'));return act(()=>favorite?remove('favorites',favorite.id):create('favorites',{userId:user?.id,entityId:document.id,entityKind:'documents',type:'document',label:document.title,route:`/document/${document.id}`}),favorite?'Removed from favorites':'Added to favorites')};
 const pinToOverview=(document:Row)=>{const resources=Array.isArray(team.overviewResources)?team.overviewResources:[],sections=Array.isArray(team.overviewSections)?team.overviewSections:[],pinned=[...resources,...sections.flatMap((section:any)=>Array.isArray(section.resources)?section.resources:[])].some((resource:any)=>resource.documentId===document.id);if(pinned){toast('Already pinned to overview');return;}void act(()=>update('teams',team.id,{overviewResources:[...resources,{id:crypto.randomUUID(),title:document.title||'Untitled',documentId:document.id}]}),'Pinned to overview')};
 const duplicate=(document:Row)=>act(()=>create('documents',{title:`${document.title||'Untitled'} (copy)`,content:document.content||'',visibility:document.visibility||'workspace',teamId:document.teamId,projectId:document.projectId,issueId:document.issueId,initiativeId:document.initiativeId,cycleId:document.cycleId}),'Document duplicated');
 const createBlankDocument=async()=>{const document=await act(()=>create('documents',{title:'Untitled',content:'',visibility:'workspace',teamId:team.id,userId:user?.id,isNewDocumentDraft:true}));if(document?.id)nav(`/document/${document.id}`,{state:{newDocumentDraftId:document.id}})};
 const openTarget=(document:Row,target:'tab'|'window')=>{const route=`/document/${document.id}`;if(window.desktop)void (target==='tab'?window.desktop.newTab(route):window.desktop.newWindow(route));else window.open(route,'_blank','noopener,noreferrer')};
 return <section className="feature-page team-home-page team-documents-page">
  <header className="feature-header">
   <h2 className="feature-heading"><EntityIcon entity={team} fallback="Users"/>{team.name}</h2>
   <div className="feature-header-actions">
    <button className={`feature-icon-button${favorite?' active':''}`} aria-label={favorite?'Remove team from favorites':'Add team to favorites'} onClick={()=>void toggleFavorite()}><Star size={15}/></button>
    <button className="feature-icon-button" aria-label="Copy team URL" onClick={()=>void act(()=>navigator.clipboard.writeText(new URL(`/team/${team.id}/overview`,window.location.origin).href),'Link copied')}><Link2 size={15}/></button>
    <Dropdown align="right" trigger={<button className="feature-icon-button" aria-label="Team actions"><MoreHorizontal size={17}/></button>}>
     {!access.guest&&<MenuItem icon="Settings" onClick={()=>nav(`/settings/team-${team.id}`)}>Team settings</MenuItem>}
     <MenuItem icon="Archive" onClick={()=>nav(`/team/${team.id}/archive`)}>Open archive</MenuItem>
     <MenuItem icon="LogOut" onClick={()=>setLeaving(true)}>Leave team…</MenuItem>
    </Dropdown>
   </div>
  </header>
  <nav className="feature-tabs team-home-tabs team-documents-tabs" aria-label="Page views">
   {['Overview','Documents','Members'].map(name=><Link key={name} aria-current={name==='Documents'?'page':undefined} className={name==='Documents'?'active':''} to={`/team/${team.id}/${name.toLowerCase()}`}>{name}</Link>)}
   <span className="team-documents-toolbar">
    {!access.guest&&<AddButton onClick={()=>void createBlankDocument()}>New document</AddButton>}
    <Dropdown align="right" trigger={<button type="button" className={`feature-icon-button${filterOpen?' active':''}`} aria-label="Add filter"><Filter size={14}/></button>}>
     <div className="team-documents-filter-menu" data-keep-open>
      <span className="native-visually-hidden" role="status">Showing all items</span>
      <label><span className="native-visually-hidden">Add Filter…</span><input autoFocus type="search" aria-label="Add Filter…" placeholder="Add Filter…" value={filterMenuQuery} onChange={event=>setFilterMenuQuery(event.target.value)}/><kbd>F</kbd></label>
      <div role="listbox" aria-label="Document filter fields">
       {([
        ['Advanced filter',ListFilter,false],['Creator',UserRound,true],['Owner',UserRound,true],['Project',FolderKanban,true],['Dates',CalendarDays,true]
       ] as const).filter(([name])=>name.toLocaleLowerCase().includes(filterMenuQuery.toLocaleLowerCase())).map(([name,FilterIcon,sub])=><button key={name} type="button" role="option" aria-selected="false" aria-haspopup={sub?'menu':undefined} className="menu-item" onClick={()=>{if(name==='Advanced filter')setFilterOpen(true)}}><FilterIcon size={14}/><span>{name}</span>{sub&&<ChevronRight size={12}/>}</button>)}
      </div>
     </div>
    </Dropdown>
    <Dropdown align="right" trigger={<button type="button" className="feature-icon-button" aria-label="Display options"><SlidersHorizontal size={14}/></button>}>
     <div className="team-documents-display" data-keep-open>
      <label><span>Grouping</span><select aria-label="Grouping" value={display.groupBy} onChange={event=>setDisplay(current=>({...current,groupBy:event.target.value as DocumentDisplay['groupBy']}))}><option value="project">Project</option><option value="none">None</option></select></label>
      <label><span>Ordering</span><select aria-label="Ordering" value={sort.key} onChange={event=>setSort({key:event.target.value as SortKey,direction:event.target.value.endsWith('At')?-1:1})}><option value="name">Name</option><option value="createdAt">Created</option><option value="updatedAt">Last edited</option><option value="owner">Owner</option></select></label>
      <button type="button" className="text-button" aria-label="Direction" onClick={()=>setSort(current=>({...current,direction:current.direction===1?-1:1}))}>{sort.direction===1?'Ascending':'Descending'}</button>
      <label><input type="checkbox" checked={display.showInactiveProjects} onChange={event=>setDisplay(current=>({...current,showInactiveProjects:event.target.checked}))}/>Show inactive projects</label>
      <label><input type="checkbox" checked={display.onlyMyProjects} onChange={event=>setDisplay(current=>({...current,onlyMyProjects:event.target.checked}))}/>Show only my projects</label>
      <span>Display properties</span>
      <div className="feature-inline">{([['owner','Owner'],['updatedAt','Last edited'],['createdAt','Created']] as const).map(([key,label])=><button key={key} type="button" className="button" aria-pressed={display[key]} onClick={()=>setDisplay(current=>({...current,[key]:!current[key]}))}>{label}</button>)}</div>
     </div>
    </Dropdown>
   </span>
  </nav>
  {filterOpen&&<div className="team-documents-filter"><label><span className="native-visually-hidden">Filter documents</span><Filter size={14}/><input autoFocus aria-label="Filter documents" placeholder="Filter documents…" value={query} onChange={event=>setQuery(event.target.value)}/></label></div>}
  <div className="feature-table-wrap team-documents-table">
   <table className="feature-table">
    <thead><tr><th><button aria-label="A-Z" aria-pressed={sort.key==='name'} onClick={()=>order('name')}>Name{arrow('name')}</button></th>{display.createdAt&&<th><button aria-label="Order by Created" aria-pressed={sort.key==='createdAt'} onClick={()=>order('createdAt')}>Created{arrow('createdAt')}</button></th>}{display.updatedAt&&<th><button aria-label="Order by Last edited" aria-pressed={sort.key==='updatedAt'} onClick={()=>order('updatedAt')}>Last edited{arrow('updatedAt')}</button></th>}{display.owner&&<th><button aria-label="Order by Owner" aria-pressed={sort.key==='owner'} onClick={()=>order('owner')}>Owner{arrow('owner')}</button></th>}<th/></tr></thead>
    {groups.map(group=>{const isCollapsed=!!collapsed[group.id],columns=2+Number(display.createdAt)+Number(display.updatedAt)+Number(display.owner);return <tbody key={group.id} data-document-group={group.id}>
     <tr className="team-document-group"><td colSpan={columns}><button className="team-document-collapse" aria-label={isCollapsed?'Expand group':'Collapse group'} aria-expanded={!isCollapsed} onClick={()=>setCollapsed(current=>({...current,[group.id]:!current[group.id]}))}>{isCollapsed?<ChevronRight size={14}/>:<ChevronDown size={14}/>}</button>{group.project?<EntityIcon entity={group.project} fallback="Box"/>:<EntityIcon entity={team} fallback="Users"/>}<strong>{group.name}</strong><span>{group.documents.length}</span></td></tr>
     {!isCollapsed&&group.documents.map(document=>{
      const title=document.title||'Untitled',owner=data.users.find(person=>person.id===(document.userId||document.creatorId||document.createdBy)),ownerName=owner?.name||owner?.email||'Unassigned',isSelected=selected.includes(document.id),label=`Select document ${title} ${date(document.createdAt)} ${date(document.updatedAt)} ${ownerName} ${ownerName} Open menu`;
      return <tr key={document.id} role="link" aria-label={label} aria-selected={isSelected} tabIndex={0} data-document-id={document.id} onClick={event=>{if(!(event.target as Element).closest('button,input'))nav(`/document/${document.id}`)}} onContextMenu={event=>{event.preventDefault();setContext({id:document.id,x:event.clientX,y:event.clientY,nonce:Date.now()})}} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();nav(`/document/${document.id}`)}else if(event.key==='ContextMenu'||event.shiftKey&&event.key==='F10'){event.preventDefault();const bounds=event.currentTarget.getBoundingClientRect();setContext({id:document.id,x:bounds.left+80,y:bounds.top+20,nonce:Date.now()})}}}>
       <td><input type="checkbox" aria-label={`Select document ${title}`} checked={isSelected} onChange={()=>toggleSelected(document.id)}/><FileText size={16}/><span>{title}</span></td>
       {display.createdAt&&<td className="muted"><time dateTime={document.createdAt}>{relativeDate(document.createdAt)}</time></td>}{display.updatedAt&&<td className="muted"><time dateTime={document.updatedAt}>{relativeDate(document.updatedAt)}</time></td>}{display.owner&&<td><Person id={document.userId||document.creatorId||document.createdBy}/></td>}
       <td><button className="feature-icon-button" aria-label="Open menu" onClick={event=>{const bounds=event.currentTarget.getBoundingClientRect();setContext({id:document.id,x:bounds.right,y:bounds.bottom,nonce:Date.now()})}}><MoreHorizontal size={16}/></button></td>
      </tr>;
     })}
    </tbody>})}
   </table>
  </div>
  {adding&&<DocumentForm initialParent={{kind:'teams',id:team.id}} onClose={()=>setAdding(false)}/>}
  {context&&activeDocument&&<Dropdown key={context.nonce} position={{x:context.x,y:context.y}} trigger={<span/>}><IssueActionFilter searchLabel="Filter document actions" status>
   {!activeReadOnly&&<><IssueActionSubmenu label="Move to" icon="Move" shortcut="⇧ P" status><span className="issue-action-group">Teams</span>{live(data.teams).map(destination=><MenuItem key={destination.id} icon={destination.id===activeDocument.teamId?'Check':'Users'} onClick={()=>void act(()=>update('documents',activeDocument.id,documentMovePatch({kind:'teams',id:destination.id})),'Document moved')}>{destination.name}</MenuItem>)}<span className="issue-action-group">Projects</span>{live(data.projects).map(destination=><MenuItem key={destination.id} icon={destination.id===activeDocument.projectId?'Check':'Box'} onClick={()=>void act(()=>update('documents',activeDocument.id,documentMovePatch({kind:'projects',id:destination.id})),'Document moved')}>{destination.name}</MenuItem>)}</IssueActionSubmenu><MenuItem icon="Pin" onClick={()=>pinToOverview(activeDocument)}>Pin to overview</MenuItem><MenuItem icon="Copy" onClick={()=>void duplicate(activeDocument)}>Duplicate</MenuItem><MenuItem icon="Pencil" shortcut="⇧ R" onClick={()=>setRenaming(activeDocument)}>Rename…</MenuItem></>}
   <MenuItem icon="Star" shortcut="⌥ F" onClick={()=>void toggleDocumentFavorite(activeDocument)}>{live(data.favorites).some(item=>item.userId===user?.id&&item.entityId===activeDocument.id&&(item.entityKind==='documents'||item.type==='document'))?'Remove favorite':'Favorite'}</MenuItem>
   <IssueActionSubmenu label="Copy" icon="Copy"><MenuItem icon="Link" onClick={()=>void copy(documentLink(activeDocument.id),'Link copied')}>Copy URL</MenuItem><MenuItem icon="Copy" onClick={()=>void copy(activeDocument.title||'Untitled','Title copied')}>Copy title</MenuItem><MenuItem icon="Link" onClick={()=>void copy(`[${activeDocument.title||'Untitled'}](${documentLink(activeDocument.id)})`,'Linked title copied')}>Copy title as link</MenuItem><MenuItem icon="Copy" onClick={()=>void copy(richTextToMarkdown(activeDocument.content||''),'Markdown copied')}>Copy content as Markdown</MenuItem></IssueActionSubmenu>
   <IssueActionSubmenu label="Remind me" icon="Clock" shortcut="⇧ H" filter={false} menuWidth={305}><EntityReminderMenu entity={activeDocument} kind="documents"/></IssueActionSubmenu><MenuItem icon="History" onClick={()=>setHistory(activeDocument)}>Show document history</MenuItem>{!activeReadOnly&&<MenuItem icon="Trash2" danger onClick={()=>setDeleting(activeDocument)}>Delete</MenuItem>}<MenuItem icon="ExternalLink" shortcut="⌃ ," onClick={()=>openTarget(activeDocument,'window')}>Open in new window</MenuItem><MenuItem icon="ExternalLink" onClick={()=>openTarget(activeDocument,'tab')}>Open in new tab</MenuItem>
  </IssueActionFilter></Dropdown>}
  {renaming&&<RenameDocumentCommand document={renaming} onClose={()=>setRenaming(null)}/>}
  {deleting&&<Confirm title={`Delete ${deleting.title||'document'}?`} description="This item will move to Recently deleted and can be restored." onClose={()=>setDeleting(null)} onConfirm={()=>act(()=>remove('documents',deleting.id))}/>}
  {history&&<DocumentHistoryModal doc={history} attribution={contentAttribution(history,'documents',data.activities)} readOnly={!!documentReadOnlyReason(history,data)} onClose={()=>setHistory(null)} onRestore={version=>act(()=>update('documents',history.id,{content:version.content,title:version.title}))}/>}
  {leaving&&<Modal title={`Leave ${team.name}?`} onClose={()=>setLeaving(false)}><div className="modal-body"><p>You will leave this team. Access to private team issues may be removed.</p><div className="feature-inline"><Button onClick={()=>setLeaving(false)}>Cancel</Button><Button disabled={busy} onClick={()=>{setBusy(true);void apiRequest(`/api/v1/teams/${team.id}/leave`,{method:'POST'}).then(()=>reload()).then(()=>nav('/teams')).catch(error=>toast(error.message)).finally(()=>setBusy(false))}}>Leave team</Button></div></div></Modal>}
 </section>;
}
