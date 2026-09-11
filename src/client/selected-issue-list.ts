import type {Entity} from '../shared/types';

export function selectedIssueTokens(value:string):string[]{
  return [...new Set(value.split(',').map(token=>token.trim()).filter(Boolean).map(token=>/^[a-z][a-z0-9]*-[1-9][0-9]*$/i.test(token)?token.toUpperCase():token.toLowerCase()))];
}
export function selectedIssueListUrl(origin:string,issues:Array<{id:string;identifier?:string}>):string{
  const tokens=[...new Set(issues.map(issue=>String(issue.identifier||issue.id)))];
  return `${origin.replace(/\/$/,'')}/issues/${tokens.map(encodeURIComponent).join(',')}`;
}
export function resolveSelectedIssues(value:string,issues:Entity[]):string[]{
  const tokens=new Set(selectedIssueTokens(value).map(token=>token.toUpperCase()));
  return issues.filter(issue=>!issue.deletedAt&&[issue.id,issue.identifier,...(issue.previousIdentifiers||[])].some(token=>typeof token==='string'&&tokens.has(token.toUpperCase()))).map(issue=>issue.id);
}
