# Persistent service

`createApp()` in [app.ts](app.ts) supplies the same HTTP service to the browser and Electron. It uses Node 24's built-in SQLite driver with WAL, indexed entity fields, FTS5 search, a change log and a durable webhook outbox. Runtime dependencies include `graphql`, `sanitize-html`, `ws`, Yjs and the shared editor schema.

```ts
import { createApp } from './src/server/app.ts';
const app = createApp({ databasePath: '/private/path/workspace.sqlite', port: 0 });
const { url } = await app.start();
// Shut down listeners, workers and SQLite cleanly:
await app.close();
```

First-run setup creates the requested account/workspace, an Engineering team and its workflow statuses. `seedDemo: true` adds an explicitly marked fixture project and three fixture issues; production defaults to `false`. Tests and benchmarks use isolated databases and request this fixture option themselves. There is no default account or password.

## HTTP surface

The API base is `/api/v1`; GraphQL is `/graphql`. Successful collection writes return the stored entity. Errors have the shape `{error:{code,message,details?}}` and an appropriate HTTP status. The [SDK](../../packages/sdk/README.md) wraps these endpoints.

| Route | Behavior |
|---|---|
| `GET /auth/status` | Setup requirement and authenticated user, including scoped bearer authentication. |
| `POST /auth/setup`, `/auth/login` | Email/password authentication; setup requires a password of at least 10 characters. |
| `POST /auth/logout` | Revoke this cookie session. |
| `GET /auth/sessions`, `DELETE /auth/sessions/:id` | Inspect/revoke the signed-in account's sessions. Browser session required. |
| `POST /auth/password` | Verify `currentPassword`, set `newPassword`, revoke other sessions. |
| `GET /auth/workspaces`, `POST /auth/workspaces` | Accessible workspaces; create a workspace with `{name}` and switch the current browser session. |
| `POST /auth/workspace` | Switch to an existing workspace with `{workspaceId}` after checking membership. |
| `POST /auth/join` | Redeem an invitation with `{token,password,name?}`. An existing account must supply its existing password. |
| `GET /api/v1/state` | Workspace data plus the current user, all accessible workspaces and a synchronization sequence. Authorized soft-deleted entities are included for offline trash/restore; active views must filter `deletedAt`. |
| `GET /api/v1/sync/bootstrap` | Bounded initial workspace state, background collection cursors, change sequence and permission revision. |
| `GET /api/v1/sync/:kind` | Stable ID-ordered synchronization pages, up to 2,000 entities, with `first` and `after`. |
| `GET /api/v1/sync/changes` | Authorized deltas after a sequence; `accessRevision` mismatch requests a fresh bootstrap to purge stale private records. |
| `POST /api/v1/sync/access` | Checks up to 5,000 `{kind,id}` references without exposing inaccessible records; used to prune revoked undo history. |
| `GET /api/v1/:kind` | `{nodes,edges,totalCount,pageInfo}` with filtering, sorting and cursors. |
| `GET`, `PATCH`, `DELETE /api/v1/:kind/:id` | Read, validated update, or soft delete. |
| `POST /api/v1/:kind`, `POST /api/v1/:kind/:id/restore` | Create or restore a record. Workspace/account creation uses the specialized authentication endpoints. |
| `POST /api/v1/batch` | Atomic create/update/delete/restore operations; up to 1,000 operations. `clientMutationId` deduplicates retries per actor/workspace. |
| `POST /api/v1/teams/:id/join`, `/leave` | Self-service membership with private invitation, inherited membership and team-owner safeguards. |
| `GET /api/v1/initiatives/:id/rollup` | Deduplicated direct and descendant projects across multiple initiative parents; `directOnly=true` limits the rollup. |
| `POST /api/v1/customers/:id/merge` | Atomically replace source customer references with `{targetId}` and preserve personal subscription uniqueness. |
| `POST /api/v1/issues/:id/duplicate` | `{includeSubIssues?,title?,clientMutationId?}` returns `{issue,issues}` with fresh IDs and internal tree/dependency references. |
| `POST /api/v1/issues/:id/convert-to-project` | `{name?,clientMutationId?}` returns `{project,issues}`; original and descendants become standalone project issues atomically. |
| `POST /api/v1/issues/:id/merge` | `{targetId,clientMutationId?}` returns `{issue,target}`; duplicate status and canonical context transfer happen together. |
| `POST /api/v1/issues/:id/triage` | `{action,comment?,priority?,snoozedUntil?,version?,clientMutationId?}` accepts, declines, snoozes or unsnoozes atomically. Optional comments accompany accept/decline. |
| `POST /api/v1/cycles/:id/start-today`, `/end-today` | `{version?,clientMutationId?}` returns `{cycle,rolledOverCount}`; inherited cycles are controlled on the parent team. |
| `POST /api/v1/projects/:id/duplicate` | `{name?,teamIds?,startDate?,includeIssues?,includeDocuments?,includeMilestones?,includeDependencies?,clientMutationId?}` returns the project and created records. Content/milestones/issues default on; external dependencies default off. |
| `POST /api/v1/milestones/:id/convert-to-project` | `{name?,version?,clientMutationId?}` returns `{project,issues}`. Moves only milestone-linked issues, preserves their hierarchy, copies description attachments and soft-deletes the converted milestone atomically. |
| `GET /api/v1/events` | SSE updates with sequence IDs, replay through `Last-Event-ID` or `?after=`, and heartbeats. |
| `GET /api/v1/search` | Indexed `q` search with phrases, identifier shorthand and linked comment matches; supports `kinds`, `first`, `after`, `filter`, `orderBy`, `includeArchived`, and `titleOnly`. Results and snippets are permission filtered. |
| `POST/GET/DELETE /api/v1/users/:id/avatar` | Own profile raster uploads/removal; authenticated image reads follow user visibility across workspaces. |
| `GET/POST /api/v1/custom-emojis`, `DELETE /:id` | List, upload multipart `{name,file}`, or remove an owned custom emoji. PNG/JPG/GIF images are limited to 2 MB and 4096 pixels per side. |
| `GET /api/v1/insights` | Counts, estimates and completion totals by `groupBy` for an authorized filtered collection. |
| `POST /graphql` | Parsed and validated GraphQL queries/mutations, aliases, variables, nested relationships and introspection. |

