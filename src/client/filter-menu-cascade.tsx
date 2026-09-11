import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';

type Panel = {field:string; search:string; anchor:HTMLElement; focus?:boolean};
export type FilterPanelNavigation = {
  field:string;
  search:string;
  setSearch:(query:string)=>void;
  openBranch:(field:string,anchor:HTMLElement,focus?:boolean)=>void;
  close:()=>void;
  expandedField?:string;
};

/** Each level owns its query and focus. Portals prevent clipping by a parent's scroll area. */
export function FilterMenuCascade({trigger,initialField,rootAlignRight=false,children}:{
  trigger:React.ReactNode; initialField:string; rootAlignRight?:boolean;
  children:(navigation:FilterPanelNavigation)=>React.ReactNode;
}) {
  const [panels,setPanels]=useState<Panel[]>([]);
  const triggerRef=useRef<HTMLSpanElement>(null);
  const elements=useRef<(HTMLDivElement|null)[]>([]);
  const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const cancelHover=()=>{clearTimeout(timer.current);timer.current=undefined;};
  const close=(restoreFocus=false)=>{
    cancelHover();setPanels([]);
    if(restoreFocus)triggerRef.current?.querySelector<HTMLElement>('button')?.focus();
  };
  useEffect(()=>()=>clearTimeout(timer.current),[]);
  useEffect(()=>{
    if(!panels.length)return;
    const outside=(event:PointerEvent)=>{
      const target=event.target as Node;
      if(!triggerRef.current?.contains(target)&&!elements.current.some(el=>el?.contains(target)))close();
    };
    const escape=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){
        event.preventDefault();event.stopImmediatePropagation();
        if(panels.length>1&&!panels[0]?.search){
          const anchor=panels.at(-1)?.anchor;
          cancelHover();setPanels(current=>current.slice(0,-1));
          queueMicrotask(()=>anchor?.focus());
        }else close(true);
      }
    };
    document.addEventListener('pointerdown',outside,true);
    document.addEventListener('keydown',escape,true);
    return()=>{document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',escape,true);};
  },[panels.length]);
  const open=()=>{
    const anchor=triggerRef.current;
    if(anchor)setPanels([{field:initialField,search:'',anchor}]);
  };
  return <span className="dropdown filter-cascade-trigger" ref={triggerRef} onClick={()=>panels.length?close():open()} onKeyDown={e=>{
    if(!panels.length&&['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();open();}
  }}>
    {React.isValidElement(trigger)?React.cloneElement(trigger as React.ReactElement<any>,{'aria-expanded':!!panels.length,'aria-haspopup':'menu'}):trigger}
    {panels.map((panel,index)=>createPortal(<CascadePanel key={index+':'+panel.field} panel={panel} index={index} rootAlignRight={rootAlignRight} register={element=>{elements.current[index]=element;}}
      onPointerEnter={cancelHover}
      onPointerOver={e=>{
        const row=(e.target as HTMLElement).closest<HTMLElement>('.issue-filter-option');
        if(!row||row.contains(e.relatedTarget as Node))return;
        cancelHover();
        const branch=row.dataset.filterBranch;
        // A short delay lets the pointer cross sibling rows on its way into a child.
        timer.current=setTimeout(()=>{
          if(branch)setPanels(current=>current[index+1]?.anchor===row?current:[...current.slice(0,index+1),{field:branch,search:'',anchor:row}]);
          else setPanels(current=>current.slice(0,index+1));
        },150);
      }}
      onPointerLeave={cancelHover}
      onKeyDown={e=>{
        e.stopPropagation();cancelHover();
        const container=elements.current[index];
        const rows=Array.from(container?.querySelectorAll<HTMLButtonElement>('.issue-filter-option:not(:disabled)')??[]);
        const target=e.target as HTMLElement;
        const input=target.tagName==='INPUT';
        if(e.key==='ArrowLeft'&&index>0&&(!input||(target as HTMLInputElement).selectionStart===0)){
          e.preventDefault();setPanels(current=>current.slice(0,index));panel.anchor.focus();return;
        }
        if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)&&(!input||e.key.startsWith('Arrow'))){
          e.preventDefault();const current=rows.indexOf(target as HTMLButtonElement);
          const next=e.key==='Home'?0:e.key==='End'?rows.length-1:e.key==='ArrowDown'?(current+1)%rows.length:(current<0?rows.length-1:(current-1+rows.length)%rows.length);
          rows[next]?.focus();return;
        }
        if(e.key==='Enter'&&input){e.preventDefault();rows[0]?.click();}
        if(e.key==='ArrowRight'&&!input&&target.dataset.filterBranch){e.preventDefault();target.click();}
      }}>
      {children({field:panel.field,search:panel.search,expandedField:panels[index+1]?.field,
        setSearch:search=>{cancelHover();setPanels(current=>current.slice(0,index+1).map((p,i)=>i===index?{...p,search}:p));},
        openBranch:(field,anchor,focus=true)=>{
          cancelHover();setPanels(current=>[...current.slice(0,index+1),{field,search:'',anchor,focus}]);
        },close:()=>close()})}
    </CascadePanel>,document.body))}
  </span>;
}

function CascadePanel({panel,index,rootAlignRight,register,children,...events}:{
  panel:Panel;index:number;rootAlignRight:boolean;register:(element:HTMLDivElement|null)=>void;children:React.ReactNode;
  onPointerEnter:React.PointerEventHandler<HTMLDivElement>;
  onPointerLeave:React.PointerEventHandler<HTMLDivElement>;
  onPointerOver:React.PointerEventHandler<HTMLDivElement>;
  onKeyDown:React.KeyboardEventHandler<HTMLDivElement>;
}) {
  const ref=useRef<HTMLDivElement>(null);
  const [position,setPosition]=useState({left:0,top:0});
  useLayoutEffect(()=>{
    const node=ref.current;if(!node)return;
    const place=()=>{
      const anchor=panel.anchor.getBoundingClientRect(),rect=node.getBoundingClientRect();
      const parentElement=panel.anchor.closest<HTMLElement>('.filter-cascade-panel');
      const parent=parentElement?.getBoundingClientRect();
      const side=parentElement?.dataset.cascadeSide||(parent&&parent.right+rect.width-3>innerWidth-8?'left':'right');
      if(parent)node.dataset.cascadeSide=side;
      let left=parent?(side==='left'?parent.left-rect.width+3:parent.right-3):rootAlignRight?innerWidth-rect.width-10:anchor.right-rect.width;
      // The first choice in the child lines up with the expanded parent row.
      let top=parent?anchor.top-44:anchor.bottom+4.5;
      left=Math.max(8,Math.min(left,innerWidth-rect.width-8));
      top=Math.max(8,Math.min(top,innerHeight-rect.height-8));
      setPosition(old=>old.left===left&&old.top===top?old:{left,top});
    };
    place();const observer=new ResizeObserver(place);observer.observe(node);
    window.addEventListener('resize',place);window.addEventListener('scroll',place,true);
    return()=>{observer.disconnect();window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);};
  },[panel.anchor,panel.search,rootAlignRight]);
  useLayoutEffect(()=>{if(index===0||panel.focus)ref.current?.querySelector<HTMLInputElement>('input')?.focus();},[]);
  return <div {...events} ref={node=>{ref.current=node;register(node);}} className="filter-cascade-panel" data-filter-level={index} role="menu" style={{...position,zIndex:100+index}} onClick={e=>e.stopPropagation()}>{children}</div>;
}
