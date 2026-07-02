import { describe, expect, it } from "vitest";

import { parseMoveNotation } from "../../../src/lib/cube";

import { CUBIE_COORDINATES, type CubiePosition } from "./constants";
import { getMoveGeometry } from "./getMoveGeometry";

const MOVE_NOTATIONS = [
  "U",
  "U'",
  "U2",
  "D",
  "D'",
  "D2",
  "L",
  "L'",
  "L2",
  "R",
  "R'",
  "R2",
  "F",
  "F'",
  "F2",
  "B",
  "B'",
  "B2",
] as const;

const BASE_MOVES = ["U", "D", "L", "R", "F", "B"] as const;

const CUBIE_POSITIONS: CubiePosition[] = CUBIE_COORDINATES.flatMap((x) =>
  CUBIE_COORDINATES.flatMap((y) =>
    CUBIE_COORDINATES.map((z) => [x, y, z] as CubiePosition),
  ),
);

describe("getMoveGeometry", () => {
  it.each(MOVE_NOTATIONS)("%s returns geometry", (notation) => {
    const geometry = getMoveGeometry(parseMoveNotation(notation));

    expect(geometry.axis).toHaveLength(3);
    expect(Number.isFinite(geometry.angle)).toBe(true);
    expect(geometry.slicePredicate).toBeTypeOf("function");
  });

  it.each(MOVE_NOTATIONS)("%s selects exactly nine cubies", (notation) => {
    const geometry = getMoveGeometry(parseMoveNotation(notation));

    expect(CUBIE_POSITIONS.filter(geometry.slicePredicate)).toHaveLength(9);
  });

  it.each(BASE_MOVES)(
    "uses opposite angles for %s and its prime",
    (notation) => {
      const baseAngle = getMoveGeometry(parseMoveNotation(notation)).angle;
      const primeAngle = getMoveGeometry(
        parseMoveNotation(`${notation}'`),
      ).angle;

      expect(primeAngle).toBe(-baseAngle);
    },
  );

  it.each(BASE_MOVES)("%s2 uses a half-turn angle", (notation) => {
    const angle = getMoveGeometry(parseMoveNotation(`${notation}2`)).angle;

    expect(Math.abs(angle)).toBe(Math.PI);
  });

  it.each([
    ["R", "L", [1, 0, 0]],
    ["U", "D", [0, 1, 0]],
    ["F", "B", [0, 0, 1]],
  ] as const)(
    "%s and %s use opposite quarter-turn signs around their positive axis",
    (positiveFace, negativeFace, axis) => {
      const positiveGeometry = getMoveGeometry(
        parseMoveNotation(positiveFace),
      );
      const negativeGeometry = getMoveGeometry(
        parseMoveNotation(negativeFace),
      );

      expect(positiveGeometry.axis).toEqual(axis);
      expect(negativeGeometry.axis).toEqual(axis);
      expect(positiveGeometry.angle).toBe(-Math.PI / 2);
      expect(negativeGeometry.angle).toBe(Math.PI / 2);
    },
  );
});
