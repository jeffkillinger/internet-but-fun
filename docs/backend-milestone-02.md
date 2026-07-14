# Backend Milestone 02 — Durable Anonymous Identity and Personalized Status

## Purpose

Establish the anonymous identity layer that future multiplayer writes will rely on.

This milestone is **identity plus read-path personalization only**.

It must:

- issue a durable signed anonymous actor cookie
- resolve that cookie to a UUID `actorId`
- personalize `StatusFull`
- compute real `viewerStatus`
- return private `yourTurn` data only to the actor who owns the turn
- preserve the existing local Rubik’s Cube experience

It must **not** add queue joins, turn creation, move submission, or any other mutation.

Identity correctness is the gate before writes may depend on it.

## Binding Documents

Read in full:

- `docs/api-contract.md`
- `src/lib/api/types.ts`
- `docs/backend-milestone-01.md`

Treat them as binding.

If implementation reveals a conflict:

- stop the affected work
- report the conflict
- do not silently revise the contract

## Anonymous Actor Identity

Version 1 has no accounts, usernames, emails, passwords, or OAuth.

Each browser receives a durable anonymous actor identity.

- Database actor identifiers are UUIDs.
- The cookie is a signed envelope containing or resolving to that UUID.
- `ActorId` remains a TypeScript string because UUIDs are strings at the API boundary.
- The actor ID supports one-move-per-epoch enforcement, queue continuity, refresh continuity, and future trophies/badges.
- Do not build trophies, badges, accounts, or actor merging in this milestone.

## Cookie Design

Use a signed HTTP-only cookie.

Required attributes:

- `httpOnly: true`
- `sameSite: "lax"`
- `secure: true` in production
- local HTTP development must remain usable
- `path: "/"`
- explicit long-lived `maxAge`, approximately one year
- rolling expiry for active visitors

Use an application-specific name such as `ibf_actor`.

### Rolling-expiry rule

Do not reissue `Set-Cookie` on every request.

Status polling will eventually make identity resolution a hot path.

Refresh expiry lazily, only after meaningful time has elapsed or when the cookie is sufficiently old. The implementation should document its chosen refresh threshold.

### Signing

Use a server-only signing secret:

- `ACTOR_COOKIE_SECRET`

Requirements:

- high entropy
- stored only in `.env.local`
- placeholder only in `.env.example`
- never logged or returned
- never exposed through `NEXT_PUBLIC_*`
- use a standard signing/authentication mechanism
- do not invent custom cryptography

If `ACTOR_COOKIE_SECRET` is absent at runtime, identity operations must fail loudly and safely. Do not fall back to unsigned cookies, a development default, or an empty secret.

### Missing cookie

1. Generate a UUID actor ID.
2. Issue the signed cookie.
3. Continue the request with that actor ID.

### Valid cookie

1. Verify signature.
2. Extract or resolve the UUID actor ID.
3. Refresh expiry only when the lazy-refresh threshold is met.
4. Continue using the same actor.

### Invalid or tampered cookie

1. Do not trust it.
2. Generate a new UUID.
3. Replace the cookie.
4. Do not expose validation details.

Refresh and browser restart must preserve identity while the cookie remains valid.

Clearing site data, switching browsers/devices, or private mode may create another actor. This remains accepted for version 1.

## Environment

Continue using:

- `DATABASE_URL`

Add:

- `ACTOR_COOKIE_SECRET`

Update `.env.example` with placeholders only.

Do not commit `.env.local`.

Do not add Supabase anon or service-role keys.

Continue using the existing direct pooled Postgres client.

## Personalized StatusFull

Update StatusFull so it resolves the requesting actor and computes viewer-specific fields while preserving the exact `StatusFullResponse` shape.

### viewerStatus precedence

Use:

1. `already_moved`
2. `active`
3. `ready_check`
4. `queued`
5. `can_play`

Definitions:

- `already_moved`: actor has a claim for the current epoch
- `active`: actor owns the current active turn
- `ready_check`: actor owns the current ready-check turn
- `queued`: actor has a current queue entry
- `can_play`: none apply

If contradictory rows exist, do not guess silently.

### Queue summary

Return:

- real `queueLength`
- real `viewerPosition` when queued
- `null` otherwise

Use deterministic queue ordering.

Do not mutate or promote the queue.

Do not run lazy expiry.

### Public activeTurn

Return only:

- status
- expiresAt
- pendingMove