Collections are listed in [repository.ts](repository.ts). Their fields are JSON, with shared domain validation for required names/titles, priorities, dates, membership roles, references, team-specific workflow/cycle properties and acyclic dependencies/parents. Caller-supplied actor, workspace and creation metadata are ignored. Creation accepts a client UUID for optimistic/outbox idempotency. Updates can include the last observed `version`; stale versions return `409 VERSION_CONFLICT`. Omitting it uses last-write-wins behavior.

Workflow status categories are chosen at creation and are immutable on public updates (`422 IMMUTABLE_STATUS_CATEGORY`). Name, color, description and order remain editable. The final status in each normal category cannot be deleted (`LAST_WORKFLOW_STATUS`), and statuses in use remain protected. Duplicate is created by duplicate merging and is system-managed (`SYSTEM_WORKFLOW_STATUS`); inherited teams receive a corresponding parent definition. Internal parent-workflow reconciliation preserves mapped definitions and required categories. `team.defaultStatusId` accepts only Backlog or Todo statuses; otherwise new member issues and accepted Triage issues use the first Backlog status by position. Explicit issue/template statuses still take precedence, and incoming external/non-member issues still use Triage when enabled. Removing a spare default status clears the explicit default atomically.

Activity records preserve the affected `entityVersion` and their durable change-log `sequence`, so equal timestamps have a stable causal order after restart or synchronization. New issue activities retain `statusTypeBefore`/`statusTypeAfter`; creation also records `initialStatusId`/`initialStatusType`. Workflow-definition creation records `initialType`; legacy and internal definition changes retain their existing `changes.type.from/to`. Historical chart calculations prefer this evidence and replay available definition history for legacy records; missing historical facts are not manufactured during migration.

