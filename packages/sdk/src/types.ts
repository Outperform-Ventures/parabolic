export const COLLECTIONS = ['workspaces','teams','users','memberships','statuses','issues','projects','milestones','initiatives','cycles','labels','labelGroups','views','documents','comments','activities','notifications','customers','customerTiers','requests','dashboards','templates','favorites','subscriptions','integrations','automations','slaPolicies','asksForms','asksPages','updates'] as const;
export type Collection = typeof COLLECTIONS[number];
export interface Entity { id: string; workspaceId: string; createdAt: string; updatedAt: string; version: number; [key: string]: unknown }
export interface Issue extends Entity { directCustomerIds?:string[]; inheritProjectCustomers?:boolean; effectiveCustomerIds?:string[]; inheritedCustomerIds?:string[]; title: string; identifier: string; description?: string; teamId: string; statusId?: string; projectId?: string | null; cycleId?: string | null; assigneeId?: string | null; priority?: number; labelIds?: string[]; parentId?: string | null; startDate?: string | null; dueDate?: string | null }
export interface Project extends Entity { directCustomerIds?:string[]; effectiveCustomerIds?:string[]; name: string; description?: string; status?: string; teamIds?: string[]; leadId?: string | null; targetDate?: string | null }
export interface Team extends Entity { name: string; key:string; identifier?: string;parentId?:string|null;private?:boolean;memberIds?:string[] }
export interface User extends Entity { name: string; email: string; username?:string; avatar?: string|null; avatarAttachmentId?:string|null;isApp?:boolean;appId?:string }
export interface Workspace extends Entity { name: string; urlKey?: string; preferences?: Record<string, unknown> }
export interface Membership extends Entity { userId: string; teamId?: string; role: 'owner' | 'admin' | 'member' | 'guest' }
export interface WorkflowStatus extends Entity { name: string; teamId: string; type: string; color: string; position: number }
export interface Milestone extends Entity { name: string; projectId: string; description?: string; targetDate?: string | null }
export interface Initiative extends Entity { name: string; description?: string; ownerId?: string | null; status?: string; targetDate?: string | null; projectIds?: string[];parentIds?:string[] }
export interface Cycle extends Entity { name?: string; number?: number; teamId: string; startDate: string; endDate: string; description?: string }
export interface LabelGroup extends Entity { name:string; entityType:'issues'|'projects'; teamId?:string|null; description?:string; color?:string }
export interface Label extends Entity { labelGroupId?:string|null; group?:string|null; entityType?:'issues'|'projects'; name: string; color: string; teamId?: string | null; description?: string; parentId?: string | null }
export interface View extends Entity { name: string; description?: string; icon?: string; color?: string; filters?: Filter; layout?: string; visibility?: string; teamId?: string | null }
export interface Document extends Entity { title: string; content?: string; projectId?: string | null; teamId?: string | null; icon?: string; color?: string }
export interface Comment extends Entity { body: string; issueId?: string; documentId?: string; projectId?: string; userId?: string; parentId?: string | null; reactions?: Record<string, string[]> }
export interface Activity extends Entity { action: string; actorId?: string; entityId?: string; entityKind?: Collection; changes?: Record<string, unknown> }
export interface InboxNotification extends Entity { title?: string; userId: string; issueId?: string; projectId?: string; documentId?:string; initiativeId?:string; entityKind?:Collection; entityId?:string; type?:string; remindAt?:string|null; deliveredAt?:string|null; readAt?: string | null; snoozedUntil?: string | null }
export interface CustomerTier extends Entity {name:string;displayName:string;color:string;description?:string|null;position:number}
export interface CustomerTierListOptions {first?:number;last?:number;after?:string;before?:string;includeArchived?:boolean;orderBy?:'createdAt'|'updatedAt'}
export interface DeletePayload {entityId:string;lastSyncId:number;success:boolean}
export interface CustomerTierCreateInput {id?:string;name?:string;displayName?:string;color:string;description?:string|null;position?:number}
export interface CustomerTierUpdateInput {name?:string;displayName?:string;color?:string;description?:string|null;position?:number}
export interface Customer extends Entity { name: string; tierId?:string|null; tier?:string; domain?: string; domains?:string[];externalIds?:string[];description?: string; revenue?: number; size?: number; status?: string }
export interface CustomerUpsertInput {tierId?:string|null;name?:string;domains?:string[];externalId?:string;revenue?:number;size?:number;ownerId?:string|null;logoUrl?:string|null}
export interface CustomerNeedCreateInput {createdAt?:string|null;commentId?:string|null;bodyData?:string|null;id?:string;issueId?:string;projectId?:string;customerId?:string|null;customerExternalId?:string|null;attachmentId?:string|null;attachmentUrl?:string|null;priority?:0|1;body?:string|null}
export interface CustomerNeedUpdateInput {bodyData?:string|null;issueId?:string|null;projectId?:string|null;body?:string|null;customerId?:string|null;customerExternalId?:string;priority?:0|1;applyPriorityToRelatedNeeds?:boolean;attachmentUrl?:string|null}
export interface CustomerNeed {comment:{id:string;body:string}|null;bodyData:string|null;originalIssue:{id:string}|null;id:string;attachmentId:string|null;body:string|null;priority:0|1;customerId:string|null;issueId:string|null;projectId:string|null;creatorId:string;createdAt:string;updatedAt:string;archivedAt:string|null;url:string|null;projectAttachment:{id:string;url:string;title:string;metadata:Record<string,unknown>}|null;attachment:{id:string;url:string}|null}
export interface CustomerRequest extends Entity { title?: string; body?: string; customerId?: string|null; issueId?: string | null; projectId?: string | null; priority?: number;important?:boolean;requesterEmail?:string;formId?:string;answers?:Record<string,unknown> }
export interface Dashboard extends Entity { name: string; widgets?: Record<string, unknown>[]; teamId?: string | null; filters?: Filter }
export interface Template extends Entity { name: string; type?: string; teamId?: string | null; description?: string; fields?: Record<string, unknown> }
export interface Favorite extends Entity { userId: string; entityId?: string; entityKind?: Collection; sortOrder?: number;type?:'folder';folderId?:string|null;name?:string }
export interface Subscription extends Entity { userId: string; entityId: string; entityKind?: Collection }
export interface Integration extends Entity { name: string; provider: string; status?: string; configuration?: Record<string, unknown> }
export interface Automation extends Entity { name: string; teamId?: string; trigger?: string; conditions?: Filter; actions?: Record<string, unknown>[]; enabled?: boolean }
export interface SlaPolicy extends Entity { name: string; teamId?: string; conditions?: Filter; durationMinutes: number; enabled?: boolean }
export interface AsksPage extends Entity { name:string; description?:string; slug:string; teamId?:string; templateIds:string[]; enabled:boolean; position?:number }
export interface AsksForm extends Entity { name: string; teamId: string; fields?: Record<string, unknown>[]; enabled?: boolean; description?: string }
export interface Update extends Entity { body: string; projectId?: string; initiativeId?: string; health?: string; userId?: string }
export interface Entities {
  workspaces: Workspace; teams: Team; users: User; memberships: Membership; statuses: WorkflowStatus;
  issues: Issue; projects: Project; milestones: Milestone; initiatives: Initiative; cycles: Cycle;
  labels: Label; labelGroups: LabelGroup; views: View; documents: Document; comments: Comment; activities: Activity;
  notifications: InboxNotification; customers: Customer; customerTiers: CustomerTier; requests: CustomerRequest; dashboards: Dashboard;
  templates: Template; favorites: Favorite; subscriptions: Subscription; integrations: Integration;
  automations: Automation; slaPolicies: SlaPolicy; asksForms: AsksForm; asksPages: AsksPage; updates: Update;
}
export type CreateFields<K extends Collection> = Partial<Omit<Entities[K], 'workspaceId' | 'createdAt' | 'updatedAt' | 'version'>> & Record<string, unknown>;
export type PatchFields<K extends Collection> = Partial<Omit<Entities[K], 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>> & Record<string, unknown>;
export interface PageInfo { hasNextPage: boolean; endCursor: string | null; startCursor?: string | null; hasPreviousPage?: boolean }
export interface Page<T> { nodes: T[]; totalCount: number; pageInfo: PageInfo }
export interface ConnectionPage<T> extends Page<T> {edges:{node:T;cursor:string}[];pageInfo:Required<PageInfo>}
export type Filter = Record<string, unknown>;
export interface ListOptions { first?: number; after?: string; last?:number;before?:string;filter?: Filter; orderBy?: string; includeDeleted?: boolean;query?:string }
export interface SearchOptions {kinds?:Collection[];first?:number;after?:string;filter?:Filter;orderBy?:'relevance'|'updatedAt'|'createdAt'|'updatedAt:asc'|'updatedAt:desc'|'createdAt:asc'|'createdAt:desc';includeArchived?:boolean;titleOnly?:boolean}
export type SearchResult=Entities[Collection]&{kind:Collection;matchSnippet?:string};
export interface RequestOptions { signal?: AbortSignal; headers?: HeadersInit; timeoutMs?: number }
export interface DuplicateIssueOptions { title?:string; includeSubIssues?:boolean; clientMutationId?:string }
export interface ConvertIssueOptions { name?:string; clientMutationId?:string }
export interface DuplicateProjectOptions { name?:string; teamIds?:string[]; startDate?:string; includeIssues?:boolean; includeDocuments?:boolean; includeMilestones?:boolean; includeDependencies?:boolean; clientMutationId?:string }
export interface TriageIssueOptions {action:'accept'|'decline'|'snooze'|'unsnooze';comment?:string;priority?:number;snoozedUntil?:string;version?:number;clientMutationId?:string}
export interface CycleActionOptions {version?:number;clientMutationId?:string}
export interface CycleActionResult {cycle:Cycle;rolledOverCount:number}
export interface CustomEmoji {id:string;name:string;url:string;creatorId:string;createdAt:string;deletedAt?:string}
export type WorkspaceData = { [K in Collection]: Entities[K][] } & { user: User | null; workspaceId: string };
export interface ChangeEvent { kind: Collection; action: 'create' | 'update' | 'delete' | 'restore' | 'purge'; entity?: Entity; id: string; seq: number }
export type StreamEvent = (ChangeEvent & { event:'change' }) | {event:'access';accessRevision:number};
export interface SyncBootstrap {state:WorkspaceData;cursors:Partial<Record<Collection,string>>;seq:number;accessRevision:number}
export interface SyncChanges {events:ChangeEvent[];nextSeq:number;hasMore:boolean;resetRequired?:boolean;accessRevision?:number}
export interface AttachmentTarget {issueId?:string;documentId?:string;entityKind?:Collection;entityId?:string}
export interface Mutation { kind: Collection; action: 'create' | 'update' | 'delete' | 'restore'; id?: string; data?: Record<string, unknown> }
export interface ApiKey { id: string; name: string; scopes: string[]; createdAt: string; expiresAt?: string | null; token?: string }
export interface OAuthApplicationFields {name:string;redirectUris?:string[];scopes:string[];clientCredentialsEnabled?:boolean;allPublicTeams?:boolean;teamIds?:string[]}
export interface OAuthApplication extends OAuthApplicationFields { id: string;redirectUris:string[]; clientSecret?: string; createdAt?: string; appUserId?:string|null;credentialsRevoked?:boolean }
export interface OAuthAccessToken {access_token:string;token_type:'Bearer';expires_in:number;scope:string}
export interface OAuthTokens extends OAuthAccessToken {refresh_token:string;refresh_token_expires_in:number}
export interface OAuthClientCredentialsOptions {clientId:string;clientSecret:string;scopes:string[]}
export interface OAuthAuthorizationOptions { actor?:'user'|'app';resource?:string; clientId:string; redirectUri:string; state:string; scopes?:string[]; codeChallenge?:string }
export interface OAuthCodeExchange { resource?:string; clientId:string; code:string; redirectUri:string; clientSecret?:string; codeVerifier?:string }
export interface OAuthRefreshOptions { resource?:string; clientId:string; refreshToken:string; clientSecret?:string; scopes?:string[] }
export interface OAuthRevokeOptions { clientId:string; token:string; clientSecret?:string; tokenTypeHint?:'access_token'|'refresh_token' }
export interface Invitation { id: string; email: string; role: string; expiresAt?: string; token?: string; [key: string]: unknown }
export interface Session { id: string; createdAt: string; expiresAt: string; current: boolean }
export interface WebhookFields {url:string;name?:string;events?:string[];enabled?:boolean;teamId?:string|null;allPublicTeams?:boolean}
export interface Webhook extends WebhookFields { id: string; secret?: string; [key: string]: unknown }
export interface Attachment { id: string; filename: string; mimeType: string; url: string; [key: string]: unknown }
export interface GraphQLError { message: string; path?: (string | number)[]; extensions?: Record<string, unknown> }
