import {parseInsightContext} from './insight-context';
import type {FilterSpec} from './query';
/** Apply the same bounded, property-safe condition grammar used by shared insight links. */
export function parseRouteFilter(serialized:string|null):FilterSpec|null{
 if(!serialized||serialized.length>65536)return null;
 try{return parseInsightContext(JSON.stringify({filter:JSON.parse(serialized)}))?.filter??null}catch{return null}
}