The renderer uses bounded bootstrap and background pages rather than the unbounded `/state` compatibility endpoint. Large JSON responses support streaming gzip. IndexedDB stores bulk pages and a small journal of subsequent changes. The outbox is scoped to both account and workspace, written before optimistic display, and uses stable mutation IDs. Version conflicts automatically merge edits to different fields; competing edits to the same field remain a visible draft until resolved. Later edits to that entity wait behind its conflict. Rejected validation/permission changes remain in the scoped outbox with their complete payload for retry or discard. `store.batch` persists up to 1,000 distinct create/update/delete/restore operations together and sends one atomic server transaction; a conflict or failure blocks the whole group. All supplied versions are checked before the transaction writes anything. Permission changes trigger a replacement bootstrap and cache purge; lost workspace/session access clears cached data while retaining unsent local operations for the account.

Undo/redo retains the last 50 logical mutations per account/workspace in IndexedDB, including atomic batches. Unsent changes can be canceled; acknowledged changes use guarded inverse mutations. Undo never silently overwrites a later external edit to the same field, and delete/restore inverses require the recorded version. Permission changes remove history containing newly inaccessible records. Editor-native text undo remains separate. `store.loadEntity(kind,id)` permits authorized navigation before full background hydration completes.

Pagination defaults to 50 records and caps `first` or `last` at 500. Use `first`/`after` to walk forward and `last`/`before` to walk backward. Backward pages preserve the requested display order. `first` with `before` and `last` with `after` select a bounded window; providing both sizes or both cursors is rejected. Zero-sized pages are valid. Connections include `nodes`, `edges: [{node,cursor}]`, `totalCount`, and both `hasPreviousPage`/`hasNextPage` with start/end cursors. These controls apply to REST collection lists and all GraphQL root/nested connections. `orderBy=updatedAt:desc` is the default. Filter examples:

```json
{"and":[{"teamId":{"eq":"team-id"}},{"priority":{"in":[1,2]}},{"title":{"contains":"retry"}}]}
```

Supported filter operators are `eq`, `neq`, `in`, `nin`, `gt`, `gte`, `lt`, `lte`, `contains`, `notContains`, `containsIgnoreCase`, `notContainsIgnoreCase`, `eqIgnoreCase`, `neqIgnoreCase`, `containsAll`, `startsWith`, `notStartsWith`, `endsWith`, `notEndsWith`, `null`, and nested `and`/`or`/`not`. `some` supports arrays of structured JSON. Raw API `contains`, prefix and suffix checks are case-sensitive; use the explicit `IgnoreCase` variants for case folding. Ordinary UI condition-block text filters remain case-insensitive. String-specific comparators require a present string; use `null` explicitly for missing values. Cursors are scoped to workspace and collection. If the cursor record disappears, restart pagination; stale cursors are rejected rather than silently skipping records.

Relationship predicates resolve readable records before matching: for example, `{assignee:{email:{eq:"person@example.com"}}}` and `{labels:{every:{name:{eq:"Bug"}}}}`. Collection relationships support `some`, `every` and `none`; an ordinary nested predicate means `some`. `every` is true for an empty readable collection. `{project:{null:true}}` matches when no project is readable by the caller. Hidden target properties never participate in positive or negative matches. Supported direct and reverse edges are declared in `relationship-filter.ts`; this is not yet a complete native schema contract. Nested timestamp durations share one query clock, and search pagination retains that clock. Initiative project-descendant rollups and predicates on derived related-record metrics still need parity work.

Counted collection queries use SQL pagination/counts for supported scalar filters and timestamp ordering after checking ancestor privacy. Complex filters, excluded private parents and custom-ID collation use the complete permission evaluator. This preserves authorization and cursor semantics while keeping common large-workspace queries indexed. Issue labels enforce one selected label per nonempty `group`; ambiguous mutations return `422 LABEL_GROUP_CONFLICT`.

## Authentication and authorization

Passwords use individually salted scrypt hashes. Session tokens, API tokens and OAuth authorization codes are stored as SHA-256 hashes. Cookies are HttpOnly and SameSite=Lax; HTTPS configuration adds Secure. Browser writes require the same origin or an explicitly configured allowed origin. There is an authentication throttle and an API throttle; responses include rate-limit headers and `Retry-After` when throttled.

