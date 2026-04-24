# Happened Product Rules

This document is the source of truth when implementation decisions need product judgment.

## Product Definition

Happened is not a generic location-based media social network. It is an app for reopening memories and episodes that are locked to places.

The differentiators are:

- Presence: content is created through place verification.
- Revisit recall: a place brings back what happened there before.
- Place accumulation: places become containers for stories over time.

## Operating Principles

- Deprioritize features that weaken place identity.
- Prioritize lock and unlock experiences over generic social network behavior.
- Make the first version excellent at the core experience instead of broad in feature count.
- The home feed is for consumption, but place information must be read first.
- Uploads must pass place verification.
- Privacy-sensitive design should stay conservative.
- Personal and friend memory sharing is v1 priority. Fandom and creator use cases stay structurally possible but secondary.

## V1 Experiences That Must Survive

- A user can leave content at a specific place.
- Content opens only when the user is at or near that place.
- Revisiting a place can trigger a recall of past memories.
- Places show accumulated stories over time.
- Users can consume friends' place content through a following-based feed.

## V1 Scope That Can Stay Light

- Complex recommendation algorithms
- Creator-only tooling
- Group albums
- Heavy profile customization
- Web support
- Country-specific login expansion
- Excessive social graph mechanics

## Safety Defaults

- Default visibility is followers-only.
- Per-post public visibility can exist.
- Sensitive private places should be restricted or weakened.
- Report, block, hide, and account deletion must be included early.
- Location use should be event-based verification, not constant tracking.

## Design Principles

- Do not make the app feel like a rigid map utility.
- Make it immersive like an entertainment app.
- Keep the tone emotional but not sentimental.
- Add analog film cues such as grain, light leaks, film-frame edges, contact-sheet rhythm, and timestamp stamps when they reinforce memory.
- Support dense information with clear priority.
- Use a dark base so places and media stand out.

## Implementation Priority

1. Build the execution base: mobile app, routing, design tokens, mock data, core tabs, reusable components.
2. Build the core UX prototype: home feed, lock state, place/distance display, heatmap-style map, place timeline, recall card, onboarding/permission flow.
3. Connect real features: auth, session, place lookup, check-in token, upload, feed data, follow/profile.
4. Raise completion quality: errors, empty states, denied permissions, loading states, tests, icon, splash, branding.

## Infrastructure Boundary

Infrastructure, deployment, paid external services, test-app distribution, QR distribution, and irreversible operational choices require explicit user approval before selection or execution.
