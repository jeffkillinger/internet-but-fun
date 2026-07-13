import { describe, expect, it } from "vitest";

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
import { createStatusFullResponse, toPublicCommittedMove } from "./status";

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
});
