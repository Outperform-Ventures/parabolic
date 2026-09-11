function rgb(hex:string){const value=/^#[0-9a-f]{6}$/i.test(hex)?hex:'#111113';return [1,3,5].map(i=>parseInt(value.slice(i,i+2),16))}
function hex(parts:number[]){return '#'+parts.map(n=>Math.round(n).toString(16).padStart(2,'0')).join('')}
function luminance(parts:number[]){const linear=parts.map(v=>{const n=v/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4});return linear[0]*.2126+linear[1]*.7152+linear[2]*.0722}
export function contrastRatio(a:string,b:string){const x=luminance(rgb(a)),y=luminance(rgb(b));return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
export function customThemeColors(background:string){const base=rgb(background),bg=hex(base),white=contrastRatio(bg,'#ffffff')>=contrastRatio(bg,'#000000'),foreground=white?[255,255,255]:[0,0,0];const mix=(amount:number)=>hex(base.map((v,i)=>v*(1-amount)+foreground[i]*amount));let muted=mix(.58);for(let n=.58;contrastRatio(bg,muted)<4.5&&n<=1;n+=.03)muted=mix(Math.min(n,1));return {'--bg':bg,'--text':hex(foreground),'--muted':muted,'--sidebar':mix(.03),'--panel':mix(.045),'--hover':mix(.08),'--selected':mix(.12),'--border':mix(.16)}}

export type ThemeInput = {base:number[];accent:number[];contrast:number;sidebarInput?:ThemeInput};
/** Public semantic hues; orange's mid tone follows theme contrast, independently of surfaces. */
export function semanticThemeColors(light:boolean,contrast=light?30:27):Record<string,string> {
 const strength=(Math.min(contrast,30)+Math.max(contrast-30,0)/4)/30;
 const values:Record<string,number[]>={blue:[80,70,267],orange:[66,80,48],'orange-mid':[66+(light?-8:8)*strength,80,48],purple:[48,59.31,288.43],red:[58,73,29],green:[light?68:60,64.37,141.95],yellow:[80,90,85]};
 return Object.fromEntries(Object.entries(values).map(([name,lch])=>['--semantic-'+name,lchToHex(lch,true)]));
}
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
/** CIELCH(D50) to sRGB, with Bradford D50→D65 adaptation. */
export function lchToHex([l,c,h]:number[],truncate=false) {
 const radians=h*Math.PI/180,fy=(l+16)/116,fx=fy+c*Math.cos(radians)/500,fz=fy-c*Math.sin(radians)/200;
 const inv=(v:number)=>v**3>216/24389?v**3:(116*v-16)/903.296296;
 const x=inv(fx)*.96422,y=inv(fy),z=inv(fz)*.82521;
 const xd=.9555766*x-.0230393*y+.0631636*z,yd=-.0282895*x+1.0099416*y+.0210077*z,zd=.0122982*x-.020483*y+1.3299098*z;
 const channels=[3.2404542*xd-1.5371385*yd-.4985314*zd,-.969266*xd+1.8760108*yd+.041556*zd,.0556434*xd-.2040259*yd+1.0572252*zd];
 const rgb=channels.map(v=>255*clamp(v<=.0031308?12.92*v:1.055*v**(1/2.4)-.055,0,1));
 return hex(truncate?rgb.map(Math.floor):rgb);
}
export function hexToLch(value:string):number[] {
 const [r,g,b]=rgb(value).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});
 const x=.4124564*r+.3575761*g+.1804375*b,y=.2126729*r+.7151522*g+.072175*b,z=.0193339*r+.119192*g+.9503041*b;
 const xd=(1.0478112*x+.0228866*y-.050127*z)/.96422,yd=.0295424*x+.9904844*y-.0170491*z,zd=(-.0092345*x+.0150436*y+.7521316*z)/.82521;
 const f=(v:number)=>v>216/24389?Math.cbrt(v):(903.296296*v+16)/116;
 const l=116*f(yd)-16,a=500*(f(xd)-f(yd)),bb=200*(f(yd)-f(zd));return [clamp(l,0,100),Math.hypot(a,bb),(Math.atan2(bb,a)*180/Math.PI+360)%360].map(v=>Math.round(v*1000)/1000);
}
export function parseThemeColor(value:string):number[] {
 if(/^#[0-9a-f]{6}$/i.test(value.trim()))return hexToLch(value.trim());
 const m=/^lch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*[\d.]+)?\s*\)$/i.exec(value.trim());
 if(m){const c=m.slice(1).map(Number);if(c.every(Number.isFinite)&&c[0]<=100&&c[1]<=200&&c[2]<=360)return c;}
 const r=/^rgb\(\s*(\d+)\s*[, ]\s*(\d+)\s*[, ]\s*(\d+)\s*\)$/i.exec(value.trim());if(r&&r.slice(1).every(v=>Number(v)<=255))return hexToLch(hex(r.slice(1).map(Number)));
 throw new Error('Use a six-digit hex, rgb(), or lch() color.');
}
export function parseThemeInput(text:string):ThemeInput {
 let value:any;try{value=JSON.parse(text);}catch{const parts=text.match(/(?:lch|rgb)\([^)]*\)|#[0-9a-f]{6}/gi);if(!parts||parts.length!==3)throw new Error('Paste theme JSON or background, accent, and sidebar colors.');return {base:parseThemeColor(parts[0]),accent:parseThemeColor(parts[1]),contrast:30,sidebarInput:{base:parseThemeColor(parts[2]),accent:parseThemeColor(parts[1]),contrast:30}};}
 const validate=(v:any):ThemeInput=>{if(!v||!Array.isArray(v.base)||!Array.isArray(v.accent))throw new Error('Theme requires base and accent LCH arrays.');for(const a of [v.base,v.accent])if(a.length<3||a.length>4||a.some((n:any)=>typeof n!=='number'||!Number.isFinite(n)||n<0)||a[0]>100||a[1]>200||a[2]>360)throw new Error('LCH values must be valid non-negative numbers.');if(typeof v.contrast!=='number'||!Number.isFinite(v.contrast)||v.contrast<0||v.contrast>100)throw new Error('Contrast must be between 0 and 100.');return {base:v.base.slice(0,3),accent:v.accent.slice(0,3),contrast:v.contrast};};
 const parsed=validate(value),side=value.sidebarInput??value.sidebar;if(side)parsed.sidebarInput=validate(side);return parsed;
}
export function themeInputFromPreferences(p:Record<string,any>):ThemeInput {try{if(p.customTheme)return parseThemeInput(JSON.stringify(p.customTheme));}catch{}return {base:hexToLch(p.backgroundColor||'#111113'),accent:hexToLch(p.accentColor||'#5e6ad2'),contrast:30};}
export function serializeTheme(input:ThemeInput){return JSON.stringify({base:input.base,accent:input.accent,contrast:input.contrast,...input.sidebarInput?{sidebar:{base:input.sidebarInput.base,accent:input.sidebarInput.accent,contrast:input.sidebarInput.contrast}}:{}},null,2);}
/** Piecewise surface relationships fitted from controlled public input/output samples. */
export function customPalette(input:ThemeInput):Record<string,number[]> {
 const [l,c,h]=input.base,k=input.contrast,dark=l<=50,scale=k<=30?k/30:1+(k-30)/120,borderScale=k<=30?k/30:1+(k-30)*7/150;
 const tone=(dl:number,dc=0)=>[clamp(l+dl,0,100),Math.max(0,c+dc),h];
 const textChroma=c/2+1,text=(fraction:number)=>[dark?l+(100-l)*fraction:l<=65?100:l*fraction,textChroma,h];
 return {bgBase:input.base,bgSub:tone(-(dark?3.25:3.5)*scale),bgShade:tone((dark?2:-5.5)*scale,dark?.5*scale:0),bgBaseHover:tone((dark?4.25:-3.5)*scale,dark?.5*scale:0),bgBorder:tone((dark?9.6:-9.45)*borderScale,(dark?1.2:-2.7)*borderScale),labelBase:text(dark?.9+(k-30)/2800:.2-(k-30)/1400),labelMuted:text(dark?.6+(k-30)/700:.4-(k-30)/700),labelFaint:text(dark?.34+(k-30)*.002357142857:.66-(k-30)*.002357142857),controlPrimary:input.accent,controlSecondary:tone((dark?36/7:72/35)*scale,dark?9/28*scale:0),elevated:tone((dark?4.125:8)*scale,dark?.5*scale:l>=100?-.5*scale:0),menu:tone(8*scale,dark?.5*scale:l>=100?-.5*scale:0)};
}
/** Selection tint blends CIE XYZ energy values, independently inferred from controlled outputs. */
export function selectionLch(base:number[],accent:number[]):number[] {
 const xyz=([l,c,h]:number[])=>{const fy=(l+16)/116,a=c*Math.cos(h*Math.PI/180),b=c*Math.sin(h*Math.PI/180);const inverse=(v:number)=>v**3>216/24389?v**3:(116*v-16)/903.296296;return [inverse(fy+a/500),inverse(fy),inverse(fy-b/200)];};
 const background=xyz(base),color=xyz(accent),weight=Math.min(1,(base[1]+30)*(base[0]<=50?1/600:.006));
 const blended=background.map((v,i)=>v*(1-weight)+color[i]*weight),curve=(v:number)=>v>216/24389?Math.cbrt(v):(903.296296*v+16)/116;
 const y=curve(blended[1]),a=500*(curve(blended[0])-y),b=200*(y-curve(blended[2]));
 return [116*y-16,Math.hypot(a,b),(Math.atan2(b,a)*180/Math.PI+360)%360];
}
/** Independent palette generator based on measured perceptual relationships. */
export function generateCustomTheme(input:ThemeInput):Record<string,string> {
 const palette=customPalette(input),hexes=Object.fromEntries(Object.entries(palette).map(([key,value])=>[key,lchToHex(value)])),side=input.sidebarInput?generateCustomTheme({...input.sidebarInput,sidebarInput:undefined}):null;
 const selected=lchToHex(selectionLch(input.base,input.accent));
 return {...semanticThemeColors(input.base[0]>50,input.contrast),'--bg':hexes.bgBase,'--text':hexes.labelBase,'--text-secondary':hexes.labelBase,'--muted':hexes.labelMuted,'--subtle':hexes.labelFaint,'--accent':hexes.controlPrimary,'--sidebar':side?.['--bg']||hexes.bgSub,'--panel':hexes.elevated,'--popover':hexes.menu,'--popover-border':lchToHex(customPalette({...input,base:palette.menu}).bgBorder),'--hover':hexes.bgBaseHover,'--selected':selected,'--border':hexes.bgBorder,'--control-bg':hexes.controlSecondary,'--nav-muted':side?.['--muted']||hexes.labelMuted,'--window-tab-bg':side?.['--panel']||hexes.elevated,'--sidebar-accent':side?.['--accent']||hexes.controlPrimary,'--sidebar-text':side?.['--text']||hexes.labelBase,'--sidebar-hover':side?.['--hover']||hexes.bgBaseHover,'--sidebar-selected':side?.['--selected']||selected,'--sidebar-border':side?.['--border']||hexes.bgBorder};
}
