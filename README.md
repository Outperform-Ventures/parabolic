# Parabolic

An open-source workspace for issues, projects, documents and product planning, with a shared React interface for macOS and the web. The Electron application includes a local Node/SQLite service; the same service can be self-hosted for a shared workspace. Licensed under [MIT](LICENSE).

Parabolic is independent and is not affiliated with or endorsed by Linear or the integration brands shown in the interface. Integration branding is not evidence of an implemented provider connection.

## Documentation

| Document | Purpose |
| --- | --- |
| [Architecture](ARCHITECTURE.md) | Renderer, desktop processes, service, persistence, sync, SDK/MCP and boundaries. |
| [Build/deploy/release runbook](DEPLOY_RUNBOOK.md) | Validation, Mac packaging, optional shared hosting, backups and rollback. |
| [Environment and secrets](ENV_AND_SECRETS.md) | Application/development settings and where per-installation credentials live. |
| [Agent instructions](AGENTS.md) | Safe development, data isolation and verification rules. |
| [Service API](src/server/README.md) / [SDK](packages/sdk/README.md) | HTTP/domain reference and typed client. |

## Run from source

Requires **Node 24.4+** (Node's SQLite API) and **pnpm 10.33.0**, as declared in `package.json`.

```sh
git clone https://github.com/Outperform-Ventures/parabolic.git
cd parabolic
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
```

For web development, check that ports **4173/4174** are free, then run `pnpm dev`. Vite serves the renderer on loopback port 4173 and proxies the API on 4174. Data is local under `.data/` by default. First run asks you to create an account/workspace; there is no default account or password.

For the local production web build, `pnpm start` serves the compiled UI and API on loopback port 4174. See the runbook before exposing it to a network.

## Desktop development and packaging

After building, start an isolated desktop profile:

```sh
PARABOLIC_USER_DATA="$PWD/.local/desktop-profile" pnpm desktop
```

Do not omit isolation when an installed Parabolic app already contains data. The embedded service keeps SQLite work in an Electron utility process and uses a loopback origin.

`pnpm package:mac` builds an Apple Silicon app under `release/mac-arm64/Parabolic.app`. With no update feed configured, this is an **ad-hoc development build**, not a Developer ID-signed or notarized public release. This OPV repository does not yet publish installers or operate an update feed; there are no fabricated download links here. Follow the [release runbook](DEPLOY_RUNBOOK.md) before distributing binaries.

The advanced `pnpm dev:desktop` launcher can copy an existing installed workspace into an isolated development directory. It removes copied login sessions, but the copied records are still private. Use it only when deliberately testing with that data; it is not a clean first-run command.

## What's included

- Issues, projects, documents, views, planning, customer records, collaboration and administration.
- Persistent SQLite service with REST/GraphQL, scoped authentication, SSE and Yjs collaboration.
- Durable client-side offline queue and conflict handling.
- Electron windows, native menus, deep links and managed embedded-service lifecycle.
- Typed SDK and credential-scoped MCP access.
- Optional SMTP delivery when configured by a self-hosting operator.

Feature breadth is not a claim of complete functional/visual parity with another product. SAML/SCIM, hosted AI, billing, many external provider connections and an operated release service are not supplied by this repository.

## CI and deployment

GitHub CI validates fresh source on Linux and macOS. It does not install over a user's app, connect to a production workspace, send email, publish an installer or deploy a server. Shared hosting and signed desktop distribution are separate operator choices documented in the runbook. There is no configured Fly application for this repository.

## Data and security

Installed macOS data normally lives under `~/Library/Application Support/Parabolic/`. Treat its database, browser partitions, cookies, drafts and backups as private. Source publication never includes those records. See the inventory before configuring SMTP, MCP or an update feed.

Back up SQLite consistently, including committed WAL data, and preserve profile/offline data when relevant. A code rollback does not reverse schema/data changes. Report suspected vulnerabilities privately to the repository maintainers; do not post tokens, workspace exports or account records in public issues.

## License and assets

Application source is MIT-licensed; retain [LICENSE](LICENSE). Bundled Inter font files retain their SIL Open Font License in `src/client/fonts/LICENSE.txt` and `public/licenses/inter.txt`. Berkeley Mono and personal avatars are not redistributed. Third-party dependencies retain their licenses; product/integration names and logos may be their owners' trademarks.
