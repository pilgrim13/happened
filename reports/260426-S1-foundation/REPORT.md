# S1 — Foundation Sprint Report

**Date:** 2026-04-26
**Sprint:** S1 (기반 정비)
**Status:** Complete ✅

## Summary

S1 lifts the Happened app off a single 849-line `App.tsx` and onto a real navigation/state foundation:

- Expo SDK 54 → 55 (React 19, RN 0.83), `expo-doctor` clean.
- React Navigation introduced (native-stack + bottom-tabs) with deep-link prefixes `happened://` and `https://happened.app`.
- `App.tsx` reduced from **849 → 43 lines** (Provider assembly only). Logic moved to `src/contexts/*`, `src/hooks/*`, `src/navigation/*`.
- Session persistence migrated to `expo-secure-store` on native, `localStorage` retained on web.
- OAuth scaffolding (Google / Apple buttons) added with `Coming soon` Alert; new env keys `EXPO_PUBLIC_GOOGLE_CLIENT_ID` / `EXPO_PUBLIC_APPLE_SERVICES_ID`.
- `@react-native-async-storage/async-storage` installed (held for S4 react-query persist).
- TypeScript: 0 errors. Web bundle: ✅. iOS bundle (`expo export`): ✅.

## Acceptance Criteria

| # | Criterion | Status |
|---|---|---|
| 1 | Expo SDK 55 upgrade, `expo-doctor` clean | ✅ (removed deprecated `newArchEnabled` / `edgeToEdgeEnabled`, added `scheme: "happened"`) |
| 2 | React Navigation + linking (`happened://`, `https://happened.app`) | ✅ stack + tabs + 3 modal detail screens |
| 3 | App.tsx decomposition <100 lines | ✅ 43 lines |
| 4 | SecureStore session persistence + web fallback | ✅ `src/storage/secureSession.ts` |
| 5 | AsyncStorage installed | ✅ |
| 6 | OAuth scaffolding (UI + env keys) | ✅ |
| 7 | `npx tsc --noEmit` 0 errors | ✅ |
| 8 | Build verification (web + iOS) | ✅ both `expo export` runs succeeded |
| 9 | README updated with new layout | ✅ |
| 10 | Conventional Commits per step | ✅ 4 commits |

## New Directory Tree (`src/`)

```
src/
├── components/
│   ├── BottomTabs.tsx              # custom tab bar UI (now wired as RN-Navigation tabBar)
│   ├── MediaRenderer.tsx
│   ├── NoticeOverlay.tsx           # NEW — global toast surface
│   └── StatusPill.tsx
├── contexts/                       # NEW
│   ├── AppDataContext.tsx          # feed/places/timeline/notifications/check-in/upload/...
│   ├── CaptureContext.tsx          # wraps useCaptureFlow as a provider
│   ├── NoticeContext.tsx           # toast queue
│   └── SessionContext.tsx          # SecureStore-backed session + isFreshSession flag
├── data/happened.ts
├── hooks/
│   ├── useCaptureFlow.ts           # NEW — captures place/location/upload/issue logic
│   ├── useSharePost.ts             # NEW
│   ├── useVisualViewportHeight.ts
│   └── useWebViewportShell.ts      # NEW — extracted web body styling effect
├── i18n/index.tsx                  # added 4 OAuth keys (en + ko)
├── navigation/                     # NEW
│   ├── AuthStack.tsx               # Welcome → Auth
│   ├── MainTabs.tsx                # Home/Map/Capture/Timeline/Profile via custom tabBar
│   ├── RootNavigator.tsx           # auth-gated stack; isFreshSession routes through Permissions→Tutorial
│   ├── linking.ts                  # deep-link config
│   ├── routes.tsx                  # Welcome/Auth/Permissions/Tutorial/PlaceDetail/PostDetail/UserProfile route wrappers
│   ├── tabRoutes.tsx               # Home/Map/Capture/Timeline/Profile route wrappers
│   └── types.ts                    # ParamList type defs
├── screens/                        # unchanged screen components (presentational)
│   └── AuthScreen.tsx              # + Google / Apple buttons (TODO onPress, Alert "Coming soon")
├── services/
│   ├── happenedApi.ts
│   └── location.ts
├── storage/                        # NEW
│   └── secureSession.ts            # SecureStore (native) + localStorage (web), tutorial seen flag
├── theme/tokens.ts
└── types/happened.ts
```

## Commits

```
fcc6b35 chore(expo): upgrade to SDK 55, fix app.json schema
f926a6b chore(deps): install React Navigation, SecureStore, AsyncStorage, OAuth deps
8261b44 feat(navigation): adopt React Navigation, split App.tsx into contexts/hooks/navigation
(this report) docs: S1 foundation report + README refresh
```

## Verification Logs

- `npx expo-doctor` → 18/18 ✅
- `npx tsc --noEmit` → 0 errors
- `npx expo export --platform web --output-dir /tmp/expo-build-web` → bundled 2423 modules, 3.1MB main bundle ✅
- `npx expo export --platform ios --output-dir /tmp/expo-build-ios` → bundled 2784 modules, 4.6MB hbc ✅

