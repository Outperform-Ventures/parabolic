# Parabolic

Parabolic is an open-source issue, project, and planning workspace for macOS and the web. It combines a React interface, an Electron desktop shell, and a persistent Node/SQLite service in one repository.

## Run

The packaged Mac app stores its database in `~/Library/Application Support/Parabolic/`. No default account or password is supplied. Create the first workspace through the login screen.

Development requires Node 24.4+ and pnpm 10:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://127.0.0.1:4173`. Vite serves the renderer and proxies the persistent service on port 4174. Development data lives under `.data/`, separately from the packaged app.

```sh
pnpm build
pnpm start                 # Production web app on port 4174
pnpm desktop               # Desktop shell from the local build
pnpm package:mac           # macOS arm64 application
pnpm typecheck
pnpm test                  # Domain, API, SDK, MCP and platform tests
pnpm exec playwright test --workers=1  # Browser workflows; requires a build
```

See [deployment.md](docs/deployment.md) for a shared service and durable storage. The default embedded database is local to one Mac; a central service shares a workspace across devices.

## Product and platform

The React renderer shares routes and workflows between web and Electron. The Node service uses SQLite WAL, validated REST and GraphQL APIs, scoped authentication, signed webhooks, synchronization, and background scheduling. The client uses optimistic changes, a durable IndexedDB outbox, progressive synchronization, conflict review, and virtualized issue lists.

- [Service and HTTP API](src/server/README.md)
- [Typed SDK](packages/sdk/README.md)
- [MCP access](docs/mcp.md)
- [macOS architecture](docs/desktop.md)
- [Platform validation](docs/platform-validation.md) and [native parity checklist](docs/native-parity-checklist.md)
- [Current section-by-section visual comparison](docs/visual-parity.md)
- [100,000-issue browser measurements](artifacts/performance/ui-100000.json) and [10,000-issue measurements](artifacts/performance/ui-10000.json)

The scope includes issues, properties and relationships, rich documents and comments, views, inbox, triage and SLAs, cycles, projects and timelines, initiatives and updates, insights and dashboards, customers and forms, administration, basic authentication, API/SDK/webhooks, OAuth, MCP, and deep links.

It excludes Pulse, hosted AI and coding workflows, billing/plans/legal surfaces, imports/exports/migration, onboarding/adoption guidance, methodology UI, and releases. Integrations have provider scaffolding only. Connector-dependent Slack/email intake and external sync are deferred. Local coding scripts fall under the coding exclusion; prefilled issue links remain included.

## License

Parabolic is available under the [MIT License](LICENSE). Bundled Inter font files remain under the SIL Open Font License included alongside them. Product and integration names and logos may be trademarks of their respective owners.
