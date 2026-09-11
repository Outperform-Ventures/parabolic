import {buildCustomerMetrics,withCustomerMetrics} from '../../shared/customer-metrics';
import {guestCapabilities} from '../../shared/guest-capabilities';
import {ViewOwner} from './view-owner';
import {TeamResources} from './team-resources';
import './team-home.css';
import {IssueActionFilter} from '../issue-action-filter';
import {apiRequest} from '../store';
import {filterLabelRecords} from '../../shared/label-filter-values';
import {entityLink} from '../entity-link';
import {documentLink} from '../document-link';
import {DocumentMove} from './document-move';
import {documentParents,documentParentPath,resolveDocumentParent} from '../../shared/document-parent';
import {contentAttribution} from '../../shared/content-attribution';
import {DocumentSubscriptions} from './document-subscriptions';
import {documentReadOnlyReason} from '../document-access';
import {registerRouteExit} from '../template-history-events';
import {ProjectsPage} from './projects';
import {DocumentForm} from './document-form';
import {EntityDiscussion} from './project-review';
import {ReminderBanner} from '../reminders';
import {IssueActionSubmenu} from '../issue-action-submenu';
import {EntityReminderMenu} from '../issue-reminder-menu';
import {richTextToMarkdown} from '../markdown';
import {reactionEntries,toggleReaction} from '../../shared/reactions';
import {EmojiPicker,EmojiGlyph} from '../components/emoji-picker';
import {EntityIcon} from './entity-icon';
import React,{useEffect,useRef,useState} from 'react';
import {Link,useNavigate,useParams,useLocation,useSearchParams} from 'react-router-dom';
import {FileText,Users,Building2,MessageSquare,Plus,History,Link2,ClipboardList,ChartNoAxesColumn,LayoutDashboard,LayoutGrid,Archive,Box,SlidersHorizontal,Check,ChevronRight,Copy,Trash2,Star,MoreHorizontal} from 'lucide-react';
import {RichEditor,Dropdown,MenuItem,Modal,Button,Avatar} from '../components/ui';
import {matchesFilter} from '../query';
import {ProjectCollection} from './project-list';
import {ViewForm} from './view-builder';
import {AskFormEditor} from './asks';
import {Action,AddButton,Blank,Chart,date,Confirm,EntityMenu,FormDialog,Header,isDone,IssueLinks,live,Metric,optionList,Person,plain,Progress,Property,Row,SavedEditor,SearchBox,Status,Tabs,useActions} from './shared';

const finalizedDocumentDrafts=new Set<string>();

export function DocumentsPage(){const location=useLocation();const {data,user,create,act}=useActions();const canCreate=guestCapabilities(data,user?.id).canCreate;const [adding,setAdding]=useState(false),[moving,setMoving]=useState<Row|null>(null),[query,setQuery]=useState('');const nav=useNavigate();useEffect(()=>{if(canCreate&&new URLSearchParams(location.search).get('new')==='1')setAdding(true)},[location.key]);const docs=live(data.documents).filter(d=>(d.title||'').toLowerCase().includes(query.toLowerCase()));return <section className="feature-page"><Header title="Documents" icon={<FileText size={16}/>}><SearchBox value={query} onChange={setQuery}/>{canCreate&&<AddButton onClick={()=>setAdding(true)}>New document</AddButton>}</Header>{docs.length?<div className="feature-table-wrap"><table className="feature-table"><thead><tr><th>Name</th><th>Location</th><th>Author</th><th>Updated</th><th/></tr></thead><tbody>{docs.map(d=><tr key={d.id}><td><Link className="feature-name" to={`/document/${d.id}`}><FileText size={17}/>{d.title||'Untitled'}</Link></td><td>{Object.entries(documentParents).filter(([,parent])=>d[parent.field]).map(([kind,parent])=><Link key={kind} to={documentParentPath({kind:kind as keyof typeof documentParents,id:d[parent.field]})}>{data[kind as keyof typeof documentParents].find(item=>item.id===d[parent.field])?.title||data[kind as keyof typeof documentParents].find(item=>item.id===d[parent.field])?.name||parent.label}</Link>)}</td><td><Person id={d.userId||d.creatorId||d.createdBy}/></td><td className="muted">{date(d.updatedAt)}</td><td><EntityMenu kind="documents" item={d} onMove={()=>setMoving(d)}/></td></tr>)}</tbody></table></div>:<Blank icon={<FileText size={30}/>} title={query?'No matching documents':'Documents'} description="Write and share knowledge alongside your work." action={canCreate?<AddButton onClick={()=>setAdding(true)}>New document</AddButton>:undefined}/>} {moving&&<DocumentMove document={data.documents.find(doc=>doc.id===moving.id)||moving} onClose={()=>setMoving(null)}/>} {adding&&<DocumentForm initialParent={resolveDocumentParent(new URLSearchParams(location.search).get('parentKind'),new URLSearchParams(location.search).get('parentId'))} onClose={()=>setAdding(false)}/>}</section>}

