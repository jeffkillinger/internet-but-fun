<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AGENTS.md — Internet But Fun

Standing context for AI coding agent sessions in this repository (Claude Code, Codex, or any other agent). Read this before doing anything.

## What this project is

**Internet But Fun (internetbutfun.com)** is a consumer-facing arcade of small, polished, whimsical web experiments. It is treated as a genuine product with its own identity. It is also, deliberately, a demonstration of Senior Web Developer and Solution Architect–level thinking: documented decision-making, explicit architecture, and a narrative of *how* and *why* decisions were made. Technical write-ups live on jeffkillinger.com (separate site), not here — IBF carries only a small footer credit.

The first game is a **collaborative multiplayer Rubik's Cube**: every visitor gets exactly **one move per epoch** on a shared cube. An epoch is one cube lifecycle — fresh scramble → collective moves → solved → archived → new scramble. The one-move premise is the product. Do not engineer around it (no solo grace, no multi-move sessions).

More games follow at a target cadence of one per week post-launch (Wrong Keys typing challenge is likely game two). Do **not** build shared game infrastructure ahead of need — the rule of three applies: extract abstractions only after two or three real instances reveal what is actually common. The append-only event log is the one deliberate site-wide primitive.

## Documents are canon

These files are **binding specifications**. Read the relevant ones before touching adjacent code. If implementation reveals a conflict or a missing decision: **stop that part, report the conflict, do not improvise a replacement design.**

- `docs/api-contract.md` — the client/server contract. Canonical vs. presentation rules, epoch/claim rules, turn state machine, endpoint shapes, security posture.
- `src/lib/api/types.ts` — the contract's TypeScript types. The wire format. Do not rename, add, or remove fields without an explicit contract change.
- `docs/arcade-architecture.md` — site-wide principles.
- `docs/backend-milestone-01.md`, `docs/backend-milestone-02.md` — historical records of completed milestones. Never edit a completed milestone doc; new work gets a new numbered doc.
- `docs/backend-milestone-03.md` — drafted, pending review before implementation begins.
- Milestone specs are written **before** implementation, reviewed, and committed. Launcher prompts stay thin and point at the docs.

Things the contract explicitly bans from ever reappearing (do not "helpfully" reintroduce):
- public actor IDs or raw actor IDs in any public response
- public turn IDs / bearer tokens in `activeTurn` (they live only in `yourTurn`, returned solely to the owning actor)
- `clientStateHash` in requests (version on request; hash on response)
- `nextTurnStartsAt` (contradicts lazy expiry)
- `hash_mismatch` as a server-side delta-refetch reason (hash mismatch is client-detected)
- presentation/animation metadata in the API, database, or event log

## Architectural invariants

