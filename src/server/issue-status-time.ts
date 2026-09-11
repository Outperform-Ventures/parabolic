import type {Repository,RecordEntity} from './repository';
import {statusTimeFromHistory,statusTimeSnapshot,transitionStatusTime} from '../shared/issue-status-time';
export function projectedStatusTime(repo:Repository,issue:RecordEntity){
 if(issue.statusEnteredAt&&issue.statusTimeTotals)return issue;
 const history=repo.db.prepare("SELECT data FROM entities WHERE workspace_id=? AND kind='activities' AND json_extract(data,'$.entityId')=? AND deleted_at IS NULL").all(issue.workspaceId,issue.id) as {data:string}[];
 const snapshot=statusTimeFromHistory(issue,history.map(row=>JSON.parse(row.data)));
 return {...issue,...(snapshot??{accumulatedStateUpdatedAt:null,statusTimeComplete:false})};
}
export function prepareStatusTime(repo:Repository,issue:RecordEntity,previous?:RecordEntity){
 if(!previous){Object.assign(issue,statusTimeSnapshot(issue.statusId,issue.createdAt));return;}
 const projected=projectedStatusTime(repo,previous);
 if(issue.statusId!==previous.statusId)Object.assign(issue,transitionStatusTime(projected,issue.statusId,issue.updatedAt));
 else if(projected.statusEnteredAt)Object.assign(issue,statusTimeSnapshot(projected.statusId,projected.statusEnteredAt,projected.statusTimeTotals));
 if(projected.statusTimeComplete===false){issue.statusTimeComplete=false;issue.accumulatedStateUpdatedAt=null;}
}
