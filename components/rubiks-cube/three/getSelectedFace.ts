import type { Face } from "@/src/lib/cube";

import type { CubiePosition } from "./constants";

export type FaceNormal = readonly [x: number, y: number, z: number];

export type SelectedFace = Readonly<{
  face: Face;
  axis: FaceNormal;
  layer: -1 | 1;
}>;

const SELECTED_FACES: Readonly<Record<Face, SelectedFace>> = {
  U: { face: "U", axis: [0, 1, 0], layer: 1 },
  D: { face: "D", axis: [0, 1, 0], layer: -1 },
  L: { face: "L", axis: [1, 0, 0], layer: -1 },
  R: { face: "R", axis: [1, 0, 0], layer: 1 },
  F: { face: "F", axis: [0, 0, 1], layer: 1 },
  B: { face: "B", axis: [0, 0, 1], layer: -1 },
};

/**
 * Maps a raycast face normal to a canonical cube face. Position is accepted
 * as hit context for future interaction work but does not determine selection.
 */
export function getSelectedFace(
  position: CubiePosition,
  faceNormal: FaceNormal,
): SelectedFace {
  void position;

  const [x, y, z] = faceNormal;
  const absoluteComponents = [Math.abs(x), Math.abs(y), Math.abs(z)];
  const largestComponent = Math.max(...absoluteComponents);

  if (largestComponent === 0) {
    throw new Error("A face normal must have a non-zero component.");
  }

  if (absoluteComponents[0] === largestComponent) {
    return x > 0 ? SELECTED_FACES.R : SELECTED_FACES.L;
  }

  if (absoluteComponents[1] === largestComponent) {
    return y > 0 ? SELECTED_FACES.U : SELECTED_FACES.D;
  }

  return z > 0 ? SELECTED_FACES.F : SELECTED_FACES.B;
}

export function isCubieOnSelectedFace(
  position: CubiePosition,
  selectedFace: SelectedFace,
): boolean {
  const [x, y, z] = position;
  const [axisX, axisY, axisZ] = selectedFace.axis;

  return x * axisX + y * axisY + z * axisZ === selectedFace.layer;
}