export function DocumentHistoryModal({doc,attribution,readOnly,onClose,onRestore}:{doc:Row;attribution:any;readOnly:boolean;onClose:()=>void;onRestore:(version:any)=>Promise<unknown>}){
 const versions=[{title:doc.title,content:doc.content,at:attribution.at||doc.updatedAt,contentAuthorId:attribution.userId||doc.userId||doc.creatorId,current:true},...[...(doc.history||[])].reverse()];
 const [dialogTitle]=useState(doc.title),[selected,setSelected]=useState<any>(null),[highlight,setHighlight]=useState(true),[change,setChange]=useState(0),[busy,setBusy]=useState(false),version=selected||versions[0];
 const selectedIndex=selected?Math.max(1,versions.findIndex(item=>item.at===selected.at&&item.title===selected.title&&item.content===selected.content)):0,newer=selectedIndex?versions[selectedIndex-1]:version,changeCount=Math.max(1,Number(version.title!==newer.title)+Number(version.content!==newer.content));
 const stamp=(at:string)=>new Date(at),day=(at:string)=>stamp(at).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}),time=(at:string)=>stamp(at).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
 return <Modal ariaLabel={`Restore version for ${dialogTitle}`} onClose={onClose} className="document-history-modal">
  <header><h2>Restore version for&nbsp; {dialogTitle}</h2><button className="icon-button" aria-label="Close modal dialog" onClick={onClose}><span aria-hidden>×</span></button></header>
  <div className="document-history-body">
   <section className={`document-history-preview${highlight?' highlight-changes':''}`} aria-label="Document content"><RichEditor value={version.content||''} onChange={()=>{}} readOnly/><footer><span>{day(version.at)}</span><span>{time(version.at)}</span></footer></section>
   <div className="document-history-controls"><label><input type="checkbox" checked={highlight} onChange={event=>setHighlight(event.target.checked)}/>Highlight changes</label><span>Go to change <strong>{change+1} of {changeCount}</strong></span><button aria-label="Previous change" disabled={change===0} onClick={()=>setChange(value=>Math.max(0,value-1))}>↑</button><button aria-label="Next change" disabled={change===changeCount-1} onClick={()=>setChange(value=>Math.min(changeCount-1,value+1))}>↓</button><button disabled={version.current||readOnly||busy} aria-label={version.current?'This is the current version, you cannot restore it':'Restore version'} onClick={()=>{setBusy(true);void onRestore(version).then(onClose).finally(()=>setBusy(false))}}>{version.current?'Current version':'Restore version'}</button></div>
   <aside className="document-history-versions">{versions.map((item,index)=><button key={`${item.at}:${index}`} className={selected?(item.at===selected.at&&item.title===selected.title&&item.content===selected.content?'active':''):(index===0?'active':'')} onClick={()=>{setSelected(item.current?null:item);setChange(0)}}><span>{day(item.at)}</span><span>{time(item.at)}</span>{item.current&&<strong>Current</strong>}<Person id={item.contentAuthorId} empty="Unknown author"/></button>)}</aside>
  </div>
 </Modal>;
}
export function DocumentPage(){
 const {documentId}=useParams(),routeLocation=useLocation(),store=useActions(),{data,user,update,create,remove,restore,act}=store,nav=useNavigate();
 const record=data.documents.find(d=>d.id===documentId),doc=record&&!record.deletedAt&&!record.archivedAt?record:undefined,readOnlyReason=doc?documentReadOnlyReason(doc,data):null,readOnly=!!readOnlyReason;
 const draftTitleRef=useRef('');
 const draftRoute=useRef<null|{id:string;cancel:()=>void;discard:()=>void}>(null);
 const finalizeDraft=(title:string)=>{if(!documentId||finalizedDocumentDrafts.has(documentId))return;finalizedDocumentDrafts.add(documentId);if(title){void act(()=>update('documents',documentId,{title,isNewDocumentDraft:null}));return}void apiRequest(`/api/v1/documents/${encodeURIComponent(documentId)}`,{method:'DELETE',keepalive:true}).catch(()=>remove('documents',documentId))};
 if(routeLocation.state?.newDocumentDraftId===documentId&&!draftRoute.current&&documentId){const discard=()=>finalizeDraft(draftTitleRef.current.trim());draftRoute.current={id:documentId,discard,cancel:registerRouteExit(`document-draft:${documentId}`,routeLocation.pathname,discard)}}
 const cancelDraft=()=>{draftRoute.current?.cancel();draftRoute.current=null};
 const discardDraft=()=>{const pending=draftRoute.current;if(!pending)return;pending.cancel();draftRoute.current=null;pending.discard()};
 const [history,setHistory]=useState(false),[showComments,setShowComments]=useState(true),[showResolved,setShowResolved]=useState(false),[showAuthors,setShowAuthors]=useState(false),[moving,setMoving]=useState(false),[deleting,setDeleting]=useState(false);
 useEffect(()=>()=>discardDraft(),[documentId]);
 useEffect(()=>{const listener=(event:Event)=>{const command=(event as CustomEvent).detail?.command;if(command==='show-author-names'){setShowAuthors(true);event.preventDefault()}else if(command==='hide-author-names'){setShowAuthors(false);event.preventDefault()}else if(command==='move-document'&&!readOnly){setMoving(true);event.preventDefault()}};window.addEventListener('workspace-command',listener);return()=>window.removeEventListener('workspace-command',listener)},[readOnly]);
 useEffect(()=>{if(readOnly){setMoving(false);setDeleting(false)}},[readOnly]);
 if(record?.deletedAt)return <section className="feature-page"><Blank icon={<FileText size={30}/>} title="Document deleted" description="This document is in Recently deleted." action={<Action onClick={()=>void act(()=>restore('documents',record.id),'Document restored')}>Restore document</Action>}/></section>;
 if(record?.archivedAt)return <section className="feature-page"><Blank icon={<Archive size={30}/>} title="Document archived" description="Restore this document to edit or share it." action={<Action onClick={()=>void act(()=>update('documents',record.id,{archivedAt:null}),'Document restored')}>Restore document</Action>}/></section>;
 if(!doc)return <section className="feature-page"><Blank title="Document unavailable" description="The document does not exist or you do not have access to it." action={<Link className="button feature-button" to="/documents">Back to documents</Link>}/></section>;
 const attribution=contentAttribution(doc,'documents',data.activities),comments=live(data.comments).filter(c=>c.documentId===doc.id),team=data.teams.find(team=>team.id===doc.teamId),favorite=live(data.favorites).find(item=>item.entityId===doc.id&&(item.entityKind==='documents'||item.type==='document'));
 const save=async(content:string)=>{if(content===doc.content)return;cancelDraft();return act(()=>update('documents',doc.id,{content,isNewDocumentDraft:null}))};
 const toggleFavorite=()=>act(()=>favorite?remove('favorites',favorite.id):create('favorites',{userId:user?.id,entityId:doc.id,entityKind:'documents',type:'document',label:doc.title,route:`/document/${doc.id}`}));
 const copyLink=()=>act(()=>navigator.clipboard.writeText(documentLink(doc.id)),'Link copied');
 const copyMarkdown=()=>act(()=>navigator.clipboard.writeText(`# ${doc.title||'Untitled'}\n\n${richTextToMarkdown(doc.content||'')}`),'Markdown copied');
 const duplicate=async()=>{const copy=await act(()=>create('documents',{title:`${doc.title||'Untitled'} (copy)`,content:doc.content||'',visibility:doc.visibility||'workspace',teamId:doc.teamId,projectId:doc.projectId,issueId:doc.issueId,initiativeId:doc.initiativeId}),'Document duplicated');if(copy?.id)nav(`/document/${copy.id}`)};
 return <section className={`feature-page feature-document-page ${showAuthors?'feature-document-authors':''}`} data-show-authors={showAuthors}>
  <header className="feature-header document-native-header">
   <div className="document-native-breadcrumbs">
    {team&&<><Link to={`/team/${team.id}/overview`}><EntityIcon entity={team} fallback="Users"/>{team.name}</Link><span className="feature-chevron">›</span></>}
    <Link to="/documents">Documents</Link><span className="feature-chevron">›</span><FileText size={14}/><span className="document-native-current">{doc.isNewDocumentDraft?'New document':doc.title||'Untitled'}</span>
    <button className={`feature-icon-button document-favorite${favorite?' active':''}`} aria-label={favorite?'Remove from favorites':'Add to favorites'} onClick={toggleFavorite}><Star size={15}/></button>
    <Dropdown align="left" menuClassName="document-actions-menu" trigger={<button className="feature-icon-button" aria-label="Document options"><MoreHorizontal size={17}/></button>}><IssueActionFilter searchLabel="Filter document actions">
     <span className="native-visually-hidden" role="status">Showing all items</span>
     {!readOnly&&<><MenuItem icon="Move" shortcut="⇧ P" onClick={()=>setMoving(true)}>Move to</MenuItem><MenuItem icon="Pin" onClick={()=>setMoving(true)}>Pin to team</MenuItem><MenuItem icon="Copy" onClick={duplicate}>Duplicate</MenuItem><MenuItem icon="Pencil" shortcut="⇧ R" onClick={()=>document.querySelector<HTMLInputElement>('.feature-document-page .feature-title-input')?.focus()}>Rename…</MenuItem><div className="menu-separator"/></>}
     <MenuItem icon="Star" shortcut="⌥ F" onClick={toggleFavorite}>{favorite?'Remove favorite':'Favorite'}</MenuItem>
     <IssueActionSubmenu label="Copy" icon="Copy" filter={false}><MenuItem icon="Link" onClick={copyLink}>Copy document URL</MenuItem><MenuItem icon="Copy" onClick={copyMarkdown}>Copy document as Markdown</MenuItem></IssueActionSubmenu>
     <IssueActionSubmenu label="Remind me" menuWidth={305} icon="Clock" shortcut="⇧ H" filter={false}><EntityReminderMenu entity={doc} kind="documents"/></IssueActionSubmenu>
     <div className="menu-separator"/>
     <MenuItem icon="Users" shortcut="⇧ A" onClick={()=>setShowAuthors(!showAuthors)}>{showAuthors?'Hide author names':'Show author names'}</MenuItem>
     <MenuItem icon="History" onClick={()=>setHistory(true)}>Show document history</MenuItem>
     {!readOnly&&<MenuItem icon="Trash2" onClick={()=>setDeleting(true)}>Delete</MenuItem>}
    </IssueActionFilter>
    </Dropdown>
   </div>
   <div className="feature-header-actions document-native-actions">
    <Dropdown align="right" menuClassName="document-metadata-menu" trigger={<button className="document-edited-trigger" aria-label={`Document display options and metadata; Edited ${date(attribution.at||doc.updatedAt)}`}><SlidersHorizontal size={13}/><span>Edited {date(attribution.at||doc.updatedAt)}</span></button>}>
     <label className="document-metadata-toggle"><span>Show comments</span><input type="checkbox" checked={showComments} onChange={event=>setShowComments(event.target.checked)}/></label>
     <label className="document-metadata-toggle"><span>Show author names</span><input type="checkbox" checked={showAuthors} onChange={event=>setShowAuthors(event.target.checked)}/></label>
     <div className="document-metadata-row"><span>Owned by</span><Person id={doc.userId||doc.creatorId||doc.createdBy}/></div>
     <div className="document-metadata-row"><span>Last edit by</span><Person id={attribution.userId||doc.userId||doc.creatorId}/><time>{date(attribution.at||doc.updatedAt)}</time></div>
     <button className="document-history-button" onClick={()=>setHistory(true)}><History size={14}/>Show document history</button>
    </Dropdown>
    <button className="feature-icon-button" aria-label="Copy document URL" onClick={copyLink}><Link2 size={15}/></button>
    <DocumentSubscriptions document={doc} readOnly={readOnly}/>
   </div>
  </header>
  {readOnlyReason&&<div className="banner" role="status">{readOnlyReason}</div>}
  <ReminderBanner kind="documents" id={doc.id}/>
  <div className="feature-document-native-shell">
   <main className="feature-document">
    <button className="document-body-icon" aria-label="Document icon"><EntityIcon entity={doc} fallback="FileText"/></button>
    <input autoFocus={!!doc.isNewDocumentDraft} className="feature-title-input" readOnly={readOnly} aria-label="Document title" defaultValue={doc.isNewDocumentDraft?'':doc.title} key={doc.id+doc.title} onChange={event=>{draftTitleRef.current=event.currentTarget.value}} onBlur={event=>{const title=event.target.value.trim();if(!title){event.target.value=doc.isNewDocumentDraft?'':doc.title;return}if(!readOnly&&(title!==doc.title||doc.isNewDocumentDraft)){cancelDraft();if(doc.isNewDocumentDraft)finalizeDraft(title);else void act(()=>update('documents',doc.id,{title,isNewDocumentDraft:null}))}}}/>
    <SavedEditor readOnly={readOnly} showAuthors={showAuthors} showInlineComments={showComments} key={doc.id} value={doc.content||''} collaboration={{kind:'documents',id:doc.id,field:'content'}} onSave={save} placeholder="Start writing, or type / for commands…"/>
    {showComments&&comments.length>0&&<EntityDiscussion kind="documents" item={doc} readOnly={readOnly} resolvedVisibility={{value:showResolved,onChange:setShowResolved}}/>}
   </main>
  </div>
  {moving&&<DocumentMove document={doc} onClose={()=>setMoving(false)}/>}
  {deleting&&<Confirm title={`Delete ${doc.title||'document'}?`} description="This item will move to Recently deleted and can be restored." onClose={()=>setDeleting(false)} onConfirm={async()=>{const result=await act(()=>remove('documents',doc.id));nav('/documents');return result}}/>}
  {history&&<DocumentHistoryModal doc={doc} attribution={attribution} readOnly={readOnly} onClose={()=>setHistory(false)} onRestore={version=>act(()=>update('documents',doc.id,{content:version.content,title:version.title}))}/>}
 </section>
}

