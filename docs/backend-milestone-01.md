We are beginning the first backend milestone for the Rubik’s Cube page in an existing Next.js + TypeScript + Tailwind project.

The user is setting up a hosted Supabase project for development.

This milestone is deliberately narrow:

- create the initial Postgres schema
- seed one active Rubik’s Cube epoch
- implement StatusFull only
- add a quarantined developer probe that verifies the server response
- add a small development-only database health endpoint

Do not make the current Rubik’s Cube experience server-driven yet.

Contract is law
===============

Before making changes, read these files in full:

- docs/api-contract.md
- src/lib/api/types.ts

Treat them as the binding contract.

Do not silently rename fields, add response fields, remove fields, change lifecycle rules, or “improve” the contract.

If implementation reveals a conflict or missing contract decision:

- stop that part of the implementation
- report the conflict
- do not improvise a replacement design

In particular, do not reintroduce or expose:

- public actor IDs
- public turn IDs
- clientStateHash in requests
- nextTurnStartsAt
- hash_mismatch as a server delta-refetch reason
- presentation-only animation metadata in API or database contracts

Existing architecture
=====================

The project already has a pure TypeScript cube engine in:

- src/lib/cube/

It includes functionality equivalent to:

- generateScramble
- createSolvedCube
- applyMoves
- serializeCube
- hashCubeState
- MoveNotation

The cube engine is currently used client-side.

This milestone will exercise the same engine in Node/server code for the first time.

Postgres is the canonical durable source of truth.

Redis must not be added.

Development environment decisions
=================================

Use the hosted Supabase Postgres project for development.

Do not require a local Supabase instance for this milestone.

Commit SQL migration files to the repository so the schema remains version-controlled.

This milestone intentionally uses manually reviewed SQL migrations.

Do not configure:

- Supabase GitHub integration
- automated migration deployment
- Supabase branch databases
- preview database branches

Use environment variables for all database credentials.

Use only the Supabase transaction-mode pooled Postgres connection string on port 6543.

Do not use the direct Postgres connection on port 5432.

The pooled Postgres connection string is the only database credential required for this milestone.

It must:

- remain server-only
- live only in `.env.local`
- never be committed
- never be exposed to client-side code
- never be returned by an API route
- never appear in logs or error responses

Use the project’s existing environment-variable conventions if present.

If no convention exists:

- document required variables in `.env.example`
- keep real values only in `.env.local`
- do not commit secrets

Inspect the repository before choosing database access code.

If no database library already exists:

- prefer `postgres` / postgres.js
- `pg` is acceptable

Do not use `@supabase/supabase-js` for database table access.

Do not add a full ORM unless one is already present and clearly in use.

If postgres.js is selected:

- configure it for Supabase transaction pooling
- disable prepared statements, for example with `prepare: false`

Report:

- the chosen database client
- why it was selected
- required environment variables
- how the pooled connection is configured
- whether prepared statements are disabled where required

Goal
====

At the end of this milestone:

1. Supabase contains one active Rubik’s Cube epoch.
2. The epoch has a server-generated scramble.
3. The scramble is represented in both:
   - the epoch row for cheap StatusFull reads
   - an `epoch_started` event payload for canonical history
4. A StatusFull endpoint returns real database data matching `StatusFullResponse`.
5. A developer-only frontend probe fetches the response and verifies:
   - the received scramble
   - the reconstructed serialized cube
   - the locally computed hash
   - the server-returned hash
6. A development-only database health endpoint confirms that the database connection, schema, and active epoch exist.
7. The existing local Rubik’s Cube prototype remains unchanged and playable.

Schema
======

Add version-controlled SQL migration files for these tables:

- epochs
- events
- queue_entries
- turns
- actor_claims

The last three tables may remain empty in this milestone.

Do not create mutation endpoints for them.

1. epochs

The epochs table should support at least:

- id
- game_id
- status
- scramble
- cube_version
- state_hash
- move_count
- started_at
- completed_at

Requirements:

- `game_id` supports the contract’s `GameId`.
- `status` must distinguish at least active and completed.
- `scramble` stores canonical move notation in order, preferably JSONB.
- `cube_version` starts at 0 for a fresh epoch.
- `move_count` starts at 0.
- `state_hash` is the hash of the cube after applying the scramble and no player moves.
- only one active Rubik’s Cube epoch should exist at a time
- add appropriate constraints/indexes to enforce or support that rule

Do not store renderer-only information.

2. events

The events table must match the architecture contract:

events (
  id,
  seq,
  game_id,
  epoch_id,
  actor_id,
  event_type,
  payload jsonb,
  created_at
)

Requirements:

- append-only design
- `epoch_id` is an explicit foreign key
- `actor_id` may be null for system events such as epoch creation
- `seq` is server-assigned and monotonic within an epoch
- add a unique constraint or unique index on `(epoch_id, seq)`
- replay code must order by `seq`, never by `created_at`
- `created_at` is audit/display metadata only
- the first seeded event is `epoch_started`
- its payload includes the canonical scramble
- do not expose internal actor IDs through StatusFull

3. queue_entries

Create the minimum future-facing table needed to support the documented queue later.

It may include fields such as:

- id
- game_id
- epoch_id
- actor_id
- status
- joined_at
- updated_at

Do not implement queue behavior.

Avoid adding speculative fields not required by the contract.

4. turns

Create the minimum future-facing table needed to support:

- ready_check
- active
- expired
- completed

It should be capable of storing a private disposable turn credential securely.

Do not return that credential publicly.

Do not implement turn behavior.

If storing a turn token, prefer storing a hash of the bearer token rather than the raw token. Report the decision.

5. actor_claims

Create the minimum table needed to enforce:

- one committed move per actor per epoch

Use a uniqueness constraint equivalent to:

- one claim for `(epoch_id, actor_id)`

Do not create a claim during seed.

Do not implement claim behavior.

Seed epoch 1
============

Add an idempotent server-side seed script.

The script must use the existing cube engine rather than duplicating cube logic.

It should:

1. Check whether an active `rubiks-cube` epoch already exists.
2. If one exists:
   - do not create a duplicate
   - print its identifying information
3. If none exists:
   - generate a canonical scramble using the existing engine
   - apply the scramble to a solved cube
   - serialize the resulting cube
   - calculate its state hash
   - insert the active epoch
   - insert its `epoch_started` event with `seq = 1`
4. Print for human inspection:
   - epoch ID
   - scramble notation
   - serialized cube state
   - state hash

This printed output is required because it is the first time the cube engine is being exercised in a Node/server environment.

Do not hide server-engine failures behind fallback values.

After inserting the epoch, the seed script must verify its own work: re-read the stored scramble from the database, replay it through the engine, recompute the hash, and confirm it matches the stored `state_hash`. If they do not match, report the mismatch as an error. This write-time check is where engine-based verification of stored state lives; the StatusFull endpoint does not perform it.

If import aliases or browser-only dependencies prevent the engine from running in Node:

- fix only the minimal portability issue
- do not duplicate the engine
- report exactly what was changed

StatusFull endpoint
===================

Implement StatusFull only.

Do not implement StatusDelta.

Use the existing `StatusFullResponse` contract exactly.

The endpoint should read the current active Rubik’s Cube epoch from Postgres and return:

- mode: "full"
- gameId: "rubiks-cube"
- epochId
- cubeVersion
- stateHash
- moveCount
- bestScoreMoves
- scramble
- public moveLog
- viewerStatus
- queue
- activeTurn
- yourTurn

For this milestone:

- `viewerStatus` is hardcoded to `"can_play"`
- `queue.queueLength` is `0`
- `queue.viewerPosition` is `null`
- `activeTurn` is `null`
- `yourTurn` is `null`
- `moveLog` is empty unless committed move events already exist
- `bestScoreMoves` is the lowest move count among completed epochs, or `null` if none exist

Do not create actor cookies yet.

Do not perform queue promotion.

Do not run lazy expiry.

Do not return private credentials.

Do not expose raw actor IDs.

StatusFull serves the stored `state_hash` and `scramble` directly from the epochs row.

It must not replay the cube or recompute the hash per request. Engine-based verification of stored state happens in the seed script (and later at move commit), not on reads.

Error behavior
==============

Add simple, typed server errors for cases such as:

