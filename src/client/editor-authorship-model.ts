import * as Y from 'yjs';
import type {AuthorshipRange} from '../shared/collaboration';

/** Reads ownership by immutable structs, including visible inline atoms. */
export function createAuthorshipReader(authorship:readonly AuthorshipRange[]){
 const ranges=new Map<number,AuthorshipRange[]>();
 for(const range of authorship){const values=ranges.get(range.client);if(values)values.push(range);else ranges.set(range.client,[range])}
 for(const values of ranges.values())values.sort((a,b)=>a.clock-b.clock);
 const itemOwners=(item:Y.Item,found:Set<string|null>)=>{
  if(item.deleted||!item.countable)return;
  const end=item.id.clock+item.length,values=ranges.get(item.id.client)||[];let cursor=item.id.clock,low=0,high=values.length;
  while(low<high){const middle=(low+high)>>>1;if(values[middle].clock+values[middle].length<=cursor)low=middle+1;else high=middle}
  for(let i=low;i<values.length;i++){const range=values[i];if(range.clock>=end)break;if(range.clock>cursor)found.add(null);found.add(range.userId);cursor=Math.max(cursor,range.clock+range.length)}
  if(cursor<end)found.add(null);
 };
 const owners=(element:Y.XmlElement):Array<string|null>=>{
  const found=new Set<string|null>();
  for(const child of element.toArray()){
   if(child instanceof Y.XmlText){for(let item=child._start;item;item=item.right)itemOwners(item,found)}
   else if(child instanceof Y.XmlElement){
    if(['mention','dateMention','customEmoji'].includes(child.nodeName)&&child._item)itemOwners(child._item,found);
    else for(const id of owners(child))found.add(id);
   }
  }
  return [...found];
 };
 return owners;
}

export type AuthorLabel={position:number;top:number;authors:Array<string|null>};
/** A single gutter cannot place independent labels on the same table row. */
export function combineAuthorLabels(labels:AuthorLabel[],lineHeight:number):AuthorLabel[]{
 const result:AuthorLabel[]=[];
 for(const label of [...labels].sort((a,b)=>a.top-b.top||a.position-b.position)){
  const previous=result.at(-1);
  if(previous&&label.top<previous.top+lineHeight)previous.authors=[...new Set([...previous.authors,...label.authors])];
  else result.push({...label,authors:[...label.authors]});
 }
 return result;
}
