import {myIssueTab} from './my-issues-state';
import {parseRouteFilter} from './route-filter';
/** Tab buttons restore that tab's temporary filter; history URLs remain authoritative. */
export function myIssueTabSearch(search:string,nextTab:string,scope:string,storage:Pick<Storage,'getItem'|'setItem'|'removeItem'>):string {
 const params=new URLSearchParams(search),currentTab=myIssueTab(search),key=(tab:string)=>`my-issue-filter:${scope}:${tab}`;
 if(currentTab===nextTab)return params.toString();
 const current=params.get('filter');
 try{if(parseRouteFilter(current))storage.setItem(key(currentTab),current!);else storage.removeItem(key(currentTab));}catch{}
 params.delete('filter');
 try{const saved=storage.getItem(key(nextTab));if(parseRouteFilter(saved))params.set('filter',saved!);}catch{}
 if(nextTab==='Assigned')params.delete('tab');else params.set('tab',nextTab);
 return params.toString();
}