Workspace roles are owner, admin, member and guest. Guests can view teams they explicitly belong to and issues explicitly shared with them; shared-issue guests can edit allowed issue fields, comment, and manage their own favorites/subscriptions/notification state. General guest writes are denied. Workspace administration requires owner/admin membership. Private team contents stay restricted; a project spanning public and private teams is readable through its public team, with inaccessible team associations and child records redacted. Views/documents/dashboards with personal/private visibility are visible to their creator and explicit members. Inbox records, favorites and subscriptions are personal. Favorites may be folders (`type:"folder"`, trimmed `name`/`label` of 1–100 characters) or ordinary shortcuts with a nullable `folderId`. Only active folders belonging to the same user/workspace may be referenced; folders cannot nest and favorite types cannot be converted. Deleting a folder atomically unfiles its children without deleting them. Guests may organize their own folders without gaining access to any additional target. Comment body edits require the author or a workspace administrator; other members can modify only their own reactions. Update body edits require the author, and first updates respect the assigned project/initiative owner. HTML is sanitized at persistence, including scripts, event handlers, unsafe URLs and unsafe styles, while retaining supported editor formatting.

Issue-description, comment and update reactions can change only the caller's own membership in each emoji. Custom reaction keys use `custom:<id>`. Removing a custom emoji hides it from new selections while retaining historical images; new uses of removed emoji are rejected. Global profile changes fan out to all joined workspaces. Other members receive public identity fields without private preferences or the account's originating workspace ID.

Internal recipient checks derive application identities from the trusted installation table: app notifications, reminders and assignment checks retain the installation’s team restrictions, and removed apps receive no further deliveries.

API token scopes are `read`, `write`, `admin`, or collection scopes such as `issues:read` and `issues:write`. Write implies read for the same collection. The `admin` scope still requires an actual administrator role for administrative endpoints. Credential management requires a browser session or administrator credential. Revoking membership or tokens removes subsequent API access and closes affected event streams as access is rechecked.

## Developer platform

| Route | Inputs and results |
|---|---|
| `GET/POST /api/v1/api-keys` | List metadata; create `{name,scopes,expiresAt?}`. Plaintext token returned once. |
| `DELETE /api/v1/api-keys/:id` | Revoke an owned key. |
| `GET/POST /api/v1/webhooks` | List metadata; create `{url,events,enabled?,teamId?,allPublicTeams?}`. Signing secret returned once. |
| `PATCH/DELETE /api/v1/webhooks/:id` | Update endpoint/event subscriptions or remove the hook. |
| `GET /api/v1/webhooks/:id/deliveries` | Inspect recent attempts, status, response status and error. |
| `POST /api/v1/webhooks/:id/test` | Queue a test delivery. |
| `POST /api/v1/webhook-deliveries/:id/retry` | Requeue a delivery. |
| `GET/POST /api/v1/apps` | Register `{name,redirectUris,scopes}`; secret returned once. |
| `PATCH/DELETE /api/v1/apps/:id` | Edit or revoke. Removing granted scopes or changing redirects revokes existing app tokens/codes. |
| `GET /oauth/authorize` | Inspect requested application consent; no grant occurs on GET. |
| `POST /oauth/authorize` | Grant with explicit `approve:true`, registered `client_id`, exact `redirect_uri`, `scope`, optional `state`, and optional S256 PKCE fields. |
| `POST /oauth/token` | Exchange a single-use authorization code with matching redirect and PKCE verifier or client secret. JSON or URL-encoded input. |
| `POST /oauth/token` with `grant_type=refresh_token` | Rotate a refresh token and its linked access token; preserve approved scopes. |
| `POST /oauth/revoke` | Idempotently revoke an access or refresh token and its grant family. |

Canonical OAuth-enabled MCP is mounted at `/mcp`, with authorization/protected-resource metadata discovery and public PKCE client registration at `/oauth/register`. Explicit browser consent binds grants to that MCP resource; audience-bound tokens are rejected by the ordinary REST API. MCP executes through the repository permission layer directly. The standalone stdio/personal-token bridge remains available through the MCP package.

OAuth browser authorization presents consent before issuing a code. Access tokens expire after one hour; refresh tokens expire after 30 idle days or 90 absolute days. Reusing a rotated refresh token revokes its family. App revocation or narrowed grants prevent refresh. Token/revocation failures use standard OAuth `error` and `error_description` fields.

