# S2 Parity Sprint Report

**Date:** 2026-04-26
**Branch:** `main`
**Goal:** Dev environment = production parity. One `docker compose -f docker-compose.dev.yml up -d` brings up the same dependency stack the production deployment will use (PostGIS, S3-compatible object storage, SMTP).

---

## Summary of changes

| Area | Before | After |
| --- | --- | --- |
| Postgres image | `postgres:16-alpine` (no spatial) | `postgis/postgis:16-3.4`. GIST index + `geography(Point,4326)` columns + auto-sync triggers. |
| Distance / radius queries | In-memory haversine (`distanceMeters` in `repository.ts`). | `ST_DWithin` + KNN (`<->`) ordering. New `findNearbyPlaces` repo method + `GET /v1/places/nearby` endpoint. Postgres `issueCheckIn` now computes distance via `ST_Distance(geography, geography)`. Local-JSON fallback keeps haversine (no PostGIS available) — function is documented as "in-memory fallback only". |
| Object storage | None (data URLs / local FS only). | MinIO service + auto-bootstrapped bucket `happened-media-dev` with `public/*` anonymous-GET policy. New `server/storage.ts` (S3 client wrapper) with `createPresignedUploadUrl`, `deleteObject`, `objectExists`, `mediaKey(userId, postId, ext)`. Wiring into request flow is deferred to S3 sprint (TODO comment in `server/media.ts`). |
| Mail | No infra. | MailHog service. New `server/mailer.ts` — `sendVerificationEmail`, `sendPasswordResetEmail`, `verifyMailerConnection` over nodemailer SMTP. |
| Env / config | Single Postgres url + media. | `.env.example` adds MinIO root creds, S3 client vars (`S3_ENDPOINT/REGION/BUCKET/ACCESS_KEY/SECRET_KEY/PUBLIC_URL_BASE`), MailHog ports, SMTP client vars. `server/config.ts` extended with `storage` and `mailer` blocks (null when env unset). |
| Tests | None for server. | `server/__tests__/parity.test.ts` — covers `mediaKey` shape/sanitization and config null-handling. Run with `npm run test:server`. |
| Docs | `Docker Postgres` mentions only. | `README.md`, `docs/development-environment.md` updated. PostGIS/MinIO/MailHog called out, rollback + reset procedures documented. |

---

## docker-compose.dev.yml topology

```
                ┌────────────────────────────────────────────────┐
                │            docker-compose.dev.yml              │
                ├────────────────────────────────────────────────┤
                │                                                │
   host:5433 ───┼──▶  postgres   (postgis/postgis:16-3.4)        │
                │       │ healthcheck: pg_isready                │
                │       └─ volume: happened-postgres-data        │
                │                                                │
   host:9000 ───┼──▶  minio      (minio/minio:latest)  S3 API    │
   host:9001 ───┼──▶                                  console    │
                │       │ healthcheck: /minio/health/live        │
                │       └─ volume: happened-minio-data           │
                │              ▲                                 │
                │              │ depends_on (service_healthy)    │
                │       minio-init (minio/mc:latest, oneshot)    │
                │         creates bucket + sets public/* policy  │
                │                                                │
   host:1025 ───┼──▶  mailhog    (mailhog/mailhog:latest) SMTP   │
   host:8025 ───┼──▶                                       UI    │
                │       │ healthcheck: GET /api/v2/messages      │
                └────────────────────────────────────────────────┘
```

All services declare `healthcheck`. `minio-init` waits on `minio: service_healthy` before running.

---

## Migration: `008_postgis.sql`

### What it does
1. `create extension if not exists postgis;`
2. Adds `geom geography(Point, 4326)` column to `places` and `memory_posts`.
3. Installs `BEFORE INSERT/UPDATE` triggers that derive `geom` from `lat/lng` (places) or from the linked place row (memory_posts) — no app code change needed for writes.
4. Backfills existing rows with a single `UPDATE`.
5. Creates GIST indexes (`places_geom_gix`, `memory_posts_geom_gix`).

### Apply
```bash
DATABASE_URL=postgres://happened:happened@localhost:5433/happened npm run db:migrate
```

### Rollback (manual — runner has no `down` support)
```bash
psql "$DATABASE_URL" -f server/migrations/008_postgis.down.sql
psql "$DATABASE_URL" -c "delete from schema_migrations where id='008_postgis.sql';"
```
The down script intentionally keeps the `postgis` extension installed (other tables/extensions may depend on it). Drop manually with `drop extension if exists postgis;` if you really want to.

---

## Environment variables

| Variable | Dev default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `postgres://happened:happened@localhost:5433/happened` | Postgres+PostGIS connection |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | `minioadmin` / `minioadmin` | MinIO admin (compose only) |
| `MINIO_API_PORT` / `MINIO_CONSOLE_PORT` | `9000` / `9001` | Host ports for MinIO |
| `S3_ENDPOINT` | `http://localhost:9000` | S3 client target |
| `S3_REGION` | `us-east-1` | required by SDK; meaningless on MinIO |
| `S3_BUCKET` | `happened-media-dev` | bucket name |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | `minioadmin` / `minioadmin` | S3 credentials |
| `S3_PUBLIC_URL_BASE` | `http://localhost:9000/happened-media-dev` | public URL prefix |
| `S3_FORCE_PATH_STYLE` | `1` | required for MinIO |
| `MAILHOG_SMTP_PORT` / `MAILHOG_UI_PORT` | `1025` / `8025` | host ports |
| `SMTP_HOST` | `localhost` | SMTP host |
| `SMTP_PORT` | `1025` | SMTP port |
| `SMTP_SECURE` | `0` | TLS off for MailHog |
| `SMTP_USER` / `SMTP_PASS` | empty | MailHog accepts no-auth |
| `SMTP_FROM` | `happened <no-reply@happened.local>` | default From header |

