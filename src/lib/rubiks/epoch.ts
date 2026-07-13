import {
  applyMoves,
  createSolvedCube,
  hashCubeState,
  parseMoveNotation,
  serializeCube,
  type MoveNotation,
} from "../cube";

export function parseStoredScramble(value: unknown): MoveNotation[] {
  if (!Array.isArray(value)) {
    throw new Error("Stored scramble must be an array.");
  }

  return value.map((move) => {
    if (typeof move !== "string") {
      throw new Error("Stored scramble contains a non-string move.");
    }

    return parseMoveNotation(move).notation;
  });
}

export function reconstructSerializedCubeFromScramble(
  scramble: readonly MoveNotation[],
): string {
  return serializeCube(applyMoves(createSolvedCube(), scramble));
}

export function hashScrambleState(scramble: readonly MoveNotation[]): string {
  return hashCubeState(reconstructSerializedCubeFromScramble(scramble));
}