- database unavailable
- no active epoch exists
- malformed stored scramble

Do not invent new public success fields.

Avoid returning secrets or raw database errors to the browser.

Database health endpoint
========================

Add a development-only endpoint:

- `GET /api/dev/db-health`

This endpoint is for local verification during backend development.

It should verify and report only safe diagnostics such as:

- database connection succeeded
- expected tables or schema are present
- an active Rubik’s Cube epoch exists
- the active epoch ID
- optionally the current cube version

It must not expose:

- connection strings
- passwords
- raw SQL errors
- internal actor IDs
- turn credentials
- environment-variable values

The endpoint should not mutate data.

Prefer restricting it to non-production environments.

If the project has an established environment guard, use it.

Otherwise, return a not-found or disabled response in production.

Do not add this endpoint to the public API contract types unless the existing contract explicitly calls for development-only diagnostics.

Developer-only frontend probe
=============================

Add a small developer-only control to the existing DevPanel or a nearby development component.

Suggested label:

- “Load StatusFull from Server”

This probe is for verification only.

It must not replace or mutate the real local prototype state.

Do not:

- overwrite local scramble
- overwrite local history
- change pendingMove
- alter the 3D cube
- make server data the page’s source of truth

When clicked, it should:

1. Fetch StatusFull.
2. Display the returned epoch ID.
3. Display the returned scramble.
4. Reconstruct the cube locally using the existing engine.
5. Display the reconstructed serialized cube state.
6. Compute the local hash.
7. Display:
   - local hash
   - server hash
   - whether they match
8. Display a clear error if the fetch or verification fails.

This is intentionally quarantined developer tooling.

The real server-driven state integration is a later milestone.

Tests
=====

Add focused tests where practical.

At minimum cover pure or server-side logic for:

- reconstructing an epoch from its stored scramble
- calculating the same hash in server code as client code
- converting database records into the exact StatusFullResponse shape
- ensuring public move entries omit actor IDs
- returning `bestScoreMoves: null` when there are no completed epochs
- ensuring the database health response exposes no secrets
- ensuring the database health endpoint is disabled or unavailable in production

Do not add a large end-to-end testing framework.

Hard non-goals
==============

Do not implement:

- join queue endpoint
- start turn endpoint
- submit move endpoint
- StatusDelta
- actor cookie creation
- auth or accounts
- ready-check behavior
- active-turn timers
- lazy expiry
- heartbeat
- pending-move spectator publishing
- move commits
- claims
- queue mutations
- realtime subscriptions
- Redis
- leaderboards
- generalized game framework
- server-driven replacement of the current local cube state
- Supabase GitHub integration
- automated migration deployment
- Supabase branch databases
- preview database environments

Do not change current Rubik’s Cube behavior:

- cube engine semantics
- arrows
- animations
- face selection
- preview/commit flow
- local history
- CubeNet
- existing local controls

Keep the diff focused on:

- direct pooled Postgres configuration
- SQL migrations
- seed script
- StatusFull read endpoint
- development-only database health endpoint
- server/read-path tests
- quarantined DevPanel verification

Verification
============

Run:

- npm test
- npm run typecheck
- npm run lint
- npm run build
- git diff --check

Also run the seed script against the configured Supabase project if credentials are available.

Then call:

- the database health endpoint
- the StatusFull endpoint

Report:

- database health result
- epoch ID
- scramble returned by the endpoint
- server state hash
- client/probe reconstructed hash
- whether the hashes match

Report
======

Report:

- existing database/auth/persistence setup found during audit
- database client selected
- why it was selected
- environment variables required
- pooled connection configuration
- whether port 6543 is used
- whether prepared statements are disabled if postgres.js is used
- migration files added
- schema tables and constraints created
- how `(epoch_id, seq)` ordering is enforced
- how the scramble is stored in both epochs and the epoch_started event
- seed script output
- database health route and safe response
- StatusFull route and response
- tests and command results
- whether the developer probe mutates any existing local state
- whether any GitHub/Supabase integration or automated migration workflow was added
- any contract conflict discovered
- any deviation from docs/api-contract.md or src/lib/api/types.ts

Do not silently deviate from the contract.
