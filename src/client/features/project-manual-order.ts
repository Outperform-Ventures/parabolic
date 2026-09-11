import type {Entity} from '../../shared/types';
export const projectManualRank=(project:Entity)=>Number.isFinite(project.sortOrder)?project.sortOrder:Number.isFinite(project.position)?project.position:Date.parse(project.createdAt)||0;
export function projectManualDrop(rows:Entity[],movingId:string,targetId:string,direction='asc'){
 const ordered=rows.filter(row=>row.id!==movingId),at=ordered.findIndex(row=>row.id===targetId);if(at<0)return undefined;
 const before=ordered[at-1],target=ordered[at],right=projectManualRank(target),left=before?projectManualRank(before):right+(direction==='desc'?1024:-1024);
 return {sortOrder:(left+right)/2};
}
