import type {WorkspaceCommand} from './keyboard';

export function mouseHistoryCommand(button:number):'back'|'forward'|null {
  return button===3?'back':button===4?'forward':null;
}

/** Use workspace-tab history, not the browser window's cross-tab history. */
export function installMouseHistoryNavigation(dispatch:(command:WorkspaceCommand)=>unknown,root:Document=document) {
  const mouse=(event:MouseEvent)=>{
    const command=mouseHistoryCommand(event.button);
    if(!command)return;
    // Suppress the browser's default on every phase, but navigate only once.
    event.preventDefault();event.stopPropagation();
    if(event.type!=='mouseup')return;
    // Do not abandon a modal draft or activate a menu behind it.
    if(root.querySelector('[role="dialog"],dialog[open],[aria-modal="true"],[role="menu"],.dropdown-content'))return;
    dispatch({command});
  };
  const types=['mousedown','mouseup','auxclick'] as const;
  for(const type of types)root.addEventListener(type,mouse,true);
  return()=>{for(const type of types)root.removeEventListener(type,mouse,true)};
}
