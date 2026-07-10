# Rubik’s Cube API Contract

This document defines the planned client/server contract for the Rubik’s Cube page.

It is intentionally specific to the Rubik’s Cube. The only site-wide abstractions established here are:

- durable anonymous actors
- explicit game and epoch identifiers
- an append-only event log
- Postgres as canonical durable state

This is not a generalized game platform.

## Core Architecture

- The server owns canonical cube state.
- The client submits canonical move intent only.
- The client never submits a resulting cube state as truth.
- Canonical cube state is derived from the scramble and committed move events, with optional snapshots later if replay becomes expensive.
- Postgres is the durable source of truth.
- Redis, if introduced later, is only for ephemeral coordination such as locks, rate limits, queue acceleration, or temporary presence.
- Redis must never become canonical game history.

## Canonical vs. Presentation Information

Canonical information may cross the network:

- `gameId`
- `epochId`
- `turnId`
- canonical `move`
- `expectedCubeVersion`

Presentation-only information stays client-side:

- animation direction intent
- which arrow created a pending move
- selected face
- camera orientation
- pointer or drag details
- transient preview-animation state

Example:

`F2` is canonical. Whether the client chooses to animate it clockwise or counterclockwise is presentation-only and must not enter the event log or API protocol.

## Actor Identity

Version 1 has no accounts, usernames, emails, passwords, or OAuth.

The server assigns each browser a durable anonymous `actorId` using a signed HTTP-only cookie.

Rules:

- Use `actorId`, not `userId`.
- Refreshing, closing, and reopening the browser must preserve the same actor.
- Clearing site data, using another browser, another device, or a private window may create another actor. This is accepted for version 1.
- Do not attempt to detect or block private browsing.
- Do not expose raw actor IDs through public API responses.
- The queue shows only queue length and the current viewer’s position.
- A future account system may claim or merge multiple actor IDs.
- Database design must not assume an actor ID is permanently one-to-one with a real person.

## Epochs

An epoch is one cube lifecycle:

1. The server creates a new scramble.
2. Players collectively submit moves.
3. The cube is solved.
4. The epoch is completed and archived.
5. A new scramble starts a new epoch.

Rules:

- `epochId` is an explicit stored field.
- Cube versions are scoped to an epoch.
- Each actor may commit exactly one move per epoch.
- There is no solo grace. A lone player cannot make additional moves.
- A committed move consumes the actor’s claim for that epoch.
- Joining the queue, receiving a turn, missing ready check, or allowing a turn to expire does not consume the claim.
- A completed epoch’s score is its number of committed HTM moves.
- Status responses always include the current `epochId`.
- If a client holds a stale epoch ID, it must discard its local state and request full status.

The potentially long time required to solve an epoch is an accepted product tradeoff. The one-move premise takes priority over keeping the cube constantly active.

## Public Viewer States

A viewer is in exactly one of these states:

- `can_play`
- `queued`
- `ready_check`
- `active`
- `already_moved`

These states determine the primary UI:

| Viewer status | UI |
| --- | --- |
| `can_play` | Show **Make your move** if there is no active turn or queue; otherwise show **Join the queue** |
| `queued` | Show queue position and queue length |
| `ready_check` | Show **You’re up — start your turn** and the 15-second client countdown |
| `active` | Enable cube manipulation and show the 30-second move timer |
| `already_moved` | Disable play controls; show spectator messaging and current game status |

## Queue and Turn State Machine

### Empty-queue shortcut

If there is no active turn and no queued player, an eligible viewer may click **Make your move**.

That click creates an active turn immediately. It does not require a separate ready check because the click itself proves current presence.

### Normal queued flow

1. Eligible viewer clicks **Join the queue**.
2. Server creates or confirms a queue entry.
3. Viewer receives their current position and queue length.
4. When they reach the front, the server creates a `ready_check` offer.
5. The client learns about the offer through authenticated status polling.
6. The client displays a fresh 15-second countdown beginning when the response is received.
7. The server enforces a hard ready-check expiry 20 seconds after the offer was created. This allows for polling latency without letting ghost entries block the queue indefinitely.
8. The viewer clicks **Start turn** with the private `turnId`.
9. The server changes the turn to `active` and starts a 30-second move timer.
10. The player submits one canonical move before expiry.
11. On success, the move is committed and the actor becomes `already_moved`.
12. If ready check or active turn expires, the viewer is removed from the queue, their claim remains intact, and the UI shows **Rejoin**.

Expired or skipped viewers are not silently returned to the queue.

## Identity Token vs. Turn Token

Two credentials serve different purposes:

- The signed actor cookie identifies the anonymous actor.
- The `turnId` proves that actor holds the current ready-check or active turn.

`turnId` is a bearer credential:

- It must be long, random, and disposable.
- It must never appear in public turn data.
- It becomes invalid after completion, expiry, or cancellation.
- It is included only in authenticated responses for the actor who owns the turn.

This split supports refresh-resume without leaking the active player’s credential to spectators.

## Status Polling

Polling is realtime transport version 1.

The same logical payload may later be delivered through a push transport without redesigning the contract.

Queued and ready-check clients may poll more frequently than spectators because timely promotion matters and the number of queued clients is expected to be small.

Suggested starting intervals:

- queued or ready-check viewer: approximately 2 seconds
- active viewer: approximately 1–2 seconds
- ordinary spectator: approximately 4–5 seconds
- back off further when the page is hidden or under load

### Full status

Used for:

- first load
- stale epoch recovery
- invalid or unavailable delta cursor
- client/server state-hash mismatch

