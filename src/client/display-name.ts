import type {Entity} from '../shared/types';
type Preferences=Record<string,any>;
export function userDisplayName(user:Pick<Entity,'id'> & {name?:string;username?:string;email?:string}|null|undefined,preferences?:Preferences,empty='Unassigned'):string {
  if(!user)return empty;
  if(preferences?.displayNames==='Username'&&user.username?.trim())return user.username.trim();
  return user.name?.trim()||user.email||empty;
}
export function viewerPreferences(data:{user?:Entity|null;users:Entity[]}):Preferences{return data.users.find(user=>user.id===data.user?.id)?.preferences||data.user?.preferences||{}}
export function displayNameFor(user:Entity|null|undefined,data:{user?:Entity|null;users:Entity[]},empty='Unassigned'){return userDisplayName(user,viewerPreferences(data),empty)}

// Attribution belongs to the visible record; it never populates member choices.
export function attributedUser(data:{users:Entity[]},id:string|undefined,identity:any):Entity|undefined {
 const member=data.users.find(user=>user.id===id);if(member)return member;
 if(!id||identity?.kind!=='requester'||identity.id!==id||typeof identity.name!=='string')return undefined;
 return {id,name:identity.name,workspaceId:'',createdAt:'',updatedAt:'',version:0};
}

export function creatorChoices(data:{users:Entity[];issues:Entity[]}) {
 const choices=new Map(data.users.map(user=>[user.id,user])),members=new Set(choices.keys()),dates=new Map<string,string>();
 for(const issue of data.issues){if(issue.deletedAt||members.has(issue.creatorId))continue;const person=attributedUser({users:[]},issue.creatorId,issue.creatorIdentity);if(person&&(!dates.has(person.id)||issue.createdAt>dates.get(person.id)!)){choices.set(person.id,person);dates.set(person.id,issue.createdAt)}}
 return [...choices.values()];
}
