# Shared web deployment

The service serves the compiled renderer, API, authentication, synchronization, uploads, webhooks, and background jobs. Use one active service process per SQLite database and a durable local data directory.

With Node 24.4+ and pnpm 11:

```sh
pnpm install --frozen-lockfile
pnpm build
HOST=0.0.0.0 PORT=4174 \
  PARABOLIC_DATABASE=/srv/parabolic/workspace.sqlite \
  PARABOLIC_PUBLIC_URL=https://work.example.internal \
  PARABOLIC_ALLOWED_ORIGINS=https://work.example.internal \
  pnpm start
```

Put an HTTPS reverse proxy in front of the service. Proxy all routes, preserve WebSocket upgrades, and disable buffering for `/api/v1/events`. Set the exact public origin explicitly; arbitrary forwarded headers are not trusted for cookie/origin decisions.

`docker compose up --build -d` uses the supplied container configuration. It publishes port 4174 on loopback and persists data in `parabolic-data`. Set `PARABOLIC_PUBLIC_URL` before shared deployment. Container verification is separate from local Mac and browser tests.

First-run authentication creates the owner, workspace, team, and statuses. It supplies no production demonstration issues or default password. Administrators create invitation links for subsequent users; this service does not send email.

## Desktop connection

The embedded Mac database is local. During development, point the desktop at a shared server with:

```sh
PARABOLIC_RENDERER_URL=https://work.example.internal pnpm desktop
```

That origin becomes the permitted renderer/IPC origin. Local drafts, caches, and offline changes are scoped to user and workspace. See [desktop.md](desktop.md) for native configuration.

## Operations

Keep SQLite and uploads in persistent storage. Stop the service before making a consistent cold copy of the data directory, then restart it. Use SQLite's online backup facility for a running database; copying only the main database file during writes can miss data still in its WAL. Operational backup is separate from the excluded product import/export feature.

`/health` supplies a process health check. SIGTERM/SIGINT closes streams, background workers, and SQLite. The Mac shell manages its embedded service automatically.

Webhook destinations require HTTPS by default. Internal HTTP/private-network destinations can be enabled with `PARABOLIC_ALLOW_PRIVATE_WEBHOOKS=true`. Create API credentials and webhooks in Settings; plaintext secrets are shown once.

See [the service reference](../src/server/README.md), [SDK](../packages/sdk/README.md), and [MCP configuration](mcp.md) for programmatic access.

### Transactional email

Set `PARABOLIC_SMTP_URL` (an `smtp://` or `smtps://` connection URL) and `PARABOLIC_MAIL_FROM` on the service to deliver invitation emails, workspace deletion confirmation codes and administrator deletion/cancellation notices. Use TLS and your organization's SMTP relay credentials for shared deployments. These are transactional account messages; connector and notification-digest work remains separate.

Messages enter a durable SQLite outbox, deduplicate by operation and retry failed delivery with backoff. Successful delivery removes the stored body. Invitations can still be copied manually while email is unconfigured; their UI accurately reports queued status. Workspace deletion requires configured email and a six-digit, session-bound code that expires after ten minutes and allows at most five attempts. Confirmed deletion has a 48-hour administrator cancellation period.

Local macOS packages receive an ad-hoc signature binding the bundle identifier and resources so native notification delivery works. This is not Developer ID signing or notarization for distribution. System notification permissions and Focus still determine whether banners appear.

General notification email is also available in Settings → Notifications, with immediate delivery or unread digests and independent notification categories. Queued digests are regenerated before SMTP so read, archived, inaccessible or opted-out notifications are omitted. Digest thresholds currently follow Parabolic's published historical urgency policy; exact current native timing is an open comparison gate. Configure `PARABOLIC_PUBLIC_URL` for web links in messages; otherwise links use the `parabolic://` desktop scheme.

Profile email changes and approved-domain workspace discovery use the same SMTP relay. Email changes require confirmation links delivered separately to the old and new addresses; approved-domain joining requires an email verification code before workspace names are disclosed. Configure `PARABOLIC_PUBLIC_URL` to the user-facing web origin so confirmation links open the service. Without SMTP configuration, these verification requests return an explicit configuration error and leave account/access data unchanged. Domain approval is configured by administrators in Security & access; it does not replace password login or implement SAML/SCIM provisioning.
