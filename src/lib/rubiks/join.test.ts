import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createFakeSql,
  createFakeStore,
  type FakeEpochRow,
  type FakeStore,
} from "./testing/fakeSql";

let store: FakeStore;
let fakeSql: ReturnType<typeof createFakeSql>;

// vi.mock is hoisted above these imports by Vitest's transform, so
// submitJoin's internal getSql() resolves to whatever `fakeSql` currently
// points to at call time (reassigned per test in beforeEach below) rather
// than a real Postgres connection.
vi.mock("../db/client", () => ({
  getSql: () => fakeSql,
}));

import { decideJoinAction, submitJoin } from "./join";
import { PublicApiError } from "./status";
import { hashTurnToken, TurnTokenError } from "./turns";

const owner = "11111111-1111-4111-8111-111111111111";

const activeTurn = {
  id: "turn-1",
  actor_id: owner,
  status: "active" as const,
  expires_at: new Date("2026-07-15T12:00:00.000Z"),
  pending_move: null,
};

const queueEntry = {
  id: "queue-1",
  actor_id: owner,
  joined_at: new Date("2026-07-15T11:00:00.000Z"),
};

describe("decideJoinAction", () => {
  it("takes the empty-queue shortcut when nothing else exists", () => {
    expect(
      decideJoinAction({
        ownedActiveTurn: null,
        ownedQueueEntry: null,
        liveTurnExists: false,
        queueEntryExists: false,
      }),
    ).toEqual({ type: "shortcut" });
  });

  it("queues a second caller once a live turn already exists", () => {
    // Simulates the concurrency scenario at the branching-logic level: real
    // row-lock/unique-index serialization can only be verified against a
    // live Postgres connection (see the manual acceptance step in
    // docs/backend-milestone-03.md), but given that a live turn already
    // exists, the decision logic must land the caller in the queue rather
    // than retrying the shortcut.
    expect(
      decideJoinAction({
        ownedActiveTurn: null,
        ownedQueueEntry: null,
        liveTurnExists: true,
        queueEntryExists: false,
      }),
    ).toEqual({ type: "queue" });
  });

  it("queues when queue entries already exist even without a live turn", () => {
    expect(
      decideJoinAction({
        ownedActiveTurn: null,
        ownedQueueEntry: null,
        liveTurnExists: false,
        queueEntryExists: true,
      }),
    ).toEqual({ type: "queue" });
  });

  it("is idempotent for an actor who already owns the active turn", () => {
    expect(
      decideJoinAction({
        ownedActiveTurn: activeTurn,
        ownedQueueEntry: null,
        liveTurnExists: true,
        queueEntryExists: false,
      }),
    ).toEqual({ type: "idempotent_active", turn: activeTurn });
  });

  it("is idempotent for an actor who already has a queued entry", () => {
    expect(
      decideJoinAction({
        ownedActiveTurn: null,
        ownedQueueEntry: queueEntry,
        liveTurnExists: true,
        queueEntryExists: true,
      }),
    ).toEqual({ type: "idempotent_queued", queueEntry });
  });

  it("prefers an owned active turn over an owned queue entry", () => {
    expect(
      decideJoinAction({
        ownedActiveTurn: activeTurn,
        ownedQueueEntry: queueEntry,
        liveTurnExists: true,
        queueEntryExists: true,
      }),
    ).toEqual({ type: "idempotent_active", turn: activeTurn });
  });
});

const epochId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const otherEpochId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const actorA = "11111111-1111-4111-8111-111111111111";
const actorB = "22222222-2222-4222-8222-222222222222";

function seedActiveEpoch(overrides: Partial<FakeEpochRow> = {}): FakeEpochRow {
  const row: FakeEpochRow = {
    id: epochId,
    game_id: "rubiks-cube",
    status: "active",
    scramble: ["R", "U"],
    cube_version: 0,
    state_hash: "deadbeef",
    move_count: 0,
    started_at: new Date("2026-07-15T10:00:00.000Z"),
    ...overrides,
  };
  store.epochs.push(row);
  return row;
}

