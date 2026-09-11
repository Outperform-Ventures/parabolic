/** Installed before BrowserRouter: Chromium orders window-target listeners by
 * registration rather than giving a later capture listener precedence. */
const handlers=new Set<(event:PopStateEvent)=>void>();
const routeExits=new Map<string,{path:string;leave:()=>void}>();
window.addEventListener('popstate',event=>{for(const[key,entry]of routeExits)if(entry.path!==location.pathname){routeExits.delete(key);entry.leave()}for(const handler of handlers)handler(event)},true);
export function registerTemplateHistoryHandler(next:(event:PopStateEvent)=>void){handlers.add(next);return()=>{handlers.delete(next)}};
export function registerRouteExit(key:string,path:string,leave:()=>void){const entry={path,leave};routeExits.set(key,entry);return()=>{if(routeExits.get(key)===entry)routeExits.delete(key)}};
