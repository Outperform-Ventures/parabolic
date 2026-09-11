import React,{useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {Link2,MoreHorizontal,Star} from 'lucide-react';
import {Dropdown,MenuItem} from '../components/ui';
import {openReminder} from '../reminders';
import {AddButton,Confirm,date,FormDialog,live,useActions,type Row} from './shared';
import {UpdateSubscription} from './updates';

export function InitiativeHeaderActions({item,onAddProject,onDeleted}:{item:Row;onAddProject:()=>void;onDeleted:()=>void}){
 const {data,user,create,remove,act}=useActions(),nav=useNavigate(),[deleting,setDeleting]=useState(false),[history,setHistory]=useState(false),[commentsVisible,setCommentsVisible]=useState(true);
 const favorite=live(data.favorites).find(entry=>entry.userId===user?.id&&entry.entityId===item.id&&(entry.entityKind==='initiatives'||entry.type==='initiative'));
 const subscription=live(data.subscriptions).find(entry=>entry.userId===user?.id&&(entry.entityId===item.id||entry.initiativeId===item.id));
 const route=`/initiative/${item.id}/overview`,copy=()=>act(()=>navigator.clipboard.writeText(new URL(route,window.location.origin).href),'Link copied');
 const toggleFavorite=()=>act(()=>favorite?remove('favorites',favorite.id):create('favorites',{userId:user?.id,entityId:item.id,entityKind:'initiatives',type:'initiative',label:item.name,route,icon:item.icon,color:item.color}));
 const toggleSubscription=()=>act(()=>subscription?remove('subscriptions',subscription.id):create('subscriptions',{userId:user?.id,entityId:item.id,initiativeId:item.id,entityKind:'initiatives'}));
 const notifications=()=>requestAnimationFrame(()=>document.querySelector<HTMLButtonElement>('[aria-label="Setup initiative notifications"]')?.click());
 return <>
  <button className={`feature-icon-button${favorite?' active':''}`} role="switch" aria-checked={!!favorite} aria-label={favorite?'Remove from favorites':'Add to favorites'} onClick={()=>void toggleFavorite()}><Star size={15}/></button>
  <Dropdown align="right" menuClassName="initiative-actions-menu" trigger={<button className="feature-icon-button" aria-label="Initiative actions"><MoreHorizontal size={17}/></button>}>
   <MenuItem icon="Copy" onClick={()=>void copy()}>Copy</MenuItem><MenuItem icon="Star" shortcut="⌥ F" onClick={()=>void toggleFavorite()}>{favorite?'Unfavorite':'Favorite'}</MenuItem><MenuItem icon="Bell" onClick={()=>void toggleSubscription()}>{subscription?'Unsubscribe':'Subscribe'}</MenuItem><MenuItem icon="Clock" shortcut="⇧ H" onClick={()=>openReminder('initiatives',item.id)}>Remind me</MenuItem><div className="menu-separator"/>
   <MenuItem icon="MessageSquare" shortcut="N, then U" onClick={()=>nav(`/initiative/${item.id}/activity?compose=1`)}>New initiative update</MenuItem><MenuItem icon="Clock" onClick={notifications}>Change update schedule…</MenuItem><MenuItem icon="Bell" onClick={()=>nav('/settings/integrations')}>Configure Slack notifications…</MenuItem><div className="menu-separator"/>
   <MenuItem icon="History" onClick={()=>setHistory(true)}>Show description history</MenuItem><MenuItem icon="MessageSquare" shortcut="⌘ U" onClick={()=>nav(`/initiative/${item.id}/activity`)}>Show updates and activity</MenuItem><MenuItem icon="MessageSquare" onClick={()=>{const visible=!commentsVisible;setCommentsVisible(visible);document.querySelectorAll<HTMLElement>('.update-discussion').forEach(node=>node.hidden=!visible)}}>{commentsVisible?'Hide comments':'Show comments'}</MenuItem><div className="menu-separator"/><MenuItem icon="Trash2" danger onClick={()=>setDeleting(true)}>Delete</MenuItem>
  </Dropdown>
  <button className="feature-icon-button" aria-label="Copy page URL" onClick={()=>void copy()}><Link2 size={15}/></button><UpdateSubscription kind="initiative" item={item}/><AddButton onClick={onAddProject}>Add project</AddButton>
  {history&&<FormDialog title="Description history" fields={[]} submit="Done" onClose={()=>setHistory(false)} onSave={async()=>true}>{data.activities.filter(activity=>activity.entityKind==='initiatives'&&activity.entityId===item.id&&activity.changes?.description).map(activity=><div className="feature-settings-row" key={activity.id}><span>{date(activity.createdAt)}</span><span className="muted">{activity.changes.description.from||'Empty'} → {activity.changes.description.to||'Empty'}</span></div>)}{!data.activities.some(activity=>activity.entityKind==='initiatives'&&activity.entityId===item.id&&activity.changes?.description)&&<p className="muted">No previous descriptions.</p>}</FormDialog>}
  {deleting&&<Confirm title={`Delete ${item.name}?`} description="This initiative will move to Recently deleted and can be restored." onClose={()=>setDeleting(false)} onConfirm={async()=>{const result=await act(()=>remove('initiatives',item.id));if(result!==null)onDeleted();return result}}/>}
 </>;
}
