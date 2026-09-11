import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DatabaseSync } from 'node:sqlite';
import { COLLECTIONS } from '../../packages/sdk/src/types.ts';
import { createMcpHttpHandler, type McpClient } from '../mcp/server.ts';
import { Auth, hashToken, secret } from './auth.ts';
import { assert, HttpError } from './errors.ts';
import type { Actor, Repository } from './repository.ts';
import { searchEntities } from './search.ts';

const SCOPES=['read','write',...COLLECTIONS.flatMap(kind=>[`${kind}:read`,`${kind}:write`])];
const json=(res:ServerResponse,status:number,value?:unknown)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(value===undefined?undefined:JSON.stringify(value));};
const validUrl=(value:unknown)=>{try{const url=new URL(String(value));return (url.protocol==='https:'||(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))&&!url.username&&!url.password&&!url.hash?url:null;}catch{return null;}};

/** OAuth's resource server executes against the repository; incoming tokens never go to REST. */
export class McpOAuth {
  private registrations=new Map<string,{count:number;reset:number}>();
  constructor(readonly db:DatabaseSync,readonly auth:Auth,readonly repo:Repository,readonly origin:()=>string,readonly allowedOrigins:string[]=[]){
    db.exec(`CREATE TABLE IF NOT EXISTS oauth_public_clients(client_id TEXT PRIMARY KEY REFERENCES oauth_apps(id) ON DELETE CASCADE,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS oauth_code_resources(code_hash TEXT PRIMARY KEY REFERENCES oauth_codes(hash) ON DELETE CASCADE,resource TEXT NOT NULL);`);
  }
  resource(){return `${this.origin().replace(/\/$/,'')}/mcp`;}
  isPublic(clientId:string){return !!this.db.prepare('SELECT client_id FROM oauth_public_clients WHERE client_id=?').get(clientId);}
  validateAuthorization(fields:Record<string,any>,clientId:string){
    const isPublic=this.isPublic(clientId),resource=fields.resource;
    if(resource!==undefined||isPublic){
      assert(typeof resource==='string'&&validUrl(resource)?.href===this.resource(),400,'The resource must identify this workspace MCP endpoint','INVALID_TARGET');
      assert(fields.response_type==='code'&&fields.code_challenge_method==='S256'&&typeof fields.code_challenge==='string'&&/^[A-Za-z0-9_-]{43}$/.test(fields.code_challenge),400,'MCP authorization requires an S256 PKCE challenge','INVALID_REQUEST');
    }
    return resource===undefined?undefined:this.resource();
  }
  bindCode(code:string,resource?:string){if(resource)this.db.prepare('INSERT INTO oauth_code_resources(code_hash,resource) VALUES(?,?)').run(hashToken(code),resource);}
  codeResource(codeHash:string,fields:Record<string,unknown>){
    const row=this.db.prepare('SELECT resource FROM oauth_code_resources WHERE code_hash=?').get(codeHash) as {resource:string}|undefined;
    assert(row?typeof fields.resource==='string'&&validUrl(fields.resource)?.href===row.resource:fields.resource===undefined,400,'Resource does not match the authorization grant','INVALID_TARGET');
    return row?.resource;
  }
  private client(actor:Actor):McpClient {
    return {
      collection:kind=>({get:async id=>this.repo.present(actor,kind,this.repo.get(actor,kind,id)),list:async options=>this.repo.list(actor,kind,options),create:async fields=>this.repo.present(actor,kind,this.repo.create(actor,kind,fields)),update:async(id,fields)=>this.repo.present(actor,kind,this.repo.update(actor,kind,id,fields)),remove:async id=>this.repo.present(actor,kind,this.repo.remove(actor,kind,id)),restore:async id=>this.repo.present(actor,kind,this.repo.restore(actor,kind,id))}),
      search:async(query,options)=>searchEntities(this.repo,actor,query,options),
    };
  }
  private async register(req:IncomingMessage,res:ServerResponse){
    const address=req.socket.remoteAddress??'unknown',now=Date.now();let window=this.registrations.get(address);
    if(!window||window.reset<now){window={count:0,reset:now+3600000};this.registrations.set(address,window);}window.count++;
    if(this.registrations.size>10000)for(const[key,value]of this.registrations)if(value.reset<now)this.registrations.delete(key);
    if(window.count>20){res.setHeader('Retry-After',Math.ceil((window.reset-now)/1000));return json(res,429,{error:'slow_down',error_description:'Client registration rate limit reached'});}
    assert(req.headers['content-type']?.includes('application/json'),415,'Registration requires application/json','INVALID_CLIENT_METADATA');
    let size=0;const chunks:Buffer[]=[];for await(const chunk of req){size+=chunk.length;assert(size<=32768,413,'Client metadata is too large','INVALID_CLIENT_METADATA');chunks.push(Buffer.from(chunk));}
    let fields:any;try{fields=JSON.parse(Buffer.concat(chunks).toString());}catch{throw new HttpError(400,'Invalid registration JSON','INVALID_CLIENT_METADATA');}
    assert(fields&&typeof fields==='object'&&!Array.isArray(fields),400,'Client metadata must be an object','INVALID_CLIENT_METADATA');
    assert(typeof fields.client_name==='string'&&fields.client_name.trim().length>0&&fields.client_name.length<=200,400,'A client name is required','INVALID_CLIENT_METADATA');
    assert(Array.isArray(fields.redirect_uris)&&fields.redirect_uris.length>0&&fields.redirect_uris.length<=20&&fields.redirect_uris.every((uri:unknown)=>typeof uri==='string'&&validUrl(uri)),400,'Register exact HTTPS or loopback redirect URIs without fragments','INVALID_REDIRECT_URI');
    assert(fields.token_endpoint_auth_method===undefined||fields.token_endpoint_auth_method==='none',400,'Dynamically registered clients use PKCE without client secrets','INVALID_CLIENT_METADATA');
    assert(fields.grant_types===undefined||(Array.isArray(fields.grant_types)&&fields.grant_types.includes('authorization_code')&&fields.grant_types.every((grant:unknown)=>['authorization_code','refresh_token'].includes(String(grant)))),400,'Only authorization code and refresh token grants are supported','INVALID_CLIENT_METADATA');
    assert(fields.response_types===undefined||(Array.isArray(fields.response_types)&&fields.response_types.length===1&&fields.response_types[0]==='code'),400,'Only code responses are supported','INVALID_CLIENT_METADATA');
    const scopes=fields.scope===undefined?SCOPES:typeof fields.scope==='string'?fields.scope.split(/\s+/).filter(Boolean):[];
    assert(scopes.length>0&&scopes.every((scope:string)=>SCOPES.includes(scope)),400,'Unsupported client scopes','INVALID_CLIENT_METADATA');
    const id=randomUUID(),at=new Date().toISOString();
    this.repo.transaction(()=>{
      this.db.prepare('INSERT INTO oauth_apps(id,workspace_id,creator_id,name,secret_hash,redirect_uris,scopes,created_at) VALUES(?,?,?,?,?,?,?,?)').run(id,'*','dynamic',fields.client_name.trim(),hashToken(secret()),JSON.stringify([...new Set(fields.redirect_uris)]),JSON.stringify(scopes),at);
      this.db.prepare('INSERT INTO oauth_public_clients(client_id,created_at) VALUES(?,?)').run(id,at);
    });
    return json(res,201,{client_id:id,client_id_issued_at:Math.floor(now/1000),client_name:fields.client_name.trim(),redirect_uris:fields.redirect_uris,token_endpoint_auth_method:'none',grant_types:['authorization_code','refresh_token'],response_types:['code'],scope:scopes.join(' ')});
  }
  async handle(req:IncomingMessage,res:ServerResponse,path:string):Promise<boolean>{
    if(path==='/mcp'){
      await createMcpHttpHandler({resource:()=>this.resource(),authorizationServer:this.origin,allowedOrigins:this.allowedOrigins,resolveCredential:request=>{
        const actor=this.auth.resolve(request,{resource:this.resource()});if(!actor?.tokenId)return null;
        const token=this.db.prepare('SELECT app_id FROM api_tokens WHERE id=?').get(actor.tokenId) as {app_id:string|null};
        const audience=this.db.prepare('SELECT resource FROM oauth_access_resources WHERE token_id=?').get(actor.tokenId) as {resource:string}|undefined;
        if(token.app_id&&audience?.resource!==this.resource())return null;
        return {client:this.client(actor),scopes:actor.scopes};
      }})(req,res);return true;
    }
    if(path==='/oauth/mcp-credential'&&req.method==='GET'){
      const actor=this.auth.resolve(req),row=actor?.tokenId?this.db.prepare('SELECT app_id FROM api_tokens WHERE id=?').get(actor.tokenId) as {app_id:string|null}:null;
      json(res,200,{active:!!row&&!row.app_id,scopes:row&&!row.app_id?actor!.scopes:[]});return true;
    }
    if(['/oauth/token','/oauth/revoke'].includes(path)){res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');if(req.method==='OPTIONS'){json(res,204);return true;}return false;}
    const discovery=['/.well-known/oauth-protected-resource','/.well-known/oauth-protected-resource/mcp','/.well-known/oauth-authorization-server'].includes(path);
    const registration=path==='/oauth/register';
    if(!discovery&&!registration)return false;
    res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Methods',registration?'POST, OPTIONS':'GET, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');
    if(req.method==='OPTIONS'){json(res,204);return true;}
    try{
      if(registration){assert(req.method==='POST',405,'Use POST for client registration','INVALID_REQUEST');await this.register(req,res);return true;}
      assert(req.method==='GET',405,'Use GET for discovery','INVALID_REQUEST');
      if(path==='/.well-known/oauth-authorization-server')json(res,200,{issuer:this.origin(),authorization_endpoint:`${this.origin()}/oauth/authorize`,token_endpoint:`${this.origin()}/oauth/token`,revocation_endpoint:`${this.origin()}/oauth/revoke`,registration_endpoint:`${this.origin()}/oauth/register`,response_types_supported:['code'],grant_types_supported:['authorization_code','refresh_token','client_credentials'],token_endpoint_auth_methods_supported:['none','client_secret_basic','client_secret_post'],code_challenge_methods_supported:['S256'],scopes_supported:SCOPES});
      else json(res,200,{resource:this.resource(),resource_name:'Parabolic workspace MCP',authorization_servers:[this.origin()],scopes_supported:SCOPES,bearer_methods_supported:['header']});
    }catch(failure){if(!(failure instanceof HttpError))throw failure;json(res,failure.status,{error:failure.code.toLowerCase(),error_description:failure.message});}
    return true;
  }
}