Webhook event selectors are `*`, collection names, or names such as `issues.create`. Delivery uses an HMAC-SHA256 of the exact raw JSON body in `Parabolic-Signature` and `X-Parabolic-Signature`. Payloads contain a delivery ID and numeric `webhookTimestamp`; the SDK verifies both signature and timestamp tolerance. Delivery IDs remain stable across retries. Any 2xx response acknowledges delivery. Other responses and transport errors trigger exponential backoff, up to eight attempts; errors are inspectable and retryable. The signing timestamp is refreshed on each delivery attempt. Access is checked both when queuing and immediately before dispatch, including after asynchronous DNS resolution. Disabling or deleting a hook during resolution prevents that send; a changed destination is resolved again on the next worker pass. A hook can select `teamId` or `allPublicTeams:true`, never both. Team scope follows the owning issue, project, cycle, or other parent for comments and activity. All-public scope excludes private/restricted teams and their descendants, private documents, and private references inside mixed-team payloads. Workspace-global events are included only by all-public or unscoped subscriptions. Omitting both scope fields preserves the existing workspace-wide authorized subscription; scope changes also apply to pending deliveries. Events no longer in scope are canceled and can be inspected/retried.

Webhooks require HTTPS and reject loopback/private/link-local addresses by default. DNS is checked and the resulting address is pinned for each request; redirects are not followed. Explicit `webhookAllowPrivateHosts:true` enables internal-network HTTP endpoints for an internal deployment or isolated test. It is disabled by default.

The GraphQL schema exposes per-collection connections, singular reads and create/update/delete/archive/restore mutations, plus `viewer`, `state` and `search`. For example:

```graphql
mutation Create($input: IssueCreateInput!) {
  issueCreate(input: $input) {
    success
    issue { id title identifier team { id name } }
  }
}
```

Entity mutation input types use JSON scalar payloads backed by domain validation. This is this application's supported public schema; it is not a binary-compatible copy of Parabolic's entire GraphQL schema or generated SDK. Query depth is limited to 16 and estimated complexity to 10,000 points.

## Files and intake

`POST /api/v1/attachments` accepts `{filename,mimeType,content}` with base64 `content` and optional `issueId`, `documentId` or `entityKind`/`entityId`. Raw uploads can supply `X-Filename` and a MIME content type. Uploads have no billing-plan or fixed per-form file-count cap. The in-memory upload transport uses a configurable server resource guard: `PARABOLIC_UPLOAD_MAX_BYTES` (default 268435456 bytes / 256 MiB), also available as `createApp({uploadMaxBytes})`. This is a deployment limit, not a Parabolic product entitlement. Authenticated member and requester upload-limit endpoints expose the same configured byte bound to the form picker; raw, multipart and base64 transports enforce it before storage. Form uploads run at most four transfers concurrently. Responses contain an authorized URL; reads recheck parent visibility. Multipart uploads also accept a `file` part and the same parent metadata. `X-Attachment-Content-Type` and `X-Attachment-Filename` preserve original metadata for the in-app preview. Only safe raster image types render inline. Other types download with a sandboxing content policy. Draft attachments without a parent are private to their uploader.

Administrators can create manual invitation links using `POST /api/v1/invitations` with `{email,role}`. Links expire after seven days and are single-use. This service does not send mail or contact external providers.

`GET /public/asks/:id` returns only the enabled form's public fields. Anonymous `POST` accepts `{title,requesterEmail,body,answers}` and validates required fields, creates an issue in triage, applies routing, and records a linked request. The acknowledgement contains the request ID and issue identifier. Connector-backed email/Slack intake remains outside the retained connector scaffold.

## Background behavior

