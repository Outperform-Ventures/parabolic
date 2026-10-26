# Parabolic

An open-source workspace for issue tracking, projects, documents, and product planning. Parabolic runs as a macOS desktop application or a self-hosted web application.

## Features

- Issues, projects, documents, and custom views
- Collaborative editing and real-time updates
- Offline editing with a persistent sync queue
- Local SQLite storage
- REST and GraphQL APIs, a TypeScript SDK, and MCP support
- A shared interface across desktop and web

Parabolic is under active development. Prebuilt installers are not currently available from this repository.

## Getting started

### Requirements

- Node.js 24.4 or later
- pnpm 10.33.0
- macOS for the desktop application

### Install and build

```sh
git clone https://github.com/Outperform-Ventures/parabolic.git
cd parabolic
pnpm install --frozen-lockfile
pnpm build
```

### Web development

```sh
pnpm dev
```

Open <http://127.0.0.1:4173>. The API runs on port 4174, and development data is stored in `.data/`. On first launch, create an account and workspace.

To serve the compiled application locally:

```sh
pnpm start
```

Open <http://127.0.0.1:4174>.

### Desktop development

After building, launch with a separate development profile:

```sh
PARABOLIC_USER_DATA="$PWD/.local/desktop-profile" pnpm desktop
```

To package an Apple Silicon macOS application:

```sh
pnpm package:mac
```

The application is written to `release/mac-arm64/Parabolic.app`. The default package is an ad-hoc signed development build, without Apple notarization.

## Configuration

[`.env.example`](.env.example) lists the basic web-service settings. The server does not load `.env` automatically. To use a local environment file after building:

```sh
cp .env.example .env
node --env-file=.env dist-server/index.mjs
```

The service binds to localhost by default. A network deployment requires a persistent database path, HTTPS, and explicit public URL and allowed-origin settings. SMTP delivery is optional.

Desktop data is stored in `~/Library/Application Support/Parabolic/` by default. `PARABOLIC_USER_DATA` selects a different profile. Back up SQLite using its backup API or after a clean shutdown so that committed WAL data is preserved.

## Documentation

- [Service API](src/server/README.md)
- [TypeScript SDK](packages/sdk/README.md)
- [MCP](docs/mcp.md)
- [OAuth](docs/oauth.md)
- [Collaboration](docs/collaboration.md)

## Contributing

Bug reports and pull requests are welcome. For a bug report, include reproduction steps, your operating system, and the relevant Node.js version. Use synthetic data in examples and omit credentials and personal information.

Before submitting a pull request, run:

```sh
pnpm typecheck
pnpm test
pnpm build
```

Use a separate database and desktop profile for development. Keep changes focused and include regression tests for behavior changes.

## License

Parabolic is licensed under the [MIT License](LICENSE). Bundled Inter fonts are distributed under the [SIL Open Font License](public/licenses/inter.txt). Third-party dependencies retain their respective licenses and trademarks.
