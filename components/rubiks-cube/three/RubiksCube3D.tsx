import type { CubeState } from "@/src/lib/cube";

import { CUBIE_COORDINATES, type CubiePosition } from "./constants";
import { Cubie } from "./Cubie";

export const CUBIE_POSITIONS: CubiePosition[] = CUBIE_COORDINATES.flatMap((x) =>
  CUBIE_COORDINATES.flatMap((y) =>
    CUBIE_COORDINATES.map((z) => [x, y, z] as CubiePosition),
  ),
);

type RubiksCube3DProps = {
  cube: CubeState;
  positions?: readonly CubiePosition[];
};

export function RubiksCube3D({
  cube,
  positions = CUBIE_POSITIONS,
}: RubiksCube3DProps) {
  return (
    <group>
      {positions.map((position) => (
        <Cubie key={position.join(",")} cube={cube} position={position} />
      ))}
    </group>
  );
}
