/** Continue panning while a held drag stays at the viewport edge. */
export function timelineAutoPan(options:{bounds:()=>DOMRect|undefined;onPan:(pixels:number)=>void;onMove?:()=>void;scrollElement?:()=>HTMLElement|null}) {
 let point:{x:number;y:number}|null=null,frame=0,last=0,stopped=false;
 const velocity=(value:number,start:number,end:number)=>Math.max(-1,Math.min(1,Math.max(0,(value-(end-36))/36)-Math.max(0,(start+36-value)/36)));
 const tick=(time:number)=>{if(stopped)return;const elapsed=Math.min(32,last?time-last:0);last=time;const bounds=options.bounds();if(point&&bounds){const dx=velocity(point.x,bounds.left,bounds.right)*elapsed*.6;if(dx)options.onPan(dx);const scroll=options.scrollElement?.();if(scroll){const rect=scroll.getBoundingClientRect(),dy=velocity(point.y,Math.max(0,rect.top),Math.min(innerHeight,rect.bottom))*elapsed*.6;if(dy){scroll.scrollTop+=dy;options.onMove?.()}}}frame=requestAnimationFrame(tick)};frame=requestAnimationFrame(tick);
 return {move:(event:{clientX:number;clientY:number})=>{point={x:event.clientX,y:event.clientY}},stop:()=>{stopped=true;cancelAnimationFrame(frame)}};
}
export function timelineScrollParent(element:HTMLElement|null){for(let current=element?.parentElement;current;current=current.parentElement)if(current.scrollHeight>current.clientHeight&&/auto|scroll/.test(getComputedStyle(current).overflowY))return current;return null;}
