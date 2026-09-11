import type {Entity} from '../shared/types';
import type {InboxRow} from './inbox-data';

export interface InboxFocusOptions {
  issues?:readonly Entity[];
  statuses?:readonly Entity[];
  comments?:readonly Entity[];
  showReadItems?:boolean;
  readStateOnFirstSeen?:ReadonlyMap<string,boolean>|Readonly<Record<string,boolean>>;
  otherNotifications?:(main:Entity)=>readonly Entity[];
}

type Rule={key:string;title:string;minimum:number;children?:Rule[];foldTrailingSingles?:boolean};
const leaf=(key:string,title:string,minimum=1):Rule=>({key,title,minimum});
// Labels, ordering and numeric cutoffs are observed behavior; implementation is local.
const policy:Rule[]=[
  leaf('urgent','Urgent'),leaf('slas','SLAs'),leaf('reminders','Reminders'),
  {key:'mentions-replies',title:'Mentions & replies',minimum:1,children:[leaf('mentions','Mentions',5),leaf('replies','Replies',5)]},
  {key:'other',title:'Other',minimum:1,foldTrailingSingles:true,children:[
    leaf('system','System',2),leaf('update-reminders','Update reminders',2),leaf('comments','Comments',2),leaf('triage','Triage',2),
    {key:'posts-updates',title:'Posts & updates',minimum:2,children:[{key:'updates',title:'Updates',minimum:5,children:[leaf('initiative-updates','Initiative updates',5),leaf('project-updates','Project updates',5)]}]},
    {key:'assignments',title:'Assignments',minimum:6,children:[leaf('issue-assignments','Assigned issues',5),leaf('project-member','Added to project',5),leaf('project-lead','Project lead',5),leaf('initiative-lead','Initiative lead',5)]},
    leaf('subscriptions','Subscriptions',6),leaf('document-changes','Document changes',6),leaf('customers','Customer requests',6),leaf('reactions','Reactions',6),leaf('completed','Completed',10),leaf('canceled','Canceled',10),leaf('duplicates','Duplicates',6),
  ]},
];
const normalized=(value:unknown)=>typeof value==='string'?value.toLowerCase().replace(/[\s_-]/g,''):'';
const tags=(item:Entity)=>new Set([item.type,...(Array.isArray(item.reasons)?item.reasons:[])].map(normalized));
const any=(values:Set<string>,...candidates:string[])=>candidates.some(value=>values.has(value));
function category(item:Entity):string{
  if(typeof item.category==='string'&&item.category)return normalized(item.category);
  const values=tags(item);
  if(any(values,'mention','mentions','mentioned','issuecommentmention','issuementioned','projectcommentmention','initiativecommentmention','documentcommentmention'))return 'mentions';
  if(any(values,'updatereminders','projectupdateprompt','initiativeupdateprompt'))return 'updatereminders';
  if(any(values,'reminder','reminders','issueduedate','issuereminder','projectreminder','documentreminder','initiativereminder'))return 'reminders';
  if(any(values,'comment','comments','reply','replies','commentsandreplies','issuecomment','projectcomment','initiativecomment','documentcomment'))return 'commentsandreplies';
  if(any(values,'assigned','unassigned','assignments','issueassignedtoyou','issueunassignedfromyou','projectaddedasmember','projectaddedaslead','initiativeaddedasowner'))return 'assignments';
  if(any(values,'subscribed','subscriptions','subscription','shared'))return 'subscriptions';
  if(any(values,'projectupdates','initiativeupdates','projectupdatecreated','initiativeupdatecreated','postsandupdates'))return 'postsandupdates';
  if(any(values,'request','requests','customers','customerrequests'))return 'customers';
  if(any(values,'reaction','reactions'))return 'reactions';
  if(any(values,'documentchanges'))return 'documentchanges';
  if(any(values,'triage'))return 'triage';
  if(any(values,'system','appsandintegrations'))return 'system';
  if(item.entityKind==='comments')return 'commentsandreplies';
  if(item.entityKind==='updates')return 'postsandupdates';
  if(item.entityKind==='requests')return 'customers';
  if(item.entityKind==='documents')return 'documentchanges';
  return '';
}

