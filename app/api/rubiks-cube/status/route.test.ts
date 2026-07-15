import { describe, expect, it, vi } from "vitest";

import {
  createFakeSql,
  createFakeStore,
} from "../../../../src/lib/rubiks/testing/fakeSql";

const epochId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const actorId = "11111111-1111-4111-8111-111111111111";

describe("status route", () => {
  it("maps a missing TURN_TOKEN_SECRET to turn_token_unavailable, not database_unavailable, for an actor who owns a live turn", async () => {
    vi.resetModules();
    vi.stubEnv("ACTOR_COOKIE_SECRET", "test-actor-secret");
    vi.stubEnv("TURN_TOKEN_SECRET", "");

    // Build a valid signed actor cookie for a known actor id so the request
    // resolves to the same actor who owns the seeded active turn below —
    // otherwise yourTurn (and the token derivation it triggers) never gets
    // computed at all.
    const { createSignedActorCookie, ACTOR_COOKIE_NAME } = await import(
      "../../../../src/lib/rubiks/actor-identity"
    );
    const cookieValue = createSignedActorCookie(actorId, Date.now());

    const store = createFakeStore();
    store.epochs.push({
      id: epochId,
      game_id: "rubiks-cube",
      status: "active",
      scramble: ["R"],
      cube_version: 0,
      state_hash: "deadbeef",
      move_count: 0,
      started_at: new Date("2026-07-15T10:00:00.000Z"),
    });
    store.turns.push({
      id: "turn-1",
      game_id: "rubiks-cube",
      epoch_id: epochId,
      actor_id: actorId,
      turn_token_hash: "unused-in-this-test",
      status: "active",
      pending_move: null,
      expires_at: new Date(Date.now() + 30_000),
      created_at: new Date(),
      completed_at: null,
    });
    const fakeSql = createFakeSql(store);

    vi.doMock("../../../../src/lib/db/client", () => ({ getSql: () => fakeSql }));

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/rubiks-cube/status?gameId=rubiks-cube", {
        headers: { cookie: `${ACTOR_COOKIE_NAME}=${cookieValue}` },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("turn_token_unavailable");
    expect(body.error.code).not.toBe("database_unavailable");
  });

  it("returns no_active_epoch, not turn_token_unavailable, when there is genuinely no active epoch", async () => {
    vi.resetModules();
    vi.stubEnv("ACTOR_COOKIE_SECRET", "test-actor-secret");
    vi.stubEnv("TURN_TOKEN_SECRET", "");

    const store = createFakeStore();
    const fakeSql = createFakeSql(store);

    vi.doMock("../../../../src/lib/db/client", () => ({ getSql: () => fakeSql }));

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/rubiks-cube/status?gameId=rubiks-cube"),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("no_active_epoch");
  });
});
