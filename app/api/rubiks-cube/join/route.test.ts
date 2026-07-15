import { describe, expect, it, vi } from "vitest";

import {
  createFakeSql,
  createFakeStore,
} from "../../../../src/lib/rubiks/testing/fakeSql";

const epochId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/rubiks-cube/join", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function malformedJsonRequest(): Request {
  return new Request("http://localhost/api/rubiks-cube/join", {
    method: "POST",
    body: "{not json",
    headers: { "content-type": "application/json" },
  });
}

describe("join route", () => {
  it("returns invalid_request/400 for a malformed JSON body", async () => {
    vi.resetModules();
    vi.stubEnv("ACTOR_COOKIE_SECRET", "test-actor-secret");
    vi.stubEnv("TURN_TOKEN_SECRET", "test-turn-secret");

    const { POST } = await import("./route");
    const response = await POST(malformedJsonRequest());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("invalid_request");
  });

  it("returns invalid_request/400 for a missing epochId", async () => {
    vi.resetModules();
    vi.stubEnv("ACTOR_COOKIE_SECRET", "test-actor-secret");
    vi.stubEnv("TURN_TOKEN_SECRET", "test-turn-secret");

    const { POST } = await import("./route");
    const response = await POST(jsonRequest({ gameId: "rubiks-cube" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("invalid_request");
  });

  it("returns invalid_request/400 for the wrong gameId", async () => {
    vi.resetModules();
    vi.stubEnv("ACTOR_COOKIE_SECRET", "test-actor-secret");
    vi.stubEnv("TURN_TOKEN_SECRET", "test-turn-secret");

    const { POST } = await import("./route");
    const response = await POST(jsonRequest({ gameId: "wrong-game", epochId }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("invalid_request");
  });

  it("maps a missing TURN_TOKEN_SECRET on a shortcut join to turn_token_unavailable without writes", async () => {
    vi.resetModules();
    vi.stubEnv("ACTOR_COOKIE_SECRET", "test-actor-secret");
    vi.stubEnv("TURN_TOKEN_SECRET", "");

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
    const fakeSql = createFakeSql(store);

    vi.doMock("../../../../src/lib/db/client", () => ({ getSql: () => fakeSql }));

    const { POST } = await import("./route");
    const response = await POST(jsonRequest({ gameId: "rubiks-cube", epochId }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("turn_token_unavailable");
    expect(body.error.code).not.toBe("database_unavailable");
    expect(store.turns).toEqual([]);
    expect(store.queue_entries).toEqual([]);
    expect(store.events).toEqual([]);
  });

  it("maps a missing TURN_TOKEN_SECRET on a queued join to turn_token_unavailable without writes", async () => {
    vi.resetModules();
    vi.stubEnv("ACTOR_COOKIE_SECRET", "test-actor-secret");
    vi.stubEnv("TURN_TOKEN_SECRET", "");

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
      id: "22222222-2222-4222-8222-222222222222",
      game_id: "rubiks-cube",
      epoch_id: epochId,
      actor_id: "33333333-3333-4333-8333-333333333333",
      turn_token_hash: "unused-in-this-test",
      status: "active",
      pending_move: null,
      expires_at: new Date(Date.now() + 30_000),
      created_at: new Date(),
      completed_at: null,
    });
    const existingTurn = store.turns[0];
    const fakeSql = createFakeSql(store);

    vi.doMock("../../../../src/lib/db/client", () => ({ getSql: () => fakeSql }));

    const { POST } = await import("./route");
    const response = await POST(jsonRequest({ gameId: "rubiks-cube", epochId }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("turn_token_unavailable");
    expect(body.error.code).not.toBe("database_unavailable");
    expect(store.turns).toEqual([existingTurn]);
    expect(store.queue_entries).toEqual([]);
    expect(store.events).toEqual([]);
  });
});
