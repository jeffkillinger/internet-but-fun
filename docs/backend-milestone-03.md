# Backend Milestone 03 — First Write Path (`join`)

## Purpose

Ship the first mutating endpoint: `join`. This is the empty-queue shortcut (an eligible actor's click immediately creates an active turn) and normal queue insertion. It resolves the turn-token lifecycle question left open since Milestone 02, and defines — on paper — the full `queue_entries` status lifecycle, even though this milestone only ever produces `queued` rows.

This milestone does **not** make the cube playable end to end. An actor who receives an active turn via the shortcut cannot yet submit a move (that's Milestone 04+). This is an accepted, temporary rough edge of an internal, pre-launch milestone — not a shippable end state.

## Binding Documents

Read in full before touching code:

- `docs/api-contract.md`
- `src/lib/api/types.ts`
- `docs/backend-milestone-01.md`, `docs/backend-milestone-02.md`

Treat them as binding. If implementation reveals a conflict, stop that part, report the conflict, do not improvise.

## Scope clarification (resolve before implementation)

CLAUDE.md/AGENTS.md's condensed M03 scope note lists timers ("15s ready-check ..., 30s active turn") inside the M03 paragraph, but also places `start-turn` in the "After M03" bucket. Those two statements are in tension: there is no ready-check state to time out, and no way to convert `ready_check` → `active`, without `start-turn`. `src/lib/api/types.ts`'s `JoinGameResponse` settles this for us — the accepted variant's `viewerStatus` is typed as `"queued" | "active"` only, with no `"ready_check"` option. A join response can never itself produce a ready-check state.

**Resolution:** M03 implements `join` only, with its two documented branches (shortcut → `active`, normal → `queued`). Queue promotion to `ready_check`, the `ready_check_started` event, `start-turn`, ready-check/active-turn expiry enforcement, and rejoin-after-expiry all move to Milestone 04. The mention of timers in the condensed scope note is forward-looking context for the next milestone, not a requirement here. If this reading is wrong, stop and say so before writing code.

## Turn-token lifecycle decision

`turns` stores only `turn_token_hash` (Milestone 01's deliberate choice, reaffirmed in Milestone 02 — "do not weaken hashed storage to dodge this"). The bearer `turnId` the client needs is generated once and can never be reconstructed from its hash. Three options were considered:

1. **Session cache** — hold the raw token server-side (in-memory or Redis) keyed by turn, redeliver it on repeat reads.
2. **Re-mint-and-rehash on every authenticated read** — an earlier draft of this spec proposed minting a fresh random token on every `StatusFull` read that serves `yourTurn` to the owner. **Rejected on review**: two concurrent status reads (duplicate requests, retries, multiple tabs) can each mint and overwrite `turn_token_hash`, and whichever write loses invalidates a token that may already be in flight toward a `submit-move`/`start-turn` call — including one the *same* tab just received and is about to use. That's not a multi-tab edge case, it's a live-request race with no synchronization between the mint and the client's next call. Rejected.
3. **Deterministic derivation** — the raw token is `HMAC-SHA256(TURN_TOKEN_SECRET, turn.id)`, base64url-encoded: a pseudorandom, computationally unpredictable value (without the secret) derived from immutable data (the turn row's own UUID, assigned once at insert and never changed). It satisfies the contract's "long, random" bearer-credential requirement in the cryptographic sense that matters — indistinguishable from random without the key — while being stable for the turn's entire life and recomputable identically on any read: no storage of the raw value, no cache, no per-read write, nothing to race.

**Decision: deterministic derivation (option 3).** It keeps every property the hashed-storage design wanted — no raw token stored anywhere, refresh-resume works from any authenticated read — while adding a stable-per-turn credential with zero read-time writes and zero rotation races. It needs no new infrastructure (no Redis, no session cache) and needs nothing beyond one new server-only secret, following the same pattern `ACTOR_COOKIE_SECRET` already established.

Mechanics:

- New required env var `TURN_TOKEN_SECRET`, kept separate from `ACTOR_COOKIE_SECRET` (independent rotation, standard key-separation practice). Add to `.env.example` as a placeholder — this is part of the M03 diff, not a follow-up. It fails loudly if missing (see "Missing-secret failure behavior" below for exactly what that means at the HTTP layer).
- **Rotating `TURN_TOKEN_SECRET` invalidates any currently live turn** (its derived token changes, so the stored hash no longer matches). In M03, `expires_at` is recorded but not enforced (no expiry endpoint/sweep exists until M04), so a live turn is not bounded to 30 seconds in practice — it can sit active indefinitely, and `join` will keep returning that same owned active turn. So: **rotate `TURN_TOKEN_SECRET` only when no live turns exist**, or (once M04 lands) explicitly expire live turns through the canonical transition first. Don't rely on "turns are short-lived" as the safety net until expiry is actually enforced.
- Add `deriveTurnToken(turnId: string): string` in `src/lib/rubiks/turns.ts` (new file): `createHmac("sha256", getTurnTokenSecret()).update(turnId).digest("base64url")`.
- `turn_token_hash` stays exactly as load-bearing as Milestone 01 designed it: validation is "hash the presented token, compare to the stored hash," unchanged. What deterministic derivation solves is the *other* half of the problem — recovering the raw value to redeliver to the owner without ever having stored it. So: at turn-creation time, the application generates the turn row's `id` itself (see below), derives the token from that `id`, computes `turn_token_hash = sha256(token)`, and inserts `id`/`turn_token_hash`/everything else together in one statement. On every later authenticated read that serves `yourTurn`, re-derive the same token from the stored `turn.id` (pure, no DB write) and hand it back — the recomputed value hashes to the same `turn_token_hash` already on the row, so nothing about the original validation design changes.
- Add `mintYourTurnSummary({ turn, actorId }): YourTurnSummary` (pure, synchronous): given a turn row already confirmed owned by `actorId`, derive the token from `turn.id` and return `{ turnId: token, status, expiresAt }`. `status.ts`'s `toYourTurnSummary` currently returns `turnId: input.turn.id` (the DB row's primary key, a placeholder that predates real token validation) — replace its call sites with `mintYourTurnSummary`.
- Token *validation proper* — given a presented `turnId` on a future `start-turn`/`submit-move` request, hash it and compare (constant-time) to the current live turn's `turn_token_hash`, plus independently check the row's status/expiry (a matching hash does not by itself prove the turn is still live) — has no caller in M03 since those endpoints don't exist yet. Leave it as a named TODO for Milestone 04.
- **Turn row `id` generation:** `turns.id` currently defaults inside Postgres (`gen_random_uuid()`), but the token must be derived from that id *before* the row exists, and `turn_token_hash` is `NOT NULL` — there's no id to derive from until after insert, and no way to insert a placeholder-then-update within the intended single statement. Generate the id in application code instead: `const turnRowId = randomUUID(); const token = deriveTurnToken(turnRowId); const tokenHash = sha256(token);` then insert `id`, `turn_token_hash`, and every other column together in one `insert` statement. Do not insert a placeholder hash and update it afterward.

## Schema changes

Add a new migration file: `supabase/migrations/<timestamp>_backend_milestone_03.sql`. As always, this is written and presented for explicit human approval — never applied automatically.

Two additive partial unique indexes, both needed for the atomicity requirement below:

```sql
create unique index if not exists turns_one_live_turn_idx
  on turns (epoch_id)
  where status in ('ready_check', 'active');

create unique index if not exists queue_entries_one_live_entry_idx
  on queue_entries (epoch_id, actor_id)
  where status in ('queued', 'ready_check', 'active');
```

- `turns_one_live_turn_idx` guarantees at most one live turn per epoch at the database level — the safety net under the shortcut's race condition.
- `queue_entries_one_live_entry_idx` guarantees an actor can't accumulate duplicate queue rows; a repeat `join` call while already queued must confirm the existing row, not insert a second one.

No other schema changes. `turns` and `queue_entries` already carry every column and status value M03 (and M04's later transitions) need.

## `queue_entries` status lifecycle (defined now, mostly implemented later)

The contract requires this to be defined even though M03's own code only ever produces `queued` rows. Full lifecycle, for the record:

| Status | Meaning | Entered by | Left by |
| --- | --- | --- | --- |
| `queued` | Waiting for promotion | `join` (normal path) | promotion → `ready_check` (M04), or actor's claim already exists |
| `ready_check` | Offered the front-of-queue slot | queue promotion (M04) | `start-turn` → `active`, or 20s server-enforced expiry → `expired` |
| `active` | Currently playing (a *promoted queue entry* only — see note) | `start-turn` (M04) | move committed → `completed`, or 30s expiry → `expired` |
| `expired` | Missed ready-check or active-turn window | server-enforced expiry (M04) | terminal; actor may rejoin fresh (new row, claim untouched) |
| `skipped` | Reserved for a not-yet-specified skip path (schema anticipates it; contract doesn't define a trigger for it yet) | — | — |
| `completed` | Actor's move was committed this epoch | move commit (M05+) | terminal |

**Note:** the empty-queue shortcut never creates a `queue_entries` row at all — it only creates a `turns` row directly. `queue_entries.status = 'active'` is reachable only via a *promoted* queued actor going through `start-turn` in M04. `turns` and `queue_entries` are decoupled: a turn can exist without the actor ever having been queued.

`expired` never touches `actor_claims` — per contract, expiry doesn't consume the one-move claim. `skipped` exists in the check constraint from Milestone 01 but has no defined entry path yet; do not invent one in M03. Flag it in the report rather than guessing.

## `join` endpoint

New route: `app/api/rubiks-cube/join/route.ts` (`POST`), mirroring the identity-resolution pattern already in `app/api/rubiks-cube/status/route.ts`. New logic module: `src/lib/rubiks/join.ts`.

Request: `JoinGameRequest` exactly (`gameId`, `epochId`).

### Validation order

Everything that decides accept/reject is authoritative only inside the locked transaction below. There is no pre-transaction fast-path check for `stale_epoch`/`already_moved` — that would create exactly the TOCTOU gap the standing requirement ("claim-check + turn-creation in the empty-queue shortcut must be transactional") is there to prevent. It's true that nothing else can write a claim concurrently in M03's own scope, but the transaction should be correct for the system it's becoming, not just for today's subset.

0. **Validate the request shape before touching the database.** `JoinGameRequest` is a compile-time type only — a real caller can send a non-JSON body, a missing `epochId`, or a non-UUID string. Parse the body defensively; reject with `PublicApiError("invalid_request", ..., 400)` if it isn't a JSON object, if `gameId !== "rubiks-cube"`, or if `epochId` isn't UUID-shaped (reuse `isUuid` from `actor-identity.ts`). This must happen before any query — an unvalidated `epochId` interpolated into `${epochId}::uuid` throws a Postgres error that would otherwise get caught and misreported as `database_unavailable` instead of a proper 400.
1. Resolve actor identity from the cookie (reuse `resolveActorIdentity`; set the cookie on the response exactly as `status` does).
2. Open a single transaction:
   ```sql
   select id from epochs
   where id = $epochId and game_id = 'rubiks-cube' and status = 'active'
   for update
   ```
   Constraining to `game_id`/`status = 'active'`, not just `id`, matters: a stale or completed epoch still exists as a row, so an unconstrained `where id = $epochId for update` would successfully lock it and proceed as if it were current. If no row matches, roll back and look up the actual current active epoch separately (outside the failed lock attempt):
   - If one exists, reject with `stale_epoch` against it:
     ```ts
     { accepted: false, reason: "stale_epoch", currentEpochId: <actual current epoch id>, viewerStatus: <computeViewerStatus against the current epoch> }
     ```
   - If none exists at all (shouldn't happen given the seeded/always-active-epoch invariant, but don't assume), throw the existing `no_active_epoch` `PublicApiError` (404) rather than trying to force a `stale_epoch` response with no real `currentEpochId` to put in it.

   The server does not silently rewrite the client's epoch — this is evaluated strictly against what the client believed it was joining, per contract. Locking the epoch row serializes concurrent `join` calls against it without blocking plain `StatusFull` reads (which don't take `FOR UPDATE`).
3. Still inside the transaction, authoritatively check `actor_claims` for `(epochId, actorId)`. If a claim exists, roll back and reject:
   ```ts
   { accepted: false, reason: "already_moved", currentEpochId: epochId, viewerStatus: "already_moved" }
   ```
4. Check whether the actor already owns the current live *active* turn, or an existing `queued` row, for this epoch. If so, this is a repeat/idempotent call — skip to building the response from existing state (`mintYourTurnSummary` is a pure re-derivation, safe to call again) rather than inserting anything. (An owned `ready_check` turn can't occur in M03 — nothing creates that state yet. Don't design a response for it now; that's M04's question to answer once it can actually happen.)
5. Otherwise, check whether a live turn or any queued entries exist for this epoch:
   - **None exist → empty-queue shortcut.** Generate the turn row's `id` in application code (`randomUUID()`), derive its token and hash from that id (see the turn-token mechanics above), and insert a `turns` row with `id`, `turn_token_hash`, `status = 'active'`, `expires_at = now() + 30s`, `pending_move = null` all together in one statement — not inserted with a placeholder hash and updated afterward. Compute the next `seq` for this epoch (`select coalesce(max(seq), 0) + 1 from events where epoch_id = $epochId`, safe because the epoch-row lock already serializes every writer touching this epoch's event log), and insert the `turn_started` event (`payload: { via: "empty_queue_shortcut" }`) with that `seq`. Every future milestone that writes events for an epoch must acquire the same epoch-row lock before computing its `seq` — this is the pattern, not a one-off.
   - **Otherwise → normal path.** Insert a `queue_entries` row (`status = 'queued'`), compute the next `seq` the same way, insert a `queue_joined` event with an explicit `payload: {}` — `events.payload` is `NOT NULL`, so this must be an empty object, not an omitted field.
6. Commit.

**On a `turns_one_live_turn_idx` violation:** this should be unreachable — the epoch-row lock already means only one transaction can be evaluating "does a live turn exist" for this epoch at a time, so by the time a second transaction reaches the insert, it will have already seen the first transaction's committed row and taken the queued branch instead. Do not build a "fall back to queued" recovery path for this (Postgres aborts the whole transaction on a unique violation without a savepoint — a bare catch-and-continue is not mechanically valid here anyway). Treat a violation as an invariant alarm: let it surface as a 500 and log it loudly. If this ever fires, the locking logic has a bug, not a race to paper over.

### Response

Reuse `computeViewerStatus`, `computeQueueSummary`, and `toPublicTurnSummary` from `src/lib/rubiks/status.ts` rather than re-deriving this logic — same pattern `status.ts` already establishes.

```ts
{
  accepted: true,
  epochId,
  viewerStatus: "active" | "queued",
  queue: QueueSummary,
  activeTurn: PublicTurnSummary | null,
  yourTurn: YourTurnSummary | null, // present only for the shortcut path or an idempotent re-call by the turn owner
}
```

## Error behavior

Reuse `PublicApiError` and its existing `code` union for request/state errors (`invalid_request`, `no_active_epoch`, `database_unavailable`); those behave the same as in `status`. Missing `TURN_TOKEN_SECRET` is a distinct case — see below.

## Missing-secret failure behavior

`deriveTurnToken`/`getTurnTokenSecret` throw when `TURN_TOKEN_SECRET` is absent, exactly like `getActorCookieSecret` throws `ActorIdentityError` when `ACTOR_COOKIE_SECRET` is absent. Left unhandled, this would be misreported: `getStatusFullResponse`'s existing catch-all converts any error that isn't already a `PublicApiError` into `database_unavailable` (`status.ts`), and the route only special-cases `ActorIdentityError` and `PublicApiError` — a missing turn-token secret would surface as a fake database outage, actively hiding the real cause.

Fix, mirroring the existing `ActorIdentityError` pattern exactly:

- Add `TurnTokenError extends Error` in `src/lib/rubiks/turns.ts`, thrown by `getTurnTokenSecret()` when `TURN_TOKEN_SECRET` is missing.
- In `getStatusFullResponse`'s catch block, re-throw `TurnTokenError` (and `PublicApiError`) rather than swallowing it into `database_unavailable` — same shape as the existing `if (error instanceof PublicApiError) throw error;` line.
- Both `app/api/rubiks-cube/status/route.ts` and the new `app/api/rubiks-cube/join/route.ts` catch `TurnTokenError` and return a distinct envelope, not part of the typed success/rejection wire shapes in `src/lib/api/types.ts` — this is an HTTP-level configuration error, same tier as `identity_unavailable`:
  ```json
  { "error": { "code": "turn_token_unavailable", "message": "Turn credentials are unavailable." } }
  ```
  Status 500, no secret details in the message, same as `identityErrorResponse`.
- Add a test: missing `TURN_TOKEN_SECRET` causes `join` (and any `status` call that would serve `yourTurn`) to return `turn_token_unavailable`, not `database_unavailable`.

## `StatusFull` read consistency

`getStatusFullResponse` (`status.ts`) currently issues several independent queries (epoch, move log, best score, claim, queue entries, current turn) under default `READ COMMITTED` isolation. Before M03 this was latent but harmless — nothing wrote concurrently. Now that `join` writes while other actors are polling status, those queries can straddle a commit and assemble a response from two different moments (e.g. queue rows reflecting a join that the turn row read a moment earlier didn't). This milestone is where that stops being theoretical, so it's in scope here rather than deferred again: wrap `getStatusFullResponse`'s reads in a single `REPEATABLE READ` transaction (postgres.js: `sql.begin(...)` with the isolation level set) so all of it reflects one consistent snapshot.

## Dev tooling (optional, not required scope — default to not building it)

Because a shortcut-created active turn can't be resolved or submitted against until Milestone 04, manual re-testing of the shortcut path repeatedly will leave a stuck `active` turn blocking further `join` calls for the epoch. A naive fix — `update turns set status = 'expired' where id = ...` with no accompanying event — trades one audit inconsistency for another: it produces a `turn_started` event with no corresponding transition ever recorded for how the turn actually ended, the same "history says something happened, but the record contradicts it" problem the earlier delete-based idea had. Doing it correctly means: lock the epoch row, update the turn's status, allocate the next `seq`, and append a `turn_expired` event (payload noting it's a development reset) — at which point this dev tool is really a preview implementation of M04's expiry transition.

Given that, **the simpler and default M03 choice is not to build this tool at all.** The concurrency acceptance test below already exercises both `join` branches without needing repeated resets. If manual re-testing turns out to be genuinely painful during implementation, building the tool correctly (lock + seq + event, not a bare status update) is preferable to skipping the event — but don't reach for it by default. Flag whichever choice was made in the report.

## Tests

Prefer pure/unit tests over hitting the shared Supabase database, per house rule. At minimum:

- `computeViewerStatus`/`computeQueueSummary` reuse — no new tests needed if genuinely unchanged.
- `deriveTurnToken` is deterministic (same `turn.id` + secret → same token, every call) and differs across distinct turn ids.
- Shortcut path: no live turn, no queue → produces `active` + `yourTurn` with a token that derives to the stored hash.
- Normal path: live active turn already exists → produces `queued`, no `yourTurn`.
- Idempotent re-join: actor already owns the active turn → no duplicate `turns` row, `yourTurn` returns the same derived token as the original creation.
- Idempotent re-join while queued → no duplicate `queue_entries` row.
- `already_moved` actor → rejected with that reason, no rows inserted, verified via the authoritative in-transaction check (not just a pre-check).
- Stale `epochId` → rejected with `stale_epoch` and the real current epoch id.
- Two concurrent shortcut attempts (simulated) → exactly one becomes `active`, the other lands in `queued`.
- Event `seq` allocation is monotonic per epoch under the epoch-row lock; no `(epoch_id, seq)` collisions across concurrent join attempts.
- `mintYourTurnSummary`/`deriveTurnToken` never log the raw token or the secret.

Do not insert fixtures into the shared dev Supabase database — use an in-memory/mock SQL layer or restructure the transaction logic into pure functions over row inputs (matching the `status.ts` pattern of pure helpers plus a thin DB-calling wrapper) so the bulk of this is testable without a live connection.

**Pure/unit tests cannot prove real Postgres locking or index behavior** — an in-memory "concurrent" test only proves the application-level branching logic, not that `select ... for update` and `turns_one_live_turn_idx` actually serialize two real concurrent connections. That requires the manual acceptance step below; it supplements these tests, it doesn't replace them.

## Hard non-goals

Do not implement:

- `start-turn`
- queue promotion / `ready_check` creation / `ready_check_started` event
- ready-check or active-turn expiry enforcement (lazy or otherwise)
- `submit-move`
- move commits or claim creation
- `StatusDelta`
- heartbeat
- pending-move publishing / live spectating
- realtime
- Redis
- a `skipped` entry path
- rate limiting / abuse controls (still on the pre-launch checklist, not this milestone)

Do not change: cube engine semantics, local interaction, arrows, animations, preview/commit flow, local history, `StatusFull`'s existing shape or behavior beyond the `yourTurn` reissue mechanics described above.

## Verification

Run: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check` — all green.

If database access is available, run the migration (after human approval) against an idle epoch (no live turn, no queue entries — the state right after seeding), then do the concurrency test **first, before anything else touches this epoch**: fire two genuinely concurrent `join` requests from different actors (e.g. two parallel `curl`/script processes) and confirm exactly one response is `active` and one is `queued`; exactly one live `turns` row exists afterward; the written events have distinct, correctly ordered `seq` values; and no unique-violation/500 occurred. This is the only way to actually exercise the row lock and partial unique index — nothing in the unit-test suite does.

Ordering matters here: M03 has no expiry enforcement, so once this test creates an active turn, the epoch is not idle again for the rest of the session — there's no way to re-run the "empty queue" scenario without a fresh epoch. The concurrency test already exercises both branches (one actor active, one queued) in a single pass, so there's no need for a separate earlier single-actor check that would just get overtaken by this one. Confirm `StatusFull` reflects the resulting `active`/`yourTurn` and `queued` states for the two actors as part of reading this test's outcome, rather than as a separate prior step.

## Report

Report:

- files changed, migration file added
- exact SQL for both new indexes and confirmation neither was applied automatically
- turn-token derivation approach (`TURN_TOKEN_SECRET` + HMAC construction) and confirmation it replaced the earlier re-mint-on-read draft
- confirmation `toYourTurnSummary`'s placeholder (`turnId: turn.id`) was replaced
- how the empty-queue shortcut's atomicity is implemented (epoch-row lock + unique index as invariant alarm, not a recovery path) and confirmation the claim/epoch checks are authoritative inside the transaction
- how event `seq` is allocated under the epoch lock
- confirmation `StatusFull`'s reads were wrapped in a consistent-snapshot transaction
- idempotency behavior for repeat `join` calls (both branches), and confirmation the owned-`ready_check` case was left unresolved for M04 rather than guessed at
- events written (`turn_started`, `queue_joined`) and their payloads
- confirmation raw actor IDs are stored only in internal database rows (`turns`, `queue_entries`, `actor_claims`, `events` — this is by design, the contract permits it internally) and are never exposed publicly or logged; confirmation raw turn tokens and `TURN_TOKEN_SECRET` are never stored or logged
- confirmation request validation (JSON shape, `gameId`, UUID-shaped `epochId`) rejects with `invalid_request`/400 before any query, rather than surfacing as `database_unavailable`
- confirmation a missing `TURN_TOKEN_SECRET` surfaces as `turn_token_unavailable` (500) from both `join` and `status`, not `database_unavailable`, and confirmation `.env.example` was updated
- the `skipped` status non-decision
- whether dev tooling for manual turn reset was added, and why (force-expire, not delete, if added)
- tests and command results
- any contract deviation or conflict discovered, especially regarding the scope clarification above
