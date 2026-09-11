import {assert,HttpError} from './errors.ts';
import type {Actor} from './repository.ts';
export interface PaginationOptions{first?:number;last?:number;after?:string;before?:string}
export function pagination(options:PaginationOptions){
  assert(options.first==null||options.last==null,400,'Use either first or last','INVALID_PAGINATION');
  assert(!options.after||!options.before,400,'Use either after or before','INVALID_PAGINATION');
  for(const value of [options.first,options.last])if(value!=null)assert(Number.isSafeInteger(value)&&value>=0,400,'Page size must be a nonnegative integer','INVALID_PAGINATION');
  return {size:Math.min(options.first??options.last??50,500),backward:options.last!=null||!!options.before&&options.first==null};
}
export function cursorId(actor:Actor,kind:string,value:string){let cursor:any;try{cursor=JSON.parse(Buffer.from(value,'base64url').toString());}catch{throw new HttpError(400,'Invalid cursor','INVALID_CURSOR');}assert(cursor&&cursor.kind===kind&&cursor.workspaceId===actor.workspaceId&&typeof cursor.id==='string',400,'Cursor belongs to a different collection','INVALID_CURSOR');return cursor.id as string;}
