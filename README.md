# Happened

Happened is a location-locked memory app: moments left at a place reopen when people return to that place. The first product surface is an immersive vertical feed, but every core interaction is anchored to place, check-in, unlock radius, and revisit recall.

## Current Stack

- Expo React Native
- TypeScript
- Local Postgres-backed Fastify API for development
- Local JSON repository fallback only when `DATABASE_URL` is unset
- Custom React Native UI without paid map, auth, analytics, or hosting dependencies
- Port-safe local Expo launcher in `scripts/dev.mjs`

## MVP Focus

- API-backed friend-test app flow from welcome, auth, permissions, home, place detail, capture, map, timeline, and profile
- Home feed with Following, Nearby, and Memories modes
- Place-first content hierarchy: place name, distance, lock state, and visibility before social chrome
- Location lock states: blurred preview when far, full memory when inside the unlock radius
- Map prototype with heatmap, place bubbles, and personal memory pins
- Capture/check-in prototype with 12-hour upload window
- Place timeline and revisit recall surfaces
- Profile, privacy, report/block, and account deletion entry points

## Product Rules

The product rules in [docs/product-rules.md](docs/product-rules.md) are the implementation baseline. If a product decision is unclear, preserve place-based memory, revisit recall, and conservative location privacy before adding generic social features.

## Planning And Prototype

- MVP brief: [docs/product-brief.md](docs/product-brief.md)
- Design prototype notes: [docs/design-prototype.md](docs/design-prototype.md)
- Major screen design board: [docs/prototypes/happened-major-screens.svg](docs/prototypes/happened-major-screens.svg)
- Reporting channel review: [docs/reporting-channels.md](docs/reporting-channels.md)
- Service-grade development environment: [docs/development-environment.md](docs/development-environment.md)
- Friend testing guide: [docs/friend-test-guide.md](docs/friend-test-guide.md)
- Owner reports: [reports/README.md](reports/README.md)

## Local Development

```bash
npm run dev
npm run web
npm run api
npm run db:up
npm run db:migrate
npm run test:local
npm run test:iphone
npm run test:public
npm run test:tailscale
npm run qa:public
npm run ios
npm run android
npm run typecheck
```

The dev script starts from port `8097` and automatically moves to the next open port to reduce conflicts with other projects on this Mac mini.

The API script starts a local Fastify server on `http://127.0.0.1:4017` by default. Development uses Docker Postgres on host port `5433` via `.env`. Without `DATABASE_URL`, the API falls back to a local JSON repository seeded from the app mock data.

Default development login:

- Email: `test@happened.dev`
- Password: `happened-test-1`

For hands-on testing, `npm run test:local` starts both the local API and Expo web server. It prints Mac URLs and same-Wi-Fi iPhone browser URLs. Use `npm run test:iphone` when you want Expo Go on an iPhone; that mode starts the same local API and prints Expo's QR code. The API is bound to `0.0.0.0` only for those local test processes so a phone on the same network can reach it.

Use `npm run test:public` when the phone is not on the same network. It creates temporary `loca.lt` public URLs for both the web app and local API. Keep the process running while testing; the URLs expire when the process stops.

Use `npm run test:tailscale` for the configured Tailscale Funnel domain. It serves the web app and API through one HTTPS URL on the configured Funnel port, defaulting to `10000`.

Use `npm run qa:public` before sharing the current public URL. It verifies API health, default login, session lookup, registration, feed actions, hidden-post persistence, check-in, memory creation, and mobile screenshot overflow.

Useful local API routes:

- `GET /health`
- `GET /v1/feed?mode=Following`
- `GET /v1/places`
- `GET /v1/places/:placeKey`
- `POST /v1/check-ins`
- `POST /v1/memories`
- `POST /v1/posts/:postId/actions`

## Infra Boundary

No backend, deployment path, external paid service, test-app distribution, QR distribution, or irreversible operational decision is selected yet. Those require explicit user approval.
