import { describe, expect, it, vi } from "vitest";

import {
  deriveTurnToken,
  hashTurnToken,
  mintYourTurnSummary,
  TurnTokenError,
} from "./turns";

describe("turn-token derivation", () => {
  it("derives the same token for the same turn id every time", () => {
    vi.stubEnv("TURN_TOKEN_SECRET", "test-turn-secret");

    const turnId = "11111111-1111-4111-8111-111111111111";

    expect(deriveTurnToken(turnId)).toBe(deriveTurnToken(turnId));
  });

  it("derives different tokens for different turn ids", () => {
    vi.stubEnv("TURN_TOKEN_SECRET", "test-turn-secret");

    expect(deriveTurnToken("11111111-1111-4111-8111-111111111111")).not.toBe(
      deriveTurnToken("22222222-2222-4222-8222-222222222222"),
    );
  });

  it("fails loudly when TURN_TOKEN_SECRET is missing", () => {
    vi.stubEnv("TURN_TOKEN_SECRET", "");

    expect(() => deriveTurnToken("11111111-1111-4111-8111-111111111111")).toThrow(
      TurnTokenError,
    );
  });

  it("hashes a derived token deterministically", () => {
    vi.stubEnv("TURN_TOKEN_SECRET", "test-turn-secret");

    const token = deriveTurnToken("11111111-1111-4111-8111-111111111111");

    expect(hashTurnToken(token)).toBe(hashTurnToken(token));
    expect(hashTurnToken(token)).not.toBe(token);
  });

  it("re-derives the same token on repeated mints (no rotation)", () => {
    vi.stubEnv("TURN_TOKEN_SECRET", "test-turn-secret");

    const owner = "22222222-2222-4222-8222-222222222222";
    const turn = {
      id: "turn-1",
      actor_id: owner,
      status: "active" as const,
      expires_at: new Date("2026-07-15T12:00:00.000Z"),
      pending_move: null,
    };

    const first = mintYourTurnSummary({ turn, actorId: owner });
    const second = mintYourTurnSummary({ turn, actorId: owner });

    expect(first).not.toBeNull();
    expect(first).toEqual(second);
  });

  it("returns null yourTurn for a non-owning actor", () => {
    vi.stubEnv("TURN_TOKEN_SECRET", "test-turn-secret");

    const turn = {
      id: "turn-1",
      actor_id: "22222222-2222-4222-8222-222222222222",
      status: "active" as const,
      expires_at: new Date("2026-07-15T12:00:00.000Z"),
      pending_move: null,
    };

    expect(
      mintYourTurnSummary({
        turn,
        actorId: "33333333-3333-4333-8333-333333333333",
      }),
    ).toBeNull();
  });

  it("returns null yourTurn for a null turn", () => {
    vi.stubEnv("TURN_TOKEN_SECRET", "test-turn-secret");

    expect(
      mintYourTurnSummary({
        turn: null,
        actorId: "33333333-3333-4333-8333-333333333333",
      }),
    ).toBeNull();
  });
});
