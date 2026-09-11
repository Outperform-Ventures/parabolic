import {useSyncExternalStore} from 'react';
import {parseThemeColor} from '../theme-colors';
/** Public icon contrast uses LCH lightness with APCA's polarity-specific exponents. */
export function iconContrast(lightness:number,background:number){
 const clampBlack=(value:number)=>value>=.022?value:value+(.022-value)**1.414;
 const foreground=clampBlack(lightness/100),backdrop=clampBlack(background/100);
 if(Math.abs(foreground-backdrop)<.0005)return 0;
 const contrast=1.14*(backdrop>foreground?backdrop**.56-foreground**.57:backdrop**.65-foreground**.62);
 return Math.abs(contrast)<.1?0:Math.abs((contrast-Math.sign(contrast)*.027)*100);
}
export function adjustedEntityColor(color:string,background:string,light:boolean){
 try{
  const original=parseThemeColor(color),base=parseThemeColor(background),threshold=light?18:38;
  if(iconContrast(original[0],base[0])>threshold)return color;
  let low=0,high=100,chosen:number|undefined;
  while(high-low>1){const middle=(high+low)/2,sufficient=iconContrast(middle,base[0])>threshold;
   if(sufficient)chosen=middle;
   if((base[0]>middle)===sufficient)low=middle;else high=middle;
  }
  return chosen===undefined?color:`lch(${chosen}% ${original[1]} ${original[2]})`;
 }catch{return color;}
}
let snapshot='',observer:MutationObserver|undefined;
const listeners=new Set<()=>void>();
function readTheme(){if(typeof document==='undefined')return '';const style=getComputedStyle(document.documentElement);return JSON.stringify([style.getPropertyValue('--bg').trim()||'#111113',parseThemeColor(style.getPropertyValue('--bg').trim()||'#111113')[0]>50,...['yellow','purple','orange','green'].map(name=>style.getPropertyValue('--semantic-'+name).trim())]);}
function subscribe(listener:()=>void){listeners.add(listener);if(!observer&&typeof document!=='undefined'){snapshot=readTheme();observer=new MutationObserver(()=>{const next=readTheme();if(next!==snapshot){snapshot=next;for(const notify of listeners)notify();}});observer.observe(document.documentElement,{attributes:true,attributeFilter:['style','data-theme','class']});}return()=>{listeners.delete(listener);if(!listeners.size){observer?.disconnect();observer=undefined;}};}
export function useEntityColor(color:string){const theme=useSyncExternalStore(subscribe,()=>snapshot||(snapshot=readTheme()),()=> '');if(!theme)return color;const [background,light,yellow,purple,orange,green]=JSON.parse(theme),aliases:Record<string,string>={'#e8b600':yellow,'#f2c94c':yellow,'#5e6ad2':purple,'#fc7840':orange,'#0f783c':green};return aliases[color.toLowerCase()]||adjustedEntityColor(color,background,light);}
