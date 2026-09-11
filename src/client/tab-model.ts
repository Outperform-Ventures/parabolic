export type WorkspaceTab={id:string;route:string;pinned?:boolean;lastActiveAt:number;history:string[];historyIndex:number};
export type ClosedTabGroup={at:number;automatic?:boolean;undoneAt?:number;restoredIds?:string[];entries:{tab:WorkspaceTab;index:number}[]};
export const validTabRoute=(route:unknown):route is string=>typeof route==='string'&&route.startsWith('/')&&!route.startsWith('//')&&!/[\\\x00-\x1f]/.test(route);
export const tabCloseControlVisible=(tabCount:number,desktop:boolean)=>desktop||tabCount>1;
export const tabUrl=(route:string,origin:string)=>new URL(validTabRoute(route)?route:'/my-issues',origin).href;
export function createWorkspaceTab(id:string,route:string,now=Date.now()):WorkspaceTab{return {id,route,lastActiveAt:now,history:[route],historyIndex:0};}
export function normalizeTabs(value:unknown,route:string,now=Date.now()):WorkspaceTab[]{
  const seen=new Set<string>(),tabs:WorkspaceTab[]=[];
  if(Array.isArray(value))for(const item of value){
    if(!item||typeof item.id!=='string'||!item.id||seen.has(item.id)||!validTabRoute(item.route))continue;
    seen.add(item.id);const history=Array.isArray(item.history)?item.history.filter(validTabRoute).slice(-100):[];
    let historyIndex=Number.isInteger(item.historyIndex)?Math.max(0,Math.min(item.historyIndex,history.length-1)):history.length-1;
    if(!history.length||history[historyIndex]!==item.route){history.splice(0,history.length,item.route);historyIndex=0;}
    tabs.push({id:item.id,route:item.route,pinned:item.pinned===true,lastActiveAt:Number.isFinite(item.lastActiveAt)&&item.lastActiveAt>0?Math.min(item.lastActiveAt,now):now,history,historyIndex});
  }
  return tabs.length?anchorPinnedTabs(tabs):[createWorkspaceTab('initial',validTabRoute(route)?route:'/my-issues',now)];
}
export function anchorPinnedTabs(tabs:WorkspaceTab[]):WorkspaceTab[]{return [...tabs.filter(tab=>tab.pinned),...tabs.filter(tab=>!tab.pinned)];}
export function recordTabVisit(tab:WorkspaceTab,route:string,now=Date.now()):WorkspaceTab{
  if(!validTabRoute(route)||tab.route===route)return tab;
  const history=[...tab.history.slice(0,tab.historyIndex+1),route].slice(-100);
  return {...tab,route,history,historyIndex:history.length-1,lastActiveAt:now};
}
export function moveTabHistory(tab:WorkspaceTab,delta:number,now=Date.now()):WorkspaceTab{
  const index=Math.max(0,Math.min(tab.history.length-1,tab.historyIndex+delta));
  return index===tab.historyIndex?tab:{...tab,route:tab.history[index],historyIndex:index,lastActiveAt:now};
}
export function closedTabsKey(workspaceId:string,userId:string){return `parabolic:closed-tabs:${workspaceId}:${userId}`;}
export function restoredTabsKey(workspaceId:string,userId:string){return `parabolic:restored-tabs:${workspaceId}:${userId}`;}
export function readClosedTabs(storage:Pick<Storage,'getItem'>,workspaceId:string,userId:string,restored=false):ClosedTabGroup[]{
  try{const data=JSON.parse(storage.getItem(restored?restoredTabsKey(workspaceId,userId):closedTabsKey(workspaceId,userId))??'[]');return Array.isArray(data)?data.filter(group=>Number.isFinite(group.at)&&Array.isArray(group.entries)).map(group=>({...group,entries:group.entries.flatMap((entry:any)=>{const tab=normalizeTabs([entry.tab],'/my-issues')[0];return entry.tab?.id===tab.id&&Number.isInteger(entry.index)?[{tab,index:Math.max(0,entry.index)}]:[];})})).filter(group=>group.entries.length).slice(-40):[];}catch{return [];}
}
export function rememberClosedTabs(storage:Pick<Storage,'getItem'|'setItem'>,workspaceId:string,userId:string,tabs:WorkspaceTab[],ids:Set<string>,now=Date.now(),automatic=false){
  const entries=tabs.flatMap((tab,index)=>ids.has(tab.id)?[{tab,index}]:[]);if(!entries.length)return;
  const group={at:now,entries,automatic},groups=[...readClosedTabs(storage,workspaceId,userId),group].slice(-40);
  storage.setItem(closedTabsKey(workspaceId,userId),JSON.stringify(groups));
  storage.setItem(`parabolic:closed-tab:${workspaceId}:${userId}`,entries.at(-1)!.tab.route);return group;
}
export function restoreTabGroup(tabs:WorkspaceTab[],group:ClosedTabGroup,newId:()=>string,now=Date.now()):{tabs:WorkspaceTab[];activeId:string}{
  const next=[...tabs];let activeId=next[0]?.id??'';
  for(const entry of group.entries){const id=next.some(tab=>tab.id===entry.tab.id)?newId():entry.tab.id;const tab={...entry.tab,id,lastActiveAt:now};next.splice(Math.min(entry.index,next.length),0,tab);activeId=id;}
  return {tabs:anchorPinnedTabs(next),activeId};
}
