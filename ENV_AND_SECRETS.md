# Environment variables and secrets

This is a public-source inventory of supported configuration and per-installation storage. It contains no real user/maintainer secret values, private vault identifiers or production database records. The repository does not provision a hosted service, SMTP account, signing identity or update host.

## Service configuration

| Variable | Default / meaning |
| --- | --- |
| `PORT` | CLI service port 4174. |
| `HOST` | CLI bind `127.0.0.1`; Docker sets `0.0.0.0` inside the container. |
| `PARABOLIC_DATABASE` | CLI fallback `.data/parabolic.sqlite` relative to cwd; Docker `/data/workspace.sqlite`. Embedded Electron supplies its profile database path directly. |
| `PARABOLIC_STATIC_DIR` | CLI `dist`; Docker `/app/dist`. |
| `PARABOLIC_PUBLIC_URL` | Explicit public origin for shared deployments, cookies/links and messages; unset by default. Development launcher supplies its local renderer origin. |
| `PARABOLIC_ALLOWED_ORIGINS` | CLI defaults include local Vite origins on 4173/5173. Set exact intended origins for shared hosting. |
| `PARABOLIC_ALLOW_PRIVATE_WEBHOOKS` | Only literal `true` enables private/internal webhook destinations; disabled otherwise. Changes the outbound trust boundary. |
| `PARABOLIC_UPLOAD_MAX_BYTES` | Positive byte bound; default 268435456 (256 MiB). Applies transport/memory protection, not a billing entitlement. |
| `PARABOLIC_SMTP_URL` | Optional SMTP/SMTPS URL; may include credentials and must be secret. No default relay. |
| `PARABOLIC_MAIL_FROM` | Optional sender; required with SMTP URL to configure delivery. |
| `PARABOLIC_SUPPORT_EMAIL` | Optional validated support destination; support delivery also requires mail configuration. |
| `NODE_ENV` | Container sets `production`; runtime/dependency convention. |

The CLI does not automatically load `.env`; explicitly use `node --env-file=.env dist-server/index.mjs` or your host's environment injection. Do not place credentials in command arguments, source or public issue reports.

## Desktop, development and build settings

| Variable | Purpose / default |
| --- | --- |
| `PARABOLIC_USER_DATA` | Absolute desktop profile override; otherwise Electron's Parabolic profile. Use an isolated path for tests. |
| `PARABOLIC_RENDERER_URL` | Optional development/shared-server origin instead of embedded service. Must satisfy the origin restrictions; never embed credentials. |
| `PARABOLIC_HEADLESS` | Literal `1` hides native windows/dock for controlled test runs. |
| `PARABOLIC_DEV` | Literal `1` enables the isolated development-launcher mode only for unpackaged apps. |
| `PARABOLIC_DEV_SOURCE` | Advanced launcher's source database; defaults to the installed macOS Parabolic database. This can copy real records—use only deliberately. |
| `PARABOLIC_DEV_DATA_DIR` | Advanced launcher output, default `.local/parabolic-dev`. |
| `PARABOLIC_DEV_PORT` | Advanced renderer port 4273. |
| `PARABOLIC_DEV_API_PORT` | Advanced API port 4274; Vite's ordinary fallback is 4174. |
| `VITE_PARABOLIC_DEV` | Renderer build flag set by the advanced launcher to `1`; displays its dev badge. |
| `PARABOLIC_UPDATE_FEED_URL` | Optional generic HTTPS feed without credentials, query or fragment. Packaging requires signing when set; no operated feed is supplied. |
| `ELECTRON_RUN_AS_NODE` | Electron runtime flag; advanced desktop launcher removes it before starting Electron. Do not set it for a normal desktop launch. |

Vite also supplies built-in `DEV`/`PROD` flags. These are build context, not credentials. The advanced development server removes SMTP settings and disables background jobs/webhook delivery for its isolated copy; do not generalize that protection to ordinary production `pnpm start`.

## Verification-only settings

