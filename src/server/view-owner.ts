import type {Actor,Repository,RecordEntity} from './repository';
import {assert} from './errors';
/** Ownership describes responsibility; it does not replace creator-based private access. */
export function normalizeViewOwner(repo:Repository,actor:Actor,view:RecordEntity,previous?:RecordEntity){
 if(view.ownerId===undefined)view.ownerId=view.creatorId||actor.userId;
 if(previous?.ownerId===view.ownerId)return;
 assert(typeof view.ownerId==='string'&&view.ownerId.length>0,422,'Choose a view owner','INVALID_VIEW_OWNER');
 const owner=repo.raw('users',view.ownerId),membership=repo.actorForUser(view.ownerId,actor.workspaceId);
 assert(owner&&!owner.deletedAt&&membership.role!=='none',422,'View owner must be a workspace member','INVALID_VIEW_OWNER');
}
