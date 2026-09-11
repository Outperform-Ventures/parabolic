import { randomBytes, randomUUID, createHash, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { IncomingMessage } from 'node:http';
import type { DatabaseSync } from 'node:sqlite';
import { assert } from './errors.ts';
import { Repository, type Actor } from './repository.ts';
import {applicationIdentity} from './oauth-app-permissions.ts';

const scrypt=promisify(scryptCallback);
export const hashToken=(token:string)=>createHash('sha256').update(token).digest('hex');
export const secret=()=>randomBytes(32).toString('base64url');
export async function hashPassword(password:string){const salt=randomBytes(16).toString('hex');const derived=await scrypt(password,salt,64) as Buffer;return `${salt}:${derived.toString('hex')}`;}
export async function verifyPassword(password:string,stored:string){const [salt,hex]=stored.split(':');if(!salt||!hex)return false;const derived=await scrypt(password,salt,64) as Buffer;const target=Buffer.from(hex,'hex');return target.length===derived.length&&timingSafeEqual(target,derived);}
export function validatePassword(password:unknown):asserts password is string {assert(typeof password==='string'&&password.length>=10&&password.length<=1024,422,'Password must contain at least 10 characters','VALIDATION_ERROR');}
export function validateEmail(email:unknown):asserts email is string {assert(typeof email==='string'&&email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),422,'Enter a valid email address','VALIDATION_ERROR');}
export class Auth {
  db:DatabaseSync; repo:Repository;sessionLifetimeDays:number;seedDemo:boolean;
  constructor(db:DatabaseSync,repo:Repository,sessionLifetimeDays=30,seedDemo=false){this.db=db;this.repo=repo;this.sessionLifetimeDays=sessionLifetimeDays;this.seedDemo=seedDemo;db.exec("CREATE TABLE IF NOT EXISTS oauth_access_resources(token_id TEXT PRIMARY KEY,resource TEXT NOT NULL); CREATE TRIGGER IF NOT EXISTS oauth_access_cleanup AFTER DELETE ON api_tokens BEGIN DELETE FROM oauth_access_resources WHERE token_id=OLD.id; END;");}
  resolve(req:IncomingMessage,options:{resource?:string}={}):Actor|null {
    const bearer=req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if(bearer){const row=this.db.prepare('SELECT * FROM api_tokens WHERE hash=?').get(hashToken(bearer)) as any;if(!row||(row.expires_at&&row.expires_at<=new Date().toISOString()))return null;const audience=this.db.prepare('SELECT resource FROM oauth_access_resources WHERE token_id=?').get(row.id) as {resource:string}|undefined;if(audience&&audience.resource!==options.resource)return null;const role=this.repo.role(row.user_id,row.workspace_id);if(role==='none'||this.repo.all('memberships',row.workspace_id).some(m=>!m.teamId&&m.userId===row.user_id&&m.pendingInvitation))return null;const appId=applicationIdentity(this.db,row.user_id,row.app_id);this.db.prepare('UPDATE api_tokens SET last_used_at=? WHERE id=?').run(new Date().toISOString(),row.id);return {userId:row.user_id,workspaceId:row.workspace_id,role:appId?'member':role,scopes:JSON.parse(row.scopes),tokenId:row.id,...(appId?{appId}:{})};}
    const cookie=req.headers.cookie?.split(';').map(c=>c.trim()).find(c=>c.startsWith('parabolic_session='))?.slice('parabolic_session='.length);if(!cookie)return null;
    const hash=hashToken(cookie);const row=this.db.prepare('SELECT * FROM sessions WHERE hash=? AND expires_at>?').get(hash,new Date().toISOString()) as any;if(!row)return null;
    const role=this.repo.role(row.user_id,row.workspace_id);if(role==='none'||this.repo.all('memberships',row.workspace_id).some(m=>!m.teamId&&m.userId===row.user_id&&m.pendingInvitation))return null;return {userId:row.user_id,workspaceId:row.workspace_id,role,scopes:['read','write','admin'],sessionHash:hash};
  }
  rememberedAccounts(req:IncomingMessage){
    const cookies=(req.headers.cookie||'').split(';').map(c=>c.trim()).filter(c=>c.startsWith('parabolic_account_')||c.startsWith('parabolic_session='));
    const result=new Map<string,{actor:Actor;token:string}>();
    for(const entry of cookies){const token=entry.slice(entry.indexOf('=')+1);const actor=this.resolve({headers:{cookie:'parabolic_session='+token}} as IncomingMessage);if(actor)result.set(actor.userId,{actor,token});}
    return [...result.values()];
  }
  require(req:IncomingMessage){const actor=this.resolve(req);assert(actor,401,'Authentication required','UNAUTHENTICATED');return actor;}
  requireAdmin(actor:Actor){assert(['owner','admin'].includes(actor.role)&&actor.scopes.includes('admin'),403,'Administrator access required','FORBIDDEN');}
  session(userId:string,workspaceId:string){const token=secret();const at=new Date().toISOString();this.db.prepare('INSERT INTO sessions(hash,user_id,workspace_id,created_at,expires_at) VALUES(?,?,?,?,?)').run(hashToken(token),userId,workspaceId,at,new Date(Date.now()+this.sessionLifetimeDays*86400000).toISOString());return token;}
  leaveWorkspace(actor:Actor,workspaceId:unknown) {
    assert(actor.sessionHash,403,'Leaving a workspace requires an authenticated browser session','FORBIDDEN');
    assert(workspaceId===actor.workspaceId,409,'The active workspace changed. Review the workspace before leaving.','WORKSPACE_CHANGED');
    return this.repo.transaction(()=>{
      const members=this.repo.all('memberships',actor.workspaceId);
      const membership=members.find(m=>m.userId===actor.userId&&!m.teamId);
      assert(membership,403,'Workspace access has been removed','FORBIDDEN');
      assert(membership.role!=='owner'||members.some(m=>m.userId!==actor.userId&&!m.teamId&&['owner','admin'].includes(m.role)),422,'Assign another workspace administrator before leaving.','LAST_OWNER');
      const at=new Date().toISOString();
      // Preserve authorship and team associations so an administrator can restore access.
      this.repo.save('memberships',{...membership,leftAt:at,deletedAt:at,updatedAt:at,version:membership.version+1},'delete',actor);
      const next=this.db.prepare("SELECT workspace_id FROM entities WHERE kind='memberships' AND json_extract(data,'$.userId')=? AND json_extract(data,'$.teamId') IS NULL AND deleted_at IS NULL ORDER BY workspace_id LIMIT 1").get(actor.userId) as {workspace_id:string}|undefined;
      if(next)this.db.prepare('UPDATE sessions SET workspace_id=? WHERE hash=? AND user_id=?').run(next.workspace_id,actor.sessionHash!,actor.userId);
      this.db.prepare('DELETE FROM sessions WHERE user_id=? AND workspace_id=?').run(actor.userId,actor.workspaceId);
      this.db.prepare('DELETE FROM api_tokens WHERE user_id=? AND workspace_id=?').run(actor.userId,actor.workspaceId);
      if(this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='oauth_refresh_tokens'").get())this.db.prepare('UPDATE oauth_refresh_tokens SET revoked_at=? WHERE user_id=? AND workspace_id=?').run(at,actor.userId,actor.workspaceId);
      return {workspaceId:next?.workspace_id||null};
    });
  }
  suspendWorkspaceMember(actor:Actor,id:string) {
    this.requireAdmin(actor);
    return this.repo.transaction(()=>{
      const membership=this.repo.raw('memberships',id);
      assert(membership&&membership.workspaceId===actor.workspaceId&&!membership.teamId,404,'Workspace member not found','NOT_FOUND');
      assert(membership.role!=='owner'||this.repo.all('memberships',actor.workspaceId).some(m=>!m.teamId&&m.id!==id&&['owner','admin'].includes(m.role)),422,'Assign another workspace administrator before suspending this member.','LAST_OWNER');
      const at=new Date().toISOString();this.repo.save('memberships',{...membership,suspendedAt:at,deletedAt:at,updatedAt:at,version:membership.version+1},'delete',actor);
      this.db.prepare('DELETE FROM sessions WHERE user_id=? AND workspace_id=?').run(membership.userId,actor.workspaceId);
      this.db.prepare('DELETE FROM api_tokens WHERE user_id=? AND workspace_id=?').run(membership.userId,actor.workspaceId);
      if(this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='oauth_refresh_tokens'").get())this.db.prepare('UPDATE oauth_refresh_tokens SET revoked_at=? WHERE user_id=? AND workspace_id=?').run(at,membership.userId,actor.workspaceId);
      return {id,suspendedAt:at};
    });
  }
  leftWorkspaceMembers(actor:Actor) {
    this.requireAdmin(actor);
    return this.repo.all('memberships',actor.workspaceId,true).filter(m=>!m.teamId&&m.deletedAt&&(m.leftAt||m.suspendedAt)&&this.repo.role(m.userId,actor.workspaceId)==='none').map(m=>({id:m.id,userId:m.userId,role:m.role,leftAt:m.leftAt,suspendedAt:m.suspendedAt,user:this.repo.raw('users',m.userId)}));
  }
  restoreWorkspaceMember(actor:Actor,id:string) {
    this.requireAdmin(actor);
    return this.repo.transaction(()=>{
      const membership=this.repo.raw('memberships',id,true);
      assert(membership&&membership.workspaceId===actor.workspaceId&&!membership.teamId&&membership.deletedAt&&(membership.leftAt||membership.suspendedAt),404,'Former workspace member not found','NOT_FOUND');
      assert(this.repo.role(membership.userId,actor.workspaceId)==='none',409,'This person already has workspace access','ALREADY_MEMBER');
      const restored={...membership,leftAt:null,suspendedAt:null,deletedAt:null,updatedAt:new Date().toISOString(),version:membership.version+1};
      this.repo.save('memberships',restored,'restore',actor);return restored;
    });
  }
  createWorkspace(userId:string,name:string){
    assert(typeof name==='string'&&name.trim().length>0&&name.length<=200,422,'Workspace name is required','VALIDATION_ERROR');return this.repo.transaction(()=>{const workspaceId=randomUUID(),at=new Date().toISOString(),actor:Actor={userId,workspaceId,role:'owner',scopes:['read','write','admin']};const base={workspaceId,createdAt:at,updatedAt:at,version:1,creatorId:userId};const workspace={...base,id:workspaceId,name:name.trim(),urlKey:workspaceId};this.repo.save('workspaces',workspace,'create',actor);this.repo.save('memberships',{...base,id:randomUUID(),userId,role:'owner'},'create',actor);const team=this.repo.create(actor,'teams',{name:'Engineering',initializeWorkflow:false,key:'ENG',color:'#5e6ad2',memberIds:[userId],triageEnabled:true});[['Triage','triage','#f2c94c'],['Backlog','backlog','#858699'],['Todo','unstarted','#d0d2e0'],['In Progress','started','#f2c94c'],['Done','completed','#5e6ad2'],['Canceled','canceled','#858699']].forEach(([name,type,color],position)=>this.repo.create(actor,'statuses',{name,type,color,teamId:team.id,position}));return {workspace,user:this.repo.raw('users',userId),workspaceId};});
  }
  async setup(fields:any) {
    validateEmail(fields.email);validatePassword(fields.password);const email=fields.email.trim().toLowerCase();const password=await hashPassword(fields.password);
    return this.repo.transaction(()=>{
      assert(!(this.db.prepare('SELECT id FROM accounts LIMIT 1').get()),409,'This server has already been configured','SETUP_COMPLETE');
      const userId=randomUUID(),workspaceId=randomUUID(),teamId=randomUUID(),at=new Date().toISOString();
      this.db.prepare('INSERT INTO accounts VALUES(?,?,?,?)').run(userId,email,password,at);
      const actor:Actor={userId,workspaceId,role:'owner',scopes:['read','write','admin']};
      const base={workspaceId,createdAt:at,updatedAt:at,version:1,creatorId:userId};
      const user={...base,id:userId,name:String(fields.name||email.split('@')[0]).slice(0,100),email,avatarColor:'#5e6ad2',preferences:{theme:'dark'}};
      this.repo.save('users',user,'create',actor);
      this.repo.save('workspaces',{...base,id:workspaceId,name:String(fields.workspaceName||'Workspace').slice(0,200),urlKey:'workspace'},'create',actor);
      this.repo.save('memberships',{...base,id:randomUUID(),userId,role:'owner'},'create',actor);
      this.repo.create(actor,'teams',{id:teamId,name:'Engineering',initializeWorkflow:false,key:'ENG',color:'#5e6ad2',icon:'layers',memberIds:[userId],cyclesEnabled:true,triageEnabled:true});
      const statuses=[['Triage','triage','#f2c94c'],['Backlog','backlog','#858699'],['Todo','unstarted','#d0d2e0'],['In Progress','started','#f2c94c'],['Done','completed','#5e6ad2'],['Canceled','canceled','#858699']];
      statuses.forEach(([name,type,color],position)=>this.repo.create(actor,'statuses',{name,type,color,teamId,position}));
      if(this.seedDemo){const todo=this.repo.all('statuses',workspaceId).find(s=>s.type==='unstarted')!;const project=this.repo.create(actor,'projects',{name:'Internal workspace',summary:'Shared planning and delivery',description:'',status:'planned',priority:0,teamIds:[teamId],leadId:userId,memberIds:[userId],fixture:true});for(const title of ['Define the next milestone','Collect requests from the team','Plan the next cycle'])this.repo.create(actor,'issues',{title,description:'',teamId,projectId:project.id,statusId:todo.id,priority:0,fixture:true});}
      return {user,workspaceId,token:this.session(userId,workspaceId)};
    });
  }
  async login(fields:any) {
    validateEmail(fields.email);assert(typeof fields.password==='string'&&fields.password.length<=1024,401,'Email or password is incorrect','INVALID_CREDENTIALS');
    const account=this.db.prepare('SELECT * FROM accounts WHERE email=?').get(fields.email.trim().toLowerCase()) as any;
    const fallback='7d5a93195da688263d274848b8ee5b6c9:92ef4d4ef4cf4f2fbf4905db58344d916ec1d5c5a8d76dc6b8fa83af2050c536a607b4141ccf75505a4b806c294ed4b3a09f7cafb9c7a1e62b91b37774336115';
    const valid=await verifyPassword(fields.password,account?.password||fallback);assert(account&&valid,401,'Email or password is incorrect','INVALID_CREDENTIALS');
    const row=this.db.prepare("SELECT workspace_id FROM entities WHERE kind='memberships' AND json_extract(data,'$.userId')=? AND json_extract(data,'$.teamId') IS NULL AND COALESCE(json_extract(data,'$.pendingInvitation'),0)=0 AND deleted_at IS NULL LIMIT 1").get(account.id) as any;assert(row,403,'Workspace access has been removed','FORBIDDEN');
    return {user:this.repo.raw('users',account.id),workspaceId:row.workspace_id,token:this.session(account.id,row.workspace_id)};
  }
  issueToken(actor:Actor,fields:any,appId?:string){
    const scopes=fields.scopes||['read'];assert(Array.isArray(scopes)&&scopes.length>0&&scopes.every((s:any)=>typeof s==='string'&&(['read','write','admin'].includes(s)||/^[a-zA-Z]+:(read|write)$/.test(s))),422,'Invalid token scopes','VALIDATION_ERROR');
    for(const scope of scopes){const [kind,access]=scope.split(':');const allowed=actor.scopes.includes('admin')||actor.scopes.includes(scope)||(scope==='read'&&actor.scopes.includes('write'))||(access&&this.repo.hasScope(actor,kind,access==='write'));assert(allowed,403,'Cannot grant a scope you do not possess','FORBIDDEN');if(scope==='admin')this.requireAdmin(actor);}
    if(fields.expiresAt)assert(Date.parse(fields.expiresAt)>Date.now(),422,'Expiration must be in the future','VALIDATION_ERROR');
    const id=randomUUID(),token=`flw_${secret()}`,createdAt=new Date().toISOString();const name=String(fields.name||'API key').slice(0,200);
    this.db.prepare('INSERT INTO api_tokens(id,hash,user_id,workspace_id,name,scopes,created_at,expires_at,app_id) VALUES(?,?,?,?,?,?,?,?,?)').run(id,hashToken(token),actor.userId,actor.workspaceId,name,JSON.stringify(scopes),createdAt,fields.expiresAt||null,appId||null);
    return {id,token,name,scopes,createdAt,expiresAt:fields.expiresAt||null};
  }
}
