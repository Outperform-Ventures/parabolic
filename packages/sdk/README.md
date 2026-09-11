# Parabolic SDK

The typed HTTP client runs in browsers and Node 22 or later. It has no runtime dependencies. The separate `@parabolic/sdk/webhooks` export uses Node crypto and belongs in a server handler.

Build from the repository root with `pnpm exec tsc -p packages/sdk/tsconfig.json`. The package can then be installed from `packages/sdk` or packed for an internal registry. Nothing is published automatically.

```ts
import { ParabolicClient, ApiError } from '@parabolic/sdk';

const client = new ParabolicClient({
  baseUrl: 'http://127.0.0.1:4174',
  token: process.env.PARABOLIC_API_TOKEN,
});

const page = await client.issues.list({
  first: 50,
  filter: { teamId: 'team-id' },
  orderBy: 'updatedAt:desc',
});

const issue = await client.issues.create({
  title: 'Implement keyboard navigation',
  teamId: 'team-id',
});
await client.issues.update(issue.id, { priority: 2, version: issue.version });

for await (const project of client.projects.iterate({ first: 100 })) {
  console.log(project.name);
}
```

`client.collection(kind)` provides `list`, `get`, `create`, `update`, `remove`, `restore`, and `iterate` for every exported `COLLECTIONS` member. Every collection also has a convenience property with its collection name, such as `client.cycles`. Every collection has a named entity interface, and the entity model also permits custom JSON fields. IDs are escaped as path components; filters are JSON encoded, and the backend enforces workspace, team, and field permissions. Read-only system collections still reject unsupported writes on the server.

Collection pages include `edges: [{node,cursor}]` and complete `pageInfo` (`startCursor`, `endCursor`, `hasPreviousPage`, `hasNextPage`). Fetch preceding pages with `{last:50,before:page.pageInfo.startCursor}`. `list()` preserves the chosen `orderBy` within each page. `iterate({last:100})` follows previous cursors and yields records in reverse display order; use `first/after` for forward iteration or `last/before` for backward iteration. The iterator rejects mixed direction pairs and repeated cursors. Search and incremental synchronization have their own forward cursor contracts.

Use `client.state()`, `client.search(query, options)`, `client.batch(operations, clientMutationId)`, and `client.graphql<T>(query, variables)` for the matching API operations. `client.apiKeys`, `client.webhooks`, `client.apps`, `client.invitations`, and `client.sessions` expose administrative operations. Administrative list methods return `{nodes}`. `changePassword`, `join`, and `switchWorkspace` support account settings and invitations; workspace switching requires a browser session. `client.insights` returns grouped metrics, `client.publicAsks` reads/submits request forms using authenticated transport, and `client.mergeCustomer(sourceId,targetId)` merges customer records. The public `request<T>(path, method, body, options)` can call newly added API endpoints without waiting for a new SDK version.

`batch` submits 1–1,000 operations atomically, subject to the server's request-body limit. Reuse the same `clientMutationId` when retrying an uncertain response.

`client.upload({filename,mimeType,content})` accepts base64; `client.uploadFile(blob,{filename,entityKind,entityId})` sends actual multipart bytes. Both accept `issueId`/`documentId` or a generic entity kind/ID to bind access to existing work. `downloadAttachment(id)` returns a `Uint8Array` with the original bytes and `deleteAttachment(id)` removes an authorized upload. Binary reads share the normal authorization, retry, timeout, and error handling.

For durable local replicas, `client.sync.bootstrap()` supplies state, per-collection continuation cursors, a change sequence, and an access revision. Continue truncated collections with `client.sync.scan(kind,{after})`, then fetch updates with `client.sync.changes({after,accessRevision})`. Discard inaccessible cached records and bootstrap again when `resetRequired` is true or an access event arrives. A new permission revision must replace the old cache, not merely merge new visible records into it.

```ts
const result = await client.graphql<{ issues: { nodes: { id: string; title: string }[] } }>(
  'query { issues(first: 20) { nodes { id title } } }',
);

const controller = new AbortController();
const request = client.issues.list({}, { signal: controller.signal });
controller.abort();
await request.catch(error => console.log(error.name));
```

The transport includes browser cookies and accepts a fixed token or an asynchronous token provider. Browser setup/login can use same-origin session cookies. Node's built-in fetch does not maintain a cookie jar; use an API token for service-to-service SDK access, or supply a fetch implementation with a cookie jar when specifically testing interactive login. Never embed a privileged API key in a browser bundle.

`ApiError` contains HTTP status, backend code/details when supplied, and an optional request ID. `GraphQLRequestError` preserves GraphQL errors and partial data. Reads retry at most twice for network failures or HTTP 429/502/503/504; `Retry-After` is honored up to ten seconds. Mutations are never automatically retried. The default thirty-second deadline covers credential resolution, all attempts, and retry waits. Cancellation also stops waiting for an asynchronous token provider before any request is opened; event-stream signals apply during credential resolution too. Per-request signals and deadlines override defaults. Iteration fails if the service repeats a pagination cursor.

