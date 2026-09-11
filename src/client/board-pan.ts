import {useEffect, type RefObject} from 'react';

/** Pull empty board space without taking over card dragging or controls. */
export function useBoardPan(ref:RefObject<HTMLElement|null>,enabled:boolean){
 useEffect(()=>{
  const element=ref.current;
  if(!enabled||!element)return;
  let gesture:{id:number;x:number;left:number;active:boolean}|null=null;
  const stop=()=>{
   if(gesture&&element.hasPointerCapture(gesture.id))element.releasePointerCapture(gesture.id);
   gesture=null;
   element.classList.remove('board-panning');
  };
  const down=(event:PointerEvent)=>{
   if(event.button!==0||event.pointerType!=='mouse'||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return;
   if(!(event.target instanceof Element)||event.target.closest('button,a,input,textarea,select,[contenteditable],[role="button"],[role="menu"],[draggable="true"],.board-card,.group-header'))return;
   if(element.scrollWidth<=element.clientWidth)return;
   gesture={id:event.pointerId,x:event.clientX,left:element.scrollLeft,active:false};
  };
  const move=(event:PointerEvent)=>{
   if(!gesture||event.pointerId!==gesture.id)return;
   if(!(event.buttons&1)){stop();return;}
   const delta=event.clientX-gesture.x;
   if(!gesture.active&&Math.abs(delta)<4)return;
   if(!gesture.active){gesture.active=true;element.setPointerCapture(gesture.id);element.classList.add('board-panning');}
   event.preventDefault();
   element.scrollLeft=gesture.left-delta;
  };
  element.addEventListener('pointerdown',down);
  window.addEventListener('pointermove',move,{passive:false});
  window.addEventListener('pointerup',stop);
  window.addEventListener('pointercancel',stop);
  element.addEventListener('lostpointercapture',stop);
  window.addEventListener('blur',stop);
  return()=>{stop();element.removeEventListener('pointerdown',down);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',stop);window.removeEventListener('pointercancel',stop);element.removeEventListener('lostpointercapture',stop);window.removeEventListener('blur',stop);};
 },[ref,enabled]);
}
