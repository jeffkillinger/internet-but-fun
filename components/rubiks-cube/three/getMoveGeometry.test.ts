import { describe, expect, it } from "vitest";

import { parseMoveNotation } from "../../../src/lib/cube";

import { CUBIE_COORDINATES, type CubiePosition } from "./constants";
import { getMoveGeometry } from "./getMoveGeometry";

const CUBIE_POSITIONS: CubiePosition[] = CUBIE_COORDINATES.flatMap((x) =>
  CUBIE_COORDINATES.flatMap((y) =>
    CUBIE_COORDINATES.map((z) => [x, y, z] as CubiePosition),
  ),
);

describe("getMoveGeometry", () => {
  it.each(["R", "U", "F"] as const)(
    "%s selects exactly nine cubies",
    (notation) => {
      const geometry = getMoveGeometry(parseMoveNotation(notation));

      expect(CUBIE_POSITIONS.filter(geometry.slicePredicate)).toHaveLength(9);
    },
  );

  it("rotates R around the positive X axis", () => {
    expect(getMoveGeometry(parseMoveNotation("R")).axis).toEqual([1, 0, 0]);
  });

  it("uses opposite angles for R and R prime", () => {
    const rAngle = getMoveGeometry(parseMoveNotation("R")).angle;
    const rPrimeAngle = getMoveGeometry(parseMoveNotation("R'")).angle;

    expect(rPrimeAngle).toBe(-rAngle);
  });

  it("uses a half-turn angle for R2", () => {
    expect(Math.abs(getMoveGeometry(parseMoveNotation("R2")).angle)).toBe(
      Math.PI,
    );
  });
});