```ts
for await (const event of client.events({ signal: controller.signal, lastEventId: '42' })) {
  if (event.event === 'access') {
    // Discard the old permission-sensitive cache and load a fresh bootstrap.
    const refreshed = await client.sync.bootstrap();
    console.log('Reloaded access revision', refreshed.accessRevision);
    continue;
  }
  // Persist event.seq after applying it. Reconnect explicitly after disconnection.
  console.log(event.kind, event.action, event.id);
}
```

The SSE generator yields the discriminated `StreamEvent` union (`event: 'change'` or `event: 'access'`), handles partial UTF-8 chunks and CRLF, skips heartbeats, and closes the stream when iteration stops. It makes one connection; applications control their reconnect policy and cursor persistence.

For webhook receivers, retain the raw request body before JSON parsing:

```ts
import { verifyWebhook } from '@parabolic/sdk/webhooks';

const event = verifyWebhook({
  body: rawBody,
  signature: request.headers['x-parabolic-signature'],
  secret: process.env.PARABOLIC_WEBHOOK_SECRET!,
});
```

The verifier checks the SHA-256 HMAC in constant time and requires `webhookTimestamp` within five minutes of the local clock. `Parabolic-Signature` carries the same signature for compatibility. Persist `X-Parabolic-Delivery` in the receiver's processed-delivery table and acknowledge duplicates without performing effects again. Timestamp validation alone does not provide replay deduplication.

`client.webhooks.create` and `.update` accept either `teamId` or `allPublicTeams:true`. Explicit public-team scope excludes private/restricted teams and parents. Omitting scope preserves the existing workspace-wide authorized behavior. Switch a team-specific webhook to public teams with `{teamId:null,allPublicTeams:true}`.

## OAuth applications

Register an application through `client.apps.create`, then send the user to a consent URL. Public clients use PKCE; server applications can also supply their client secret during code exchange. Keep the verifier and a fresh, unpredictable state value in your application's session. Verify the callback's state before exchanging its code.

```ts
import { createPkcePair } from '@parabolic/sdk';

const pkce = await createPkcePair();
const state = crypto.randomUUID();
const consentUrl = client.oauth.authorizationUrl({
  clientId: applicationId,
  redirectUri: 'https://internal.example/callback',
  state,
  scopes: ['issues:read', 'issues:write'],
  codeChallenge: pkce.challenge,
});
// Save state and pkce.verifier in your session, then navigate to consentUrl.

const tokens = await client.oauth.exchangeCode({
  clientId: applicationId,
  code: callbackCode,
  redirectUri: 'https://internal.example/callback',
  codeVerifier: pkce.verifier,
});
const refreshed = await client.oauth.refresh({
  clientId: applicationId,
  refreshToken: tokens.refresh_token,
});
// Atomically replace both stored tokens with refreshed before using them again.
await client.oauth.revoke({ clientId: applicationId, token: refreshed.refresh_token });
```

OAuth access tokens last one hour. Refresh tokens expire after thirty days without use, with a ninety-day absolute grant limit. Every refresh replaces both tokens; the preceding access token stops working immediately. Reusing a consumed refresh token revokes the complete grant, including its latest access token. Serialize refresh operations and persist each successful response atomically. OAuth mutations receive no automatic transport retry. A lost refresh response requires new authorization. Scope narrowing is supported through `scopes` on `oauth.refresh`; increases require new consent.

Revoking an access token through API settings also disables its refresh grant. Changing application scopes or redirect URIs can invalidate existing grants. Client secrets belong only on servers, and tokens must be sent over HTTPS when communicating beyond loopback. See the repository's `docs/oauth.md` for consent, expiry, and revocation behavior.

For MCP OAuth grants, include `resource: "https://workspace.example/mcp"` in `oauth.authorizationUrl`, `oauth.exchangeCode`, and `oauth.refresh`. The grant is bound to that MCP resource, so use its access token with the MCP endpoint rather than SDK REST methods. Ordinary API OAuth grants omit `resource`.

For an unattended internal service, an administrator registers an application with `clientCredentialsEnabled:true`, `allPublicTeams` and optional `teamIds`. Redirect URLs are optional when client credentials are enabled:

```ts
const application = await admin.apps.create({
  name: 'Internal reporting',
  clientCredentialsEnabled: true,
  scopes: ['issues:read'],
  allPublicTeams: false,
  teamIds: ['team-id'],
});
const token = await client.oauth.clientCredentials({
  clientId: application.id,
  clientSecret: application.clientSecret!,
  scopes: ['issues:read'],
});
const reporter = new ParabolicClient({ baseUrl: client.baseUrl, token: token.access_token });
```

Client-credentials tokens last thirty days and do not include refresh tokens. Mutations are attributed to a non-login application identity. Up to 1,000 same-scope credentials can coexist; requesting different scopes revokes earlier application credentials. `admin.apps.rotateSecret(id)` returns the new secret and revokes all existing grants. Team access changes and application removal also revoke credentials. For browser installation with the same application identity, set `actor:'app'` in `oauth.authorizationUrl`; administrator consent and a client secret at exchange are required. Individual-user OAuth grants and public MCP clients retain their existing user authorization behavior.

