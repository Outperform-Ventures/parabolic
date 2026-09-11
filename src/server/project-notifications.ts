import type {Actor,RecordEntity,Repository} from './repository.ts';

/** Activity covered by a personal project subscription, separate from update posts. */
export function projectActivityRecipients(repo:Repository,actor:Actor,kind:string,entity:RecordEntity,previous:RecordEntity|undefined,add:(id:string,reason:string)=>void){
  if(entity.deletedAt)return;
  let projectId:string|undefined,reason:string|undefined;
  if(kind==='projects'&&previous&&entity.description!==previous.description){projectId=entity.id;reason='projectDescriptionContentChange';}
  if(kind==='issues'&&entity.projectId){
    if(!previous){projectId=entity.projectId;reason='issueCreated';}
    else if(entity.statusId!==previous.statusId&&['completed','canceled'].includes(repo.raw('statuses',entity.statusId)?.type)){projectId=entity.projectId;reason='status';}
  }
  if(!projectId||!reason)return;
  const project=repo.raw('projects',projectId);if(!project)return;
  for(const userId of project.subscriberIds||[])add(userId,reason);
  for(const subscription of repo.all('subscriptions',actor.workspaceId))
    if(subscription.projectId===projectId||subscription.entityKind==='projects'&&subscription.entityId===projectId)add(subscription.userId,reason);
}
