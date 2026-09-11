/** External navigation waits for an open form/dialog instead of abandoning it. */
export function nativeCommandRouting<T extends {command:string;route?:string}>(dispatch:(command:T)=>void,onDeferred:()=>void,root:Document=document){
 let pending:T|undefined,disposed=false;
 const modalOpen=()=>[...root.querySelectorAll<HTMLElement>('[role="dialog"],dialog[open],[aria-modal="true"]')].some(element=>element.getClientRects().length>0);
 const flush=()=>{if(!disposed&&pending&&!modalOpen()){const command=pending;pending=undefined;dispatch(command);}};
 const observer=new MutationObserver(flush);observer.observe(root.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open','hidden','style','class']});
 return {receive(command:T){if(['new-contextual','new-issue','new-project','new-initiative','new-document','new-customer-request'].includes(command.command)&&[...root.querySelectorAll<HTMLElement>('.command-palette,.issue-composer')].some(element=>element.getClientRects().length>0))return;if(command.command==='navigate'&&command.route&&modalOpen()){if(!pending)onDeferred();pending=command;return;}dispatch(command);},dispose(){disposed=true;pending=undefined;observer.disconnect();}};
}