## Notable Decisions

1. **Custom BottomTabs preserved**: rather than rewriting the existing pixel-tuned `BottomTabs.tsx`, it is mounted as React Navigation's `tabBar` component. The TabKey ↔ route name mapping lives in `src/navigation/MainTabs.tsx`.
2. **Onboarding ordering**: a transient `isFreshSession` flag in `SessionContext` decides whether the post-auth stack starts on `Permissions` (new account / login completion) or directly on `MainTabs` (cold-start with valid SecureStore session). `consumeFreshSession()` flips it after the user finishes Permissions or Tutorial.
3. **Modal detail screens**: PlaceDetail / PostDetail / UserProfile are root stack screens with `presentation: 'modal'`; back behavior is delivered by stack `goBack()` (replacing the old in-state `selectedPlace/Post/Profile` toggles). This gives proper iOS swipe-to-dismiss, hardware back, and deep-link routability.
4. **Capture flow**: extracted into `useCaptureFlow` and wrapped with `CaptureProvider` so multiple tabs (Home → Capture, Map → Capture, deep link → Capture) share `capturePlace`, `checkInToken`, and last-known location. Auto-locate on tab activation kept (gated by `auto` mode flag).
5. **OAuth scaffold**: buttons render unconditionally for Google; Apple button shown on `iOS` and `web` (Android falls back to email until Apple's Android web flow is wired). All `onPress` are `Alert.alert('Coming soon', ...)` + a `TODO(S2/S3)` comment listing the intended `expo-auth-session` / `expo-apple-authentication` invocation.
6. **app.json schema cleanup**: removed deprecated `newArchEnabled` (default-on in SDK 55) and `android.edgeToEdgeEnabled` (now schema-rejected); added `scheme: "happened"` so deep links work without the config plugin.

## Known Gaps / Follow-ups

- **`prototypeParams` query-string router** (the old `?screen=…&postId=…` web prototype shortcut) is **not** ported to React Navigation. The deep-link config (`/post/:postId`, `/place/:placeName`, `/u/:handle`, `/home`, …) covers the same use cases. If `scripts/qa-public.mjs` or any external preview tool relies on the old query syntax, those URLs need to be updated to the new path-based format.
- **`prototypeParams.capture` / `homePost` initial-render hooks** are now best-effort: `Home` honors `initialPostIndex` via `route.params`, but the bare `?capture=1` shortcut is gone. The fix in S2 is to add a small URL-rewriter that maps legacy query strings to a `navigate` call on container ready.
- **Map screen does not currently auto-locate** on first focus. (Old `mapAutoLocateAttempted` was tied to the global stage state machine; the simpler replacement is a `useFocusEffect` inside `MapRoute`.)
- **`AsyncStorage` is installed but unused.** Wired in S4 as the react-query persistor.
- **OAuth backend endpoints** (`/v1/auth/oauth/google`, `/v1/auth/oauth/apple`) do not exist. Server-side scaffolding will land in S3 alongside the real client wiring.
- **Permissions stack screen lacks a back button** when reached from `MainTabs` (legitimate for fresh-session onboarding; revisit if accessed from Profile → Settings).
- **`docs/friend-test-guide.md`** still mentions stage URLs and may need refresh once the deep-link surface is final.

## Handoff Notes — S2 (PostGIS / Place Geometry)

S2 picks up here with a clean foundation. Suggested entry points:

1. **Backend**: `server/migrate.ts` is currently lat/lng + `uploadRadiusMeters` columns. S2 should:
   - Add PostGIS extension migration (`CREATE EXTENSION IF NOT EXISTS postgis;`).
   - Replace `coordinates` with a `geography(Point, 4326)` column and back-fill from existing rows.
   - Replace the haversine query in `fetchPlaces` / `issueCheckInToken` distance check with `ST_DWithin` / `ST_Distance`.
2. **Client distance helper**: `src/services/location.ts` exposes `distanceMeters` already — keep it for client-side UI hints, but server should authoritatively compute and return distance with each check-in attempt.
3. **Map tile clustering**: with PostGIS, `MapScreen` can accept server-clustered place bubbles. The `places` shape in `src/types/happened.ts` (`PlaceBubble`) already includes `coordinates` and `uploadRadiusMeters`; extend with `accuracy_m` / `cluster_count` if needed.
4. **Capture radius enforcement**: `useCaptureFlow.issueCheckInToken` currently sends `clientDistance` to the API as a hint and trusts the server's verdict. After PostGIS lands, the API can refuse out-of-radius requests with a single SQL predicate. The `verificationBlockedMessage` UI plumbing on `CaptureScreen` is already there.
5. **Search**: `fetchSearchResults` is text-only today. With PostGIS geom, S2/S3 can add `?near=lat,lng&radius=500` style params with stable bounded queries.

The navigation/state shape in S1 is intentionally minimal so S2 can bolt PostGIS onto the API layer without touching screens. `AppDataContext.refresh()` is the single update funnel — when the API contract changes, only `services/happenedApi.ts` and the typed shapes in `types/happened.ts` need to move.