describe("submitJoin", () => {
  beforeEach(() => {
    store = createFakeStore();
    fakeSql = createFakeSql(store);
    vi.stubEnv("TURN_TOKEN_SECRET", "test-turn-secret");
  });

  it("rejects a non-rubiks-cube gameId before touching the database", async () => {
    // @ts-expect-error deliberately wrong gameId to exercise runtime validation
    await expect(submitJoin({ gameId: "other-game", epochId, actorId: actorA })).rejects.toThrow(
      PublicApiError,
    );
    expect(store.epochs).toEqual([]);
  });

  it("rejects a non-UUID epochId before touching the database", async () => {
    seedActiveEpoch();

    await expect(
      submitJoin({ gameId: "rubiks-cube", epochId: "not-a-uuid", actorId: actorA }),
    ).rejects.toThrow(PublicApiError);
  });

  it("throws no_active_epoch when none exists", async () => {
    await expect(
      submitJoin({ gameId: "rubiks-cube", epochId, actorId: actorA }),
    ).rejects.toMatchObject({ code: "no_active_epoch", status: 404 });
    expect(store.turns).toEqual([]);
    expect(store.events).toEqual([]);
  });

  it("takes the empty-queue shortcut: writes one active turn and one turn_started event", async () => {
    seedActiveEpoch();

    const response = await submitJoin({ gameId: "rubiks-cube", epochId, actorId: actorA });

    expect(response).toMatchObject({ accepted: true, epochId, viewerStatus: "active" });
    if (!response.accepted) throw new Error("expected accepted response");

    expect(store.turns).toHaveLength(1);
    expect(store.turns[0]).toMatchObject({
      epoch_id: epochId,
      actor_id: actorA,
      status: "active",
    });
    expect(store.events).toHaveLength(1);
    expect(store.events[0]).toMatchObject({
      seq: 1,
      epoch_id: epochId,
      actor_id: actorA,
      event_type: "turn_started",
      payload: { via: "empty_queue_shortcut" },
    });

    // The returned bearer token must hash to exactly what got persisted —
    // proving the client can actually use what it was handed.
    expect(response.yourTurn).not.toBeNull();
    expect(hashTurnToken(response.yourTurn!.turnId)).toBe(store.turns[0].turn_token_hash);
  });

  it("queues a second actor once a turn is already active, with a monotonic seq", async () => {
    seedActiveEpoch();
    await submitJoin({ gameId: "rubiks-cube", epochId, actorId: actorA });

    const response = await submitJoin({ gameId: "rubiks-cube", epochId, actorId: actorB });

    expect(response).toMatchObject({ accepted: true, epochId, viewerStatus: "queued" });
    if (!response.accepted) throw new Error("expected accepted response");
    expect(response.yourTurn).toBeNull();

    expect(store.queue_entries).toHaveLength(1);
    expect(store.queue_entries[0]).toMatchObject({
      epoch_id: epochId,
      actor_id: actorB,
      status: "queued",
    });
    expect(store.events).toHaveLength(2);
    expect(store.events[1]).toMatchObject({
      seq: 2,
      event_type: "queue_joined",
      actor_id: actorB,
      payload: {},
    });
  });

  it("is idempotent for an actor who already owns the active turn: no duplicate row, same token", async () => {
    seedActiveEpoch();
    const first = await submitJoin({ gameId: "rubiks-cube", epochId, actorId: actorA });
    if (!first.accepted) throw new Error("expected accepted response");

    const second = await submitJoin({ gameId: "rubiks-cube", epochId, actorId: actorA });
    if (!second.accepted) throw new Error("expected accepted response");

    expect(store.turns).toHaveLength(1);
    expect(second.yourTurn?.turnId).toBe(first.yourTurn?.turnId);
  });

  it("is idempotent for an actor who already has a queued entry: no duplicate row", async () => {
    seedActiveEpoch();
    await submitJoin({ gameId: "rubiks-cube", epochId, actorId: actorA });

    await submitJoin({ gameId: "rubiks-cube", epochId, actorId: actorB });
    await submitJoin({ gameId: "rubiks-cube", epochId, actorId: actorB });

    expect(store.queue_entries).toHaveLength(1);
  });

  it("rejects already_moved without writing any new rows", async () => {
    seedActiveEpoch();
    store.actor_claims.push({
      id: "claim-1",
      game_id: "rubiks-cube",
      epoch_id: epochId,
      actor_id: actorA,
      claimed_at: new Date(),
    });

    const response = await submitJoin({ gameId: "rubiks-cube", epochId, actorId: actorA });

    expect(response).toEqual({
      accepted: false,
      reason: "already_moved",
      currentEpochId: epochId,
      viewerStatus: "already_moved",
    });
    expect(store.turns).toEqual([]);
    expect(store.queue_entries).toEqual([]);
    expect(store.events).toEqual([]);
  });

  it("rejects stale_epoch against the real current epoch, computing the actor's actual viewer status there", async () => {
    seedActiveEpoch({ id: otherEpochId });

    const response = await submitJoin({ gameId: "rubiks-cube", epochId, actorId: actorA });

    expect(response).toEqual({
      accepted: false,
      reason: "stale_epoch",
      currentEpochId: otherEpochId,
      viewerStatus: "can_play",
    });
    expect(store.turns).toEqual([]);
    expect(store.queue_entries).toEqual([]);
  });

  it("does not write anything when TURN_TOKEN_SECRET is missing during the shortcut (rollback / no-write)", async () => {
    seedActiveEpoch();
    vi.stubEnv("TURN_TOKEN_SECRET", "");

    await expect(
      submitJoin({ gameId: "rubiks-cube", epochId, actorId: actorA }),
    ).rejects.toThrow(TurnTokenError);

    expect(store.turns).toEqual([]);
    expect(store.events).toEqual([]);
  });

  it("treats a unique-index violation as an invariant alarm: rolls back, logs only safe metadata, never the raw error", async () => {
    seedActiveEpoch();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const fakeError = Object.assign(
      new Error(
        'duplicate key value violates unique constraint "turns_one_live_turn_idx" Detail: Key (epoch_id)=(secret-detail) already exists.',
      ),
      { code: "23505", constraint_name: "turns_one_live_turn_idx", table_name: "turns" },
    );
    fakeSql = createFakeSql(store, { failOn: { insert_turn: () => { throw fakeError; } } });

    await expect(
      submitJoin({ gameId: "rubiks-cube", epochId, actorId: actorA }),
    ).rejects.toMatchObject({ code: "database_unavailable", status: 503 });

    // Rolled back: no turn survives the failed transaction.
    expect(store.turns).toEqual([]);

    expect(consoleError).toHaveBeenCalledTimes(1);
    const loggedArgs = consoleError.mock.calls[0];
    const loggedPayload = loggedArgs[1];

    expect(loggedPayload).toEqual({
      code: "23505",
      constraint: "turns_one_live_turn_idx",
      table: "turns",
    });
    // The sanitized payload must never be (or contain) the raw error, and
    // the log must never include the error's message/detail text.
    expect(loggedArgs).not.toContain(fakeError);
    expect(JSON.stringify(loggedArgs)).not.toContain("secret-detail");
    expect(JSON.stringify(loggedArgs)).not.toContain("duplicate key value");

    consoleError.mockRestore();
  });
});
