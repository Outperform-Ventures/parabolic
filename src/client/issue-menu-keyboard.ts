import type React from 'react';
export function issueMenuItems(root:HTMLElement){return Array.from(root.querySelectorAll<HTMLElement>('[role=menuitem]:not([hidden]):not([disabled])')).filter(item=>item.closest('.issue-action-filter')===root);}
export function markIssueMenuActive(root:HTMLElement,item?:HTMLElement){for(const candidate of issueMenuItems(root))candidate.dataset.actionActive=String(candidate===item);}
export function navigateIssueMenu(event:React.KeyboardEvent<HTMLElement>){
 if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return false;
 const root=event.currentTarget;if((event.target as HTMLElement).closest('.issue-action-filter')!==root)return false;
 event.preventDefault();event.stopPropagation();const items=issueMenuItems(root);if(!items.length)return true;
 const focused=items.indexOf(document.activeElement as HTMLElement),active=items.findIndex(item=>item.dataset.actionActive==='true'),index=focused<0?Math.max(0,active):focused;
 const next=event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowUp'?items.length-1:1))%items.length;
 markIssueMenuActive(root,items[next]);if(!(event.target as HTMLElement).matches('input'))items[next].focus();return true;
}
export function matchesIssueAction(text:string,query:string){let from=0;for(const character of query.trim().toLowerCase()){const index=text.toLowerCase().indexOf(character,from);if(index<0)return false;from=index+1;}return true;}
export function hoverIssueMenu(event:React.PointerEvent<HTMLElement>){
 if(event.pointerType==='touch'||event.buttons)return;
 const root=event.currentTarget,item=(event.target as HTMLElement).closest<HTMLElement>('[role=menuitem]');
 if(!item||item.closest('.issue-action-filter')!==root||item.hidden||item.hasAttribute('disabled'))return;
 markIssueMenuActive(root,item);if(document.activeElement!==item&&!document.activeElement?.matches('.issue-action-filter>input'))item.focus({preventScroll:true});return item;
}
