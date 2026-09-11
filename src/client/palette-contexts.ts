import {defaultPaletteItems,paletteDefaultInventory} from './palette-defaults';
type Command={label:string;shortcut?:string};
export interface PaletteContext {issueCount?:number;issueLabel?:string;issueDetail?:boolean;projects?:boolean;projectCount?:number;projectLabel?:string;assignedToMe?:boolean;teamLabel?:string;teamOverview?:boolean;teamFavorite?:boolean}
/** Native batch009 rendered, virtualized command census. Preserve guarded handlers;
 * an unavailable source action is never synthesized by inventory projection. */
export function contextualPaletteItems<T extends Command>(commands:T[],context:PaletteContext={}){
 const result:Array<T&{section:string;shortcut?:string}>=[],used=new Set<T>();
 const add=(source:string,label:string,section:string,shortcut?:string)=>{const row=commands.find(item=>item.label===source);if(!row||used.has(row))return;used.add(row);result.push({...row,label,section,...(shortcut===undefined?{}:{shortcut})});};
 const n=context.issueCount??0,plural=n>1,section=plural?`${n} issues`:context.issueLabel??'Issue';
 if(n){
  for(const [source,label,key]of [
   ['Change assignee','Assign to…','A'],['Assign to me',context.assignedToMe?'Un-assign from me':'Assign to me','I'],
   ['Change status','Change status…','S'],['Change priority','Change priority…','P'],['Change project','Add to project…','⇧ P'],
   ['Change labels','Add labels…','L'],['Change estimate','Change estimate…','⇧ E'],['Change team','Move to a different team…','⌘ ⇧ M'],['Change due date','Set due date…','⇧ D'],
   ['Copy issue ID',plural?'Copy issue IDs':'Copy issue ID','⌘ .'],['Copy issue URL',plural?'Copy issue URLs':'Copy issue URL','⌘ ⇧ ,'],
   ['Copy issue title',plural?'Copy issue titles':'Copy issue title',"⌘ ⇧ '"],['Copy issue title as link',plural?'Copy titles as links':'Copy title as link','⌘ C'],
   ['Copy issue description',plural?'Copy issue descriptions as Markdown':'Copy issue description as Markdown',''],['Copy issue as Markdown','Copy issue content as Markdown','⌘ ⌥ C'],
   ['Manage subscribers','Change subscribers…','⌘ ⇧ S'],['Mark issue as','Mark issue as…',''],['Show similar issues…','Show similar issues…',''],
   ...(!context.issueDetail?[['Remove all subscribers','Remove all subscribers',''] as [string,string,string]]:[]),
   ['Favorite issue','Favorite issue','⌥ F'],['Add link to issue','Add link…','⌃ L'],['Create document for issue','Create new document for issue…',''],
   ['Add customer request','Add customer request to issue…','⌃ R'],['Remind me about this issue','Remind me about this issue…','⇧ H'],
   ['Issue description history','Issue description history',''],['Rename issue','Rename issue','⇧ R'],
   ['Duplicate issue','Make a copy as new issue…',''],['Convert issue to project','Convert to project…',''],['Convert into template…','Convert into template…',''],['Convert into recurring issue','Convert into recurring issue…',''],['Edit recurrence','Edit recurring issue…',''],['Delete issue','Delete issue','⌘ ⌫'],
  ])add(source,label,section,key);
 }
 const projectCount=context.projectCount??0,projectSection=projectCount===1?`Project ⋅ ${context.projectLabel??'Project'}`:`${projectCount} projects`;
 if(!n&&projectCount){
  for(const [source,label,key] of [
   ['Edit project','Edit project…',''],['Change project status','Change project status…','P S'],['Change project priority','Change project priority…','P P'],['Change project labels','Add labels…','P L'],['Change project target date','Set project target date…','⌃ ⌥ D'],['Change project start date','Set project start date…','⌃ ⌥ S'],
   ['Change project dependencies','Change project dependencies…',''],['Rename project','Rename project','⇧ R'],['Create new document for project','Create new document…',''],['Open project updates and activity','Open project updates and activity',''],['Add customer request','Add customer request to project…','⌃ R'],['Remind me about project',projectCount===1?'Remind me about this project…':'Remind me about these projects…','⇧ H'],
   ['Change project lead','Set project lead…','P A'],['Change project members','Change project members…','P M'],['Change project teams','Change project teams…','P T'],['Favorite project',projectCount===1?'Favorite project':'Favorite projects','⌥ F'],['Subscribe to project notifications','Subscribe to project notifications…',''],['Unsubscribe from project notifications','Unsubscribe from project notifications…',''],
   ['Copy project URL',projectCount===1?'Copy project URL':'Copy project URLs','⌘ ⇧ ,'],['Copy project title',projectCount===1?'Copy project title':'Copy project titles',"⌘ ⇧ '"],['Copy project title as link',projectCount===1?'Copy title as link':'Copy titles as links','⌘ C'],['Copy project as Markdown',projectCount===1?'Copy project overview as Markdown':'Copy project overviews as Markdown','⌘ ⌥ C'],['Delete project',projectCount===1?'Delete project':'Delete projects',''],['Create new project milestone','Create new project milestone…',''],
  ])add(source,label,projectSection,key);
 }
 if(!n&&context.teamOverview)add('Add document to team overview…','Add document to team overview…','Team overview','');
 let defaults=defaultPaletteItems(commands);
 if(context.projects){defaults=[...defaults.filter(row=>row.section==='Projects'),...defaults.filter(row=>row.section!=='Projects')];if(!n){const index=defaults.findIndex(row=>row.label==='Find in view…'),filter=defaults.findIndex(row=>row.label==='Add Filter…');if(index>=0&&filter>=0)[defaults[index],defaults[filter]]=[defaults[filter],defaults[index]];}}
 for(const row of defaults){
  if(context.issueDetail&&row.label==='Find in view…')continue;
  const source=paletteDefaultInventory.find(entry=>entry[2]===row.label)?.[1];if(source)add(source,row.label,row.section,row.shortcut);
  if(row.label==='Create new initiative'&&context.teamLabel){
   const teamSection=`Team ⋅ ${context.teamLabel}`;
   if(n)add(context.teamFavorite?'Unfavorite team':'Favorite team',context.teamFavorite?'Unfavorite team':'Favorite team',teamSection,'⌥ F');
   add('Copy team title','Copy team title',teamSection,"⌘ ⇧ '");add('Copy title as link','Copy title as link',teamSection,'⌘ C');
  }
 }
 for(const[source,label,group,key]of [
  ['Create new document template','Create new document template…','Templates',''],['Create new project template','Create new project template…','Templates',''],
  ...(context.teamLabel&&!n?[[context.teamFavorite?'Unfavorite team':'Favorite team',context.teamFavorite?'Unfavorite page':'Favorite page','Favorites','⌥ F'] as [string,string,string,string]]:[]),
  ['Create new folder','Create new folder…','Favorites',''],['Open last viewed issue','Open last viewed issue','Navigation',''],['Open in new window','Open in new window','Navigation','⌃ ,'],
  ['Open issue','Open issue…','Navigation','O I'],['Open team','Open team…','Navigation','O T'],['Open team archive','Open team archive…','Navigation','G X'],['Open project','Open project…','Navigation','O P'],['Open favorite','Open favorite…','Navigation','O F'],['Open label','Open issue label…','Navigation','O L'],['Open user…','Open user…','Navigation','O U'],['Open view','Open view…','Navigation','O V'],['Open document','Open document…','Navigation','O D'],['Open customer','Open customer…','Navigation','O Q'],
  ['Go to advanced search','Go to advanced search','Navigation','/'],['Go to inbox','Go to inbox','Navigation','G I'],['Go to my issues','Go to my issues','Navigation','G M'],['Open drafts','Go to drafts','Navigation','G D'],['Go to active issues','Go to active issues','Navigation','G A'],['Go to backlog','Go to backlog','Navigation','G B'],['Go to all issues','Go to all issues','Navigation','G E'],['Go to projects','Go to projects','Navigation','G P'],['Go to initiatives','Go to initiatives','Navigation','G N'],['Go to views','Go to views','Navigation','G U'],['Go to customers','Go to customers','Navigation','G Q'],['Go to teams','Go to teams','Navigation',''],
  ['Go to recently deleted issues','Go to recently deleted issues','Navigation',''],['Go to recently deleted projects','Go to recently deleted projects','Navigation',''],['Go to recently deleted initiatives','Go to recently deleted initiatives','Navigation',''],['Go to recently deleted documents','Go to recently deleted documents','Navigation',''],
  ['Open settings','Go to settings','Navigation','G S'],['Open settings…','Open settings…','Navigation','O S'],['Open recently viewed','Open recently viewed','Navigation','⌘ Y'],['Toggle sidebar','Collapse navigation sidebar','Navigation','['],
  ['Open tab','Open tab…','Navigation','⌘ ⇧ A'],['Close tab','Close tab','Navigation','⌘ W'],['New tab','New tab','Navigation','⌘ T'],['Next tab','Next tab','Navigation','⌘ ⇧ ]'],['Previous tab','Previous tab','Navigation','⌘ ⇧ ['],['Pin tab','Pin tab','Navigation','⌃ ⇧ P'],['Close other tabs','Close other tabs','Navigation','⌘ ⌥ W'],['Close tabs to the right','Close tabs to the right','Navigation',''],
  ['Display options','Display options…','View',''],['Select all','Select all','View','⌘ A'],['Copy page URL','Copy page URL','View','⌘ ⇧ C'],
  ['Open suspended user…','Open suspended user…','Workspace',''],['Change interface theme…','Change interface theme…','Workspace',''],['Change default view…','Change default view…','Workspace',''],['Invite to Parabolic…','Invite to Parabolic…','Workspace',''],['Create a team…','Create a team…','Workspace',''],['Leave team…','Leave team…','Workspace',''],
  ['Contact support','Contact support','Help',''],['Send feedback','Send feedback','Help',''],['Open Parabolic Documentation','Open Parabolic Documentation','Help',''],['Open API Documentation','Open API Documentation','Help',''],['Parabolic status','Parabolic status','Help',''],['Report performance problem','Report performance problem','Help',''],
  ['Keyboard shortcuts','Open Keyboard Shortcuts Cheat Sheet','Help','⌘ /'],['Create or join a workspace','Create or join a workspace…','Account',''],['Log out','Log out','Account','⌥ ⇧ Q'],['Disable hardware acceleration','Disable hardware acceleration','Developer',''],
 ])add(source,label,group,key);
 return result;
}
