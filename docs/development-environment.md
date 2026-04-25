# Happened Service-Grade Development Environment

## Goal

The first target is not a throwaway demo. The local environment should let friends use Happened like a real service while keeping infrastructure choices reversible.

## Current Preview Standard

- One command can expose the app to a phone through Tailscale Funnel, and the current fixed friend-test URL is served through ngrok.
- The web app and API share one HTTPS URL.
- Development data persists in Docker Postgres (`happened-postgres`) on host port `5433`.
- Local JSON persistence remains as a fallback only when `DATABASE_URL` is unset.
- Uploaded images persist through the local media storage provider in `.local/uploads/`.
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

Starts local Postgres and applies schema migrations when `DATABASE_URL` is configured.

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