- Enabled routing rules run in order when an issue enters Triage or its routing properties change there. Destination teams chain their rules, with bounded loop detection and surfaced property conflicts. Explicit template/workflow choices override initial defaults; team-member creation normally uses the team's default workflow, while non-member or API-token creation defaults to Triage when enabled.
- Team SLA defaults and triage responsibility apply at creation. Ordered SLA rules can apply or remove a target on issue changes. Manual targets use `{slaDuration:{value,unit}}`, with `hour`, `day`, `businessDay` or `week`; clearing uses `{slaDuration:null,slaDueAt:null}`. A due date and SLA target are mutually exclusive. Business days follow the workspace's Monday–Friday or Sunday–Thursday calendar and local time zone, including DST.
- SLA states are `lowRisk`, `mediumRisk`, `highRisk`, `breached`, `achieved`, `failed` or no target. Risk thresholds are seven days and 24 hours; completion before/after the deadline determines achieved/failed. Subscribers and opted-in team members receive at most one 24-hour risk notification and one breach notification per applied target.
- Recurrence supports daily/weekly/monthly intervals, IANA time zones, month-end clamping and DST wall time. It generates one due occurrence and advances to the next future occurrence after downtime, preventing a catch-up flood.
- Enabled team cycles use 1–8 weeks, a configured weekday and 00:01 in the team's IANA time zone, including DST. Teams select 1–15 future cycles. Cooldown is a minimum gap before the next selected weekday. Eligible unfinished work rolls when the next period starts; completed/canceled/backlog/Triage work during cooldown remains in the closing period.
- Team options implement parent/sub-issue completion, auto-add started/completed work to the current cycle, auto-close stale issues and auto-archive completed work.
- Document edits and project name/description edits preserve up to 100 prior revisions. Project entries use `{id,title,content,at,userId}`; restoring uses a normal guarded description update and synchronizes the collaboration room. Project/document comments accept Yjs relative-position anchors and notify accessible subscribers when first posted. Activity and Inbox notifications are produced by the same mutation transaction; per-type channel preferences control external desktop delivery without suppressing Inbox records. Notifications carry all matching `reasons`. Issue creators, new assignees and accessible user mentions are subscribed automatically; referenced issue mentions create related links, including when posted in comments. Status-category alerts cover completion/cancellation, urgent-priority changes and blocking relationships; unchanged fields and ordinary comment edits do not repeat these alerts.
- Scheduled reminders use notifications with `type:'reminder'`, `entityKind`, `entityId`, and a future ISO `remindAt` for issues, documents, projects or initiatives. The scheduler sets `deliveredAt` once after checking the recipient’s current access; rescheduling resets delivery/read/archive state and deletion cancels delivery. Only the recipient can manage their reminders, including guests for accessible shared issues. The newest 2,000 open notifications are retained per user/workspace; older open items are automatically archived, while pending reminders and future-snoozed items stay outside the limit.
- Notification arrival ordering uses server-managed `movedToInboxAt` (creation time initially), independently of `updatedAt` or read edits. Due snoozes clear `snoozedUntil`, become unread, and persist the scheduled expiry as `unsnoozedAt`/`movedToInboxAt`; manual unsnooze uses the action time. Wake updates the existing notification once after checking recipient access. An explicit read action after expiry preserves that read choice while materializing arrival, so a later scheduler tick does not undo it. Pending entity reminders cannot be delivered by unsnoozing; their first delivery sets arrival. Retention uses the same arrival ordering, including expired snoozes awaiting the scheduler. The observed native arrival/stack semantics and this application's timestamp mapping are documented in `audit/observations/132-inbox-stacks-policy.md`.

Triage responsibility can notify several selected members or assign incoming work in round-robin order. Optional rotations follow local calendar days in the workspace time zone. Acceptance can require a priority; decline/duplicate remain available without it. Snoozed issues return at their selected time or on new comments, reactions or human issue edits, with persisted wake reason/history. Scheduled metadata updates do not wake them.

Cycle settings use `cycleDuration`, `cycleStartDay` (Sunday=0), `cycleUpcomingCount`, `cycleCooldownDays`, `cycleStartDate` and team `timezone`. Existing active issues can be kept in the current/next cycle or moved to Backlog when enabling the active-work automation. New Started/Completed issues use the current cycle; during cooldown Started goes to the next cycle and Completed to the previous one. Disabling closes the current period and removes future periods while unlinking their issues. Date edits preserve past periods; API end dates are exclusive. Legacy `startsAt`/`endsAt` inputs normalize to `startDate`/`endDate`.

