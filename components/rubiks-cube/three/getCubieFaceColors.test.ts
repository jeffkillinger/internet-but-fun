import { describe, expect, it } from "vitest";

import { applyMove, createSolvedCube } from "../../../src/lib/cube";

import { CUBE_COLORS } from "./constants";
import { getCubieFaceColors } from "./getCubieFaceColors";

describe("getCubieFaceColors", () => {
  it("maps every solved exterior face to its canonical color", () => {
    const cube = createSolvedCube();

    expect(getCubieFaceColors(cube, [0, 1, 0]).up).toBe(CUBE_COLORS.up);
    expect(getCubieFaceColors(cube, [0, -1, 0]).down).toBe(CUBE_COLORS.down);
    expect(getCubieFaceColors(cube, [0, 0, 1]).front).toBe(CUBE_COLORS.front);
    expect(getCubieFaceColors(cube, [0, 0, -1]).back).toBe(CUBE_COLORS.back);
    expect(getCubieFaceColors(cube, [1, 0, 0]).right).toBe(CUBE_COLORS.right);
    expect(getCubieFaceColors(cube, [-1, 0, 0]).left).toBe(CUBE_COLORS.left);
  });

  it("maps specific facelets after a single R move without mirroring", () => {
    const cube = applyMove(createSolvedCube(), "R");

    expect(getCubieFaceColors(cube, [1, 1, 1]).front).toBe(CUBE_COLORS.down);
    expect(getCubieFaceColors(cube, [1, 0, 1]).front).toBe(CUBE_COLORS.down);
    expect(getCubieFaceColors(cube, [1, -1, 1]).front).toBe(CUBE_COLORS.down);
    expect(getCubieFaceColors(cube, [1, 1, -1]).up).toBe(CUBE_COLORS.front);
    expect(getCubieFaceColors(cube, [1, 1, 1]).right).toBe(CUBE_COLORS.right);
  });
});
