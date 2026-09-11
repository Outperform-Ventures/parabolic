import {randomUUID} from 'node:crypto';
import {assert} from './errors.ts';
import type {Actor,Repository,RecordEntity} from './repository.ts';

const defaults=['Enterprise','Growth','Startup','Individual'];
export function initializeWorkspaceTiers(repo:Repository,workspace:RecordEntity){
 if(repo.all('customerTiers',workspace.id,true).length)return;
 const names=[...new Set<string>([...(workspace.customerSettings?.tiers??defaults),...repo.all('customers',workspace.id,true).map(c=>c.tier).filter(Boolean)])];
 const actor:Actor={workspaceId:workspace.id,userId:'system',role:'owner',scopes:['admin'],system:true};
 for(const [position,name] of names.entries()){const at=workspace.createdAt;repo.save('customerTiers',{id:randomUUID(),workspaceId:workspace.id,name,displayName:name,color:'#858699',position:position+1,createdAt:at,updatedAt:at,version:1},'create',actor);}
 for(const customer of repo.all('customers',workspace.id,true)){if(!customer.tier||customer.tierId)continue;const tier=repo.all('customerTiers',workspace.id).find(t=>t.displayName===customer.tier);if(tier)repo.save('customers',{...customer,tierId:tier.id,version:customer.version+1},'update',actor);}
}
export function initializeCustomerTiers(repo:Repository){
 const name='customer-tier-entities-v1';if(repo.db.prepare('SELECT name FROM data_migrations WHERE name=?').get(name))return;
 repo.transaction(()=>{for(const workspace of repo.db.prepare("SELECT data FROM entities WHERE kind='workspaces' AND deleted_at IS NULL").all() as {data:string}[])initializeWorkspaceTiers(repo,JSON.parse(workspace.data));repo.db.prepare('INSERT INTO data_migrations VALUES(?,?)').run(name,new Date().toISOString());});
}
export function validateCustomerTier(repo:Repository,actor:Actor,tier:RecordEntity,previous?:RecordEntity){
 tier.name??=tier.displayName;tier.displayName??=tier.name;
 for(const field of ['name','displayName'])assert(typeof tier[field]==='string'&&tier[field].trim().length>0&&tier[field].length<=100,422,'Tier names must contain 1–100 characters','INVALID_CUSTOMER_TIER');
 tier.name=tier.name.trim();tier.displayName=tier.displayName.trim();
 assert(typeof tier.color==='string'&&/^#(?:[a-f0-9]{3}|[a-f0-9]{6}|[a-f0-9]{8})$/i.test(tier.color),422,'Tier color must be a HEX color','INVALID_CUSTOMER_TIER');
 assert(tier.description==null||typeof tier.description==='string'&&tier.description.length<=10000,422,'Invalid tier description','INVALID_CUSTOMER_TIER');
 const others=repo.all('customerTiers',actor.workspaceId).filter(t=>t.id!==tier.id);
 assert(!others.some(t=>t.name.toLowerCase()===tier.name.toLowerCase()),409,'A tier with this name already exists','CUSTOMER_TIER_EXISTS');
 const end=()=>Math.max(0,...others.map(t=>t.position))+1;
 if(tier.position==null)tier.position=end();
 assert(typeof tier.position==='number'&&Number.isFinite(tier.position),422,'Tier position must be a finite number','INVALID_CUSTOMER_TIER');
 if(others.some(t=>t.position===tier.position)){
  if(!previous)tier.position=end();
  else {const ordered=[tier,...others].sort((a,b)=>a.position-b.position);for(const [index,item] of ordered.entries()){const position=index+1;if(item.id===tier.id)tier.position=position;else if(item.position!==position)repo.save('customerTiers',{...item,position,version:item.version+1,updatedAt:tier.updatedAt},'update',actor);}}
 }
}
export function applyCustomerTier(repo:Repository,actor:Actor,customer:RecordEntity,previous:RecordEntity|undefined,provided:Record<string,any>){
 const textEdit=Object.hasOwn(provided,'tier')&&(!Object.hasOwn(provided,'tierId')||previous&&provided.tierId===previous.tierId&&provided.tier!==previous.tier);
 let tier:RecordEntity|null=null;
 if(textEdit){if(customer.tier){tier=repo.all('customerTiers',actor.workspaceId).find(t=>t.displayName.toLowerCase()===String(customer.tier).toLowerCase()||t.name.toLowerCase()===String(customer.tier).toLowerCase())??null;assert(tier,422,'Customer tier is not available','INVALID_CUSTOMER_TIER');}}
 else if(customer.tierId){tier=repo.raw('customerTiers',customer.tierId);assert(tier&&tier.workspaceId===actor.workspaceId,422,'Customer tier is not available','INVALID_CUSTOMER_TIER');}
 customer.tierId=tier?.id??null;customer.tier=tier?.displayName??'';
}
export function assertTierUnused(repo:Repository,actor:Actor,id:string){assert(!repo.all('customers',actor.workspaceId,true).some(c=>c.tierId===id),422,'This tier is still in use by a customer','CUSTOMER_TIER_IN_USE');}
export function synchronizeTierName(repo:Repository,actor:Actor,tier:RecordEntity,previous:RecordEntity){
 if(tier.displayName===previous.displayName)return;
 for(const customer of repo.all('customers',actor.workspaceId,true).filter(c=>c.tierId===tier.id))repo.save('customers',{...customer,tier:tier.displayName,updatedAt:tier.updatedAt,version:customer.version+1},'update',actor);
}