Completed cycle snapshots preserve scope, started/completed effort, counts and success (completed count plus 25% of started count). Late completions can be credited during cooldown; after the next period begins the snapshot freezes against later edits. Daily progress samples retain their first point and each day's latest point. Upcoming automatic capacity averages the previous three completed cycles; without history, the visible member-count fallback is explicitly approximate. A manual positive capacity remains an override. API-created enabled teams initialize immediately; isolated fixtures can request `initializeCycles:false`.

Auto-close respects active cycles, unfinished projects, future due dates, active SLAs and ineligible children. Auto-archive measures both completion and last activity, requires eligible issue families and completed/inactive project/cycle containers, and can archive those containers. Manual unarchive restarts the inactivity period. After 30 days, trash cleanup removes issue/project/initiative/document/cycle content, related history, attachments, collaboration snapshots and replay payloads. Minimal access-control tombstones protect surviving references to deleted private parents; permanently deleted IDs cannot be recreated or restored.

Issue templates apply `properties` and can contain `formFields` and up to 100 nested `subIssues`. Issue creation accepts `{templateId,templateAnswers}`; required fields are validated, supported property fields map to issue properties, and other answers append escaped labeled sections to the description. `{{fieldId}}` interpolates answers into titles/descriptions. Parent and children are created atomically. Team defaults distinguish `defaultTemplateId` for team members and `nonMemberDefaultTemplateId` for nonmembers; member defaults cannot be form templates. Explicit `templateId:null` bypasses the default.

Project templates accept `projectPlan:{durationDays,milestones,issues,documents}`. Milestone `targetOffsetDays` and issue `dueOffsetDays` are relative to the project start date or creation day. Plan-local `id`, `milestoneKey` and `parentKey` values are remapped to fresh persistent IDs, so the same template can safely create many projects. Project/milestone/issue/document creation rolls back together on any invalid entry.

The scheduler wakes every minute. Documents, issue/project/initiative descriptions and comment bodies use a Yjs CRDT over authenticated WebSocket `/collaboration/:kind/:id?field=content|description|body`. Only the defined kind/field combinations are accepted. Concurrent edits merge, presence is attributed by the server, update bytes are persisted, and HTML projections are coalesced before normal entity history/notifications. API content replacement updates the room. Permission checks run on each incoming update and changes to membership/visibility disconnect excluded clients. SSE remains the change feed for ordinary entities.

Teams support at most five hierarchy levels. Non-guest child membership implies ancestor membership; guests retain explicit team membership only. Restricted children under private parents are visible to parent members; private children require explicit access. Optional workflow and estimation inheritance synchronize from the parent, while enabled parent cycle schedules align child cycles and preserve historical periods. API-created teams receive six default workflow categories unless `initializeWorkflow:false` is requested.

Issue sharing is controlled by `team.issueSharingEnabled` and `issueSharingPolicy` (`members` or `owners`). `issue.sharedWithIds` grants access to an issue and inheriting descendants, including cross-team children. An explicit empty array stops inherited grants; setting `null` on a child removes its override. Shared recipients receive safe workflow, label and estimate metadata without private team identifiers, and cannot change the team/project/cycle/milestone or sharing context.

Issue relations are reciprocal. `relations` uses `related`, `blocks` and `blockedBy`; array aliases stay synchronized. An indexed relation graph rejects cycles across all supported representations, and resolved blocking issues become Related. Duplicate merges retain the source issue while moving comments, customer requests and eligible personal subscriptions/favorites to the canonical issue. Cloning and conversion duplicate attachment bytes into the new entity permission boundary.

Initiatives support multiple parents, acyclic depth of five, deduplicated descendant project rollups, priority and a lead team. Root ordering uses finite `position`; independent parent ordering uses `parentPositions: {parentId: number}` with magnitudes up to 1e15. Patching the map preserves other parent positions and removing a parent prunes its position. Saved views support `entityType:"initiatives"` and optional `initiativeId` context with the same parent access checks as the initiative. Customer domains normalize case and URL spelling; merging customers atomically replaces customer references without revealing hidden content. Issue/project customer metrics derive from authorized linked requests and deduplicated customers. Project and initiative update reminders use the owner’s time zone and publish/nudge idempotency.