export {CustomersPage,CustomerPage} from './customers';

export function AsksPage(){const {data,create,update,act}=useActions();const [form,setForm]=useState<Row|boolean>(false);const forms=live(data.asksForms);return <section className="feature-page"><Header title="Asks" icon={<ClipboardList size={16}/>}><AddButton onClick={()=>setForm(true)}>New form</AddButton></Header><div className="feature-readable"><h1>Request forms</h1><p className="muted">Collect structured requests and route them to the right team.</p>{forms.map(f=><div className="feature-settings-row" key={f.id}><div><strong>{f.name}</strong><p>{f.description||data.teams.find(t=>t.id===f.teamId)?.name}</p></div><span className="muted">{f.enabled?'Enabled':'Disabled'}</span><a className="button feature-button" href={`/request/${f.id}`} target="_blank" rel="noreferrer">Preview</a><Action onClick={()=>act(()=>navigator.clipboard.writeText(entityLink('asksForms',f.id)!),'Link copied')}><Copy size={13}/>Copy link</Action><Action onClick={()=>setForm(f)}>Edit</Action><EntityMenu kind="asksForms" item={f}/></div>)}{!forms.length&&<Blank icon={<ClipboardList size={30}/>} title="Create a request form" description="Each submission creates a tracked request and an issue in the selected team." action={<AddButton onClick={()=>setForm(true)}>New form</AddButton>}/>}</div>{form&&<AskFormEditor form={typeof form==='object'?form:undefined} onClose={()=>setForm(false)}/>} </section>}