The client does not choose an epoch for full status. The server always returns the current epoch.

Full status includes:

- current epoch
- scramble
- committed move log or snapshot plus required tail
- cube version
- authoritative state hash
- total move count
- best completed score
- viewer status
- queue summary
- public active-turn information
- private `yourTurn` information only when the requesting actor owns the turn

### Delta status

Used for ordinary polling.

The client sends:

- the `epochId` it currently holds
- the last `cubeVersion` it has applied

The server returns only committed moves after that version, plus current small status fields.

The client applies new moves in order, computes its local state hash, and compares it with the server’s authoritative hash.

The server may require a full refetch for:

- `stale_epoch`
- `cursor_too_old`

A hash mismatch is detected by the client, not the server. On mismatch, the client discards local cube state and requests full status.

## Public and Private Turn Information

Public status includes a turn summary without credentials:

- status
- expiry
- canonical pending move, if live preview sharing is enabled

Authenticated status may additionally include `yourTurn` when the requesting actor owns the ready-check or active turn:

- `turnId`
- status
- expiry

This private block is how a viewer learns they were promoted while polling and how refresh-resume recovers the disposable turn credential.

## Live Spectating

Spectators should eventually be able to watch the active player preview candidate moves.

Do not stream:

- pointer movement
- camera orientation
- drag trajectory
- renderer animation metadata

Share only the canonical pending move:

- `activeTurn.pendingMove: Move | null`

The spectator uses the existing preview-animation system to render it.

Polling may introduce a short delay. That is acceptable for version 1. A later push transport may reuse the same field.

## Move Submission

The client sends only canonical move intent.

It does not send the cube state.

Reasons:

- The server must not trust client-computed state.
- A move is smaller and easier to validate.
- The move log is the durable history and replay source.
- Spectators animate moves, not opaque state replacements.
- If replay ever becomes expensive, add server snapshots rather than changing the move-submission protocol.

The request includes:

- `gameId`
- `epochId`
- `turnId`
- canonical `move`
- `expectedCubeVersion`

The request does not include `clientStateHash`.

Version serves optimistic concurrency. The response hash serves drift detection.

## Move Rejection Reasons

Client-side control locking is for UX. Server-side validation remains mandatory because clients can be bypassed and honest requests can race against expiry or other state changes.

Possible rejection reasons:

- `not_your_turn`
- `turn_expired`
- `stale_cube_version`
- `stale_epoch`
- `already_moved`
- `invalid_move`

Meanings:

- `not_your_turn`: the actor does not hold the current active turn.
- `turn_expired`: the supplied turn existed but is no longer active. This does not consume the actor’s claim.
- `stale_cube_version`: the client submitted against an older committed version.
- `stale_epoch`: the submitted epoch is no longer current.
- `already_moved`: the actor has already committed a move in this epoch.
- `invalid_move`: the submitted move is malformed or outside the canonical move set.

## Endpoint Inventory

Version 1 requires four logical operations:

1. `join`
   - Join the queue when a queue or active turn exists.
   - Start an active turn immediately when the game is idle and the actor is eligible.

2. `start-turn`
   - Convert the actor’s ready-check offer into an active 30-second turn.

3. `submit-move`
   - Validate and atomically commit one canonical move.

4. `status`
   - Return either full or delta status.
   - Advance lazy expiry before producing the response.
   - Include public status for everyone and private `yourTurn` data only for the authenticated owner.


Client flow note:

- The client always obtains the current `epochId` from a status response before attempting to join.
- `JoinGameRequest` intentionally includes that `epochId`.
- If the server responds with `stale_epoch`, the client must immediately request `StatusFull`, update its local epoch, re-render eligibility, and allow the user to join again if appropriate.
- The server does not silently rewrite the client's epoch during join. The request is evaluated against the epoch the client believed it was joining.

Heartbeat is deliberately omitted from version 1. It can be added later without redesigning these payloads.

## Append-Only Event Log

Durable game history uses a game-generic event shape:

```sql
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
```

Rules:

- `seq` is server-assigned and monotonic within an epoch.
- Replay must order by `seq`, never `created_at`.
- `created_at` is audit/display metadata only.
- Server-side event rows may contain the true actor ID.
- Public committed-move responses must not expose raw actor IDs.
- Rubik’s Cube moves are stored as events, not in a cube-specific move-history table.
- The event shape is deliberately game-generic, but no shared game engine is being built.

## Security and Abuse Floor

Version 1 uses proportionate controls:

- signed HTTP-only actor cookie
- private disposable turn IDs
- server-side move validation
- one committed move per actor per epoch
- endpoint rate limits per actor and per IP hash
- soft limits on excessive new actors or moves from one IP hash
- atomic version and turn validation

Do not add unless abuse demonstrates need:

- accounts
- user-supplied usernames
- CAPTCHA
- browser fingerprinting
- private-mode detection
- proof of work

A future heartbeat can be added if active-turn squatting becomes a meaningful problem.

## Cost and Load

Status polling is the primary load driver.

Mitigations:

- delta responses
- small public payloads
- different polling rates by viewer state
- polling backoff for hidden tabs and high load
- optional later push transport
- database connection pooling
- spending alerts and caps

Pre-launch checklist:

- Set Vercel spending alerts/cap if available for the selected plan.
- Confirm production cookie security settings.
- Confirm Supabase usage/budget alerts.
- Verify polling intervals and hidden-tab backoff.
- Load-test status polling at representative concurrency.
