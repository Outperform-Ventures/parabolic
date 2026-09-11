import type {Entity} from '../shared/types';

export function memberJoinedLabel(user:Entity,membership:Entity|undefined):string|undefined{
 if(typeof user.joinedDisplay==='string'&&user.joinedDisplay.trim())return user.joinedDisplay.trim();
 const value=user.joinedAt??(membership?.sourceTransfer?.timestampsObserved===false?undefined:membership?.createdAt);
 if(!value||!Number.isFinite(Date.parse(value)))return undefined;
 return new Date(value).toLocaleDateString();
}