export {InsightsPage,DashboardsPage} from './insights';

function matches(i:Row,f:any,labels:Row[],projects:Row[],cycles:Row[],userId?:string,issues?:Row[],metrics?:ReturnType<typeof buildCustomerMetrics>,milestones?:Row[]){if(f?.conditions)return matchesFilter(metrics?withCustomerMetrics(i,metrics):i,f,labels,projects,cycles,undefined,userId,issues,milestones);return (!f?.teamId||i.teamId===f.teamId)&&(!f?.assigneeId||i.assigneeId===f.assigneeId)&&(!f?.statusId||i.statusId===f.statusId)&&(!f?.projectId||i.projectId===f.projectId)&&(!f?.query||(i.title||i.name||'').toLowerCase().includes(f.query.toLowerCase()))}
export {ViewsDirectory as ViewsPage} from './views-directory';

export {ViewForm} from './view-builder';

export function ViewPage(){
 const {viewId}=useParams();const {data,user,update,act}=useActions();const nav=useNavigate();const view=live(data.views).find(v=>v.id===viewId);const [editing,setEditing]=useState(false);if(!view)return <Blank title="View not found" action={<Link to="/views">Back to views</Link>}/>;if(view.entityType==='projects'&&view.projectPage)return <ProjectsPage view={view}/>;const metrics=buildCustomerMetrics(data.customers,data.requests,'issues',data.issues);const items=live(view.entityType==='projects'?data.projects:data.issues).filter(i=>(view.entityType==='projects'||matches(i,view.filters,filterLabelRecords(data),data.projects,data.cycles,user?.id,data.issues,metrics,data.milestones))&&(view.entityType!=='projects'||((!view.teamId||i.teamId===view.teamId||i.teamIds?.includes(view.teamId))&&(!view.searchQuery||(i.name||'').toLocaleLowerCase().includes(view.searchQuery.toLocaleLowerCase())))));
 return <section className="feature-page"><Header title={view.name} icon={<EntityIcon entity={view} fallback="LayoutGrid"/>} breadcrumb={{title:'Views',to:'/views'}}><Action onClick={()=>setEditing(true)}><SlidersHorizontal size={14}/>Edit view</Action><EntityMenu kind="views" item={view} onDeleted={()=>nav('/views')}/></Header><div className="feature-list-caption feature-between"><span>{view.description||items.length+(items.length===1?' project':' projects')}</span><div className="feature-segment">{['List','Board','Timeline'].map(layout=><button type="button" className={view.layout===layout?'active':''} key={layout} onClick={()=>act(()=>update('views',view.id,{layout}))}>{layout}</button>)}</div></div>{view.entityType==='projects'?<ProjectCollection key={view.id} projects={items} layout={view.layout||'List'} storageKey={view.id} initialFilters={view.filters} initialQuery={view.searchQuery||''} initialDisplay={view.display}/>:<IssueLinks issues={items}/>} {editing&&<ViewForm view={view} onClose={()=>setEditing(false)}/>}</section>;
}

