import { randomUUID, timingSafeEqual } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { Auth, hashToken, secret } from './auth.ts';
import { assert } from './errors.ts';
import type { Actor, Repository } from './repository.ts';
import {applicationIdentity} from './oauth-app-permissions.ts';

export interface OAuthClientRecord { id: string; name: string; secret_hash: string; scopes: string; publicClient?:boolean }
interface RefreshRecord { hash:string; family_id:string; app_id:string; user_id:string; workspace_id:string; scopes:string; expires_at:string; absolute_expires_at:string; consumed_at:string|null; revoked_at:string|null; access_token_id:string; require_secret:number; resource:string|null }
export const OAUTH_ACCESS_SECONDS = 3600;
const REFRESH_IDLE_MS = 30 * 86400000;
const REFRESH_ABSOLUTE_MS = 90 * 86400000;

/** Opaque refresh tokens are stored only as hashes. A reused token revokes its entire grant. */
export class OAuthRefresh {
  constructor(readonly db:DatabaseSync, readonly auth:Auth, readonly repo:Repository) {
    db.exec(`CREATE TABLE IF NOT EXISTS oauth_refresh_tokens(
      hash TEXT PRIMARY KEY,family_id TEXT NOT NULL,app_id TEXT NOT NULL,user_id TEXT NOT NULL,workspace_id TEXT NOT NULL,
      scopes TEXT NOT NULL,created_at TEXT NOT NULL,expires_at TEXT NOT NULL,absolute_expires_at TEXT NOT NULL,
      consumed_at TEXT,revoked_at TEXT,access_token_id TEXT NOT NULL,require_secret INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS oauth_refresh_family ON oauth_refresh_tokens(family_id);
      CREATE INDEX IF NOT EXISTS oauth_refresh_app ON oauth_refresh_tokens(app_id);`);
    if(!db.prepare("PRAGMA table_info(oauth_refresh_tokens)").all().some(column=>column.name==='resource'))db.exec("ALTER TABLE oauth_refresh_tokens ADD COLUMN resource TEXT");
  }
  authenticate(client:OAuthClientRecord, clientSecret:unknown, required:boolean) {
    if ((!required||client.publicClient) && clientSecret === undefined) return;
    const actual=Buffer.from(hashToken(typeof clientSecret==='string'?clientSecret:''),'hex'),expected=Buffer.from(client.secret_hash,'hex');
    assert(actual.length===expected.length&&timingSafeEqual(actual,expected),401,'Invalid client credentials','INVALID_CLIENT');
  }
  issue(actor:Actor, client:OAuthClientRecord, requireSecret:boolean, familyId:string=randomUUID(), absoluteExpiresAt=new Date(Date.now()+REFRESH_ABSOLUTE_MS).toISOString(),resource?:string) {
    const at=new Date().toISOString(), expiresAt=new Date(Math.min(Date.now()+REFRESH_IDLE_MS,Date.parse(absoluteExpiresAt))).toISOString();
    const access=this.auth.issueToken(actor,{name:client.name,scopes:actor.scopes,expiresAt:new Date(Date.now()+OAUTH_ACCESS_SECONDS*1000).toISOString()},client.id);
    const refresh=`flwr_${secret()}`;
    this.db.prepare('INSERT INTO oauth_refresh_tokens(hash,family_id,app_id,user_id,workspace_id,scopes,created_at,expires_at,absolute_expires_at,access_token_id,require_secret,resource) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(hashToken(refresh),familyId,client.id,actor.userId,actor.workspaceId,JSON.stringify(actor.scopes),at,expiresAt,absoluteExpiresAt,access.id,requireSecret?1:0,resource??null);
    if(resource)this.db.prepare('INSERT INTO oauth_access_resources(token_id,resource) VALUES(?,?)').run(access.id,resource);
    return {access_token:access.token,token_type:'Bearer' as const,expires_in:OAUTH_ACCESS_SECONDS,refresh_token:refresh,refresh_token_expires_in:Math.floor((Date.parse(expiresAt)-Date.now())/1000),scope:actor.scopes.join(' ')};
  }
  revokeFamily(familyId:string) {
    this.repo.transaction(()=>{
      this.db.prepare('DELETE FROM api_tokens WHERE id IN (SELECT access_token_id FROM oauth_refresh_tokens WHERE family_id=?)').run(familyId);
      this.db.prepare('UPDATE oauth_refresh_tokens SET revoked_at=COALESCE(revoked_at,?) WHERE family_id=?').run(new Date().toISOString(),familyId);
    });
  }
  rotate(fields:Record<string,unknown>, client:OAuthClientRecord) {
    const row=this.db.prepare('SELECT * FROM oauth_refresh_tokens WHERE hash=? AND app_id=?').get(hashToken(String(fields.refresh_token??'')),client.id) as unknown as RefreshRecord|undefined;
    // Authentication precedes reuse detection, so an unrelated client cannot revoke a grant.
    this.authenticate(client,fields.client_secret,row?!!row.require_secret:true);
    assert(row,400,'Refresh token is invalid or expired','INVALID_GRANT');
    const active=this.db.prepare('SELECT id FROM api_tokens WHERE id=? AND app_id=?').get(row.access_token_id,client.id);
    const allowed=JSON.parse(client.scopes) as string[], priorScopes=JSON.parse(row.scopes) as string[];
    const role=this.repo.role(row.user_id,row.workspace_id);
    if(row.consumed_at||row.revoked_at||row.expires_at<=new Date().toISOString()||row.absolute_expires_at<=new Date().toISOString()||!active||role==='none'||!priorScopes.every(scope=>allowed.includes(scope))){
      // Commit revocation separately; throwing inside the transaction would roll it back.
      this.revokeFamily(row.family_id);
      assert(false,400,'Refresh token is invalid or expired; authorize the application again','INVALID_GRANT');
    }
    assert(row.resource?fields.resource===row.resource:fields.resource===undefined,400,'Resource does not match the refresh grant','INVALID_TARGET');
    const scopes=fields.scope===undefined?priorScopes:String(fields.scope).split(/[ ,]+/).filter(Boolean);
    assert(scopes.length>0&&scopes.every(scope=>priorScopes.includes(scope)),400,'Refresh cannot increase the authorized scopes','INVALID_SCOPE');
    const appId=applicationIdentity(this.db,row.user_id,client.id);
    const actor:Actor={userId:row.user_id,workspaceId:row.workspace_id,role:appId?'member':role,scopes,...(appId?{appId}:{})};
    return this.repo.transaction(()=>{
      this.db.prepare('UPDATE oauth_refresh_tokens SET consumed_at=? WHERE hash=?').run(new Date().toISOString(),row.hash);
      this.db.prepare('DELETE FROM api_tokens WHERE id=?').run(row.access_token_id);
      return this.issue(actor,client,!!row.require_secret,row.family_id,row.absolute_expires_at,row.resource??undefined);
    });
  }
  revoke(fields:Record<string,unknown>, client:OAuthClientRecord) {
    const tokenHash=hashToken(String(fields.token??''));
    let row=this.db.prepare('SELECT * FROM oauth_refresh_tokens WHERE hash=? AND app_id=?').get(tokenHash,client.id) as unknown as RefreshRecord|undefined;
    const access=this.db.prepare('SELECT id FROM api_tokens WHERE hash=? AND app_id=?').get(tokenHash,client.id) as {id:string}|undefined;
    if(!row&&access)row=this.db.prepare('SELECT * FROM oauth_refresh_tokens WHERE access_token_id=? AND app_id=?').get(access.id,client.id) as unknown as RefreshRecord|undefined;
    this.authenticate(client,fields.client_secret,row?!!row.require_secret:true);
    if(row)this.revokeFamily(row.family_id);
    else if(access)this.db.prepare('DELETE FROM api_tokens WHERE id=?').run(access.id);
    // Unknown tokens intentionally return success without revealing whether they exist.
  }
}
