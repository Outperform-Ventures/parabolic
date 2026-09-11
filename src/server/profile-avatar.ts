import {randomUUID} from 'node:crypto';
import type {IncomingMessage,ServerResponse} from 'node:http';
import type {Actor,Repository} from './repository.ts';
import {assert,HttpError} from './errors.ts';
const limit=5_000_000;
export function avatarImageType(bytes:Buffer){
  if(bytes.length>=24&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.toString('ascii',12,16)==='IHDR'){const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);assert(width>0&&height>0&&width<=16384&&height<=16384&&width*height<=40_000_000,422,'Image dimensions are too large','INVALID_IMAGE');return 'image/png';}
  if(bytes.length>=4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
  if(bytes.length>=13&&['GIF87a','GIF89a'].includes(bytes.toString('ascii',0,6)))return 'image/gif';
  if(bytes.length>=16&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return 'image/webp';
  if(bytes.length>=24&&bytes.toString('ascii',4,8)==='ftyp'&&/avif|avis/.test(bytes.toString('ascii',8,Math.min(40,bytes.length))))return 'image/avif';
  throw new HttpError(422,'Choose a PNG, JPEG, GIF, WebP, or AVIF image','INVALID_IMAGE');
}
/** Account pictures follow the user across workspaces; reads still require user visibility. */
export async function handleProfileAvatar(repo:Repository,req:IncomingMessage,res:ServerResponse,actor:Actor,id:string){
  const method=req.method??'GET',user=repo.get(actor,'users',id),db=repo.db;
  if(method==='GET'||method==='HEAD'){
    const version=new URL(req.url??'/', 'http://localhost').searchParams.get('v');assert(user.avatarAttachmentId&&(!version||version===user.avatarAttachmentId),404,'Avatar not found','NOT_FOUND');
    const row=db.prepare("SELECT * FROM attachments WHERE id=? AND entity_kind='users' AND entity_id=? AND creator_id=?").get(user.avatarAttachmentId,id,id) as any;assert(row,404,'Avatar not found','NOT_FOUND');res.writeHead(200,{'Content-Type':row.mime_type,'Content-Length':row.size,'Content-Disposition':'inline','Content-Security-Policy':"default-src 'none'; sandbox",'X-Content-Type-Options':'nosniff'});res.end(method==='HEAD'?undefined:Buffer.from(row.content));return;
  }
  assert(method==='POST'||method==='DELETE',405,'Method not allowed','METHOD_NOT_ALLOWED');repo.access(actor,'users',user,true);assert(id===actor.userId,403,'You can only edit your own profile','FORBIDDEN');
  let upload:{id:string;bytes:Buffer;mimeType:string;filename:string}|undefined;
  if(method==='POST'){
    assert(req.headers['content-type']?.startsWith('multipart/form-data'),415,'Use a multipart image upload','UNSUPPORTED_MEDIA_TYPE');const chunks:Buffer[]=[];let size=0;for await(const chunk of req){size+=chunk.length;assert(size<=limit+100_000,413,'Avatar must be smaller than 5 MB','PAYLOAD_TOO_LARGE');chunks.push(Buffer.from(chunk));}
    let form:FormData;try{form=await new Response(Buffer.concat(chunks),{headers:{'content-type':req.headers['content-type']!}}).formData();}catch{throw new HttpError(422,'Invalid image upload','INVALID_IMAGE');}const file=form.get('file');assert(file instanceof File&&file.size>0,422,'Choose an image','INVALID_IMAGE');assert(file.size<=limit,413,'Avatar must be smaller than 5 MB','PAYLOAD_TOO_LARGE');const bytes=Buffer.from(await file.arrayBuffer());upload={id:randomUUID(),bytes,mimeType:avatarImageType(bytes),filename:file.name.replace(/[\r\n]/g,'').slice(0,255)||'avatar'};
  }
  const updated=repo.transaction(()=>{
    const current=repo.get(actor,'users',id);repo.access(actor,'users',current,true);const at=new Date().toISOString();if(upload)db.prepare('INSERT INTO attachments VALUES(?,?,?,?,?,?,?,?,?,?)').run(upload.id,actor.workspaceId,id,upload.filename,upload.mimeType,upload.bytes.length,'users',id,upload.bytes,at);
    const next=repo.update(actor,'users',id,{avatar:upload?`/api/v1/users/${encodeURIComponent(id)}/avatar?v=${upload.id}`:null,avatarAttachmentId:upload?.id??null});if(current.avatarAttachmentId)db.prepare("DELETE FROM attachments WHERE id=? AND entity_kind='users' AND entity_id=? AND creator_id=?").run(current.avatarAttachmentId,id,id);return repo.present(actor,'users',next);
  });res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(updated));
}
