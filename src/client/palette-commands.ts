import type { WorkspaceCommand } from './keyboard';
export interface PaletteCommand { label:string; icon:string; shortcut?:string; command:WorkspaceCommand }
export function availablePaletteCommands<T extends {label:string}>(commands:T[],capabilities:{guest:boolean;canCreate:boolean}){
 if(!capabilities.guest)return commands;
 return commands.filter(command=>!/customer|initiative|invite|new label|new .* template|recently deleted/i.test(command.label)&&(!/^(Create|Add document|Add section|Move document)/.test(command.label)||capabilities.canCreate));
}
/** Commands reuse the same handlers as shortcuts, so selection and permission rules agree. */
export function retainedPaletteCommands(context:{issue:boolean; shared?:boolean; list?:boolean; count?:number; subscribed?:boolean; canManageTemplate?:boolean; project?:boolean; projectSubscribed?:boolean; initiative?:boolean; triageId?:string;desktop?:boolean;hardwareAccelerationEnabled?:boolean}):PaletteCommand[]{
 const rows:PaletteCommand[]=[];
 const add=(label:string,icon:string,command:string,extra:Omit<WorkspaceCommand,'command'>={},shortcut='')=>rows.push({label,icon,shortcut,command:{command,...extra}});
 for(const [value,key,icon] of [['issue','I','Circle'],['project','P','Box'],['document','D','FileText'],['team','T','Users'],['user','U','User'],['cycle','C','Repeat'],['view','V','Layers'],['initiative','N','Layers'],['customer','Q','Building2'],['favorite','F','Star'],['workspace','W','Building2']])add(`Open ${value}`,icon,'open-picker',{value},`O ${key}`);
 add('Find in view','Search','find-in-page',{},'⌘ F');
 add('Search workspace','Search','search',{},'/');
 add('Open drafts','FileText','open-drafts',{},'G D');
 add('Create issue from template','FileText','new-issue-template');
 add('Toggle sidebar','PanelLeft','toggle-sidebar');
 add('Open tab','Layers','open-tab-menu',{},'⌘ ⇧ A');
 add('Close tab','X','close-tab',{},'⌘ W');
 add('New tab','Plus','new-tab',{},'⌘ T');
 add('Next tab','ChevronRight','next-tab',{},'⌘ ⇧ ]');
 add('Previous tab','ChevronLeft','previous-tab',{},'⌘ ⇧ [');
 add('Pin tab','Pin','pin-tab',{},'⌃ ⇧ P');
 add('Close other tabs','X','close-other-tabs',{},'⌘ ⌥ W');
 add('Reopen closed tab','RotateCcw','reopen-tab',{},'⌘ ⇧ T');
 add('Open recently viewed','History','open-recently-viewed',{},'⌘ Y');
 add('Close tabs to the right','X','close-tabs-right');
 add('Open settings…','Settings','settings',{},'O S');
 add('Go to advanced search','Search','search',{},'/');
 add('Copy page URL','Link','copy-page-url');
 add('Log out','LogOut','logout',{},'⌥ ⇧ Q');
 add('Create or join a workspace','Building2','create-workspace');
 add('Contact support','HelpCircle','contact-support');
 add('Send feedback','MessageSquare','send-feedback');
 add('Open Parabolic Documentation','BookOpen','open-parabolic-documentation');
 add('Open API Documentation','BookOpen','open-api-documentation');
 add('Parabolic status','AlertTriangle','open-parabolic-status');
 add('Report performance problem','Gauge','report-performance-problem');
 if(context.desktop&&context.hardwareAccelerationEnabled===true)add('Disable hardware acceleration','ArrowRight','disable-hardware-acceleration');
 if(context.list){add('Display options','SlidersHorizontal','display-options');add('Add filter','Filter','add-filter');add('Clear filters','Filter','clear-filters');add('Select all','CheckSquare','select-all',{},'⌘ A');}
 if(context.issue){
  if((context.count??1)===1)add('Issue description history','History','issue-description-history');
  for(const [label,field,icon]of [['status','statusId','Circle'],['assignee','assigneeId','User'],['priority','priority','Flag'],['estimate','estimate','Gauge'],['labels','labelIds','Tag'],['due date','dueDate','Calendar'],...(!context.shared?[['team','teamId','Users'],['project','projectId','Box'],['cycle','cycleId','Repeat'],['parent issue','parentId','GitBranch']]:[])])add(`Change ${label}`,icon,'edit-property',{field});
  add(context.subscribed?'Unsubscribe':'Subscribe','Bell','toggle-subscription',{value:!context.subscribed},'⇧ S');
  if(!context.shared)add('Manage subscribers','Users','manage-subscribers',{},'⌘ ⇧ S');
  if((context.count??1)===1&&!context.shared)add('Mark issue as','GitBranch','mark-issue-as');
  if((context.count??1)===1){add('Show similar issues…','Search','show-similar-issues');if(!context.shared&&context.canManageTemplate!==false)add('Convert into template…','FileText','convert-issue-template');}
  for(const [label,value]of [['Mark as blocked by','blockedBy'],['Mark as blocking','blocking'],['Add related issue','related'],...(!context.shared?[['Mark as duplicate','duplicate']]:[])])add(label,'GitBranch','add-relation',{value});
  add('Copy issue ID','Copy','copy-issue-id');add('Copy issue title','Copy','copy-entity-title');add('Copy issue URL','Link','copy-entity-url');add('Copy issue as Markdown','Copy','copy-issue-markdown');
  if(!context.shared)add('Delete issue','Trash2','delete-issue');
 }
 if(context.project){
  if((context.count??1)===1)add('Edit project','Pencil','edit-selected-project');
  for(const[label,field,icon]of [['status','status','Circle'],['priority','priority','Flag'],['lead','leadId','User'],['members','memberIds','Users'],['teams','teamIds','Users'],['labels','labelIds','Tag'],['initiatives','initiativeIds','Layers'],['target date','targetDate','Calendar'],['start date','startDate','Calendar']])add('Change project '+label,icon,'edit-property',{field});
  if((context.count??1)===1){add('Change project dependencies','GitBranch','edit-project-dependencies');add('Create new document for project','FileText','new-project-document');add('Open project updates and activity','Activity','open-updates');}
  add('Remind me about project','Clock','remind',{},'⇧ H');add(context.projectSubscribed?'Unsubscribe from project notifications':'Subscribe to project notifications','Bell','toggle-subscription');add('Create new project milestone','Diamond','new-project-milestone');
  add('Archive project','Archive','archive-projects');add('Favorite project','Star','favorite-projects');add('Copy project URL','Link','copy-entity-url');add('Copy project title','Copy','copy-entity-title');add('Copy project title as link','Link','copy-project-links');add('Copy project as Markdown','Copy','copy-project-markdown');add('Copy customer requests as Markdown','Copy','copy-project-requests-markdown');
  if((context.count??1)===1)add('Rename project','Pencil','rename-project');add('Delete project','Trash2','delete-issue');
 }
 if(context.initiative){add('Change initiative owner','User','edit-property',{field:'ownerId'});add('Favorite initiative','Star','toggle-favorite');add('Copy initiative URL','Link','copy-entity-url');}
 if(context.triageId&&!context.shared)for(const[label,command,key]of [['Accept issue','triage-accept','1'],['Mark triage issue as duplicate','triage-duplicate','2'],['Decline issue','triage-decline','3'],['Snooze issue','triage-snooze','H']])add(label,'Inbox',command,{value:context.triageId},key);
 return rows;
}
