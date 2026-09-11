import {useEffect,useSyncExternalStore} from 'react';
import {FONT_SIZE_OPTIONS} from './font-scale';
export const localFontSizeKey='parabolic:font-size';
const eventName='parabolic-font-size';
let fallback:string|null=null;
const normalize=(value:unknown)=>FONT_SIZE_OPTIONS.find(option=>option.toLowerCase()===String(value||'').toLowerCase())||'Default';
function read(){try{return localStorage.getItem(localFontSizeKey)??fallback}catch{return fallback}}
export function setLocalFontSize(value:string){fallback=normalize(value);try{localStorage.setItem(localFontSizeKey,fallback)}catch{/* Text sizing remains usable without storage. */}window.dispatchEvent(new Event(eventName))}
function subscribe(listener:()=>void){const storage=(event:StorageEvent)=>{if(event.key===localFontSizeKey||event.key===null){fallback=null;listener()}};window.addEventListener(eventName,listener);window.addEventListener('storage',storage);return()=>{window.removeEventListener(eventName,listener);window.removeEventListener('storage',storage)}}
/** One-time migration preserves the old installation's size, then remains device-local. */
export function useLocalFontSize(legacy:unknown,ready=true){
 const value=useSyncExternalStore(subscribe,()=>read(),()=>null);
 useEffect(()=>{if(ready&&read()===null)setLocalFontSize(normalize(legacy))},[ready,legacy]);
 return normalize(value??legacy);
}
