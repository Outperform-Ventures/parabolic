import type{Entity}from'../shared/types';
export type RequestOrder='created'|'customer'|'revenue';
export function sortIssueRequests(requests:Entity[],customers:Entity[],order:RequestOrder,importantFirst:boolean,reversed=false){
 const byId=new Map(customers.filter(c=>!c.deletedAt).map(c=>[c.id,c]));
 return [...requests].sort((a,b)=>{if(importantFirst&&!!a.important!==!!b.important)return a.important?-1:1;let compared=0;if(order==='customer')compared=String(byId.get(a.customerId)?.name??'Unknown customer').localeCompare(String(byId.get(b.customerId)?.name??'Unknown customer'));else if(order==='revenue')compared=(Number(byId.get(b.customerId)?.revenue)||0)-(Number(byId.get(a.customerId)?.revenue)||0);else compared=Date.parse(b.createdAt)-Date.parse(a.createdAt);return compared*(reversed?-1:1)||Date.parse(b.createdAt)-Date.parse(a.createdAt)||a.id.localeCompare(b.id)});
}
