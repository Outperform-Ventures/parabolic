import {randomUUID} from 'node:crypto';
import {assert} from './errors';
import {sanitizeEditorContent} from './content';
import type {Actor,RecordEntity,Repository} from './repository';

const links=()=>/(src|href)="(?:https?:\/\/[^/"\s]+)?\/api\/v1\/attachments\/([A-Za-z0-9_-]+)(?:[?#][^"]*)?"/g;
function transform(value:any,visit:(html:string)=>string):any{
 if(Array.isArray(value))return value.map(item=>transform(item,visit));
 if(!value||typeof value!=='object')return value;
 return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,(['description','content','body'].includes(key)||(key==='label'&&value.type==='instructions'))&&typeof item==='string'?visit(item):transform(item,visit)]));
}
export function templateAssetIds(template:RecordEntity){const ids=new Set<string>();transform(template,html=>{for(const match of sanitizeEditorContent(html).matchAll(links()))ids.add(match[2]);return html});return ids}
export function publicTemplateAssetIds(template:RecordEntity){const ids=new Set<string>();const html=[template.description??template.properties?.description??'',...(template.formFields||[]).filter((field:any)=>field.type==='instructions').map((field:any)=>field.content||field.description||field.label||'')];for(const value of html)for(const match of sanitizeEditorContent(String(value)).matchAll(links()))ids.add(match[2]);return ids}

// Publishing content must use the writer's actual read permission. A reference
// to a file ID is not permission to expose its bytes to template readers.
export function prepareTemplateAssets(repo:Repository,actor:Actor,template:RecordEntity,previous?:RecordEntity){
 const previousIds=previous?templateAssetIds(previous):new Set<string>(),mapped=new Map<string,string>();
 const next=transform(template,html=>sanitizeEditorContent(html).replace(links(),(match,attribute,id)=>{
  if(mapped.has(id))return `${attribute}="/api/v1/attachments/${mapped.get(id)}"`;
  const file=repo.db.prepare('SELECT * FROM attachments WHERE id=? AND workspace_id=?').get(id,actor.workspaceId) as any;
  let readable=false;if(file){if(file.entity_id){try{repo.get({...actor,scopes:[...actor.scopes,'read']},file.entity_kind,file.entity_id);readable=true}catch{}}else readable=file.creator_id===actor.userId}
  // Preserve an existing broken legacy reference without granting new access.
  // Its uploader can repair it by saving the template with their own access.
  if(!readable&&previousIds.has(id))return match;
  assert(readable,422,'A template attachment is unavailable','INVALID_TEMPLATE_ATTACHMENT');
  let target=id;
  if(!file.entity_id)repo.db.prepare('UPDATE attachments SET entity_kind=?,entity_id=? WHERE id=? AND workspace_id=? AND creator_id=? AND entity_id IS NULL').run('templates',template.id,id,actor.workspaceId,actor.userId);
  else if(file.entity_kind!=='templates'||file.entity_id!==template.id){target=randomUUID();repo.db.prepare('INSERT INTO attachments VALUES(?,?,?,?,?,?,?,?,?,?)').run(target,actor.workspaceId,actor.userId,file.filename,file.mime_type,file.size,'templates',template.id,file.content,new Date().toISOString())}
  mapped.set(id,target);return `${attribute}="/api/v1/attachments/${target}"`;
 }));
 Object.assign(template,next);
}

export function copyAppliedTemplateAssets(repo:Repository,actor:Actor,template:RecordEntity,html:string){
 const declared=templateAssetIds(template),mapped=new Map<string,string>();
 return sanitizeEditorContent(html).replace(links(),(match,attribute,id)=>{
  if(!declared.has(id))return match;
  if(mapped.has(id))return `${attribute}="/api/v1/attachments/${mapped.get(id)}"`;
  const file=repo.db.prepare('SELECT * FROM attachments WHERE id=? AND workspace_id=?').get(id,actor.workspaceId) as any;
  assert(file,422,'A template attachment is unavailable','INVALID_TEMPLATE_ATTACHMENT');
  if(actor.requesterIntake)assert(file.entity_kind==='templates'&&file.entity_id===template.id,422,'A template attachment must be republished by its uploader','INVALID_TEMPLATE_ATTACHMENT');
  if(file.entity_id)repo.get({...actor,scopes:[...actor.scopes,'read']},file.entity_kind,file.entity_id);
  else assert(file.creator_id===actor.userId,422,'A template attachment is unavailable','INVALID_TEMPLATE_ATTACHMENT');
  const target=randomUUID();repo.db.prepare('INSERT INTO attachments VALUES(?,?,?,?,?,?,?,?,?,?)').run(target,actor.workspaceId,actor.userId,file.filename,file.mime_type,file.size,null,null,file.content,new Date().toISOString());mapped.set(id,target);return `${attribute}="/api/v1/attachments/${target}"`;
 });
}

export function publishedTemplateAsset(repo:Repository,template:RecordEntity,id:string){
 if(!publicTemplateAssetIds(template).has(id))return null;
 return repo.db.prepare("SELECT * FROM attachments WHERE id=? AND workspace_id=? AND entity_kind='templates' AND entity_id=?").get(id,template.workspaceId,template.id) as any||null;
}
export function projectPublishedAssetUrls(repo:Repository,template:RecordEntity,slug:string,html:string){
 return sanitizeEditorContent(html).replace(links(),(match,attribute,id)=>publishedTemplateAsset(repo,template,id)?`${attribute}="/asks-api/${template.workspaceId}/template-assets/${template.id}/${id}?pageSlug=${encodeURIComponent(slug)}"`:match);
}
