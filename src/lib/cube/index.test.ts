import { describe, expect, it } from "vitest";

import {
  applyMove,
  applyMoves,
  countMoves,
  createSolvedCube,
  deserializeCube,
  generateScramble,
  hashCubeState,
  isSolved,
  serializeCube,
  type MoveNotation,
} from "./index";

describe("cube logic", () => {
  it("creates a solved cube", () => {
    expect(isSolved(createSolvedCube())).toBe(true);
  });

  it("is unsolved after one move", () => {
    expect(isSolved(applyMove(createSolvedCube(), "R"))).toBe(false);
  });

  it("returns to solved after a move and its inverse", () => {
    expect(isSolved(applyMoves(createSolvedCube(), ["F", "F'"]))).toBe(true);
  });

  it("returns to solved after four quarter turns", () => {
    expect(isSolved(applyMoves(createSolvedCube(), ["U", "U", "U", "U"]))).toBe(
      true,
    );
  });

  it("returns to solved after two half turns", () => {
    expect(isSolved(applyMoves(createSolvedCube(), ["F2", "F2"]))).toBe(true);
  });

  it("round-trips serialized state", () => {
    const cube = applyMoves(createSolvedCube(), ["R", "U", "F2"]);
    expect(deserializeCube(serializeCube(cube))).toEqual(cube);
  });

  it("returns the same hash for the same serialized state", () => {
    const serialized = serializeCube(createSolvedCube());
    expect(hashCubeState(serialized)).toBe(hashCubeState(serialized));
  });

  it("returns a different hash after one move", () => {
    const solved = serializeCube(createSolvedCube());
    const moved = serializeCube(applyMove(createSolvedCube(), "R"));
    expect(hashCubeState(moved)).not.toBe(hashCubeState(solved));
  });

  it("generates scrambles of the requested length", () => {
    expect(generateScramble(30)).toHaveLength(30);
  });

  it("does not repeat a face consecutively in a scramble", () => {
    const scramble = generateScramble(1_000);
    for (let index = 1; index < scramble.length; index += 1) {
      expect(scramble[index].face).not.toBe(scramble[index - 1].face);
    }
  });

  it("counts moves using Half Turn Metric", () => {
    expect(countMoves(["F", "F'", "F2"])).toBe(3);
  });

  it("solves the sixfold sexy-move identity", () => {
    const identity: readonly MoveNotation[] = ["R", "U", "R'", "U'"];
    const sequence = Array.from({ length: 6 }).flatMap(() => identity);
    expect(isSolved(applyMoves(createSolvedCube(), sequence))).toBe(true);
  });

  it("matches the known facelet state after R", () => {
    expect(serializeCube(applyMove(createSolvedCube(), "R"))).toBe(
      "UUFUUFUUFRRRRRRRRRFFDFFDFFDDDBDDBDDBLLLLLLLLLUBBUBBUBB",
    );
  });
});
