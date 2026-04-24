# Happened

Happened is a location-locked memory app: moments left at a place reopen when people return to that place. The first product surface is an immersive vertical feed, but every core interaction is anchored to place, check-in, unlock radius, and revisit recall.

## Current Stack

- Expo React Native
- TypeScript
- Local mock data first, backend later
- Custom React Native UI without paid map, auth, analytics, or hosting dependencies
- Port-safe local Expo launcher in `scripts/dev.mjs`

## MVP Focus

- Testable mock app flow from welcome, auth, permissions, home, place detail, capture, map, timeline, and profile
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
- Owner reports: [reports/README.md](reports/README.md)

## Local Development

```bash
npm run dev
npm run web
npm run ios
npm run android
npm run typecheck
```

The dev script starts from port `8097` and automatically moves to the next open port to reduce conflicts with other projects on this Mac mini.

## Infra Boundary

No backend, deployment path, external paid service, test-app distribution, QR distribution, or irreversible operational decision is selected yet. Those require explicit user approval.
