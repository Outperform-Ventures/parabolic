import type {Customer,CustomerUpsertInput,CustomerNeed,CustomerNeedCreateInput,CustomerNeedUpdateInput,CustomerTier,CustomerTierCreateInput,CustomerTierUpdateInput,CustomerTierListOptions,DeletePayload} from './types.js';
import type {ConnectionPage,OAuthAccessToken,OAuthApplicationFields,OAuthClientCredentialsOptions,WebhookFields} from './types.js';
import type { ApiKey, Attachment, ChangeEvent, Collection, CreateFields, Entities, GraphQLError, Invitation, ListOptions, Mutation, OAuthApplication, OAuthAuthorizationOptions, OAuthCodeExchange, OAuthRefreshOptions, OAuthRevokeOptions, OAuthTokens, Page, PatchFields, RequestOptions, Session, User, Webhook, WorkspaceData } from './types.js';
import type { AttachmentTarget, ConvertIssueOptions, CustomEmoji, CycleActionOptions, CycleActionResult, DuplicateIssueOptions, DuplicateProjectOptions, SearchOptions, SearchResult, StreamEvent, SyncBootstrap, SyncChanges, TriageIssueOptions } from './types.js';

export class ApiError extends Error {
  readonly name = 'ApiError';
  constructor(message: string, readonly status: number, readonly code?: string, readonly details?: unknown, readonly requestId?: string) { super(message); }
}
export class GraphQLRequestError extends Error {
  readonly name = 'GraphQLRequestError';
  constructor(readonly errors: GraphQLError[], readonly data?: unknown) { super(errors.map(e => e.message).join('; ')); }
}
export interface ClientOptions {
  /** Service origin, without /api/v1. */
  baseUrl: string;
  token?: string | (() => string | Promise<string>);
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
  maxRetries?: number;
  headers?: HeadersInit;
}
const sleep = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal.aborted) return reject(signal.reason);
  const done = () => { signal.removeEventListener('abort', abort); resolve(); };
  const timer = setTimeout(done, ms);
  const abort = () => { clearTimeout(timer); reject(signal.reason); };
  signal.addEventListener('abort', abort, { once: true });
});
function abortable<T>(value:T|Promise<T>,signal?:AbortSignal):Promise<T>{
  if(!signal)return Promise.resolve(value);
  return new Promise((resolve,reject)=>{
    const abort=()=>reject(signal.reason),cleanup=()=>signal.removeEventListener('abort',abort);
    if(signal.aborted)reject(signal.reason);else signal.addEventListener('abort',abort,{once:true});
    // Observe settlement even after cancellation, so a late provider rejection is handled.
    Promise.resolve(value).then(result=>{cleanup();resolve(result);},error=>{cleanup();reject(error);});
  });
}
export function queryString(options: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(options)) if (value !== undefined && value !== null) params.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
  return params.size ? `?${params}` : '';
}
export class ParabolicClient {
  readonly baseUrl: string;
  private readonly transport: typeof globalThis.fetch;
  constructor(readonly options: ClientOptions) {
    const url = new URL(options.baseUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new TypeError('baseUrl must be an HTTP(S) service URL without credentials, query, or fragment');
    this.baseUrl = url.href.replace(/\/$/, '');
    this.transport = options.fetch ?? globalThis.fetch;
    if (!this.transport) throw new Error('A fetch implementation is required');
  }
  request<T>(path: string, method = 'GET', body?: unknown, options: RequestOptions = {}): Promise<T> {return this.perform(path,method,body,options);}
  private authorizationToken(signal?:AbortSignal){signal?.throwIfAborted();return abortable(typeof this.options.token==='function'?this.options.token():this.options.token,signal);}
  private async perform<T>(path: string, method = 'GET', body?: unknown, options: RequestOptions = {},binary=false): Promise<T> {
    if (!path.startsWith('/') || path.startsWith('//')) throw new TypeError('Request path must be relative to the service origin');
    const timeout = AbortSignal.timeout(options.timeoutMs ?? this.options.timeoutMs ?? 30_000);
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
    const headers = new Headers(this.options.headers);
    new Headers(options.headers).forEach((value, name) => headers.set(name, value));
    headers.set('Accept', binary?'*/*':'application/json');
    const multipart=body instanceof FormData;
    if(multipart)headers.delete('Content-Type');else if (body !== undefined) headers.set('Content-Type', 'application/json');
    const token = typeof this.options.token==='function'?await this.authorizationToken(signal):this.options.token;
    signal.throwIfAborted();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const retries = method === 'GET' ? Math.max(0, Math.min(5, this.options.maxRetries ?? 2)) : 0;
    for (let attempt = 0; ; attempt++) {
      let response: Response;
      try {
        response = await this.transport(`${this.baseUrl}${path}`, { method, headers, body: multipart?body:body === undefined ? undefined : JSON.stringify(body), credentials: 'include', signal });
      } catch (error) {
        if (signal.aborted || attempt >= retries) throw error;
        await sleep(Math.min(5000, 200 * 2 ** attempt), signal); continue;
      }
      if ([429, 502, 503, 504].includes(response.status) && attempt < retries) {
        const value = response.headers.get('Retry-After');
        const wait = value ? (Number.isFinite(Number(value)) ? Number(value) * 1000 : Date.parse(value) - Date.now()) : 200 * 2 ** attempt;
        await response.body?.cancel();
        await sleep(Math.max(0, Math.min(10_000, Number.isFinite(wait) ? wait : 200)), signal); continue;
      }
      if(response.ok&&binary)return new Uint8Array(await response.arrayBuffer()) as T;
      const raw = response.status === 204 ? '' : await response.text();
      let data: any;
      try { data = raw ? JSON.parse(raw) : undefined; } catch { if (response.ok) throw new ApiError('Service returned invalid JSON', response.status, 'invalid_response'); }
      if (!response.ok) throw new ApiError(typeof data?.error === 'string' ? data.error_description ?? data.error : data?.error?.message ?? data?.message ?? `HTTP ${response.status} ${response.statusText}`, response.status, typeof data?.error==='string'?data.error:data?.error?.code ?? data?.code, data?.details ?? data?.error?.details, response.headers.get('x-request-id') ?? undefined);
      return data as T;
    }
  }
  collection<K extends Collection>(kind: K) { return new CollectionClient(this, kind); }
  readonly oauth = {
    authorizationUrl:(fields:OAuthAuthorizationOptions)=>{
      const url=new URL(`${this.baseUrl}/oauth/authorize`);url.search=new URLSearchParams({response_type:'code',client_id:fields.clientId,redirect_uri:fields.redirectUri,state:fields.state,...(fields.actor?{actor:fields.actor}:{}),...(fields.resource?{resource:fields.resource}:{}),...(fields.scopes?{scope:fields.scopes.join(' ')}:{}),...(fields.codeChallenge?{code_challenge:fields.codeChallenge,code_challenge_method:'S256'}:{})}).toString();return url.href;
    },
    clientCredentials:(fields:OAuthClientCredentialsOptions,options?:RequestOptions)=>this.request<OAuthAccessToken>('/oauth/token','POST',{grant_type:'client_credentials',client_id:fields.clientId,client_secret:fields.clientSecret,scope:fields.scopes.join(' ')},options),
    exchangeCode:(fields:OAuthCodeExchange,options?:RequestOptions)=>this.request<OAuthTokens>('/oauth/token','POST',{grant_type:'authorization_code',client_id:fields.clientId,client_secret:fields.clientSecret,redirect_uri:fields.redirectUri,code:fields.code,code_verifier:fields.codeVerifier,resource:fields.resource},options),
    refresh:(fields:OAuthRefreshOptions,options?:RequestOptions)=>this.request<OAuthTokens>('/oauth/token','POST',{grant_type:'refresh_token',client_id:fields.clientId,client_secret:fields.clientSecret,refresh_token:fields.refreshToken,scope:fields.scopes?.join(' '),resource:fields.resource},options),
    revoke:(fields:OAuthRevokeOptions,options?:RequestOptions)=>this.request<void>('/oauth/revoke','POST',{client_id:fields.clientId,client_secret:fields.clientSecret,token:fields.token,token_type_hint:fields.tokenTypeHint},options),
  };
  get issues() { return this.collection('issues'); }
  duplicateIssue(id:string,fields:DuplicateIssueOptions={},options?:RequestOptions){return this.request<{issue:Entities['issues'];issues:Entities['issues'][]}>(`/api/v1/issues/${encodeURIComponent(id)}/duplicate`,'POST',fields,options);}
  convertIssueToProject(id:string,fields:ConvertIssueOptions={},options?:RequestOptions){return this.request<{project:Entities['projects'];issues:Entities['issues'][]}>(`/api/v1/issues/${encodeURIComponent(id)}/convert-to-project`,'POST',fields,options);}
  convertMilestoneToProject(id:string,fields:ConvertIssueOptions&{version?:number}={},options?:RequestOptions){return this.request<{project:Entities['projects'];issues:Entities['issues'][]}>(`/api/v1/milestones/${encodeURIComponent(id)}/convert-to-project`,'POST',fields,options);}
  mergeIssue(id:string,targetId:string,fields:{clientMutationId?:string}={},options?:RequestOptions){return this.request<{issue:Entities['issues'];target:Entities['issues']}>(`/api/v1/issues/${encodeURIComponent(id)}/merge`,'POST',{...fields,targetId},options);}
  get projects() { return this.collection('projects'); }
  duplicateProject(id:string,fields:DuplicateProjectOptions={},options?:RequestOptions){return this.request<{project:Entities['projects'];issues:Entities['issues'][];milestones:Entities['milestones'][];documents:Entities['documents'][]}>(`/api/v1/projects/${encodeURIComponent(id)}/duplicate`,'POST',fields,options);}
  get teams() { return this.collection('teams'); }
  joinTeam(id:string,options?:RequestOptions){return this.request<Entities['teams']>(`/api/v1/teams/${encodeURIComponent(id)}/join`,'POST',{},options);}
  leaveTeam(id:string,options?:RequestOptions){return this.request<Entities['teams']|{id:string;left:true}>(`/api/v1/teams/${encodeURIComponent(id)}/leave`,'POST',{},options);}
  get documents() { return this.collection('documents'); }
  get customers() { return this.collection('customers'); }
  async customerTier(id:string,options?:RequestOptions){const result=await this.graphql<{customerTier:CustomerTier}>('query($id:String!){customerTier(id:$id){id workspaceId version name displayName color description position createdAt updatedAt archivedAt}}',{id},options);return result.customerTier;}
  async customerTiers(fields:CustomerTierListOptions={},options?:RequestOptions){const result=await this.graphql<{customerTiers:ConnectionPage<CustomerTier>}>('query($after:String,$before:String,$first:Int,$includeArchived:Boolean,$last:Int,$orderBy:PaginationOrderBy){customerTiers(after:$after,before:$before,first:$first,includeArchived:$includeArchived,last:$last,orderBy:$orderBy){nodes{id workspaceId version name displayName color description position createdAt updatedAt archivedAt} edges{cursor node{id workspaceId version name displayName color description position createdAt updatedAt archivedAt}} totalCount pageInfo{hasNextPage hasPreviousPage startCursor endCursor}}}',{...fields},options);return result.customerTiers;}
  async customerTierCreate(input:CustomerTierCreateInput,options?:RequestOptions){const result=await this.graphql<{customerTierCreate:{success:boolean;lastSyncId:number;tier:CustomerTier}}>('mutation($input:CustomerTierCreateInput!){customerTierCreate(input:$input){success lastSyncId tier{id workspaceId version name displayName color description position createdAt updatedAt}}}',{input},options);return result.customerTierCreate;}
  async customerTierUpdate(id:string,input:CustomerTierUpdateInput,options?:RequestOptions){const result=await this.graphql<{customerTierUpdate:{success:boolean;lastSyncId:number;tier:CustomerTier}}>('mutation($id:String!,$input:CustomerTierUpdateInput!){customerTierUpdate(id:$id,input:$input){success lastSyncId tier{id workspaceId version name displayName color description position createdAt updatedAt}}}',{id,input},options);return result.customerTierUpdate;}
  async customerTierDelete(id:string,options?:RequestOptions){const result=await this.graphql<{customerTierDelete:DeletePayload}>('mutation($id:String!){customerTierDelete(id:$id){success entityId lastSyncId}}',{id},options);return result.customerTierDelete;}
  async customerUpsert(input:CustomerUpsertInput,options?:RequestOptions){const result=await this.graphql<{customerUpsert:{success:boolean;customer:Customer}}>('mutation($input:CustomerUpsertInput!){customerUpsert(input:$input){success customer{id workspaceId createdAt updatedAt version name domain domains externalIds revenue size ownerId}}}',{input},options);return result.customerUpsert;}
  async customerNeedCreate(input:CustomerNeedCreateInput,options?:RequestOptions){const result=await this.graphql<{customerNeedCreate:{success:boolean;lastSyncId:number;need:CustomerNeed}}>('mutation($input:CustomerNeedCreateInput!){customerNeedCreate(input:$input){success lastSyncId need{id attachmentId body bodyData comment{id body} priority customerId issueId projectId creatorId createdAt updatedAt archivedAt originalIssue{id} url attachment{id url} projectAttachment{id url title metadata}}}}',{input},options);return result.customerNeedCreate;}
  async customerNeedUpdate(id:string,input:CustomerNeedUpdateInput,clearAttachment=false,options?:RequestOptions){const fields='id attachmentId body bodyData comment{id body} priority customerId issueId projectId creatorId createdAt updatedAt archivedAt originalIssue{id} url attachment{id url} projectAttachment{id url title metadata}';const result=await this.graphql<{customerNeedUpdate:{success:boolean;lastSyncId:number;need:CustomerNeed;updatedRelatedNeeds:CustomerNeed[]}}>(`mutation($id:String!,$input:CustomerNeedUpdateInput!,$clearAttachment:Boolean){customerNeedUpdate(id:$id,input:$input,clearAttachment:$clearAttachment){success lastSyncId need{${fields}} updatedRelatedNeeds{${fields}}}}`,{id,input,clearAttachment},options);return result.customerNeedUpdate;}
  async customerNeedArchive(id:string,options?:RequestOptions){const result=await this.graphql<{customerNeedArchive:{success:boolean;lastSyncId:number;entity:CustomerNeed|null}}>('mutation($id:String!){customerNeedArchive(id:$id){success lastSyncId entity{id attachmentId body bodyData comment{id body} priority customerId issueId projectId creatorId createdAt updatedAt archivedAt originalIssue{id} url attachment{id url} projectAttachment{id url title metadata}}}}',{id},options);return result.customerNeedArchive;}
  async customerNeedUnarchive(id:string,options?:RequestOptions){const result=await this.graphql<{customerNeedUnarchive:{success:boolean;lastSyncId:number;entity:CustomerNeed|null}}>('mutation($id:String!){customerNeedUnarchive(id:$id){success lastSyncId entity{id attachmentId body bodyData comment{id body} priority customerId issueId projectId creatorId createdAt updatedAt archivedAt originalIssue{id} url attachment{id url} projectAttachment{id url title metadata}}}}',{id},options);return result.customerNeedUnarchive;}
  async customerNeedDelete(id:string,keepAttachment?:boolean,options?:RequestOptions){const result=await this.graphql<{customerNeedDelete:DeletePayload}>('mutation($id:String!,$keepAttachment:Boolean){customerNeedDelete(id:$id,keepAttachment:$keepAttachment){success lastSyncId entityId}}',{id,keepAttachment},options);return result.customerNeedDelete;}
  async customerNeedCreateFromAttachment(input:{attachmentId:string},options?:RequestOptions){const result=await this.graphql<{customerNeedCreateFromAttachment:{success:boolean;lastSyncId:number;need:CustomerNeed}}>('mutation($input:CustomerNeedCreateFromAttachmentInput!){customerNeedCreateFromAttachment(input:$input){success lastSyncId need{id attachmentId body bodyData comment{id body} priority customerId issueId projectId creatorId createdAt updatedAt archivedAt originalIssue{id} url attachment{id url} projectAttachment{id url title metadata}}}}',{input},options);return result.customerNeedCreateFromAttachment;}
  mergeCustomer(id:string,targetId:string,options?:RequestOptions){return this.request<Entities['customers']>(`/api/v1/customers/${encodeURIComponent(id)}/merge`,'POST',{targetId},options);}
  get workspaces() { return this.collection('workspaces'); }
  get users() { return this.collection('users'); }
  get memberships() { return this.collection('memberships'); }
  get statuses() { return this.collection('statuses'); }
  get milestones() { return this.collection('milestones'); }
  get initiatives() { return this.collection('initiatives'); }
  initiativeRollup(id:string,fields:{directOnly?:boolean}={},options?:RequestOptions){return this.request<{initiativeIds:string[];projects:Entities['projects'][];directProjectIds:string[];children:Entities['initiatives'][]}>(`/api/v1/initiatives/${encodeURIComponent(id)}/rollup${queryString(fields)}`,'GET',undefined,options);}
  get cycles() { return this.collection('cycles'); }
  get labelGroups() { return this.collection('labelGroups'); }
  get labels() { return this.collection('labels'); }
  get views() { return this.collection('views'); }
  get comments() { return this.collection('comments'); }
  get activities() { return this.collection('activities'); }
  get notifications() { return this.collection('notifications'); }
  get requests() { return this.collection('requests'); }
  get dashboards() { return this.collection('dashboards'); }
  get templates() { return this.collection('templates'); }
  get favorites() { return this.collection('favorites'); }
  get subscriptions() { return this.collection('subscriptions'); }
  get integrations() { return this.collection('integrations'); }
  get automations() { return this.collection('automations'); }
  get slaPolicies() { return this.collection('slaPolicies'); }
  get asksForms() { return this.collection('asksForms'); }
  get asksPages() { return this.collection('asksPages'); }
  get updates() { return this.collection('updates'); }
  state(options?: RequestOptions) { return this.request<WorkspaceData>('/api/v1/state', 'GET', undefined, options); }
  authStatus(options?: RequestOptions) { return this.request<{ setupRequired: boolean; user: User | null; workspaceId?: string | null }>('/auth/status', 'GET', undefined, options); }
  login(email: string, password: string, options?: RequestOptions) { return this.request<{ user: User; workspaceId: string }>('/auth/login', 'POST', { email, password }, options); }
  setup(fields: { email: string; password: string; name: string; workspaceName: string }, options?: RequestOptions) { return this.request<{ user: User; workspaceId: string }>('/auth/setup', 'POST', fields, options); }
  logout(options?: RequestOptions) { return this.request<void>('/auth/logout', 'POST', {}, options); }
  changePassword(currentPassword: string, newPassword: string, options?: RequestOptions) { return this.request<void>('/auth/password', 'POST', { currentPassword, newPassword }, options); }
  switchWorkspace(workspaceId: string, options?: RequestOptions) { return this.request<{ workspaceId: string; user: User }>('/auth/workspace', 'POST', { workspaceId }, options); }
  accessibleWorkspaces(options?: RequestOptions) { return this.request<{ nodes: Entities['workspaces'][] }>('/auth/workspaces', 'GET', undefined, options); }
  createWorkspace(name: string, options?: RequestOptions) { return this.request<{ workspaceId: string; user: User }>('/auth/workspaces', 'POST', { name }, options); }
  join(fields:{token:string;name:string;password:string},options?:RequestOptions){return this.request<{workspaceId:string;user:User}>('/auth/join','POST',fields,options);}
  readonly sync={
    bootstrap:(options?:RequestOptions)=>this.request<SyncBootstrap>('/api/v1/sync/bootstrap','GET',undefined,options),
    changes:(fields:{after:number;first?:number;accessRevision?:number},options?:RequestOptions)=>this.request<SyncChanges>(`/api/v1/sync/changes${queryString(fields)}`,'GET',undefined,options),
    scan:<K extends Collection>(kind:K,fields:{after?:string;first?:number}={},options?:RequestOptions)=>this.request<Pick<Page<Entities[K]>,'nodes'|'pageInfo'>>(`/api/v1/sync/${kind}${queryString(fields)}`,'GET',undefined,options),
    access:(records:{kind:Collection;id:string}[],options?:RequestOptions)=>this.request<{allowed:string[]}>('/api/v1/sync/access','POST',{records},options),
  };
  batch(operations: Mutation[], clientMutationId?: string, options?: RequestOptions) { return this.request<{ results: unknown[] }>('/api/v1/batch', 'POST', { operations, clientMutationId }, options); }
  insights(fields:{kind?:Collection;groupBy?:string;filter?:Record<string,unknown>}={},options?:RequestOptions){return this.request<{nodes:{key:string;count:number;estimate:number;completed:number}[];totalCount:number}>(`/api/v1/insights${queryString(fields)}`,'GET',undefined,options);}
  readonly publicAsks={
    get:(id:string,options?:RequestOptions)=>this.request<Pick<Entities['asksForms'],'id'|'name'|'description'|'fields'>>(`/public/asks/${encodeURIComponent(id)}`,'GET',undefined,options),
    submit:(id:string,fields:{title:string;email?:string;body?:string;answers?:Record<string,unknown>;submissionKey?:string},options?:RequestOptions)=>this.request<{id:string;identifier:string;status:'received'}>(`/public/asks/${encodeURIComponent(id)}`,'POST',fields,options),
  };
  readonly asksSite={
    pages:(options?:RequestOptions)=>this.request<{pages:{id:string;name:string;description:string;slug:string;templates:{id:string;name:string;teamId:string}[]}[]}>('/api/v1/asks-site','GET',undefined,options),
    submit:(slug:string,fields:{templateId:string;submissionKey:string;title?:string;description?:string;templateAnswers?:Record<string,unknown>},options?:RequestOptions)=>this.request<{id:string;issueId:string;identifier:string;status:'received';replayed:boolean}>(`/api/v1/asks-site/${encodeURIComponent(slug)}`,'POST',fields,options),
  };
  search(q: string, options: SearchOptions & RequestOptions = {}) {
    const { signal, headers, timeoutMs, kinds, ...rest } = options;
    return this.request<Page<SearchResult>>(`/api/v1/search${queryString({ q, ...rest, kinds: kinds?.join(',') })}`, 'GET', undefined, { signal, headers, timeoutMs });
  }
  async graphql<T = unknown>(query: string, variables?: Record<string, unknown>, options?: RequestOptions): Promise<T> {
    const result = await this.request<{ data?: T; errors?: GraphQLError[] }>('/graphql', 'POST', { query, variables }, options);
    if (result.errors?.length) throw new GraphQLRequestError(result.errors, result.data);
    if (result.data === undefined) throw new ApiError('GraphQL response has no data', 200, 'invalid_response');
    return result.data;
  }
  readonly apiKeys = {
    list: (options?: RequestOptions) => this.request<{ nodes: ApiKey[] }>('/api/v1/api-keys', 'GET', undefined, options),
    create: (fields: { name: string; scopes: string[]; expiresAt?: string }, options?: RequestOptions) => this.request<ApiKey & { token: string }>('/api/v1/api-keys', 'POST', fields, options),
    revoke: (id: string, options?: RequestOptions) => this.request<void>(`/api/v1/api-keys/${encodeURIComponent(id)}`, 'DELETE', undefined, options),
  };
  readonly sessions = {
    list: (options?: RequestOptions) => this.request<{ nodes: Session[] }>('/auth/sessions', 'GET', undefined, options),
    revoke: (id: string, options?: RequestOptions) => this.request<void>(`/auth/sessions/${encodeURIComponent(id)}`, 'DELETE', undefined, options),
  };
  readonly apps = {
    rotateSecret:(id:string,options?:RequestOptions)=>this.request<{id:string;clientSecret:string;credentialsRevoked:true}>(`/api/v1/apps/${encodeURIComponent(id)}/rotate-secret`,'POST',{},options),
    list: (options?: RequestOptions) => this.request<{ nodes: OAuthApplication[] }>('/api/v1/apps', 'GET', undefined, options),
    create: (fields: OAuthApplicationFields, options?: RequestOptions) => this.request<OAuthApplication>('/api/v1/apps', 'POST', fields, options),
    update: (id: string, fields: Partial<OAuthApplicationFields>, options?: RequestOptions) => this.request<OAuthApplication>(`/api/v1/apps/${encodeURIComponent(id)}`, 'PATCH', fields, options),
    remove: (id: string, options?: RequestOptions) => this.request<void>(`/api/v1/apps/${encodeURIComponent(id)}`, 'DELETE', undefined, options),
  };
  readonly invitations = {
    list: (options?: RequestOptions) => this.request<{ nodes: Invitation[] }>('/api/v1/invitations', 'GET', undefined, options),
    create: (fields: { email: string; role?: string }, options?: RequestOptions) => this.request<Invitation>('/api/v1/invitations', 'POST', fields, options),
    remove: (id: string, options?: RequestOptions) => this.request<void>(`/api/v1/invitations/${encodeURIComponent(id)}`, 'DELETE', undefined, options),
  };
  readonly webhooks = {
    list: (options?: RequestOptions) => this.request<{ nodes: Webhook[] }>('/api/v1/webhooks', 'GET', undefined, options),
    create: (fields: WebhookFields, options?: RequestOptions) => this.request<Webhook>('/api/v1/webhooks', 'POST', fields, options),
    update: (id: string, fields: Partial<WebhookFields>, options?: RequestOptions) => this.request<Webhook>(`/api/v1/webhooks/${encodeURIComponent(id)}`, 'PATCH', fields, options),
    remove: (id: string, options?: RequestOptions) => this.request<void>(`/api/v1/webhooks/${encodeURIComponent(id)}`, 'DELETE', undefined, options),
    test: (id: string, options?: RequestOptions) => this.request<unknown>(`/api/v1/webhooks/${encodeURIComponent(id)}/test`, 'POST', {}, options),
    deliveries: (id: string, options?: RequestOptions) => this.request<{ nodes: unknown[] }>(`/api/v1/webhooks/${encodeURIComponent(id)}/deliveries`, 'GET', undefined, options),
    retry: (id: string, options?: RequestOptions) => this.request<unknown>(`/api/v1/webhook-deliveries/${encodeURIComponent(id)}/retry`, 'POST', {}, options),
  };
  upload(fields: { filename: string; mimeType: string; content: string } & AttachmentTarget, options?: RequestOptions) { return this.request<Attachment>('/api/v1/attachments', 'POST', fields, options); }
  uploadFile(file:Blob,fields:AttachmentTarget&{filename?:string}={},options?:RequestOptions){const body=new FormData();body.append('file',file,fields.filename??(file instanceof File?file.name:'attachment'));for(const [key,value]of Object.entries(fields))if(value!==undefined&&key!=='filename')body.append(key,value);return this.request<Attachment>('/api/v1/attachments','POST',body,options);}
  downloadAttachment(id:string,options?:RequestOptions){return this.perform<Uint8Array>(`/api/v1/attachments/${encodeURIComponent(id)}`,'GET',undefined,options,true);}
  deleteAttachment(id:string,options?:RequestOptions){return this.request<void>(`/api/v1/attachments/${encodeURIComponent(id)}`,'DELETE',undefined,options);}
  uploadAvatar(userId:string,file:Blob,filename='avatar',options?:RequestOptions){const body=new FormData();body.append('file',file,filename);return this.request<User>(`/api/v1/users/${encodeURIComponent(userId)}/avatar`,'POST',body,options);}
  removeAvatar(userId:string,options?:RequestOptions){return this.request<User>(`/api/v1/users/${encodeURIComponent(userId)}/avatar`,'DELETE',undefined,options);}
  triageIssue(id:string,fields:TriageIssueOptions,options?:RequestOptions){return this.request<{issue:Entities['issues'];comment?:Entities['comments']}>(`/api/v1/issues/${encodeURIComponent(id)}/triage`,'POST',fields,options);}
  startCycleToday(id:string,fields:CycleActionOptions={},options?:RequestOptions){return this.request<CycleActionResult>(`/api/v1/cycles/${encodeURIComponent(id)}/start-today`,'POST',fields,options);}
  endCycleToday(id:string,fields:CycleActionOptions={},options?:RequestOptions){return this.request<CycleActionResult>(`/api/v1/cycles/${encodeURIComponent(id)}/end-today`,'POST',fields,options);}
  readonly customEmojis={
    list:(options?:RequestOptions)=>this.request<{nodes:CustomEmoji[]}>('/api/v1/custom-emojis','GET',undefined,options),
    upload:(name:string,file:Blob,filename='emoji.png',options?:RequestOptions)=>{const body=new FormData();body.append('name',name);body.append('file',file,filename);return this.request<CustomEmoji>('/api/v1/custom-emojis','POST',body,options);},
    remove:(id:string,options?:RequestOptions)=>this.request<void>(`/api/v1/custom-emojis/${encodeURIComponent(id)}`,'DELETE',undefined,options),
  };
  /** Opens one authenticated event stream. Reconnect with lastEventId after disconnect. */
  async *events(options: { signal?: AbortSignal; lastEventId?: string } = {}): AsyncGenerator<StreamEvent> {
    const headers = new Headers(this.options.headers);
    headers.set('Accept', 'text/event-stream');
    const token = typeof this.options.token==='function'?await this.authorizationToken(options.signal):this.options.token;
    options.signal?.throwIfAborted();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (options.lastEventId) headers.set('Last-Event-ID', options.lastEventId);
    const response = await this.transport(`${this.baseUrl}/api/v1/events`, { headers, credentials: 'include', signal: options.signal });
    if (!response.ok || !response.body) throw new ApiError('Unable to open change stream', response.status);
    const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '',eventName=''; let data: string[] = [];
    try {
      while (true) {
        const chunk = await reader.read(); buffer += decoder.decode(chunk.value, { stream: !chunk.done });
        let newline: number;
        while ((newline = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, newline).replace(/\r$/, ''); buffer = buffer.slice(newline + 1);
          if (!line) { if (data.length) { const event = JSON.parse(data.join('\n')); data = [];if(eventName==='access'&&Number.isSafeInteger(event?.accessRevision))yield {event:'access',accessRevision:event.accessRevision};else if ((!eventName||eventName==='message')&&event && typeof event.kind === 'string' && typeof event.seq === 'number') yield {...event,event:'change'} as StreamEvent; }eventName=''; }
          else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
          else if(line.startsWith('event:'))eventName=line.slice(6).trim();
        }
        if (buffer.length > 2_000_000 || data.join('').length > 2_000_000) throw new ApiError('Event exceeds size limit', 200, 'invalid_response');
        if (chunk.done) break;
      }
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  }
}
export class CollectionClient<K extends Collection> {
  constructor(private client: ParabolicClient, readonly kind: K) {}
  list(options: ListOptions = {}, request?: RequestOptions) { return this.client.request<ConnectionPage<Entities[K]>>(`/api/v1/${this.kind}${queryString(options as Record<string, unknown>)}`, 'GET', undefined, request); }
  get(id: string, options?: RequestOptions) { return this.client.request<Entities[K]>(`/api/v1/${this.kind}/${encodeURIComponent(id)}`, 'GET', undefined, options); }
  create(fields: CreateFields<K>, options?: RequestOptions) { return this.client.request<Entities[K]>(`/api/v1/${this.kind}`, 'POST', fields, options); }
  update(id: string, fields: PatchFields<K>, options?: RequestOptions) { return this.client.request<Entities[K]>(`/api/v1/${this.kind}/${encodeURIComponent(id)}`, 'PATCH', fields, options); }
  remove(id: string, options?: RequestOptions) { return this.client.request<void>(`/api/v1/${this.kind}/${encodeURIComponent(id)}`, 'DELETE', undefined, options); }
  restore(id: string, options?: RequestOptions) { return this.client.request<Entities[K]>(`/api/v1/${this.kind}/${encodeURIComponent(id)}/restore`, 'POST', {}, options); }
  /** Backward pagination yields records in reverse order; list() always preserves the selected display order. */
  async *iterate(options: ListOptions = {}, request?: RequestOptions): AsyncGenerator<Entities[K]> {
    const backward=options.last!==undefined||options.before!==undefined;
    if(options.first!==undefined&&(options.last!==undefined||options.before!==undefined)||options.after!==undefined&&(options.before!==undefined||options.last!==undefined))throw new TypeError('Use first/after or last/before pagination');
    let cursor=backward?options.before:options.after;
    const seen=new Set<string>(cursor?[cursor]:[]);
    while(true){
      const page=await this.list(backward?{last:100,...options,before:cursor}:{first:100,...options,after:cursor},request);
      for(const node of backward?[...page.nodes].reverse():page.nodes)yield node;
      const more=backward?page.pageInfo.hasPreviousPage:page.pageInfo.hasNextPage;
      if(!more)return;
      const next=backward?page.pageInfo.startCursor:page.pageInfo.endCursor;
      if(!next||seen.has(next))throw new ApiError('Pagination cursor did not advance',200,'invalid_cursor');
      cursor=next;seen.add(cursor);
    }
  }
}
