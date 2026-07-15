# Arcade architecture notes

This site should ship individual interactive projects first. The Rubik's Cube
is the first project, but future pages may include unrelated small games or
toys. Do not build a generalized game engine or platform layer ahead of real
needs. Shared abstractions should be extracted only after two or three shipped
projects prove that the shape is actually shared.

Do not add accounts, profiles, achievements, leaderboards, multiplayer
frameworks, comments, moderation, or broad reusable systems as part of this
architecture. Those are separate product decisions.

## Durable history

Future durable game history should use Postgres as the canonical source of
truth. Redis, if added later, is only for ephemeral coordination such as locks,
turn claims, expiry windows, or queues. Redis must not be canonical history.

Use a generic append-only events table rather than cube-specific history
tables:

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

`game_id` for the Rubik's Cube is `"rubiks-cube"`. New games should be added
explicitly.

`epoch_id` is an explicit column. It identifies one game instance, not just a
property inside event payload JSON.

`seq` is server-assigned and monotonic per game or per epoch. Replay-derived
state must order by `seq`, not by `created_at`. `created_at` is display and
audit metadata only.

Rubik's Cube moves should eventually be stored as events, not as a
cube-specific moves table. Cube state should be derived from events or from
snapshots that were themselves produced from the event stream.

## Epoch semantics

For the Rubik's Cube, an epoch means one scramble-to-solved game instance. A
new scramble starts a new epoch.

Events are scoped to an explicit `epoch_id`. Actor move claims are scoped per
epoch, so `already_moved` means already moved in this epoch, not forever.
`turn_expired` must not consume the actor's per-epoch move claim.

Rubik's Cube score is the number of HTM moves taken to solve a completed epoch.
Future non-cube games may define different scoring semantics, but scores should
be scoped to completed game instances or epochs where applicable.

## Anonymous actor identity

There are no accounts yet. Durable anonymous identity should use `actor_id`,
not `user_id`.

Prefer a signed cookie for server-visible anonymous identity. A localStorage
UUID is acceptable for purely client-local experiments, but it is insufficient
for server-authoritative turn limits because the server cannot trust it.

`actor_id` is not guaranteed to be permanently one-to-one with a real person.
Future authentication can claim or merge one or more actor IDs later. Avoid
schema assumptions that make future account/actor merging painful.

Do not add Clerk, Auth.js, OAuth, or custom auth as part of this pass.

## Future Rubik's Cube move submission contract

The server validates and applies canonical move intent. The client must never
submit resulting cube state as truth.

Canonical request information that may cross the network:

```ts
type SubmitRubiksCubeMoveRequest = {
  gameId: "rubiks-cube";
  epochId: string;
  turnId: string;
  move: "U" | "U'" | "U2" | "D" | "D'" | "D2" |
    "L" | "L'" | "L2" | "R" | "R'" | "R2" |
    "F" | "F'" | "F2" | "B" | "B'" | "B2";
  expectedCubeVersion: number;
};
```

Do not include `clientStateHash` in the request. The client sends the cube
version it believes is current. The server returns authoritative state hash
information for drift checks.

Renderer-only information must not cross the network:

- animation direction intent
- arrow source
- camera orientation
- selected face
- transient preview animation state

Example accepted response:

```ts
type SubmitRubiksCubeMoveAccepted = {
  accepted: true;
  moveNumber: number;
  cubeVersion: number;
  stateHash: string;
};
```

Example rejected response:

```ts
type SubmitRubiksCubeMoveRejected = {
  accepted: false;
  reason:
    | "not_your_turn"
    | "turn_expired"
    | "stale_cube_version"
    | "stale_epoch"
    | "epoch_mismatch"
    | "already_moved"
    | "invalid_move";
  currentCubeVersion: number;
  stateHash: string;
  currentEpochId?: string;
};
```

`turn_expired` does not consume the actor's per-epoch move claim.
`stale_epoch` or `epoch_mismatch` means the submitted epoch is no longer active.
