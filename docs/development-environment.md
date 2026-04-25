# Happened Service-Grade Development Environment

## Goal

The first target is not a throwaway demo. The local environment should let friends use Happened like a real service while keeping infrastructure choices reversible.

## Current Preview Standard

- One command can expose the app to a phone through Tailscale Funnel, and the current fixed friend-test URL is served through ngrok.
- The web app and API share one HTTPS URL.
- Development data persists in Docker **PostGIS** (`happened-postgres`, image `postgis/postgis:16-3.4`) on host port `5433`. Radius queries use `ST_DWithin` and KNN ordering on a GIST index.
- Local JSON persistence remains as a fallback only when `DATABASE_URL` is unset.
- Uploaded images persist through the local media storage provider in `.local/uploads/` (deprecated; superseded by S3 client in S3 sprint).
- **MinIO** (S3-compatible, ports `9000` API / `9001` console) ships in the dev compose. Bucket `happened-media-dev` is auto-created with a public-read policy on the `public/*` prefix.
- **MailHog** (ports `1025` SMTP / `8025` UI) runs alongside Postgres for local email testing. Server reads `SMTP_*` env to talk to it.
- Auth, check-in tokens, memory posts, places, timeline, profiles, follows, blocks, search, notifications, and media are all API-backed.
- Postgres schema, migrations, seed data, auth, feed, viewer-specific feed actions, check-ins, and memory creation are wired into the development API path.
- Map uses real OpenStreetMap raster tiles, Web Mercator projection, current GPS location, draggable pan, zoom controls, place markers, and GPS-based distance state.
- Public QA covers API flows, cross-account post visibility, and mobile web screenshots at 390px and 430px widths.
- No external analytics, product event logging, or crash logging is installed.
- Local-vs-production differences are tracked in `docs/local-vs-production.md`.
- API request logs are off by default. Set `API_LOG_REQUESTS=1` only for local debugging; authorization headers and passwords are redacted.

## Commands

```bash
npm run test:tailscale
```

Builds a static web preview, starts the API, local proxy, and Tailscale Funnel.

```bash
npm run test:local
```

Starts API and Expo web for same-network phone/browser testing.

```bash
npm run db:up
npm run db:migrate
```

Starts local **PostGIS** + **MinIO** + **MailHog** and applies schema migrations when `DATABASE_URL` is configured.
Convenience URLs after `db:up`:

- MinIO console: <http://localhost:9001> (default credentials `minioadmin` / `minioadmin`).
- MailHog UI: <http://localhost:8025>.

To wipe ALL dev data (postgres + minio volumes), run the explicit DESTRUCTIVE command:
`docker compose -f docker-compose.dev.yml down -v`. There is no shortcut script — the wipe is intentional.

To roll back the PostGIS migration manually:
`psql "$DATABASE_URL" -f server/migrations/008_postgis.down.sql && psql "$DATABASE_URL" -c "delete from schema_migrations where id='008_postgis.sql';"`

```bash
npm run qa:public
```

Checks the fixed public URL for health, auth, sessions, feed actions, hidden-post persistence, check-in, memory creation, and mobile screenshot overflow.

The default development login is:

- Email: `test@happened.dev`
- Password: `happened-test-1`

## Dev Substitutes

- Docker Postgres substitutes for managed DB while friend testing.
- Local filesystem uploads substitute for object storage.
- Tailscale Funnel substitutes for a deployed preview environment.
- ngrok substitutes for a stable external friend-test domain.
- OpenStreetMap public raster tiles substitute for a production map provider during development.
- Expo web substitutes for native builds during product-flow QA.
- Location checks default to a dev override so remote friends can test check-in flows. Set `HAPPENED_DEV_LOCATION_OVERRIDE=0` to enforce measured GPS distance and 50m accuracy.
- Media storage is behind `server/media.ts`. Keep `MEDIA_STORAGE_DRIVER=local` while the Mac mini is the preview host; object storage can be added behind the same interface later.

These are accepted only for the first development target. Before public launch, DB hosting, object storage, auth provider, observability, CI/CD, app distribution, legal docs, and moderation operations need explicit production choices.