`mergeCustomer(sourceId, targetId)` performs the server customer merge and returns the updated target. `initiativeRollup(id, { directOnly: false })` returns accessible descendant initiatives and their project rollup. Both preserve server permission filtering.

`duplicateIssue(id, { includeSubIssues: true, title, clientMutationId })` duplicates the selected issue tree. `convertIssueToProject(id, { name, clientMutationId })` converts an issue and its sub-issues into a project. `mergeIssue(sourceId, targetId, { clientMutationId })` marks a duplicate and moves its comments, customer requests, and eligible subscriptions to the canonical issue. These operations run atomically on the service and return their resulting records.

`duplicateProject(id, options)` supports `name`, `teamIds`, `startDate`, `includeIssues`, `includeDocuments`, `includeMilestones`, `includeDependencies`, and `clientMutationId`. Issues, documents, and milestones are included by default; external project dependencies are excluded unless requested. Use the same `clientMutationId` when retrying an uncertain response, so the service returns the original result rather than creating another copy. SDK mutations are never retried automatically.

`convertMilestoneToProject(id, { name, version, clientMutationId })` creates a project from a milestone and moves only its linked issues. `sync.access([{kind,id}])` checks current access to cached records. `joinTeam(id)` and `leaveTeam(id)` use the service's membership rules; leaving a private team can return `{id,left:true}` when the team is no longer visible.

Search accepts `filter`, `orderBy` (`relevance`, `updatedAt`, `createdAt`, with optional `:asc`/`:desc`), `includeArchived`, and `titleOnly`. A nonempty filter also works with an empty query. Quick-open uses `titleOnly: true` to exclude descriptions and comments. Full search maps matching issue comments to their parent issues, deduplicates results, and returns a short `matchSnippet` from an authorized match. Quoted phrases are exact; unquoted stopwords are ignored; existing identifiers accept shorthand such as `ENG123`. Relevance prefers exact identifiers/titles and open issues. Results are capped at 500 per page, and cursors are bound to the query, filter, ordering, workspace, and user.

```ts
const page = await client.search('', {
  kinds: ['issues'],
  filter: { and: [{ priority: { eq: 1 } }, { customerRevenue: { gte: 1000 } }] },
  includeArchived: false,
  orderBy: 'updatedAt:desc',
  first: 100,
});
const quick = await client.search('ENG123', { kinds: ['issues'], titleOnly: true });
```

`triageIssue(id, { action, priority, comment, snoozedUntil, version, clientMutationId })` accepts `accept`, `decline`, `snooze`, and `unsnooze`. Accept/decline can save a comment atomically, and the response contains the resulting issue plus the optional comment. Team priority requirements and permissions also apply to SDK callers.

`startCycleToday(id, { version, clientMutationId })` starts the next upcoming cycle and rolls eligible unfinished issues into it. `endCycleToday(id, options)` adjusts the active cycle to end at the next local midnight. Both return `{ cycle, rolledOverCount }`; inherited cycles must be changed on their parent team. Pass `version` to reject stale changes and reuse `clientMutationId` for an uncertain response.

`uploadAvatar(userId, file, filename)` and `removeAvatar(userId)` update the current user's profile photo and return the updated user. `customEmojis.upload(name, file, filename)`, `customEmojis.list()`, and `customEmojis.remove(id)` manage workspace emoji. Uploads use real multipart bodies with automatic boundaries. Removing a custom emoji removes it from suggestions while preserving authorized image access for historical content.

```ts
const emoji = await client.customEmojis.upload('ship_it', imageBlob, 'ship.png');
const { nodes } = await client.customEmojis.list();
await client.triageIssue(issue.id, {
  action: 'accept', priority: 2, comment: '<p>Ready for the team.</p>',
  clientMutationId: crypto.randomUUID(),
});
```

### Direct request forms

`publicAsks` preserves the existing endpoint namespace; forms now require authentication for both reading and submission. Browser sessions follow a direct link only into workspaces they belong to. API tokens retain their original workspace scope. Node callers must provide a token or a custom fetch transport that persists session cookies; calling `login` does not create a Node cookie jar.

Submissions derive requester identity from authentication, so caller-supplied email cannot impersonate another user. Send an optional stable `submissionKey` for retry deduplication; reusing it with changed content returns a conflict. Submit typed `answers`, including numbers as numbers and checkboxes as booleans.

### Template file fields

A form field with `type: "file"` accepts an array of stored attachment IDs in `templateAnswers[fieldId]`. Upload bytes first with `upload` or `uploadFile`, then create the issue or submit the Asks page with the returned IDs. `request("/api/v1/attachments/" + id + "/metadata")` returns authorized filename, size, MIME type and URL metadata without downloading the bytes.

The server checks upload ownership or source-parent access. Reused bound files are copied for the destination; inspect the created issue's `templateAnswers` for canonical IDs. Failed creation rolls back copies and bindings. A file field cannot set an issue property.
