import {useMemo,useRef,useState,type CSSProperties} from 'react';
import {useVirtualizer} from '@tanstack/react-virtual';
import {useAppStore} from '../store';
import {emojiCatalog as catalog,type EmojiEntry} from './emoji-data';
import colors from './reaction-emoji-colors.json';
import categories from './reaction-emoji-categories.json';
import './reaction-emoji.css';

const reactionIds=new Set(categories.flatMap(category=>category.emojis));
const searchAliases=Object.entries(catalog.aliases).reduce<Record<string,string[]>>((result,[alias,id])=>{(result[id]??=[]).push(alias);return result;},{});
const defaults=['+1','ok_hand','pray','joy','heart','eyes','white_check_mark','slightly_smiling_face','smiley','smile','grinning','thinking_face','sweat_smile','warning','confused','x','raised_hands','tada'];
const names:Record<string,string>={frequent:'Frequently used',people:'Smileys & People',nature:'Animals & Nature',foods:'Food & Drink',activity:'Activity',places:'Travel & Places',objects:'Objects',symbols:'Symbols',flags:'Flags',custom:'Custom',results:'Search results'};

export default function ReactionEmoji({onSelect}:{onSelect:(emoji:string)=>Promise<unknown>}){
 const {data,user}=useAppStore(),key=`parabolic:emojis:${data.workspaceId}:${user?.id}`;
 const custom=data.workspaces.find(w=>w.id===data.workspaceId)?.customEmojis;
 const entries=useMemo<Record<string,EmojiEntry>>(()=>({...catalog.emojis,...Object.fromEntries((custom??[]).filter((e:any)=>!e.deletedAt).map((e:any)=>[`custom:${e.id}`,{id:`custom:${e.id}`,name:e.name,keywords:[e.name,'custom'],skins:[{native:`custom:${e.id}`}],url:e.url}]))}),[custom]);
 const [query,setQuery]=useState(''),[active,setActive]=useState(-1),[busy,setBusy]=useState(false),[skin]=useState(()=>Number(localStorage.getItem(key+':skin')||0));
 const [frequent,setFrequent]=useState<string[]>(()=>{try{const saved=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(saved)?saved.filter(id=>typeof id==='string'):[];}catch{return [];}});
 const input=useRef<HTMLInputElement>(null),scroll=useRef<HTMLDivElement>(null),pending=useRef(false);
 const groups=useMemo(()=>{
  const needle=query.trim().toLowerCase();
  if(needle){
   const found=Object.values(entries).filter(e=>(reactionIds.has(e.id)||e.id.startsWith('custom:'))&&[e.id,...e.keywords,...(searchAliases[e.id]??[])].some(value=>value.toLowerCase().includes(needle)));
   const rank=(e:EmojiEntry)=>e.id===needle||catalog.aliases[needle]===e.id?0:e.id.startsWith(needle)?1:2;
   found.sort((a,b)=>rank(a)-rank(b)||(a.id<b.id?-1:a.id>b.id?1:0));
   return found.length?[{id:'results',emojis:found.map(e=>e.id)}]:[];
  }
  return [{id:'frequent',emojis:[...new Set([...frequent,...defaults])].filter(id=>entries[id]).slice(0,18)},...categories,{id:'custom',emojis:Object.keys(entries).filter(id=>id.startsWith('custom:'))}].filter(g=>g.emojis.length);
 },[query,entries,frequent]);
 const rows=useMemo(()=>groups.flatMap(group=>[{heading:group.id,ids:[] as string[]},...Array.from({length:Math.ceil(group.emojis.length/9)},(_,i)=>({heading:'',ids:group.emojis.slice(i*9,i*9+9)}))]),[groups]);
 const flat=useMemo(()=>rows.flatMap((row,rowIndex)=>row.ids.map(id=>({id,rowIndex}))),[rows]);
 const indices=useMemo(()=>new Map(flat.map((item,index)=>[`${item.rowIndex}:${item.id}`,index])),[flat]);
 const selected=active<0?-1:Math.min(active,flat.length-1);
 const list=useVirtualizer({count:rows.length,getScrollElement:()=>scroll.current,estimateSize:()=>28,overscan:3});
 const focus=(index:number)=>{
  const next=Math.max(0,Math.min(flat.length-1,index));if(!flat[next])return;
  setActive(next);list.scrollToIndex(flat[next].rowIndex,{align:'auto'});
 };
 const select=async(id:string)=>{
  if(pending.current)return;pending.current=true;setBusy(true);
  try{
   const emoji=entries[id];
   const result=await onSelect(emoji.skins[skin]?.native||emoji.skins[0].native);
   if(result!==false&&result!==null){const next=[id,...frequent.filter(e=>e!==id)].slice(0,32);setFrequent(next);localStorage.setItem(key,JSON.stringify(next));}
  }finally{pending.current=false;setBusy(false);}
 };
 const changeQuery=(value:string)=>{setQuery(value);scroll.current?.scrollTo({top:0});};
 return <div className="reaction-emoji-picker">
  <div className="reaction-emoji-search"><div>
   <input ref={input} autoFocus aria-label="Search emoji" placeholder="Search emoji…" value={query} onChange={e=>changeQuery(e.target.value)} onKeyDown={e=>{
    if(e.key==='ArrowDown'||selected>=0&&['ArrowUp','ArrowLeft','ArrowRight'].includes(e.key)){
     e.preventDefault();focus(selected<0?0:selected+({ArrowDown:9,ArrowUp:-9,ArrowLeft:-1,ArrowRight:1}[e.key]??0));
    }else if(e.key==='Enter'){e.preventDefault();const target=flat[selected<0?0:selected];if(target)void select(target.id);}
   }}/>
   {query&&<button className="reaction-emoji-clear" aria-label="Clear emoji search" onMouseDown={e=>e.preventDefault()} onClick={()=>{changeQuery('');input.current?.focus();}}><svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.96967 2.96967C3.26256 2.67678 3.73744 2.67678 4.03033 2.96967L8 6.939L11.9697 2.96967C12.2626 2.67678 12.7374 2.67678 13.0303 2.96967C13.3232 3.26256 13.3232 3.73744 13.0303 4.03033L9.061 8L13.0303 11.9697C13.2966 12.2359 13.3208 12.6526 13.1029 12.9462L13.0303 13.0303C12.7374 13.3232 12.2626 13.3232 11.9697 13.0303L8 9.061L4.03033 13.0303C3.73744 13.3232 3.26256 13.3232 2.96967 13.0303C2.67678 12.7374 2.67678 12.2626 2.96967 11.9697L6.939 8L2.96967 4.03033C2.7034 3.76406 2.6792 3.3474 2.89705 3.05379L2.96967 2.96967Z" fill="currentColor"/></svg></button>}
  </div></div>
  <div className="reaction-emoji-scroll" ref={scroll} role="group" aria-label="Emoji grid" style={{height:Math.min(283,rows.length?rows.length*28+8:36)}}>
   <div style={{height:list.getTotalSize(),position:'relative'}}>
    {list.getVirtualItems().map(item=>{const row=rows[item.index];return <div key={item.key} className={row.heading?'reaction-emoji-heading':'reaction-emoji-row'} style={{position:'absolute',top:item.start,width:'100%',height:28}}>
     {row.heading?names[row.heading]??row.heading:row.ids.map(id=>{const index=indices.get(`${item.index}:${id}`)!,emoji=entries[id],highlight=(colors as Record<string,string>)[id];return <button key={id} type="button" tabIndex={-1} disabled={busy} aria-label={id.startsWith('custom:')?emoji.name:id} title={`:${id.startsWith('custom:')?emoji.name:id}:`} data-emoji={id} className={selected===index?'active':''} style={highlight?{'--emoji-highlight':highlight} as CSSProperties:undefined} onMouseDown={e=>e.preventDefault()} onMouseEnter={()=>setActive(index)} onClick={()=>void select(id)}>
      {emoji.url?<img className="reaction-emoji-glyph" src={emoji.url} alt=""/>:<span className="reaction-emoji-glyph">{emoji.skins[skin]?.native||emoji.skins[0].native}</span>}
     </button>;})}
    </div>;})}
   </div>
   {!rows.length&&<div className="reaction-emoji-empty">No results found</div>}
  </div>
 </div>;
}
