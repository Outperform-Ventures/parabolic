export type HelpReferenceAction='documentation'|'api-documentation'|'status';
export const HELP_REFERENCE_EVENT='parabolic:help-reference';

export interface ParabolicDocumentationArticle {title:string;body:string}
export const parabolicDocumentationArticles:ParabolicDocumentationArticle[]=[
 {title:'Issues',body:'Create an issue using the compose button or C. Set its team, status, priority, assignee and project, then choose Create issue. Open a row to edit its description, properties, comments and relationships.'},
 {title:'Filtering and sorting',body:'Use Filter in an issue view to narrow the list by properties. Display options control grouping and ordering. Multiple sort rules are applied in order, with the next rule breaking ties. Reorder rules to change their precedence.'},
 {title:'Sidebar and favorites',body:'Open More → Customize sidebar, or Settings → Preferences → App sidebar, to change navigation visibility, order and badge style. Drag navigation rows within their section. Your teams and Favorites can be collapsed. Right-click a favorite to copy its URL, open a tab or remove it. Create folders from the Favorites heading and drag favorites into them.'},
 {title:'Teams and subscriptions',body:'Expand a team to open its issues, projects and views. Its menu provides settings, favorites, the archive and subscription options. Subscribe separately to issues added, completed or canceled, or added to triage. Your own changes do not send you subscription notifications.'},
 {title:'Projects and views',body:'Projects collect related issues, milestones, documents and updates. Views save filters and presentation settings so you can return to the same set of work. Favorite frequently used views to keep them in the sidebar.'},
 {title:'Keyboard navigation',body:'Press ⌘K to open workspace commands. The Help menu includes the full keyboard-shortcut guide. Use arrow keys and Enter in menus, Escape to dismiss them, and type to filter sidebar menus.'},
];

export const apiReferenceSections=[
 {title:'Service origin',body:'API paths are relative to the same Parabolic service origin shown below.'},
 {title:'Authentication',body:'Browser requests use the authenticated session. Server integrations use a scoped API token or OAuth access token. Never embed an administrator token in browser code.'},
 {title:'REST API',body:'REST collections and operations use /api/v1. Errors return an error code, message, and optional details.'},
 {title:'GraphQL',body:'Send queries and mutations as JSON to POST /graphql.'},
 {title:'Parabolic SDK',body:'The typed @parabolic/sdk client supports REST collections, GraphQL, search, synchronization, uploads, and OAuth in browsers and Node.'},
 {title:'Webhooks',body:'Create scoped webhooks in API settings. Receivers should verify X-Parabolic-Signature against the raw request body and deduplicate X-Parabolic-Delivery.'},
 {title:'MCP',body:'The authenticated MCP endpoint is /mcp. OAuth discovery and consent bind each grant to that resource.'},
] as const;

export interface ParabolicHealth {status:'operational'|'unavailable';version?:string;message?:string}
export async function loadParabolicHealth(fetcher:typeof fetch=fetch,timeoutMs=5000):Promise<ParabolicHealth>{
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const response=await fetcher('/api/v1/health',{method:'GET',credentials:'same-origin',cache:'no-store',signal:controller.signal});
  if(!response.ok)return {status:'unavailable',message:`Service returned HTTP ${response.status}`};
  const body=await response.json() as {status?:unknown;version?:unknown};
  if(body.status!=='ok')return {status:'unavailable',message:'Service reported an unavailable state'};
  return {status:'operational',...(typeof body.version==='string'?{version:body.version}:{})};
 }catch(error){
  return {status:'unavailable',message:controller.signal.aborted?'Status request timed out':error instanceof Error?error.message:'Status request failed'};
 }finally{clearTimeout(timer);}
}
