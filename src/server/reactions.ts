import {assert} from './errors.ts';
import type {Actor,RecordEntity,Repository} from './repository.ts';
import {validateOwnReactions} from './updates.ts';

function normalized(value:any){if(!Array.isArray(value))return value;assert(value.length<=10000,422,'Too many reactions','INVALID_REACTIONS');const entries=new Map<string,Set<string>>();for(const reaction of value){assert(reaction&&typeof reaction.emoji==='string'&&typeof reaction.userId==='string',422,'Invalid legacy reaction','INVALID_REACTIONS');const users=entries.get(reaction.emoji)||new Set<string>();users.add(reaction.userId);entries.set(reaction.emoji,users);}return Object.fromEntries([...entries].map(([key,users])=>[key,[...users]]));}

/** Reaction identity is server checked, including workspace custom emoji grants. */
export function validateReactions(repo:Repository,actor:Actor,entity:RecordEntity,previous?:RecordEntity){
  if(entity.reactions===undefined)return;
  entity.reactions=normalized(entity.reactions);if(previous)previous={...previous,reactions:normalized(previous.reactions)};
  if(entity.reactions&&typeof entity.reactions==='object')for(const key of Object.keys(entity.reactions))assert(!['__proto__','prototype','constructor','toString','valueOf'].includes(key)&&!/[\u0000-\u001f\u007f]/.test(key),422,'Invalid reaction identity','INVALID_REACTIONS');
  validateOwnReactions(actor,entity,previous);
  for(const [key,users]of Object.entries(entity.reactions) as [string,string[]][]){
    if(!key.startsWith('custom:'))continue;
    const id=key.slice(7),custom=repo.raw('workspaces',actor.workspaceId)?.customEmojis?.find((emoji:any)=>emoji.id===id);
    const added=users.some(userId=>!previous?.reactions?.[key]?.includes(userId));
    assert(!added||custom&&!custom.deletedAt,422,'This custom emoji is no longer available','INVALID_CUSTOM_EMOJI');
  }
}
