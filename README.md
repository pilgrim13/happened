# Happened


Happened is a location-locked memory app: moments left at a place reopen when people return to that place. The first product surface is an immersive vertical feed, but every core interaction is anchored to place, check-in, unlock radius, and revisit recall.

## Current Stack

- Expo SDK 55 + React Native 0.83 + React 19
- TypeScript
- React Navigation (native-stack + bottom-tabs) with deep-linking (`happened://`, `https://happened.app`)
- Session persistence via `expo-secure-store` (native) + `localStorage` (web)
- Local **PostGIS** + **MinIO** + **MailHog**-backed Fastify API for development
- Local JSON repository fallback only when `DATABASE_URL` is unset
- Custom React Native UI without paid map, auth, analytics, or hosting dependencies
- Port-safe local Expo launcher in `scripts/dev.mjs`

## Source Layout

```
App.tsx                   # Provider assembly only (<50 lines)
src/
  navigation/             # RootNavigator, AuthStack, MainTabs, route wrappers, linking config
  contexts/               # SessionContext, AppDataContext, NoticeContext, CaptureContext
  hooks/                  # useCaptureFlow, useSharePost, useWebViewportShell, ...
  storage/                # secureSession (SecureStore + localStorage fallback)
  screens/                # Screen components (presentational; receive props from route wrappers)
  components/             # BottomTabs (custom tab bar), NoticeOverlay, ...
  services/               # API client, location helpers
  theme/, i18n/, types/, data/
server/                   # Fastify API
```

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

The API script starts a local Fastify server on `http://127.0.0.1:4017` by default. Development uses Docker **PostGIS** on host port `5433` via `.env`. The dev compose also brings up **MinIO** (S3-compatible, console at <http://localhost:9001>) and **MailHog** (SMTP `:1025`, UI <http://localhost:8025>) for parity with production object-storage and email infra. Without `DATABASE_URL`, the API falls back to a local JSON repository seeded from the app mock data.

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
- `GET /v1/places/nearby?lat=&lng=`
- `GET /v1/places/:placeKey`
- `POST /v1/check-ins`
- `POST /v1/media/presign`
- `POST /v1/memories`
- `POST /v1/posts/:postId/actions`
- `GET /v1/auth/sessions`
- `POST /v1/auth/verify-email/request`
- `POST /v1/auth/password-reset/request`

Full API reference: [docs/api.md](docs/api.md)

## Infra Boundary

No backend, deployment path, external paid service, test-app distribution, QR distribution, or irreversible operational decision is selected yet. Those require explicit user approval.