`getStorageConfig()` and `getMailerConfig()` return `null` when required vars are missing, so the API can still boot in degraded environments.

---

## Verification log

```
$ docker compose -f docker-compose.dev.yml up -d
... (postgres / minio / mailhog all healthy, minio-init: bucket ready)

$ docker compose ps
happened-mailhog    Up (healthy)   1025, 8025
happened-minio      Up (healthy)   9000-9001
happened-postgres   Up (healthy)   5433->5432

$ npm run db:migrate
Database migrations complete. Applied: 1

$ docker exec happened-postgres psql -U happened -d happened -c "\d places"
... geom | geography(Point,4326)
Indexes: places_pkey, places_geom_gix gist (geom)
Triggers: places_sync_geom_trg BEFORE INSERT OR UPDATE OF lat, lng

$ curl 'http://127.0.0.1:4017/v1/places/nearby?lat=37.5047&lng=127.0491&radius=5000&limit=5'
{"data":[
  {"id":"seolleung", ..., "distanceMeters":0},
  {"id":"cafe",       ..., "distanceMeters":429},
  {"id":"school",     ..., "distanceMeters":1288},
  {"id":"office",     ..., "distanceMeters":2045}
]}        # <- ST_DWithin + KNN ordering, ascending by distance ✓

$ curl -o/dev/null -w'%{http_code}\n' http://localhost:8025/    # MailHog UI
200
$ curl -o/dev/null -w'%{http_code}\n' http://localhost:9001/    # MinIO console
200

$ npx tsc --noEmit       # 0 errors
$ npm run test:server    # 5 / 5 ok
```

---

## Files

### Added
- `server/migrations/008_postgis.sql`
- `server/migrations/008_postgis.down.sql`
- `server/storage.ts`
- `server/mailer.ts`
- `server/__tests__/parity.test.ts`
- `reports/260426-S2-parity/REPORT.md` (this file)

### Modified
- `docker-compose.dev.yml` — Postgres → PostGIS image; added MinIO + minio-init + MailHog services with healthchecks.
- `.env.example` — added all new dev-default env vars (S3_*, SMTP_*, MAILHOG_*, MINIO_*).
- `package.json` — added `db:reset` (annotated as DESTRUCTIVE) and `test:server` scripts; added `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `nodemailer`, `@types/nodemailer` deps.
- `server/db.ts` — registers migration `008_postgis.sql`.
- `server/config.ts` — exposes `storage` and `mailer` config blocks.
- `server/repository.ts` — `issueCheckIn` (postgres path) uses `ST_Distance`; new `findNearbyPlaces` (postgres uses `ST_DWithin` + KNN; local-JSON fallback uses haversine); haversine helper marked deprecated for postgres path.
- `server/schemas.ts` — `nearbyQuerySchema`.
- `server/app.ts` — `GET /v1/places/nearby` endpoint.
- `server/media.ts` — TODO(S3) deprecation comment.
- `README.md`, `docs/development-environment.md` — PostGIS/MinIO/MailHog docs, rollback + reset commands.

---

## Handoff to S3 sprint

1. **Wire object storage into the upload flow.** `server/media.ts` still writes data URLs / local files. Replace `mediaStorage.saveDataUrl(...)` callsites in `server/app.ts` (`/v1/me/profile`, `/v1/memories`) with the presigned-upload flow:
   - Client requests `POST /v1/media/upload-intent` → server calls `createPresignedUploadUrl({ key: mediaKey(userId, postId, ext), contentType, maxBytes })` and returns `{ uploadUrl, publicUrl, expiresAt }`.
   - Client `PUT`s the file to `uploadUrl`. Server stores `publicUrl` on the post row.
   - For private posts use a non-`public/` prefix and switch to `getSignedUrl(GetObjectCommand, ...)` for read access.
2. **Email verification + password reset** — `server/mailer.ts` ready. Hook `sendVerificationEmail` into the registration flow and `sendPasswordResetEmail` into a new `/v1/auth/forgot-password` endpoint.
3. **Nearby feed** — `findNearbyPlaces` is in place. The `GET /v1/feed?mode=Nearby` path can switch from the current "all places" filter to PostGIS once the client starts sending `lat/lng` query params.
4. **CI** — S6 sprint should pick up `npm run test:server` as the smoke target plus add a Postgres-backed integration test that hits `/v1/places/nearby`.
5. **Production parity gaps still open** — managed Postgres+PostGIS provider, real S3 bucket + IAM, real SMTP (SES/Resend), TLS termination. None blocked by S2.

## Risks / known gaps

- The `places` rows are seeded from the app's mock fixtures in `ensurePostgresSeed`; a future seed change should keep `lat/lng` non-null so triggers populate `geom` automatically.
- Local-JSON fallback (no `DATABASE_URL`) still uses haversine. That path is dev-only; production never runs without Postgres.
- MinIO `forcePathStyle=true` is hardcoded for dev. AWS S3 prod will need `S3_FORCE_PATH_STYLE=0` and a virtual-hosted bucket URL in `S3_PUBLIC_URL_BASE`.
- MailHog accepts any From/To and never delivers — fine for dev, do not point staging at it.
