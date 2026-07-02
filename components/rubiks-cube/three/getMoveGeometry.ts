import type { Move } from "../../../src/lib/cube";

import type { CubiePosition } from "./constants";

export type RotationAxis = readonly [x: number, y: number, z: number];

export type MoveGeometry = Readonly<{
  axis: RotationAxis;
  angle: number;
  slicePredicate: (position: CubiePosition) => boolean;
}>;

const FACE_AXES = {
  U: [0, 1, 0],
  D: [0, -1, 0],
  L: [-1, 0, 0],
  R: [1, 0, 0],
  F: [0, 0, 1],
  B: [0, 0, -1],
} as const satisfies Record<Move["face"], RotationAxis>;

/**
 * The renderer uses +X Right, +Y Up, and +Z Front. Three.js is right-handed:
 * a positive angle follows the right-hand rule around the returned outward
 * face axis. Viewed from outside while facing that face, a positive Three.js
 * angle is counterclockwise, so a canonical clockwise face turn is negative.
 *
 * Consequently R returns -PI / 2 around +X. Viewed while facing the Right
 * face, the visible R turn is clockwise. Prime turns reverse that direction,
 * and half turns use PI radians (the sign is visually equivalent at PI).
 */
export function getMoveGeometry(move: Move): MoveGeometry {
  const axis = FACE_AXES[move.face];
  const angle = move.amount * (-Math.PI / 2);

  return {
    axis,
    angle,
    slicePredicate: (position) =>
      position[0] * axis[0] +
        position[1] * axis[1] +
        position[2] * axis[2] ===
      1,
  };
}
