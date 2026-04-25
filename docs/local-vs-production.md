# Local Preview vs Production

## Current Direction

The Mac mini remains the service host while we decide whether to launch. The product should behave like a real service for users, while infrastructure pieces stay replaceable.

## Same For Users

- Accounts, sessions, profiles, follows, blocks, search, notifications, posting, replies, saves, and reports are API-backed.
- Uploaded photos are persisted and served back through stable media URLs.
- The public ngrok URL serves the web app and API from one origin.
- Mobile Safari/Chrome users can create accounts, stay logged in, post memories, and view other users' content.

## Local Substitutes

- Hosting: Mac mini process + ngrok, instead of deployed web/API hosting.
- Database: Docker Postgres on the Mac mini, instead of managed Postgres.
- Media: local filesystem storage under `.local/uploads`, instead of S3/R2/object storage.
- Maps: OpenStreetMap public raster tiles, instead of a paid production map provider.
- Location: development check-in can stay relaxed for remote friend testing unless `HAPPENED_DEV_LOCATION_OVERRIDE=0`.
- Notifications: in-app notification list only, no native/web push yet.
- Observability: no external analytics, product event logging, or crash logging installed.

## Migration Hooks Already In Place

- Database access goes through repository methods and migrations.
- Media writes/reads go through `server/media.ts` and `MEDIA_STORAGE_DRIVER`.
- The frontend treats media URLs as API/public URLs, so the UI should not need large changes when storage moves.
- Environment-specific values live in `.env`, `.env.example`, and preview scripts.

## Before Public Launch

- Move Postgres to managed hosting or a backed-up production database.
- Replace local media storage with object storage and CDN-style delivery.
- Add backup/restore runbooks for DB and media.
- Add moderation/admin tools for reports and account safety.
- Add production auth hardening, rate limits, email verification, and password reset.
- Add explicit privacy policy, terms, and data deletion workflow.
