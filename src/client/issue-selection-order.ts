/** Reorder the selected rows while preserving their relative order. */
export function reorderIssueSelection<T extends {id:string}>(items:T[], selected:ReadonlySet<string>, direction:string):T[] {
  if(direction==='top')return [...items.filter(i=>selected.has(i.id)),...items.filter(i=>!selected.has(i.id))];
  if(direction==='bottom')return [...items.filter(i=>!selected.has(i.id)),...items.filter(i=>selected.has(i.id))];
  const next=[...items];
  if(direction==='up')for(let i=1;i<next.length;i++){
    if(selected.has(next[i].id)&&!selected.has(next[i-1].id))[next[i-1],next[i]]=[next[i],next[i-1]];
  }
  if(direction==='down')for(let i=next.length-2;i>=0;i--){
    if(selected.has(next[i].id)&&!selected.has(next[i+1].id))[next[i],next[i+1]]=[next[i+1],next[i]];
  }
  return next;
}
/** Range selection follows visible order and ignores an anchor hidden by filters. */
export function issueSelectionRange(items:readonly {id:string}[], selected:readonly string[], anchor:string, target:string):string[] {
  const start=items.findIndex(item=>item.id===anchor),end=items.findIndex(item=>item.id===target);
  if(end<0)return [...selected];
  return [...new Set([...selected,...items.slice(start<0?end:Math.min(start,end),start<0?end+1:Math.max(start,end)+1).map(item=>item.id)])];
}