function classifier(options:InboxFocusOptions){
  const issues=new Map(options.issues?.map(item=>[item.id,item])),statuses=new Map(options.statuses?.map(item=>[item.id,item])),comments=new Map(options.comments?.map(item=>[item.id,item]));
  const isHumanComment=(item:Entity)=>category(item)==='commentsandreplies'&&!item.isAgentAppUser&&!item.actor?.isAgentAppUser;
  const hasParent=(item:Entity)=>!!(item.parentCommentId||comments.get(item.commentId||(item.entityKind==='comments'?item.entityId:''))?.parentId);
  return (item:Entity):string=>{
    const values=tags(item),issue=issues.get(item.issueId||(item.entityKind==='issues'?item.entityId:'')),state=issue?(statuses.get(issue.statusId)?.type||issue.status):undefined;
    const closed=state?['completed','done','canceled','cancelled','duplicate'].includes(state):!!issue?.completedAt;
    if(!closed&&(issue?.priority===1||values.has('issuepriorityurgent')))return 'urgent';
    if(any(values,'slabreached','slaatrisk','slawarning','issueslahighrisk','issueslabreached'))return 'slas';
    const group=category(item);
    if(group==='reminders')return 'reminders';
    if(group==='mentions')return 'mentions';
    if(isHumanComment(item)&&[item,...(options.otherNotifications?.(item)||[])].some(row=>isHumanComment(row)&&hasParent(row)))return 'replies';
    if(group==='system'||group==='appsandintegrations')return 'system';
    if(group==='updatereminders'||any(values,'projectupdateprompt','initiativeupdateprompt'))return 'update-reminders';
    if(isHumanComment(item))return 'comments';
    if(group==='triage'||state==='triage'&&!closed)return 'triage';
    if(group==='postsandupdates'){
      if(any(values,'initiativeupdates','initiativeupdatecreated'))return 'initiative-updates';
      if(any(values,'projectupdates','projectupdatecreated'))return 'project-updates';
      return 'updates';
    }
    if(group==='assignments'){
      if(any(values,'issueassignedtoyou','issueunassignedfromyou')||any(values,'assigned','unassigned')&&(item.issueId||item.entityKind==='issues'))return 'issue-assignments';
      if(values.has('projectaddedasmember'))return 'project-member';
      if(values.has('projectaddedaslead'))return 'project-lead';
      if(values.has('initiativeaddedasowner'))return 'initiative-lead';
      return 'assignments';
    }
    if(group==='subscriptions')return 'subscriptions';
    if(group==='documentchanges')return 'document-changes';
    if(group==='customers')return 'customers';
    if(group==='reactions')return 'reactions';
    if(state==='completed'||state==='done')return 'completed';
    if(state==='canceled'||state==='cancelled')return 'canceled';
    if(state==='duplicate')return 'duplicates';
    return 'other';
  };
}

type Group={key:string;title:string;items:Entity[]};
type Counts={rule:Rule;own:Entity[];all:Entity[];children:Counts[];childrenReachCutoff:boolean;canSeparate:boolean};
function focusGroups(items:Entity[],options:InboxFocusOptions):Group[]{
  const classify=classifier(options),buckets=new Map<string,Entity[]>();
  for(const item of items){const key=classify(item);if(!buckets.has(key))buckets.set(key,[]);buckets.get(key)!.push(item);}
  const measure=(rule:Rule):Counts=>{
    const own=buckets.get(rule.key)||[],children=(rule.children||[]).map(measure),all=[...own,...children.flatMap(child=>child.all)],childrenReachCutoff=children.some(child=>child.all.length>=child.rule.minimum);
    return {rule,own,children,all,childrenReachCutoff,canSeparate:all.length>=rule.minimum||childrenReachCutoff};
  };
  const singleBranch=(node:Counts):Counts=>{while(!node.own.length&&node.children.filter(child=>child.all.length).length===1)node=node.children.find(child=>child.all.length)!;return node;};
  const combined=(node:Counts):Group[]=>{if(!node.all.length)return [];const label=singleBranch(node).rule;return [{key:label.key,title:label.title,items:node.all}];};
  const expand=(node:Counts):Group[]=>{
    if(!node.childrenReachCutoff)return combined(node);
    const trailing=new Set<Counts>();
    if(node.rule.foldTrailingSingles){
      for(let index=node.children.length-1;index>=0;index--){const child=node.children[index];if(!child.all.length)continue;if(child.all.length>1||child.canSeparate)break;trailing.add(child);}
      if(trailing.size<2)trailing.clear();
    }
    const groups:Group[]=[],folded:Counts[]=[];
    for(const child of node.children){
      if(child.canSeparate)groups.push(...expand(child));
      else if(node.rule.foldTrailingSingles&&!trailing.has(child))groups.push(...combined(child));
      else if(child.all.length)folded.push(child);
    }
    const rest=[...node.own,...folded.flatMap(child=>child.all)];
    if(rest.length){const label=!node.own.length&&folded.length===1?singleBranch(folded[0]).rule:node.rule;groups.push({key:label.key,title:label.title,items:rest});}
    return groups;
  };
  const groups=policy.flatMap(rule=>expand(measure(rule)));
  if(groups.length===1)groups[0]={...groups[0],title:'Unread'};
  return groups;
}

/** Input is already filtered to visible main notifications, one per stack. No entities are cloned. */
export function groupInboxFocus(notifications:Entity[],options:InboxFocusOptions={}):InboxRow[]{
  const read:Entity[]=[],unread:Entity[]=[];
  const wasRead=(item:Entity)=>{
    const snapshot=options.readStateOnFirstSeen;
    if(!snapshot)return !!item.readAt;
    return typeof (snapshot as ReadonlyMap<string,boolean>).get==='function'?!!(snapshot as ReadonlyMap<string,boolean>).get(item.id):!!(snapshot as Readonly<Record<string,boolean>>)[item.id];
  };
  for(const item of notifications)(options.showReadItems&&wasRead(item)?read:unread).push(item);
  if(!unread.length)return notifications.map(item=>({type:'notification',item}));
  const groups=focusGroups(unread,options);
  if(read.length)groups.push({key:'read',title:'Read',items:read});
  return groups.flatMap(group=>[{type:'group' as const,id:'focus-'+group.key,title:group.title,count:group.items.length},...group.items.map(item=>({type:'notification' as const,item}))]);
}
