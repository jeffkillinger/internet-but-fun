import type { Move } from "../../../src/lib/cube";

import type { CubiePosition } from "./constants";

export type RotationAxis = readonly [x: number, y: number, z: number];

export type MoveGeometry = Readonly<{
  axis: RotationAxis;
  angle: number;
  slicePredicate: (position: CubiePosition) => boolean;
}>;

const FACE_GEOMETRY = {
  U: { axis: [0, 1, 0], layer: 1, clockwiseSign: -1 },
  D: { axis: [0, 1, 0], layer: -1, clockwiseSign: 1 },
  L: { axis: [1, 0, 0], layer: -1, clockwiseSign: 1 },
  R: { axis: [1, 0, 0], layer: 1, clockwiseSign: -1 },
  F: { axis: [0, 0, 1], layer: 1, clockwiseSign: -1 },
  B: { axis: [0, 0, 1], layer: -1, clockwiseSign: 1 },
} as const satisfies Record<
  Move["face"],
  {
    axis: RotationAxis;
    layer: -1 | 1;
    clockwiseSign: -1 | 1;
  }
>;

/**
 * The renderer uses +X Right, +Y Up, and +Z Front. Three.js is right-handed:
 * a positive angle follows the right-hand rule around the positive coordinate
 * axis. Clockwise turns of positive-axis faces (R, U, F) therefore use
 * negative angles, while clockwise turns of negative-axis faces (L, D, B)
 * use positive angles.
 *
 * Consequently R returns -PI / 2 around +X. Viewed while facing the Right
 * face, the visible R turn is clockwise. Prime turns reverse that direction,
 * and half turns use PI radians.
 */
export function getMoveGeometry(move: Move): MoveGeometry {
  const { axis, layer, clockwiseSign } = FACE_GEOMETRY[move.face];
  const angle = move.amount * clockwiseSign * (Math.PI / 2);

  return {
    axis,
    angle,
    slicePredicate: (position) =>
      position[0] * axis[0] +
        position[1] * axis[1] +
        position[2] * axis[2] ===
      layer,
  };
}
