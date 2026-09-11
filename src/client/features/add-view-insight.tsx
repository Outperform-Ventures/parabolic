import React from 'react';
import type {InsightConfig} from './insight-data';
import type {FilterSpec} from '../query';
import {FormDialog,optionList,useActions} from './shared';
export function AddViewInsight({config,filter,viewId,title,onClose}:{config:InsightConfig;filter:FilterSpec;viewId?:string;title:string;onClose:()=>void}){
 const store=useActions();
 return <FormDialog title="Add to dashboard" submit="Add insight" initial={{name:title}} fields={[{key:'dashboardId',label:'Dashboard',type:'select',options:optionList(store.data.dashboards,'Create new dashboard')},{key:'name',label:'Title',required:true}]} onClose={onClose} onSave={async values=>{
   if(viewId)await store.update('views',viewId,{insightConfig:config});
   const widget={...config,id:crypto.randomUUID(),name:values.name,...(viewId?{sourceViewId:viewId,filters:{match:'all',conditions:[]}}:{filters:filter})};
   const dashboard=store.data.dashboards.find(item=>item.id===values.dashboardId);
   if(dashboard)await store.update('dashboards',dashboard.id,{widgets:[...(dashboard.widgets||[]),widget]});
   else await store.create('dashboards',{name:values.name,visibility:'private',widgets:[widget]});
   store.toast('Insight added to dashboard');return true;
 }}><p className="muted">{viewId?'This insight follows changes to its source view. Dashboard filters also apply.':'Dashboard filters also apply to this insight.'}</p></FormDialog>;
}