The service runs as one SQLite-backed process per database. It does not implement clustered workers or SMTP delivery. SAML/SCIM, external provider connections and hosted AI remain outside this build's accepted scope.

## Configuration and verification

The CLI entry accepts `PORT` (4174), `HOST` (127.0.0.1), `PARABOLIC_DATABASE`, `PARABOLIC_STATIC_DIR`, `PARABOLIC_PUBLIC_URL`, `PARABOLIC_ALLOWED_ORIGINS` and `PARABOLIC_ALLOW_PRIVATE_WEBHOOKS`. Production behind a reverse proxy should set the public HTTPS URL explicitly; arbitrary forwarded headers are not trusted. Electron passes its own private data path and a random loopback port directly to `createApp()`.

Run the server/platform suites with `node --import tsx --test tests/server/*.test.ts tests/platform/*.test.ts`. `node --import tsx tests/server/client-sync.browser.ts` exercises real Chromium offline writes, atomic group rollback and failure persistence, conflict resolution, preferences and permission cache revocation with isolated services.

The isolated benchmark is `BENCHMARK_ISSUES=10000 node --import tsx tests/server/benchmark.ts` (also accepts 100000). It measures persistent fixture creation, HTTP list/filter/search/bootstrap/sync/full-state response time, decoded and compressed sizes, and CRUD median/p95. `BENCHMARK_OUTPUT` optionally saves its JSON report. It removes its temporary database afterward. Benchmark results characterize that machine and dataset, not renderer frame rates or end-to-end native performance.

### Personal issue-view subscriptions

Create a private `subscriptions` record with `entityKind: "views"`, an accessible issue-view `entityId`, and boolean `notifyOnAdded` / `notifyOnClosed` options (both default true). `timeZone` captures the subscriber's calendar timezone for date filters. At least one event is required; delete the subscription to unsubscribe. Duplicate subscriptions to the same view are rejected, and targets cannot be changed after creation. Project views and inaccessible, archived or deleted views are not valid targets.

Issue mutations evaluate the saved filter and team scope against the recipient's readable records, comparing before and after at one clock. Entering a view produces `viewIssueAdded`; completion/cancellation produces `viewIssueClosed` when the issue matches before or after, including closure that removes it from a status-filtered view. Both reasons on one transition yield one alert per view and recipient. Ordinary edits inside the view and the recipient's own actions do not repeat alerts. Archived/deleted issues and views do not produce new alerts. Existing view alerts require current access to both the issue and the view. The `viewSubscriptions` desktop preference controls external delivery without deleting Inbox records. Concrete Slack delivery remains deferred.

### Asks pages and authenticated template intake

`asksPages` is an administrator-managed collection with `name`, `description`, workspace-unique `slug`, ordered `templateIds`, optional destination `teamId`, `enabled` and `position`. Only issue templates with an accessible applicable destination team can be selected. The REST collection, GraphQL `asksPages`/`asksPage`, sync and SDK `asksPages` collection share the repository authorization rules.

`GET /api/v1/asks-site` requires login and returns enabled pages and forms visible to that requester. `POST /api/v1/asks-site/:slug` accepts `templateId`, `submissionKey`, optional `title`/`description`, and `templateAnswers`. It invokes the existing issue template engine, including defaults, answer validation and child issues, creates a linked request, and routes to Triage when available. Creation is atomic. A repeated matching submission key returns the original result; a changed payload under that key is rejected. No client-provided requester identity or arbitrary issue fields are trusted. Deleted/disabled pages and inaccessible/archived templates cannot receive requests.

The SDK exposes `asksSite.pages()` and `asksSite.submit()`. The requester UI is `/ask-site`, with custom page paths `/ask-site/:slug`; configure pages under Settings → Asks. Basic workspace login is required. Basic login replaces enterprise SAML, and concrete email connectors remain deferred. Hosting/custom-domain configuration remains retained under ledger F12-006 and is not implemented by this page/submission change.

Audit note: the older `/public/asks/:id` and `/request/:formId` direct-form flow still accepts anonymous intake. This is a retained basic-login parity gap tracked under F12-003; the authenticated page portal does not close it. See audit observation 273.
