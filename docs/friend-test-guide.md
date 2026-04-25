# Happened Friend Test Guide

## Public URL

Use the fixed preview URL:

```text
https://euryhaline-lita-insupportably.ngrok-free.dev
```

The first ngrok visit may show a warning page. Tap `Visit Site` once, then the app opens normally.

The Mac mini, Docker Postgres, preview proxy, and ngrok tunnel must stay running while friends test.

## Test Login

```text
Email: test@happened.dev
Password: happened-test-1
```

Friends can also create their own account with `Create account`. The browser keeps the login session for the configured session period and remembers the last email after sign-out. Passwords are not saved.

## What To Test

1. Open the URL on iPhone Safari or mobile Chrome.
2. Create a new account, then sign out and log back in.
3. Close and reopen the browser tab to confirm the session is restored.
4. Finish the permissions screen.
5. Use the home feed: switch tabs, search, open notifications, open a place.
6. Tap the camera button on Home to start a post from the nearest/default place.
7. Check in, write a caption, and post a memory.
8. Use the Home refresh button or pull-to-refresh to see newly posted memories.
9. Log in with another account and confirm the first account's post appears in the main Following feed.
10. Use post actions: echo, save, reply, report, hide.
11. Open the map, drag it, zoom in/out, tap places, and use the locate button.
12. Check that bottom navigation, keyboard, and Safari bottom address bar do not cover primary controls.

## Known Dev Substitutes

- The preview uses ngrok and this Mac mini, not deployed hosting.
- Data persists in local Docker Postgres.
- Uploads persist through the local media storage provider on the Mac mini filesystem.
- Map tiles load from OpenStreetMap for development.
- Location radius is relaxed for development so remote friends can test check-in flows.
- No external analytics, product event logging, or crash logging is installed.
- Local-vs-production differences are tracked in `docs/local-vs-production.md`.

## File Handoff

Use this local handoff area for screenshots, recordings, notes, and generated QA artifacts:

```text
/Users/junnyeonglee/codex-projects/happened/.local/handoff/from-user
/Users/junnyeonglee/codex-projects/happened/.local/handoff/from-codex
/Users/junnyeonglee/codex-projects/happened/.local/qa
```

Ask Hermes Agent to drop user-provided screenshots or videos into `from-user`. Codex-generated screenshots and notes can go into `from-codex` or `.local/qa`.

## QA Command

Run this before sharing the URL:

```bash
npm run qa:public
```

It checks health, default login, session restore, new registration, feed actions, hide persistence, check-in, memory creation, cross-account post visibility, and mobile screenshot overflow at 390px and 430px widths.
