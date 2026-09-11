import {randomUUID} from 'node:crypto';
import {assert} from './errors';
import type {Actor,RecordEntity,Repository} from './repository';

const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function prepareTemplateUploads(repo:Repository,actor:Actor,issue:RecordEntity,field:any,value:any){
 assert(Array.isArray(value)&&value.every(id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(id))&&new Set(value).size===value.length,422,`${field.label||field.id} requires uploaded files`,'INVALID_TEMPLATE_ANSWERS');
 const ids:string[]=[],links:string[]=[];
 for(const sourceId of value){
  const file=repo.db.prepare('SELECT * FROM attachments WHERE id=? AND workspace_id=?').get(sourceId,actor.workspaceId) as any;
  assert(file,422,'An uploaded file is unavailable','INVALID_TEMPLATE_ATTACHMENT');
  if(file.entity_id)repo.get(actor,file.entity_kind,file.entity_id);
  else assert(file.creator_id===actor.userId,422,'An uploaded file is unavailable','INVALID_TEMPLATE_ATTACHMENT');
  let id=sourceId;
  // Reused files get their own destination binding; never widen the original.
  if(file.entity_id){id=randomUUID();repo.db.prepare('INSERT INTO attachments VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,actor.workspaceId,actor.userId,file.filename,file.mime_type,file.size,null,null,file.content,new Date().toISOString());}
  ids.push(id);links.push(`<p><a href="/api/v1/attachments/${id}">${escape(file.filename)}</a></p>`);
 }
 issue.templateAnswers={...issue.templateAnswers,[field.id]:ids};
 return `<p><strong>${escape(field.label||field.id)}</strong></p>`+links.join('');
}
