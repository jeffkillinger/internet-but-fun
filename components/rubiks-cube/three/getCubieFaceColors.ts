import {
  CUBE_COLORS,
  type CubeFace,
  type CubiePosition,
} from "./constants";

export type CubieFaceColors = Record<CubeFace, string>;

/**
 * Returns the solved exterior colors for a cubie at a world-space position.
 *
 * This is the rendering seam for cube state. A later milestone will extend it
 * to accept canonical cube state; the 3D components should remain unaware of
 * how sticker colors are derived.
 */
export function getCubieFaceColors([
  x,
  y,
  z,
]: CubiePosition): CubieFaceColors {
  return {
    right: x === 1 ? CUBE_COLORS.right : CUBE_COLORS.interior,
    left: x === -1 ? CUBE_COLORS.left : CUBE_COLORS.interior,
    up: y === 1 ? CUBE_COLORS.up : CUBE_COLORS.interior,
    down: y === -1 ? CUBE_COLORS.down : CUBE_COLORS.interior,
    front: z === 1 ? CUBE_COLORS.front : CUBE_COLORS.interior,
    back: z === -1 ? CUBE_COLORS.back : CUBE_COLORS.interior,
  };
}
