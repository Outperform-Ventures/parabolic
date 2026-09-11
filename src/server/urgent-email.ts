import type {Actor,RecordEntity,Repository} from './repository';
import {enqueueMail} from './mail';
export function enqueueUrgentIssueEmail(repo:Repository,actor:Actor,issue:RecordEntity,userId:string){
 const user=repo.raw('users',userId);
 if(user?.preferences?.notifications?.email===true||user?.preferences?.notifications?.urgentEmail!==true||!user.email)return;
 enqueueMail(repo,{workspaceId:actor.workspaceId,to:user.email,subject:`Urgent: ${issue.identifier||'Issue'} ${issue.title}`,text:`An issue assigned to you was marked Urgent.\n\n${issue.identifier||''} ${issue.title}\n\nOpen Parabolic to review the issue.`,dedupeKey:`urgent-issue:${actor.workspaceId}:${issue.id}:${issue.version}:${userId}`});
}
