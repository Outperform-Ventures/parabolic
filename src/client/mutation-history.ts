import type {Entity,EntityKind} from '../shared/types';

export type MutationAction='create'|'update'|'delete'|'restore';
export type HistoryChange={kind:EntityKind;entityId:string;action:MutationAction;data?:Record<string,any>;before:Record<string,any>;after:Record<string,any>;version?:number};
export type HistoryFrame={id:string;at?:number;undoneAt?:number;route?:string;changes:HistoryChange[];operationIds:string[]};
export type MutationHistory={past:HistoryFrame[];future:HistoryFrame[]};
/** A conversion is one parent-description update and newly linked children.
 * Recover its editor boundary from durable history after the editor remounts. */
export function selectionConversionBoundary(frame:HistoryFrame|undefined,issueId:string){
  if(!frame||frame.changes.length<2)return null;
  const parent=frame.changes.find(change=>change.kind==='issues'&&change.entityId===issueId&&change.action==='update');
  if(!parent||Object.keys(parent.after).length!==1||typeof parent.before.description!=='string'||typeof parent.after.description!=='string')return null;
  const children=frame.changes.filter(change=>change!==parent);
  if(!children.every(change=>change.kind==='issues'&&change.action==='create'&&change.after.parentId===issueId&&parent.after.description.includes(`/issues/${change.entityId}`)))return null;
  return {before:parent.before.description,after:parent.after.description};
}
const omit=new Set(['id','workspaceId','createdAt','updatedAt','creatorId','authorId','version','deletedAt','replaceSubscribers']);
export function historyChange(kind:EntityKind,entityId:string,action:MutationAction,data:Record<string,any>|undefined,previous?:Entity):HistoryChange{const clean=Object.fromEntries(Object.entries(data||{}).filter(([key])=>!omit.has(key)));return {kind,entityId,action,data,before:Object.fromEntries(Object.keys(clean).map(key=>[key,previous?.[key]??null])),after:clean,version:previous?.version};}
export function boundedHistory(value:MutationHistory):MutationHistory{const result={past:value.past.slice(-50),future:value.future.slice(-50)};while(JSON.stringify(result).length>5_000_000&&(result.past.length>1||result.future.length>1)){if(result.past.length>1)result.past.shift();else result.future.shift();}return result;}
export function inverseChange(change:HistoryChange,direction:'undo'|'redo',current?:Entity){
  const expected=direction==='undo'?change.after:change.before;
  if(change.action==='update'){if(!current||current.deletedAt||Object.entries(expected).some(([key,value])=>JSON.stringify(current[key]??null)!==JSON.stringify(value??null)))throw new Error('This item changed after your edit. Review its current values before undoing or redoing.');return {action:'update' as const,data:{...(direction==='undo'?change.before:change.after),...(change.kind==='issues'&&change.data?.replaceSubscribers===true?{replaceSubscribers:true}:{})}};}
  const action=direction==='undo'?change.action==='delete'?'restore':'delete':change.action==='create'?(current?'restore':'create'):change.action;
  if(action==='create'){if(current)throw new Error('This item already exists. Its current state cannot be replaced by redo.');return {action:'create' as const,data:change.data};}
  if(!current||(action==='restore'?!current.deletedAt:!!current.deletedAt)||(change.version!==undefined&&current.version!==change.version))throw new Error('This item changed after your action. Its current state is protected from undo or redo.');
  return {action:action as MutationAction,data:undefined};
}

/** Remember the state explicitly overwritten by a conflict resolution. */
export function rebaseHistoryChange(change:HistoryChange,server:Entity,side:'before'|'after'):HistoryChange {
  if(change.action!=='update')return change;
  return {...change,[side]:Object.fromEntries(Object.keys(change[side]).map(key=>[key,server[key]??null]))};
}
