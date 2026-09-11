import type {Entity} from './types';
export const defaultPriorityTypes=['assigned','mention','reminder','request'];
/** Priority filtering is shared by Inbox and notification delivery channels. */
export function isPriorityNotification(row:Entity,issue:Entity|undefined,preferences:Record<string,any>={}){return (preferences.priorityTypes??defaultPriorityTypes).some((type:string)=>[row.type,...(Array.isArray(row.reasons)?row.reasons:[])].some(reason=>String(reason??'').toLowerCase().includes(type.toLowerCase())))||(preferences.includeUrgent!==false&&issue?.priority===1);}
