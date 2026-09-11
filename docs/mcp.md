# External tool access through MCP

Parabolic exposes all retained workspace collections through MCP. It runs no hosted model, coding agent, or AI session. Workspace membership, private-team rules, entity permissions, and credential scopes apply to every record operation.

## Remote clients with OAuth

Use `https://your-workspace.example/mcp`. This endpoint is part of the workspace server; it requires no separate MCP daemon. Configure the backend's public URL to that HTTPS origin when serving behind a reverse proxy. Loopback HTTP is supported for local development. The server executes MCP requests directly against its repository, so it never passes an incoming OAuth token through to REST.

An unauthenticated request returns HTTP 401 and a `WWW-Authenticate` header pointing to `/.well-known/oauth-protected-resource/mcp`. Resource metadata is also available at `/.well-known/oauth-protected-resource`. It supplies the canonical MCP resource URI, authorization server, supported scopes, and bearer-header method. The authorization server publishes `/.well-known/oauth-authorization-server` with its authorization, token, revocation, and registration endpoints and S256 PKCE support.

Clients may use an application registered in API settings or dynamically register with `POST /oauth/register`. Dynamic registration accepts a client name, exact HTTPS or loopback redirect URIs, optional scopes, `token_endpoint_auth_method: "none"`, authorization-code and refresh grants, and code responses. It returns a client ID without a client secret. Registration is rate limited. Dynamic client names are self-declared and identified as such in consent; registration alone grants no workspace access. Client ID Metadata Documents are not advertised; clients can use the advertised registration endpoint or a preregistered client.

An OAuth client must send `resource=https://your-workspace.example/mcp`, `response_type=code`, `code_challenge`, and `code_challenge_method=S256` to `/oauth/authorize`. Request only the needed scopes, such as `issues:read`, or `read issues:write` for broad reads and issue changes. The browser shows the current account, workspace, client name, requested access, MCP host, and callback host. The user explicitly approves or denies each request. The selected workspace determines the grant's membership and permissions.

Exchange the code at `/oauth/token` with the same `resource`, registered redirect URI, client ID, and private PKCE verifier. MCP tokens last one hour and carry an exact resource binding in the server's token store. An ordinary REST OAuth token, an expired token, or an OAuth token for another audience receives HTTP 401. Conversely, MCP OAuth tokens cannot call ordinary REST, GraphQL, or collaboration endpoints. Refresh requests retain the same resource and rotate both tokens; revocation and reused refresh credentials invalidate the grant. See [OAuth details](oauth.md).

HTTP 403 scope challenges include `error="insufficient_scope"`, the existing and newly needed scopes, and resource metadata. The client can request explicit additional consent and retry. The service does not silently expand credentials. Personal API keys remain an explicitly configured alternative, with their normal workspace scopes.

This discovery and authorization flow follows the official [MCP authorization specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization), including audience isolation and direct repository execution.

## Local stdio clients

```json
{
  "mcpServers": {
    "parabolic": {
      "command": "node",
      "args": ["/absolute/path/to/parabolic/dist-mcp/cli.mjs"],
      "env": {
        "PARABOLIC_URL": "http://127.0.0.1:4174",
        "PARABOLIC_API_TOKEN": "your-personal-api-key",
        "PARABOLIC_MCP_READ_ONLY": "1"
      }
    }
  }
}
```

During development, `node --import tsx src/mcp/cli.ts` starts the same stdio server. It requires a personal API key in `PARABOLIC_API_TOKEN`. Diagnostics go to stderr; stdout contains newline-delimited JSON-RPC. `PARABOLIC_MCP_READ_ONLY=1` removes write tools. `PARABOLIC_MCP_COLLECTIONS=issues,projects,documents` restricts both tools and resources. Use a scoped key as an independent permission boundary.

## Tools and transport

Supported protocol versions are `2024-11-05`, `2025-03-26`, `2025-06-18`, and `2025-11-25`; unsupported versions negotiate `2025-11-25`. The tools are `list_entities`, `get_entity`, `search`, `create_entity`, `update_entity`, `delete_entity`, and `restore_entity`. Their schemas describe fields, filters, sorting, and pagination. `includeDeleted: true` discovers accessible records in trash. Delete moves records to trash and restore uses the normal repository operation. The `parabolic://schema` resource lists collections; `parabolic://{kind}/{id}` reads one accessible record.

HTTP POST requires `Content-Type: application/json`, `Accept: application/json, text/event-stream`, and an authorization header on every request. The server uses stateless JSON Streamable HTTP responses; notifications return 202. GET and DELETE return 405 because this transport has no allocated HTTP sessions or independent server-push stream. The main API offers a separate authenticated SSE change feed. Each HTTP body contains one JSON-RPC message and is limited to two megabytes. Unsupported `MCP-Protocol-Version` headers receive 400. Origin headers must match the canonical resource origin or an explicitly configured allowed origin. These transport choices follow the [MCP transport specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports).

For existing personal-key clients, `PARABOLIC_URL=http://127.0.0.1:4174 node dist-mcp/cli.mjs --http` provides the compatibility endpoint `http://127.0.0.1:4041/mcp`. Override `PARABOLIC_MCP_PORT`, `PARABOLIC_MCP_HOST`, and comma-separated `PARABOLIC_MCP_ORIGINS` as needed. This bridge validates personal credentials through `/oauth/mcp-credential`; it rejects OAuth application tokens and does not advertise OAuth on its separate origin. OAuth clients use the canonical workspace `/mcp` endpoint.

Verification: `tests/platform/mcp-oauth.test.ts` runs real discovery, registration, consent, PKCE exchange, record access, scope challenges, audience rejection, refresh, revocation, and personal-key compatibility against SQLite. `tests/platform/oauth.spec.ts` tests the actual consent screen and callback. These protocol tests do not establish compatibility with every third-party MCP client UI.
