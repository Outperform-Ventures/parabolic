export const customerSubscriptionEvents=[
 {id:'request-added',label:'A request is added'},
 {id:'request-important',label:'A request is marked as important'},
 {id:'request-completed',label:'A requested issue or project is completed or canceled'},
] as const;
export function customerSubscriptionMatches(events:unknown,request:Record<string,any>,previous?:Record<string,any>){
 if(!Array.isArray(events))return true;
 return events.includes('request-added')&&(!previous||request.customerId!==previous.customerId)||events.includes('request-important')&&request.important===true&&previous?.important!==true||events.includes('request-completed')&&['Completed','Canceled'].includes(request.status)&&request.status!==previous?.status;
}