Never include `turnId`.

### Private yourTurn

Return only to the authenticated actor who owns the ready-check or active turn:

- `turnId`
- status
- expiresAt

Never expose it to another actor.

### Hashed-token conflict

The schema stores only `turn_token_hash`.

If refresh-resume requires recovering the original bearer token, do not silently weaken storage or add plaintext/reversible token storage.

Stop that part and report the conflict.

No turns are created in this milestone, so this may remain a documented future issue.

## Actor Persistence Strategy

Do not add a generalized users/accounts system.

An `actors` table is not required unless there is a concrete need.

Prefer stateless signed identity with the UUID in the signed envelope.

If proposing an actors table, report the reason before adding it.

## Development Verification

Add or extend development-only diagnostics, for example:

- extend `/api/dev/db-health`
- add `/api/dev/actor-health`
- add a DevPanel identity section

Diagnostics may show:

- actor cookie present
- signature valid
- UUID format valid
- same actor persisted across refresh

Prefer a shortened/redacted actor value.

Diagnostics must be unavailable in production.

Do not add actor identity to public StatusFull.

## Tests

Prefer extracting viewer-status calculation into a pure function over fetched row inputs, such as:

`computeViewerStatus({ claim, turn, queueEntry, actorId })`

Test that pure function with in-memory fixtures.

Do **not** insert test fixture rows into the shared development Supabase database.

Add focused tests for:

### Cookie behavior

- missing cookie creates UUID actor
- valid cookie resolves same actor
- tampered cookie is replaced
- HTTP-only
- SameSite Lax
- explicit long max age
- Secure in production
- usable in local HTTP development
- missing signing secret fails loudly and safely
- rolling expiry does not reissue the cookie on every request
- rolling expiry reissues when the refresh threshold is reached

### Viewer status

- empty rows → `can_play`
- claim → `already_moved`
- queue entry → `queued`
- owner ready-check → `ready_check`
- owner active turn → `active`
- another actor receives no `yourTurn`
- owner receives `yourTurn`
- public `activeTurn` never contains `turnId`

### Queue summary

- queue length correct
- viewer position correct
- non-queued position null

Do not add a large E2E framework unless one already exists.

## Manual Acceptance

1. Load the Rubik’s Cube page.
2. Confirm actor cookie exists.
3. Refresh and confirm same actor.
4. Close/reopen browser if practical and confirm same actor.
5. Delete or tamper with cookie locally.
6. Confirm safe replacement.
7. Confirm StatusFull hash verification still passes.
8. Confirm no raw actor ID appears publicly.

With empty claims, turns, and queue, expected viewer status remains `can_play`.

## Hard Non-Goals

Do not implement:

- join endpoint
- empty-queue turn creation
- queue mutations or promotion
- start-turn endpoint
- ready-check lifecycle
- move submission
- claim creation
- move commits
- StatusDelta
- lazy expiry
- heartbeat
- pending-move publishing
- realtime
- Redis
- accounts
- usernames
- trophies
- badges
- actor merging
- OAuth
- CAPTCHA
- private-mode detection
- generalized identity platform

Do not change:

- cube engine semantics
- local interaction
- arrows
- animations
- preview/commit
- local history
- current epoch or seed data

## Deferred Frontend Product Requirement

Record, but do not implement here:

When a player changes candidate moves, reverse the previous preview before animating the next.

Example:

- `R`
- `null`
- `U`

This is product rule communication, not optional polish.

Use a transition-based model:

- displayed pending state → target pending state

Future spectators should receive the same canonical pending transitions.

Do not transmit renderer-only direction metadata.

This must land before launch and before live pending-move spectating.

## Verification Commands

Run:

- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `git diff --check`

If database access is available, confirm StatusFull hash verification still passes.

## Report

Report:

- files changed
- packages added
- cookie mechanism/signing approach
- environment variables
- cookie name and attributes
- `maxAge`
- rolling-expiry refresh threshold and behavior
- invalid-cookie handling
- UUID generation/validation
- viewerStatus precedence
- whether viewerStatus is factored as a pure function
- confirmation that tests use in-memory fixtures rather than writing to shared Supabase
- queue length and position logic
- public `activeTurn` vs private `yourTurn`
- confirmation of no public actor IDs or turn tokens
- any hashed-token/refresh-resume conflict
- tests and commands
- manual checks remaining
- any contract deviation
