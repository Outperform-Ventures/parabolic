/** Modal dialogs escape inherited inertness, so freeze them explicitly as well
 * as the body. Watch dialogs opened by asynchronous work during preparation. */
export function freezeRestartInput(document:Document){
  const body=document.body,focused=document.activeElement as HTMLElement|null;
  const states=new Map<HTMLElement,boolean>();
  const freeze=(element:HTMLElement)=>{if(!states.has(element))states.set(element,element.inert);element.inert=true;};
  const scan=()=>{freeze(body);for(const dialog of document.querySelectorAll<HTMLDialogElement>('dialog[open]'))freeze(dialog);};
  scan();
  const Observer=document.defaultView?.MutationObserver??MutationObserver;
  const observer=new Observer(scan);observer.observe(body,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});
  focused?.blur();
  let released=false;
  return()=>{
    if(released)return;released=true;observer.disconnect();
    for(const [element,previous] of states)element.inert=previous;
    if(focused?.isConnected&&document.activeElement===body)focused.focus({preventScroll:true});
  };
}
