import type {Entity} from './types';
export function notificationDestination(notification:Entity):{kind:'issue'|'document'|'project'|'initiative'|'inbox';route:string}{
 const entityId=(kind:string,field:string)=>notification[field]||(notification.entityKind===kind?notification.entityId:undefined);
 const issue=entityId('issues','issueId'),document=entityId('documents','documentId'),project=entityId('projects','projectId'),initiative=entityId('initiatives','initiativeId');
 const tags=[notification.type,...(Array.isArray(notification.reasons)?notification.reasons:[])].map(value=>String(value||'').toLowerCase().replace(/[\s_-]/g,''));
 const updatePrompt=tags.some(tag=>['updatereminders','projectupdateprompt','initiativeupdateprompt'].includes(tag));
 const updates=notification.updateId?`/updates#update-${encodeURIComponent(notification.updateId)}`:updatePrompt?'/updates':'';
 if(document&&(notification.entityKind==='documents'||tags.some(tag=>tag.startsWith('document'))))return {kind:'document',route:`/document/${encodeURIComponent(document)}`};
 if(issue)return {kind:'issue',route:`/issues/${encodeURIComponent(issue)}`};
 // A document's project is context, not the event's destination.
 if(document)return {kind:'document',route:`/document/${encodeURIComponent(document)}`};
 if(project)return {kind:'project',route:`/project/${encodeURIComponent(project)}${updates}`};
 if(initiative)return {kind:'initiative',route:`/initiative/${encodeURIComponent(initiative)}${updates}`};
 return {kind:'inbox',route:'/inbox'};
}
