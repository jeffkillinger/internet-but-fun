import { describe, expect, it, vi } from "vitest";

import {
  applyMoves,
  createSolvedCube,
  hashCubeState,
  parseMoveNotation,
  serializeCube,
  type MoveNotation,
} from "../cube";

import {
  hashScrambleState,
  reconstructSerializedCubeFromScramble,
} from "./epoch";
import {
  computeQueueSummary,
  computeViewerStatus,
  createStatusFullResponse,
  toPublicCommittedMove,
  toPublicTurnSummary,
} from "./status";
import { deriveTurnToken, mintYourTurnSummary } from "./turns";

const scramble: MoveNotation[] = ["R", "U", "F2"];

describe("Rubik's Cube server status helpers", () => {
  it("reconstructs an epoch from its stored scramble", () => {
    expect(reconstructSerializedCubeFromScramble(scramble)).toBe(
      serializeCube(applyMoves(createSolvedCube(), scramble)),
    );
  });

  it("calculates the same hash in server code as client code", () => {
    const serialized = reconstructSerializedCubeFromScramble(scramble);
    expect(hashScrambleState(scramble)).toBe(hashCubeState(serialized));
  });

  it("converts database records into the exact StatusFullResponse shape", () => {
    const stateHash = hashScrambleState(scramble);
    const response = createStatusFullResponse({
      epoch: {
        id: "epoch-1",
        game_id: "rubiks-cube",
        scramble,
        cube_version: 0,
        state_hash: stateHash,
        move_count: 0,
      },
      moveLog: [],
      bestScoreMoves: 12,
    });

    expect(response).toEqual({
      mode: "full",
      gameId: "rubiks-cube",
      epochId: "epoch-1",
      cubeVersion: 0,
      stateHash,
      moveCount: 0,
      bestScoreMoves: 12,
      scramble,
      moveLog: [],
      viewerStatus: "can_play",
      queue: {
        queueLength: 0,
        viewerPosition: null,
      },
      activeTurn: null,
      yourTurn: null,
    });
  });

  it("ensures public move entries omit actor IDs", () => {
    const publicMove = toPublicCommittedMove({
      seq: 2,
      payload: {
        actorId: "internal-actor",
        move: parseMoveNotation("R").notation,
        moveNumber: 1,
        cubeVersion: 1,
      },
      created_at: new Date("2026-07-13T12:00:00.000Z"),
    });

    expect(publicMove).toEqual({
      moveNumber: 1,
      cubeVersion: 1,
      move: "R",
      createdAt: "2026-07-13T12:00:00.000Z",
    });
    expect(publicMove).not.toHaveProperty("actorId");
  });

  it("returns bestScoreMoves null when there are no completed epochs", () => {
    const response = createStatusFullResponse({
      epoch: {
        id: "epoch-1",
        game_id: "rubiks-cube",
        scramble,
        cube_version: 0,
        state_hash: hashScrambleState(scramble),
        move_count: 0,
      },
      moveLog: [],
      bestScoreMoves: null,
    });

    expect(response.bestScoreMoves).toBeNull();
  });

  it("computes can_play for empty viewer rows", () => {
    expect(
      computeViewerStatus({
        actorId: "11111111-1111-4111-8111-111111111111",
        claim: null,
        turn: null,
        queueEntry: null,
      }),
    ).toBe("can_play");
  });

  it("gives actor claims highest viewerStatus precedence", () => {
    const actorId = "11111111-1111-4111-8111-111111111111";

    expect(
      computeViewerStatus({
        actorId,
        claim: { actor_id: actorId },
        turn: {
          id: "turn-1",
          actor_id: actorId,
          status: "active",
          expires_at: new Date("2026-07-13T12:00:00.000Z"),
          pending_move: null,
        },
        queueEntry: {
          id: "queue-1",
          actor_id: actorId,
          joined_at: new Date("2026-07-13T11:00:00.000Z"),
        },
      }),
    ).toBe("already_moved");
  });

  it("computes queued, ready_check, and active viewer states", () => {
    const actorId = "11111111-1111-4111-8111-111111111111";

    expect(
      computeViewerStatus({
        actorId,
        claim: null,
        turn: null,
        queueEntry: {
          id: "queue-1",
          actor_id: actorId,
          joined_at: new Date("2026-07-13T11:00:00.000Z"),
        },
      }),
    ).toBe("queued");
    expect(
      computeViewerStatus({
        actorId,
        claim: null,
        turn: {
          id: "turn-1",
          actor_id: actorId,
          status: "ready_check",
          expires_at: new Date("2026-07-13T12:00:00.000Z"),
          pending_move: null,
        },
        queueEntry: null,
      }),
    ).toBe("ready_check");
    expect(
      computeViewerStatus({
        actorId,
        claim: null,
        turn: {
          id: "turn-1",
          actor_id: actorId,
          status: "active",
          expires_at: new Date("2026-07-13T12:00:00.000Z"),
          pending_move: null,
        },
        queueEntry: null,
      }),
    ).toBe("active");
  });

  it("returns queue length and viewer position with deterministic ordering", () => {
    const actorId = "22222222-2222-4222-8222-222222222222";
    const queue = computeQueueSummary({
      actorId,
      queueEntries: [
        {
          id: "queue-b",
          actor_id: actorId,
          joined_at: new Date("2026-07-13T11:00:00.000Z"),
        },
        {
          id: "queue-a",
          actor_id: "11111111-1111-4111-8111-111111111111",
          joined_at: new Date("2026-07-13T11:00:00.000Z"),
        },
      ],
    });

    expect(queue).toEqual({ queueLength: 2, viewerPosition: 2 });
    expect(
      computeQueueSummary({
        actorId: "33333333-3333-4333-8333-333333333333",
        queueEntries: [],
      }),
    ).toEqual({ queueLength: 0, viewerPosition: null });
  });

  it("returns private yourTurn only to the owning actor", () => {
    vi.stubEnv("TURN_TOKEN_SECRET", "test-turn-secret");

    const owner = "11111111-1111-4111-8111-111111111111";
    const turn = {
      id: "turn-private",
      actor_id: owner,
      status: "active" as const,
      expires_at: new Date("2026-07-13T12:00:00.000Z"),
      pending_move: "R",
    };

    expect(mintYourTurnSummary({ turn, actorId: owner })).toEqual({
      turnId: deriveTurnToken("turn-private"),
      status: "active",
      expiresAt: "2026-07-13T12:00:00.000Z",
    });
    expect(
      mintYourTurnSummary({
        turn,
        actorId: "22222222-2222-4222-8222-222222222222",
      }),
    ).toBeNull();
  });

  it("never includes turnId in public activeTurn", () => {
    const publicTurn = toPublicTurnSummary({
      id: "turn-private",
      actor_id: "11111111-1111-4111-8111-111111111111",
      status: "active",
      expires_at: new Date("2026-07-13T12:00:00.000Z"),
      pending_move: "R",
    });

    expect(publicTurn).toEqual({
      status: "active",
      expiresAt: "2026-07-13T12:00:00.000Z",
      pendingMove: "R",
    });
    expect(publicTurn).not.toHaveProperty("turnId");
  });
});
