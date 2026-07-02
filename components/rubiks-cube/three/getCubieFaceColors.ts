import { FACES, type CubeState } from "../../../src/lib/cube";

import {
  CANONICAL_FACE_OFFSETS,
  CANONICAL_FACE_TO_CUBE_FACE,
  CANONICAL_STICKER_COLORS,
  CUBE_COLORS,
  FACELET_POSITIONS,
  type CubeFace,
  type CubiePosition,
} from "./constants";

export type CubieFaceColors = Record<CubeFace, string>;

/**
 * Maps canonical facelets onto the visible faces of one world-space cubie.
 * Non-exterior faces remain neutral; no render transform state is involved.
 */
export function getCubieFaceColors(
  cube: CubeState,
  position: CubiePosition,
): CubieFaceColors {
  const colors: CubieFaceColors = {
    right: CUBE_COLORS.interior,
    left: CUBE_COLORS.interior,
    up: CUBE_COLORS.interior,
    down: CUBE_COLORS.interior,
    front: CUBE_COLORS.interior,
    back: CUBE_COLORS.interior,
  };

  for (const face of FACES) {
    const faceletIndex = FACELET_POSITIONS[face].findIndex(
      ([x, y, z]) =>
        x === position[0] && y === position[1] && z === position[2],
    );

    if (faceletIndex !== -1) {
      const sticker = cube[CANONICAL_FACE_OFFSETS[face] + faceletIndex];
      colors[CANONICAL_FACE_TO_CUBE_FACE[face]] =
        CANONICAL_STICKER_COLORS[sticker];
    }
  }

  return colors;
}