export {ArchivePage} from './archive';

export function TeamHomePage(){
 const {teamId}=useParams(),routeLocation=useLocation(),nav=useNavigate();
 const {data,user,create,update,remove,act,reload,toast}=useActions();
 const guest=guestCapabilities(data,user?.id).guest,team=data.teams.find(t=>t.id===teamId),[document,setDocument]=useState(false),[leaving,setLeaving]=useState(false),[busy,setBusy]=useState(false);
 if(!team)return <Blank title="Team not found"/>;
 const tab=routeLocation.pathname.endsWith('/documents')?'Documents':routeLocation.pathname.endsWith('/members')?'Members':'Overview';
 const memberIds=[...new Set<string>([...(team.memberIds||[]),...(team.ownerIds||[]),...(team.ownerId||team.creatorId?[team.ownerId||team.creatorId]:[]),...data.memberships.filter(m=>m.teamId===team.id&&!m.deletedAt).map(m=>m.userId)])];
 const members=memberIds.flatMap(id=>{const memberUser=data.users.find(person=>person.id===id);return memberUser?[{user:memberUser,membership:data.memberships.find(m=>m.teamId===team.id&&m.userId===id&&!m.deletedAt)}]:[]}),documents=live(data.documents).filter(d=>d.teamId===team.id);
 const favorite=live(data.favorites).find(item=>item.userId===user?.id&&item.entityId===team.id&&(item.entityKind==='teams'||item.type==='team'));
 const toggleFavorite=()=>act(()=>favorite?remove('favorites',favorite.id):create('favorites',{type:'team',entityKind:'teams',entityId:team.id,userId:user?.id,label:team.name,route:`/team/${team.id}/overview`,icon:team.icon,color:team.color}));
 return <section className="feature-page team-home-page">
  <Header title={team.name} icon={<EntityIcon entity={team} fallback="Users"/>}>
   <button className={`feature-icon-button${favorite?' active':''}`} aria-label={favorite?'Remove team from favorites':'Add team to favorites'} onClick={()=>void toggleFavorite()}><Star size={15}/></button>
   <button className="feature-icon-button" aria-label="Copy team URL" onClick={()=>void act(()=>navigator.clipboard.writeText(new URL(`/team/${team.id}/overview`,window.location.origin).href),'Link copied')}><Link2 size={15}/></button>
   <Dropdown align="right" trigger={<button className="feature-icon-button" aria-label="Team actions"><MoreHorizontal size={17}/></button>}>
    <IssueActionFilter compact>
     <span className="native-visually-hidden" role="status">Showing all items</span>
     {!guest&&<MenuItem icon="Settings" onClick={()=>nav(`/settings/team-${team.id}`)}>Team settings</MenuItem>}
     <MenuItem icon="Archive" onClick={()=>nav(`/team/${team.id}/archive`)}>Open archive</MenuItem>
     <MenuItem icon="LogOut" onClick={()=>setLeaving(true)}>Leave team…</MenuItem>
    </IssueActionFilter>
   </Dropdown>
   {tab==='Documents'&&!guest&&<AddButton onClick={()=>setDocument(true)}>New document</AddButton>}
  </Header>
  <nav className="feature-tabs team-home-tabs" aria-label="Page views">
   {['Overview','Documents','Members'].map(name=><Link key={name} aria-current={tab===name?'page':undefined} className={tab===name?'active':''} to={`/team/${team.id}/${name.toLowerCase()}`}>{name}</Link>)}
  </nav>
  {tab==='Overview'?<div className="feature-readable team-overview-content"><main className="team-overview-main"><div className="feature-project-icon" style={{color:team.color}}><EntityIcon entity={team} fallback="Users"/></div><input key={team.id+':'+team.name} className="team-overview-name" aria-label="Team name" defaultValue={team.name} readOnly={guest} onBlur={event=>{const name=event.currentTarget.value.trim();if(!name){event.currentTarget.value=team.name;return}if(name!==team.name)void act(()=>update('teams',team.id,{name}))}}/><textarea key={team.id+':'+(team.description||'')} className="team-overview-description" aria-label="Team description" placeholder="Add a description…" defaultValue={team.description||''} readOnly={guest} onBlur={event=>{const description=event.currentTarget.value.trim();if(description!==(team.description||''))void act(()=>update('teams',team.id,{description}))}}/><TeamResources teamId={team.id}/></main><aside className="team-overview-sidebar"><h3>Members</h3><Link className="team-overview-member-link" to={`/team/${team.id}/members`} aria-label={members.map(member=>member.user.name||member.user.email).join(' ')}>{members.slice(0,5).map(member=><Avatar key={member.user.id} user={member.user} size={20}/>)}{members.length>5&&<span>+{members.length-5}</span>}</Link><h3>Go to</h3><nav aria-label="Team destinations"><Link to={`/team/${team.id}/members`}><Users size={14}/>Members</Link>{!guest&&<Link to={`/settings/team-${team.id}`}><SlidersHorizontal size={14}/>Team settings</Link>}<Link to={`/team/${team.id}/all`}><ClipboardList size={14}/>Issues</Link><Link to={`/team/${team.id}/projects`}><Box size={14}/>Projects</Link><Link to={`/team/${team.id}/views`}><LayoutGrid size={14}/>Views</Link></nav></aside></div>:tab==='Documents'?<div className="feature-table-wrap team-documents-table"><table className="feature-table"><thead><tr><th>Name</th><th>Created</th><th>Last edited</th><th>Owner</th></tr></thead><tbody><tr className="team-document-group"><td colSpan={4}><EntityIcon entity={team} fallback="Users"/><strong>Team documents</strong><span>{documents.length}</span></td></tr>{documents.map(d=><tr key={d.id}><td><Link className="feature-name" to={`/document/${d.id}`}><FileText size={16}/>{d.title||'Untitled'}</Link></td><td className="muted">{date(d.createdAt)}</td><td className="muted">{date(d.updatedAt)}</td><td><Person id={d.userId||d.creatorId||d.createdBy}/></td></tr>)}</tbody></table></div>:<div className="feature-readable team-members-list"><h2>Members</h2>{members.map(member=><Link className="feature-linked-row" key={member.user.id} to={`/profiles/${member.user.id}`}><Person id={member.user.id}/><span className="muted">{member.membership?.role||'Member'}</span></Link>)}</div>}
  {document&&<DocumentForm initialParent={{kind:'teams',id:team.id}} onClose={()=>setDocument(false)}/>}
  {leaving&&<Modal title={`Leave ${team.name}?`} onClose={()=>setLeaving(false)}><div className="modal-body"><p>You will leave this team. Access to private team issues may be removed.</p><div className="feature-inline"><Button onClick={()=>setLeaving(false)}>Cancel</Button><Button disabled={busy} onClick={()=>{setBusy(true);void apiRequest(`/api/v1/teams/${team.id}/leave`,{method:'POST'}).then(()=>reload()).then(()=>nav('/teams')).catch(error=>toast(error.message)).finally(()=>setBusy(false))}}>Leave team</Button></div></div></Modal>}
 </section>;
}
