/** Shared ordering for deliberate workspace edits and tab closes. */
type Clock={tick:number;newActionAt:number};
const memory=new Map<string,Clock>();
const key=(scope:string)=>'parabolic:action-clock:'+scope;
function read(scope:string):Clock{let stored:Partial<Clock>={};try{stored=JSON.parse(localStorage.getItem(key(scope))??'{}');}catch{}const local=memory.get(scope);return {tick:Math.max(local?.tick||0,Number.isFinite(stored?.tick)?stored.tick!:0),newActionAt:Math.max(local?.newActionAt||0,Number.isFinite(stored?.newActionAt)?stored.newActionAt!:0)};}
function write(scope:string,value:Clock){memory.set(scope,value);try{localStorage.setItem(key(scope),JSON.stringify(value));}catch{}}
export function reserveHistoryTime(scope:string,now=Date.now()){const value=read(scope);value.tick=Math.max(now,value.tick+1);write(scope,value);return value.tick;}
export function commitHistoryAction(scope:string,at:number){const value=read(scope);value.newActionAt=Math.max(value.newActionAt,at);write(scope,value);if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('workspace-history-action',{detail:{scope,at}}));}
export function lastHistoryAction(scope:string){return read(scope).newActionAt;}
export function redoIsCurrent(scope:string,undoneAt:number|undefined){return (undoneAt??0)>=lastHistoryAction(scope);}