`PARABOLIC_FONT_RENDERER_DIR`, `PARABOLIC_FONT_REPORT_DIR` and `PARABOLIC_WEBKIT_EXECUTABLE` control verification input/output or a browser executable. Native smoke tools use `PARABOLIC_SMOKE_EXECUTABLE` and `PARABOLIC_SMOKE_SERVER_MODULE`. They are not production secrets or part of the public quick start. Run verification with synthetic records and temporary profiles; reports may still become sensitive if pointed at real data.

Benchmark/test-specific controls are defined by their individual test tools, not an application deployment contract. Standard GitHub runner/cache variables are supplied by GitHub. CI needs no application/SMTP/signing tokens and has read-only repository contents permission.

## Credential and private-data locations

| Item | Location / custody |
| --- | --- |
| User passwords | Created per installation; salted scrypt hashes in SQLite, not default credentials or an environment master password. |
| Sessions/API tokens | Issued per account/workspace; relevant server tables store hashes. Browser session material remains in the browser/Electron profile. API plaintext is shown at creation and belongs in the operator's secret manager. |
| OAuth app secrets | App-generated credentials; secret hashes are stored in SQLite. No external provider client secret is provisioned by this repository. |
| Webhook signing secrets | Recoverable values in private SQLite webhook records; treat the database and backups as secrets. |
| MCP token | Stdio uses `PARABOLIC_API_TOKEN`; HTTP clients supply bearer authorization. Store under the operator's credential manager, never a committed MCP configuration. |
| SMTP credentials | Operator-injected `PARABOLIC_SMTP_URL`; no verified shared account/vault item is part of this public source. |
| Desktop data | Normally `~/Library/Application Support/Parabolic/`: SQLite/WAL, connection/window settings, cookies and IndexedDB partitions. Do not assume the database is encrypted by this application. |
| Development data | `.data/` or advanced `.local/parabolic-dev/`; may contain real copied records despite being isolated/ignored. |
| Signing/notarization credentials | Not configured in repository CI. Future distribution needs explicit Apple/certificate custody and a verified tool-specific credential inventory. |
| Release/update hosting credentials | Not configured. A feed URL is public configuration, not a credential store. |

SQLite also contains attachment bytes, mail outbox content, verification state and other account/workspace data. Hashing selected credentials does not make a database/profile safe to publish. No application-specific Keychain vault is implemented here; do not infer one from Electron or OS facilities.

## MCP settings

| Variable | Default / behavior |
| --- | --- |
| `PARABOLIC_URL` | Upstream service, default `http://127.0.0.1:4174`. |
| `PARABOLIC_API_TOKEN` | Required for stdio; secret. HTTP mode instead forwards the caller's bearer token. |
| `PARABOLIC_MCP_COLLECTIONS` | Optional comma-separated collection allowlist; unknown names are rejected. |
| `PARABOLIC_MCP_READ_ONLY` | Literal `1` removes write tools. Does not grant missing upstream rights. |
| `PARABOLIC_MCP_HOST` | HTTP bind default `127.0.0.1`. |
| `PARABOLIC_MCP_PORT` | HTTP port default 4041. |
| `PARABOLIC_MCP_ORIGINS` | Optional comma-separated HTTP origin policy. |

## Rotation and recovery

Revoke/reissue API/session/OAuth credentials through an authorized account and update each consumer's protected copy. Coordinate webhook secret changes with receivers. Rotate SMTP credentials at the relay and update host injection without printing URLs. Do not rotate or send messages as an incidental source/documentation task.

Back up SQLite consistently with WAL and preserve needed client profiles/offline work separately. Keep backups outside source/CI artifacts with restricted access. Test recovery before relying on it. Restoring older credentials/profile state can revive or lose sessions and discard newer records; it is not a harmless code rollback.

Git/Docker/package exclusions do not replace review. Never publish `.env`, databases, user avatars, cookies, signing keys, raw logs or personal screenshots. See [the runbook](DEPLOY_RUNBOOK.md) for release/deployment boundaries.
