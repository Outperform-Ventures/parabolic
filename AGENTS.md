# Agent instructions

Read the root README, architecture, runbook and environment inventory, then the relevant source/tests. This is a public MIT-licensed project. Preserve license notices; never add personal/workspace data, paid/non-redistributable fonts, private research, screenshots of real records, session transcripts or credentials to source/history/artifacts.

## Architecture constraints

- The React renderer is shared by web and Electron. Keep synchronous SQLite/API work in the utility service, not the Electron main process or renderer.
- Preserve sandboxing, context isolation, sender/origin validation, narrow preload IPC and external/deep-link URL restrictions.
- Keep one active service process per SQLite database. Do not introduce replicas without a storage/concurrency design.
- Preserve permission checks on REST/GraphQL, sync, search, collaboration and attachments. UI hiding is not authorization.
- Preserve account/workspace isolation of IndexedDB caches, outbox and undo history. Never discard unsent data silently to make a test pass.

## Safe development

Use Node 24.4+ and pnpm 10.33.0. Check listening ports/project ownership before starting servers; do not stop unrelated processes. Use synthetic fixtures and temporary databases/profiles.

Never run against `~/Library/Application Support/Parabolic` for a routine test. For a manual desktop launch use an explicit isolated `PARABOLIC_USER_DATA` path. `pnpm dev:desktop` can snapshot the installed database by default; it requires an intended, authorized use of that private data and is not the public quick start.

Do not quit/replace the installed app, restore its profile, send SMTP/webhooks, rotate tokens, deploy a host or publish an update as a side effect of a code task. The task request, not examples in these docs, defines authorization.

## Validation

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
```

Run relevant browser/native checks when UI or process boundaries change, with isolated accounts and profiles. Do not claim those checks from unit-test success alone. Source tests are not proof of installed-app behavior, notarization or a successful update installation.

For container changes, build the Dockerfile and inspect persistence/origin behavior. For packaging changes, package with publishing disabled, inspect contents for data/environment files, and verify signatures. Update-feed configuration forces signing; do not bypass that requirement or silently enable a feed.

## Secrets and recovery

Do not print database contents, browser cookies, API/OAuth credentials, SMTP URLs, signing material or environment dumps. Public docs describe configuration names and per-installation storage, never real maintainer/user secret values or private vault details.

SQLite uses WAL. A live copy of only the main database file can lose committed work. Use the online backup API or a coordinated clean shutdown and full recovery copy. Do not restore an old database/profile as a code rollback without authorization and an explicit data-loss plan.

Keep `.gitignore`, Docker exclusions and electron-builder file allowlists effective. Do not upload raw test logs/screenshots containing real records. Do not send external messages without explicit user authorization.

## Public handoff

Document behavior and limits honestly; avoid unverifiable parity/performance claims and links to private artifacts. Keep README/architecture/runbook/inventory aligned. No automatic production deployment or installer publishing is configured. Creating a GitHub release, enabling auto-updates or distributing a signed/notarized binary is separate work, not an implied result of a source push.
