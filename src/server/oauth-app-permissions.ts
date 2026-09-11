import type {DatabaseSync} from 'node:sqlite';
import type {Actor,RecordEntity,Repository} from './repository.ts';

export function applicationIdentity(db:DatabaseSync,userId:string,appId:string|null):string|undefined{
  if(!appId||!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='oauth_app_installations'").get())return;
  const row=db.prepare('SELECT app_id FROM oauth_app_installations WHERE user_id=? AND app_id=?').get(userId,appId) as {app_id:string}|undefined;
  return row?.app_id;
}
/** Evaluate the current installation on every access, including existing SSE connections. */
export function oauthAppTeamAccess(repo:Repository,actor:Actor,team:RecordEntity):boolean|undefined{
  if(!actor.appId)return;
  const row=repo.db.prepare('SELECT o.all_public_teams,o.team_ids FROM oauth_app_options o JOIN oauth_apps a ON a.id=o.app_id JOIN oauth_app_installations i ON i.app_id=o.app_id WHERE a.id=? AND i.user_id=? AND i.workspace_id=?').get(actor.appId,actor.userId,actor.workspaceId) as {all_public_teams:number;team_ids:string}|undefined;
  if(!row)return false;
  const seen=new Set<string>();let current:RecordEntity|null=team,publicTeam=true;while(current){if(seen.has(current.id)||current.private||!(!current.visibility||current.visibility==='public')){publicTeam=false;break;}seen.add(current.id);if(!current.parentId)break;current=repo.raw('teams',current.parentId,true);if(!current)publicTeam=false;}
  return !!row.all_public_teams&&publicTeam||(JSON.parse(row.team_ids) as string[]).includes(team.id);
}
