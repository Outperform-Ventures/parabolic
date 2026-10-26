# Build, deploy and release runbook

Parabolic has three distinct operations: build a local Mac app, self-host a shared web service, or distribute signed desktop updates. This repository configures source CI only. There is no automatic Fly deployment, installer publishing or replacement of an installed app.

## Validate source

Use Node 24.4+ and pnpm 10.33.0:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
```

CI runs on Linux and macOS; Linux also builds the shared-service container. Read the actual run and revision before claiming success. Browser/native tests are separate from the unit suite and need their own isolated profiles, dependencies and evidence.

Do not start a server on an occupied port or stop an unrelated project. Do not use real installed-app data for routine validation.

## Local macOS package

On macOS, with no update-feed override configured:

```sh
pnpm package:mac
```

Expected directory: `release/mac-arm64/Parabolic.app`. The default target is Apple Silicon. There is no claim of an Intel build or a published download asset from this command.

The local signing hook applies an ad-hoc signature. Check the result:

```sh
codesign --verify --deep --strict release/mac-arm64/Parabolic.app
```

Inspect package contents for environment files, workspace databases, cookies, private reference material and test data before distribution. For a manual test use an isolated profile, not `/Applications/Parabolic.app` or its regular data directory:

```sh
PARABOLIC_USER_DATA="$PWD/.local/package-review-profile" release/mac-arm64/Parabolic.app/Contents/MacOS/Parabolic
```

Launching this starts an embedded service; check project ports/resources first. Use synthetic records. Do not overwrite an installed app or quit another instance without an intended, authorized installation plan.

## Signed/notarized public distribution

This is not configured as an automatic workflow. A maintainer must establish signing certificate/key custody, Apple notarization credentials, release ownership and an HTTPS artifact/update host before enabling distribution. Do not invent secret values or put signing files in source.

`PARABOLIC_UPDATE_FEED_URL` must be a clean HTTPS URL; it causes packaging to require signing and select distributable targets. The local ad-hoc hook is bypassed in that mode. This is a guard, not proof that notarization, feed metadata, signed installation/relaunch or rollback works.

Before publishing a release, validate the exact artifact's signature/notarization, bundle identity, source revision, privacy, architecture and isolated startup/update behavior. Preserve licenses and provide real checksums. Do not advertise a GitHub download until its artifact exists. Do not enable updates for installed users as a side effect of a source/docs change.

## Shared web service

After the source checks, configure a durable database path, public HTTPS origin and allowed origins; see [the inventory](ENV_AND_SECRETS.md). The CLI does not load `.env` automatically. One option is:

```sh
cp .env.example .env
node --env-file=.env dist-server/index.mjs
```

The example is loopback-only and leaves email unconfigured. For shared hosting, set the intended `HOST`, `PARABOLIC_PUBLIC_URL`, `PARABOLIC_ALLOWED_ORIGINS` and private persistent path before starting. Do not expose default development origins as a production access policy.

The supplied Docker/Compose setup is an alternative:

```sh
docker compose build
docker compose up -d
```

This starts a service and creates/uses the `parabolic-data` volume. It publishes port 4174 on loopback. A shared deployment needs an HTTPS reverse proxy preserving WebSocket upgrades and SSE streaming; disable proxy buffering for `/api/v1/events`. Set the exact public origin; arbitrary forwarded headers are not a trusted configuration source.

Run one service process per database. Do not scale replicas against the same file. First-run setup creates an account/workspace; no production demo account or password is supplied. Optional SMTP can send real mail once configured; test with a controlled relay and recipients.

## Verify a deployment

Confirm the source/image revision, persistent path/volume, health response, intended origin policy, authentication and synthetic read/write behavior. Confirm WebSocket/SSE behavior for a shared service and inspect logs without printing credentials or real records. The local embedded desktop does not automatically switch to or synchronize with a newly hosted server.

`/health` is process health, not proof of correct authorization, data integrity, provider delivery or source parity. A successful build is not a successful install or deployment.

## Backup and recovery

SQLite uses WAL. Use SQLite's online backup facility for a running database, or coordinate a clean shutdown before a consistent cold copy. Copying only the main `.sqlite` file during writes may miss committed WAL data. Attachments are stored in the database; browser cookies, IndexedDB caches and unsent work also live in profiles.

For installed-app recovery, preserve the full profile and a consistent database backup. Keep all copies private and outside the repository/CI artifacts. Verify backup integrity and test restoration separately before relying on it. The advanced dev launcher creates a workspace copy and removes sessions; it is not a complete production-profile backup.

## Rollback

For shared source, review a revert and rebuild the prior known-good runtime. For a desktop, select a known-good package without altering the user's data first. Startup may migrate SQLite schema; downgrading binaries does not reverse migrations and may be incompatible with newer data.

If data restoration is necessary, preserve current state, obtain authorization for losing post-backup work, and test a matched code/data restore separately. Never silently restore an old profile/database to fix an application error. Document recovery version, backup time, integrity checks and expected missing work without exposing records.

## Common failures

| Symptom | Check |
| --- | --- |
| Missing SQLite API | Correct Node 24.4+ runtime; do not substitute older Node. |
| Port conflict | Identify the owner; choose free development ports instead of killing it. |
| Desktop opens existing private workspace | Stop the unintended test safely; use an explicit isolated profile on the next authorized launch. |
| Email unavailable | Both SMTP URL and sender are required; do not assume a managed relay exists. |
| API/MCP unauthorized | Credential scopes, workspace membership, audience/origin and read-only settings; never paste the token into an issue. |
| Update unavailable | No feed, development build, managed policy or unsupported platform; do not bypass signing. |
| Container builds but assets missing | Ensure `public/` and compiled renderer are included and verify requests on the actual image. |
| Database downgrade fails | Preserve current files; assess schema compatibility and recovery rather than deleting data. |

See [architecture](ARCHITECTURE.md) for boundaries and [environment/secrets](ENV_AND_SECRETS.md) for configuration custody. No real credentials or personal profiles are required for source CI.
