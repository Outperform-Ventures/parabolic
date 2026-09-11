import type {IncomingMessage} from 'node:http';
import {randomUUID} from 'node:crypto';
import {hashPassword,hashToken,secret,validateEmail,validatePassword,verifyPassword} from './auth';
import {assert} from './errors';
import type {Actor,Repository} from './repository';

export type AsksRequester={id:string;workspaceId:string;email:string;name:string;sessionHash:string};
const cookieName='parabolic_asks_session';
const publicRecord=(row:any)=>({id:row.id,workspaceId:row.workspace_id,email:row.email,name:row.name,enabled:!!row.enabled,invited:!!row.invite_hash,registered:!!row.password,createdAt:row.created_at,updatedAt:row.updated_at});
export class AsksAuth {
 constructor(readonly repo:Repository,readonly sessionDays=30){
  repo.db.exec(`CREATE TABLE IF NOT EXISTS asks_requesters(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,email TEXT NOT NULL,name TEXT NOT NULL,password TEXT,enabled INTEGER NOT NULL DEFAULT 1,invite_hash TEXT UNIQUE,invite_expires TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(workspace_id,email));
  CREATE TABLE IF NOT EXISTS asks_requester_sessions(hash TEXT PRIMARY KEY,requester_id TEXT NOT NULL,created_at TEXT NOT NULL,expires_at TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS asks_requester_session_owner ON asks_requester_sessions(requester_id);`);
 }
 private workspace(id:string){const workspace=this.repo.raw('workspaces',id);assert(workspace,404,'Asks site is unavailable','NOT_FOUND');return workspace}
 private admin(actor:Actor){assert(['owner','admin'].includes(actor.role)&&this.repo.hasScope(actor,'asksPages',true),403,'Administrator access required','FORBIDDEN');this.workspace(actor.workspaceId)}
 list(actor:Actor){this.admin(actor);return this.repo.db.prepare('SELECT * FROM asks_requesters WHERE workspace_id=? ORDER BY email').all(actor.workspaceId).map(publicRecord)}
 invite(actor:Actor,fields:any){
  this.admin(actor);assert(fields&&typeof fields==='object'&&!Array.isArray(fields),422,'Provide requester details','VALIDATION_ERROR');const email=typeof fields.email==='string'?fields.email.trim().toLowerCase():fields.email;validateEmail(email);const name=fields.name??email.split('@')[0];assert(typeof name==='string'&&name.trim().length>0&&name.length<=200,422,'Enter a requester name','VALIDATION_ERROR');
  const token=secret(),at=new Date().toISOString(),expiresAt=new Date(Date.now()+7*86400000).toISOString();
  return this.repo.transaction(()=>{const existing=this.repo.db.prepare('SELECT id,name FROM asks_requesters WHERE workspace_id=? AND email=?').get(actor.workspaceId,email) as any,id=existing?.id||randomUUID();
   this.repo.db.prepare('INSERT INTO asks_requesters VALUES(?,?,?,?,NULL,1,?,?,?,?) ON CONFLICT(workspace_id,email) DO UPDATE SET name=excluded.name,enabled=1,invite_hash=excluded.invite_hash,invite_expires=excluded.invite_expires,updated_at=excluded.updated_at').run(id,actor.workspaceId,email,fields.name===undefined&&existing?.name?existing.name:name.trim(),hashToken(token),expiresAt,at,at);
   return{...publicRecord(this.repo.db.prepare('SELECT * FROM asks_requesters WHERE id=?').get(id)),token,expiresAt};
  });
 }
 revoke(actor:Actor,id:string){this.admin(actor);return this.repo.transaction(()=>{const row=this.repo.db.prepare('SELECT id FROM asks_requesters WHERE id=? AND workspace_id=?').get(id,actor.workspaceId);assert(row,404,'Requester not found','NOT_FOUND');this.repo.db.prepare('UPDATE asks_requesters SET enabled=0,invite_hash=NULL,invite_expires=NULL,updated_at=? WHERE id=?').run(new Date().toISOString(),id);this.repo.db.prepare('DELETE FROM asks_requester_sessions WHERE requester_id=?').run(id)})}
 private session(id:string){const token=secret(),at=new Date().toISOString();this.repo.db.prepare('INSERT INTO asks_requester_sessions VALUES(?,?,?,?)').run(hashToken(token),id,at,new Date(Date.now()+this.sessionDays*86400000).toISOString());return token}
 async join(workspaceId:string,fields:any){
  this.workspace(workspaceId);assert(typeof fields?.token==='string'&&fields.token.length<=200,422,'An invitation is required','INVALID_INVITATION');validatePassword(fields.password);const password=await hashPassword(fields.password);
  return this.repo.transaction(()=>{const row=this.repo.db.prepare('SELECT * FROM asks_requesters WHERE workspace_id=? AND invite_hash=? AND enabled=1 AND invite_expires>?').get(workspaceId,hashToken(fields.token),new Date().toISOString()) as any;assert(row,410,'This invitation has expired or been used','INVALID_INVITATION');
   this.repo.db.prepare('UPDATE asks_requesters SET password=?,invite_hash=NULL,invite_expires=NULL,updated_at=? WHERE id=?').run(password,new Date().toISOString(),row.id);this.repo.db.prepare('DELETE FROM asks_requester_sessions WHERE requester_id=?').run(row.id);return{requester:{id:row.id,workspaceId,email:row.email,name:row.name},token:this.session(row.id)};
  });
 }
 async login(workspaceId:string,fields:any){
  this.workspace(workspaceId);const email=typeof fields?.email==='string'?fields.email.trim().toLowerCase():fields?.email;validateEmail(email);assert(typeof fields.password==='string'&&fields.password.length<=1024,401,'Email or password is incorrect','INVALID_CREDENTIALS');const row=this.repo.db.prepare('SELECT * FROM asks_requesters WHERE workspace_id=? AND email=? AND enabled=1').get(workspaceId,email) as any;
  const fallback='7d5a93195da688263d274848b8ee5b6c9:92ef4d4ef4cf4f2fbf4905db58344d916ec1d5c5a8d76dc6b8fa83af2050c536a607b4141ccf75505a4b806c294ed4b3a09f7cafb9c7a1e62b91b37774336115';
  const valid=await verifyPassword(fields.password,row?.password||fallback);assert(row?.password&&valid,401,'Email or password is incorrect','INVALID_CREDENTIALS');
  // Recheck after password hashing: revocation or a password reset may race login.
  return this.repo.transaction(()=>{const current=this.repo.db.prepare('SELECT * FROM asks_requesters WHERE id=? AND enabled=1 AND password=?').get(row.id,row.password) as any;assert(current,401,'Email or password is incorrect','INVALID_CREDENTIALS');return{requester:{id:row.id,workspaceId,email:row.email,name:row.name},token:this.session(row.id)}});
 }
 resolve(req:IncomingMessage,workspaceId:string):AsksRequester|null{
  if(!this.repo.raw('workspaces',workspaceId))return null;const token=req.headers.cookie?.split(';').map(c=>c.trim()).find(c=>c.startsWith(cookieName+'='))?.slice(cookieName.length+1);if(!token)return null;const hash=hashToken(token),row=this.repo.db.prepare('SELECT r.* FROM asks_requester_sessions s JOIN asks_requesters r ON r.id=s.requester_id WHERE s.hash=? AND s.expires_at>? AND r.enabled=1 AND r.workspace_id=?').get(hash,new Date().toISOString(),workspaceId) as any;
  return row?{id:row.id,workspaceId,email:row.email,name:row.name,sessionHash:hash}:null;
 }
 require(req:IncomingMessage,workspaceId:string){const requester=this.resolve(req,workspaceId);assert(requester,401,'Sign in to submit an Ask','UNAUTHENTICATED');return requester}
 status(req:IncomingMessage,workspaceId:string){const workspace=this.workspace(workspaceId),requester=this.resolve(req,workspaceId);return{workspace:{id:workspace.id,name:workspace.name},requester:requester?{id:requester.id,workspaceId,email:requester.email,name:requester.name}:null}}
 logout(req:IncomingMessage,workspaceId:string){const requester=this.resolve(req,workspaceId);if(requester)this.repo.db.prepare('DELETE FROM asks_requester_sessions WHERE hash=?').run(requester.sessionHash)}
 async changePassword(requester:AsksRequester,fields:any){
  validatePassword(fields?.newPassword);assert(typeof fields.currentPassword==='string'&&fields.currentPassword.length<=1024,401,'Current password is incorrect','INVALID_CREDENTIALS');const row=this.repo.db.prepare('SELECT password FROM asks_requesters WHERE id=? AND enabled=1').get(requester.id) as any;assert(row?.password&&await verifyPassword(fields.currentPassword,row.password),401,'Current password is incorrect','INVALID_CREDENTIALS');const password=await hashPassword(fields.newPassword);
  this.repo.transaction(()=>{const valid=this.repo.db.prepare('SELECT r.id FROM asks_requesters r JOIN asks_requester_sessions s ON s.requester_id=r.id WHERE r.id=? AND r.enabled=1 AND r.password=? AND s.hash=? AND s.expires_at>?').get(requester.id,row.password,requester.sessionHash,new Date().toISOString());assert(valid,401,'Sign in again to change your password','UNAUTHENTICATED');this.repo.db.prepare('UPDATE asks_requesters SET password=?,updated_at=? WHERE id=?').run(password,new Date().toISOString(),requester.id);this.repo.db.prepare('DELETE FROM asks_requester_sessions WHERE requester_id=? AND hash<>?').run(requester.id,requester.sessionHash)});
 }
 cookie(token:string,secure=false){return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token?Math.floor(this.sessionDays*86400):0}${secure?'; Secure':''}`}
}
