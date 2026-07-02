import { describe, expect, it } from "vitest";

import type { CubiePosition } from "./constants";
import { getSelectedFace, type FaceNormal } from "./getSelectedFace";

describe("getSelectedFace", () => {
  it.each([
    [[1, 0, 0], "R", [1, 0, 0], 1],
    [[-1, 0, 0], "L", [1, 0, 0], -1],
    [[0, 1, 0], "U", [0, 1, 0], 1],
    [[0, -1, 0], "D", [0, 1, 0], -1],
    [[0, 0, 1], "F", [0, 0, 1], 1],
    [[0, 0, -1], "B", [0, 0, 1], -1],
  ] as const)(
    "maps normal %j to %s",
    (normal, face, axis, layer) => {
      expect(getSelectedFace([0, 0, 0], normal)).toEqual({
        face,
        axis,
        layer,
      });
    },
  );

  it.each([
    [[1, 0, 0], "R"],
    [[0, 1, 0], "U"],
    [[0, 0, 1], "F"],
  ] as const)(
    "uses normal %j rather than the corner position",
    (normal, face) => {
      expect(getSelectedFace([1, 1, 1], normal).face).toBe(face);
    },
  );

  it("returns the same face for different cubie positions", () => {
    const normal: FaceNormal = [0, 0, 1];
    const positions: CubiePosition[] = [
      [-1, -1, 1],
      [0, 0, 1],
      [1, 1, 1],
    ];

    expect(positions.map((position) => getSelectedFace(position, normal).face))
      .toEqual(["F", "F", "F"]);
  });
});
