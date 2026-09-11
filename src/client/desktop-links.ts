import {useEffect,useRef} from 'react';
const entityRoute=/^\/(?:issues|project|initiative|document|cycles|view|customer|label|label-group)(?:\/|$)/;
export function desktopLink(route:string):string|null{if(!route.startsWith('/')||route.startsWith('//')||/[\\\r\n\0]/.test(route))return null;return `parabolic://${route.slice(1)}`}
export function requestDesktopOpen(route:string){const url=desktopLink(route);if(!url)return;const event=new CustomEvent('workspace-desktop-open',{detail:{url},cancelable:true});if(!window.dispatchEvent(event))return;const frame=document.createElement('iframe');frame.hidden=true;frame.title='Open in desktop app';frame.src=url;document.body.append(frame);setTimeout(()=>frame.remove(),1500)}
/** Only an incoming entity link attempts a launch; in-app route changes stay in this window. */
export function useDesktopLinkPreference(enabled:boolean,ready:boolean){const incoming=useRef(location.pathname+location.search+location.hash),attempted=useRef(false);useEffect(()=>{if(!ready||!enabled||attempted.current||window.desktop||!entityRoute.test(incoming.current))return;attempted.current=true;requestDesktopOpen(incoming.current)},[enabled,ready])}
