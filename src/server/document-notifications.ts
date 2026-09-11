import {documentNotificationContent} from './collaboration-schema.ts';
import {documentParents} from '../shared/document-parent.ts';
import type {Actor,RecordEntity,Repository} from './repository.ts';
export function documentSubscribers(document:RecordEntity):string[]{return document.subscriberIds??[document.creatorId||document.userId].filter(Boolean)}
export function documentRecipients(repo:Repository,actor:Actor,kind:string,document:RecordEntity,previous:RecordEntity|undefined,add:(id:string,reason:string)=>void){
 if(kind!=='documents'||!previous)return;
 const before=documentSubscribers(previous),after=documentSubscribers(document);
 for(const id of after)if(!before.includes(id))add(id,'documentSubscribed');
 for(const id of before)if(!after.includes(id))add(id,'documentUnsubscribed');
 const contentChanged=document.content!==previous.content&&documentNotificationContent(document.content||'')!==documentNotificationContent(previous.content||'');
 const moved=Object.values(documentParents).some(({field})=>(document[field]||null)!==(previous[field]||null));
 const reason=document.deletedAt&&!previous.deletedAt?'documentDeleted':!document.deletedAt&&(contentChanged||document.title!==previous.title)?'documentContentChange':!document.deletedAt&&moved?'documentMoved':null;
 if(!reason)return;
 for(const id of after)add(id,reason);
 for(const subscription of repo.all('subscriptions',actor.workspaceId))if(subscription.documentId===document.id||subscription.entityKind==='documents'&&subscription.entityId===document.id)add(subscription.userId,reason);
}
