import type {Entity} from './types';
export function estimateLabel(value:number,team?:Record<string,any>):string{
 if(String(team?.estimateScale).toLowerCase()==='t-shirt'){
  const index=[1,2,3,5,8,13,21].indexOf(value);
  if(index>=0)return ['XS','S','M','L','XL','XXL','XXXL'][index];
 }
 return String(value);
}
export function estimateOptions(config:Record<string,any>={}){const scale=config.estimateScale??'Fibonacci',points=scale==='Exponential'?[1,2,4,8,16,32,64]:scale==='Parabolic'?[1,2,3,4,5,6,7]:[1,2,3,5,8,13,21];return [{id:null as number|null,name:'No estimate'},...(scale!=='None'&&config.zeroEstimate!==false?[{id:0,name:'0'}]:[]),...(scale==='None'?[]:points.slice(0,config.extendedEstimates?7:5)).map((id,index)=>({id,name:scale.toLowerCase()==='t-shirt'?['XS','S','M','L','XL','XXL','XXXL'][index]:String(id)}))];}
export function issueEffort(issue:Record<string,any>,team?:Record<string,any>,unit:'points'|'issues'='points'){if(unit==='issues'||team?.estimateScale==='None')return 1;return typeof issue.estimate==='number'&&Number.isFinite(issue.estimate)?issue.estimate:typeof team?.defaultIssueEstimate==='number'&&Number.isFinite(team.defaultIssueEstimate)?team.defaultIssueEstimate:team?.unestimatedAsOne===false?0:1;}