1. **The server owns canonical state. Clients send move intent only** — never resulting cube state. Server validates and applies.
2. **State is replay-derived, never stored directly.** Client state is `{ scramble: Move[], history: Move[] }`; the cube is computed by replaying. Server state is the epoch's scramble plus the committed-move event log, with `state_hash` denormalized for cheap reads.
3. **Canonical vs. presentation is a hard boundary.** Canonical: `F2`, epoch IDs, versions. Presentation: animation direction intent, which arrow created a move, selected face, camera. Presentation data never enters the engine, the event log, the database, or the wire. (Example: an arrow-created `F2` animates in the arrow's direction via renderer-only metadata; the committed move is just `F2`.)
4. **The cube engine (`src/lib/cube/`) is sacred.** Pure functions, fully tested, runs identically in browser and Node (verified by hash parity: browser and server both compute the same FNV-1a hash for the same state). Do not modify it without explaining why first. Never duplicate its logic elsewhere.
5. **Read paths do not replay.** `StatusFull`/`StatusDelta` serve stored `state_hash` and `scramble` directly. Engine-based verification of stored state happens at write time (seed, move commit), not per-request.
6. **The event log is append-only.** Replay orders by `(epoch_id, seq)`, never `created_at`. `seq` is server-assigned and monotonic per epoch.
7. **Client-side prevention is UX; server-side validation is law.** The UI locks controls when it's not your turn, but the server independently rejects with typed reasons (`not_your_turn`, `turn_expired`, `stale_cube_version`, `stale_epoch`, `already_moved`, `invalid_move`).
8. **Identity is anonymous and durable.** Signed HMAC-SHA256 HTTP-only cookie (`ibf_actor`) containing a versioned JSON envelope `{v, actorId, issuedAt}` resolving to a UUID. No accounts, no usernames, no user-supplied text anywhere. Tampered cookies are silently replaced. Missing `ACTOR_COOKIE_SECRET` fails loudly (`identity_unavailable`) — never fall back to unsigned.

## Database and environment

- **Postgres via Supabase is the durable source of truth.** Redis is banned from canonical history; if ever introduced, ephemeral coordination only.
- Access is **postgres.js over the Supabase transaction pooler (port 6543) with `prepare: false`**. Never `@supabase/supabase-js` for table access. Never the direct 5432 connection.
- The Supabase project has Data API **off** and automatic RLS **on**. Migrations also enable RLS explicitly per table (reproducibility must not depend on dashboard settings). No public policies, no anon grants. The browser talks to our API routes, never to the database.
- Secrets: `DATABASE_URL`, `ACTOR_COOKIE_SECRET`, and (as of Milestone 03) `TURN_TOKEN_SECRET` live in `.env.local` only (gitignored). `.env.example` carries placeholders. Secrets never appear in client code, logs, error responses, or `NEXT_PUBLIC_*`.
- Node scripts load env via `tsx --env-file=.env.local` (plain Node does not read `.env.local` — this is the house pattern for all scripts).
- **Migrations are written, presented, and STOPPED for explicit human approval before any SQL executes against the database.** This gate is absolute. Migration files are committed SQL in `supabase/migrations/`; the human applies them via the Supabase dashboard. Never apply, never auto-migrate, never edit SQL ad hoc in the dashboard.
- The current hosted project is `internet-but-fun-prod`, serving as dev until launch (a `-dev` project gets created pre-launch).

## Current state (as of Backend Milestone 02)

**Frontend (complete for tap-based play):**
- Canonical 54-facelet cube engine with serialization, scramble generation, HTM move counting (`countMoves`), solved detection, and `hashCubeState` (FNV-1a, 8 chars) — all pure, all tested, including known-answer and asymmetric-state tests.
- 2D CubeNet debug renderer (frozen; permanent reference view) with diff-highlighted previews.
- DevPanel: sequence input (`R U R' U'` etc., transactional parse), copy-state, state hashes, server StatusFull probe.
- React Three Fiber 3D renderer: 27 cubies, colors derived from canonical state via a documented facelet-to-position convention (world: +Y=U, −Y=D, +Z=F, −Z=B, +X=R, −X=L; BoxGeometry material order +x,−x,+y,−y,+z,−z).
- All 18 move preview animations via a pure `getMoveGeometry` table (R/U/F clockwise = −π/2 on their axis; L/D/B = +π/2). Animation is a transient renderer overlay between derived states — transforms are never accumulated or baked; completion snaps to derived truth; any state change mid-animation abandons and snaps.
- Raycast face selection (face normal determines the face, never cubie position), dimmed-slice highlight, curved world-space rotation arcs with enlarged hit targets, same-arrow double-turn upgrade (state machine: none+CW→base, base+CW→double, double+CW→base; likewise CCW/prime), renderer-only animation-direction intent for arrow-created doubles.
- Preview/commit flow in a `usePendingMove` hook with an injected `commitMove` callback — **this callback is the seam where server move submission will attach.**
- Reset View, occluded canonical face labels, batch operations (scramble/sequence/undo) never animate.

**Backend (read path + identity complete):**
- Schema applied: `epochs` (partial unique index enforcing one active epoch per game), `events` (unique `(epoch_id, seq)`), `queue_entries`, `turns` (stores `turn_token_hash`, never raw tokens; `pending_move` regex-checked to canonical notation), `actor_claims` (unique `(epoch_id, actor_id)`). All RLS-enabled. Status enums include `skipped`.
- Seeded active epoch with server-generated scramble, stored on the epoch row **and** in the `epoch_started` event payload. Seed is idempotent and self-verifies stored hash on every run.
- `GET /api/rubiks-cube/status?gameId=rubiks-cube` — StatusFull per contract. viewerStatus computed by pure `computeViewerStatus` (precedence: already_moved > active > ready_check > queued > can_play), personalized via the actor cookie. Public `activeTurn` never carries turnId; private `yourTurn` only to the owner.
- Dev-only diagnostics (404 in production): `/api/dev/db-health`, `/api/dev/actor-health`.
- Browser/server hash parity verified end to end (the DevPanel probe).
- **Known tripwire:** if an owned live turn exists, StatusFull currently fails with `turn_token_unrecoverable`, because the schema stores only token hashes and the resume path can't reproduce the original bearer token. Milestone 03 must resolve the token lifecycle (re-mint-and-rehash on resume vs. session cache). Do not weaken hashed storage to dodge this.

## Next: Backend Milestone 03 — first write path (spec drafted, `docs/backend-milestone-03.md`, pending review)

Scope: `join` only, with both branches — empty-queue shortcut (eligible actor clicks Make your move → active turn created immediately + token minted) and normal queue insertion; first real events (`queue_joined`, `turn_started`). The spec resolves the turn-token lifecycle as **deterministic derivation**: `turnId = HMAC-SHA256(TURN_TOKEN_SECRET, turn.id)`, recomputed identically on every read with zero storage of the raw value and zero writes-on-read (an earlier draft that re-minted a random token on every status poll was rejected on review — concurrent reads could race and invalidate an in-flight token). `turn_token_hash` stays exactly as load-bearing as Milestone 01 designed it (validation still hashes the presented token and compares) — derivation only solves recovering the raw value for redelivery, it doesn't bypass the stored hash. It settles a scope tension in this note: `start-turn` and ready-check promotion are *not* in M03 — `JoinGameResponse`'s accepted variant only ever produces `viewerStatus: "queued" | "active"`, never `"ready_check"`, so a join call alone cannot produce that state. **Atomicity**: the empty-queue shortcut locks the epoch row scoped to `game_id`/`status = 'active'` (`select ... for update` — not just by id, since a stale/completed epoch row would otherwise still lock successfully) for the entire check-then-insert (request-shape validation happens before any query; `already_moved`/`stale_epoch` checks and event `seq` allocation happen inside the lock), backed by a partial unique index (`turns_one_live_turn_idx`) treated as an invariant alarm rather than a recovery branch. `StatusFull`'s multi-query read is wrapped in a consistent-snapshot transaction as part of this milestone, now that a concurrent writer exists. The `queue_entries` status lifecycle is now defined in the spec even though M03's own code only ever produces `queued` rows; shortcut-created turns never get a `queue_entries` row.

After M03: queue promotion to `ready_check` + `start-turn` + ready-check/active-turn expiry enforcement (M04); submit-move transaction — validate actor/turn/epoch/version/move → append event → update epoch → create claim (M05); StatusDelta + polling, epoch completion lifecycle (M06); reversal animation (M07, frontend); live pending-move spectating + drag-to-turn (M08, frontend); pre-launch hardening — rate limits, secrets rotation, dev/prod project split, load testing (M09).

## Workflow rules

- Milestone spec first, implementation second. Specs get reviewed (ideally by a separate reviewer conversation) before code.
- Before declaring any task done: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check` — all green.
- Report deviations, assumptions, and decisions explicitly. Convert design ambiguities into reported attestations rather than silent choices.
- Keep diffs scoped to the milestone. State non-goals and honor them.
- Prefer pure functions with in-memory-fixture tests over database-dependent tests. Never insert test fixtures into the shared dev database.
- Animation-direction and affordance-layer code is untestable in Vitest; changes there end with a manual play session. Budget for it.
- The human applies migrations, runs seeds, and performs manual acceptance. Stop at those gates.

## Deferred product requirements (do not lose these)

- **Reversal animation (pre-launch requirement, not polish):** when a player changes candidate moves, animate the previous preview reversing before the new preview plays (`R → null → U` as canonical pending transitions). Transition-based model: displayed pending state → target pending state. Spectators later replay the same transitions. No renderer direction metadata crosses the wire. Must ship before launch and before live spectating.
- **Pre-launch checklist:** fresh production `ACTOR_COOKIE_SECRET` and `TURN_TOKEN_SECRET` (never reuse dev's; rotating `TURN_TOKEN_SECRET` invalidates any live turn, so do this during a quiet window); Vercel spending cap; Supabase budget alerts; create `internet-but-fun-dev` and repoint `.env.local`; verify `secure: true` cookie in production; polling intervals + hidden-tab backoff; load-test status polling; set `DATABASE_URL` in Vercel (deliberately not set yet).
- Seed script: print an explicit "hash verified" line on success (currently verifies silently).
- Button move-controls grid becomes debug/accessibility tier once direct manipulation is primary; visual demotion is a decided-but-unscheduled change.

## Voice and collaboration notes

- Jeff originates the creative and product ideas. The assistant's job is frameworks, structure, critique, and honest pushback — not generating content or vision on his behalf. Sycophantic capitulation is a failure mode; so is contrarianism for its own sake.
- Decisions are made explicitly and on paper before code. When a decision is discovered mid-implementation, surface it — don't resolve it by accident.
- AI tools are used openly as force multipliers; the architecture narrative (including AI-assisted workflow) is part of the portfolio story.
