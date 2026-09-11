import {useEffect,useState} from 'react';
import {semanticThemeColors} from '../theme-colors';
export type InsightTheme={colors:Record<string,string>;muted:string;empty:string};
export function defaultInsightTheme(light=false):InsightTheme{return{colors:semanticThemeColors(light),muted:light?'#5b5c5e':'#949597',empty:light?'#9c9c9e':'#949597'};}
function readTheme():InsightTheme{
 if(typeof document==='undefined')return defaultInsightTheme();
 const root=document.documentElement,style=getComputedStyle(root),light=root.dataset.theme==='custom'?style.getPropertyValue('--semantic-green').trim()==='#43bc58':style.colorScheme==='light',theme=defaultInsightTheme(light);
 if(root.dataset.theme==='custom')for(const key of Object.keys(theme.colors))theme.colors[key]=style.getPropertyValue(key).trim()||theme.colors[key];
 theme.muted=style.getPropertyValue('--muted').trim()||theme.muted;theme.empty=style.getPropertyValue(light?'--subtle':'--muted').trim()||theme.empty;return theme;
}
/** Canvas needs resolved colors; observe the same root theme tokens used by CSS and SVG. */
export function useInsightTheme(){const [theme,setTheme]=useState(readTheme);useEffect(()=>{const update=()=>setTheme(readTheme()),observer=new MutationObserver(update);observer.observe(document.documentElement,{attributes:true,attributeFilter:['style','data-theme']});update();return()=>observer.disconnect();},[]);return theme;}
