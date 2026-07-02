import type { CubeState } from "@/src/lib/cube";

import { CUBIE_COORDINATES, type CubiePosition } from "./constants";
import { Cubie } from "./Cubie";

const CUBIE_POSITIONS: CubiePosition[] = CUBIE_COORDINATES.flatMap((x) =>
  CUBIE_COORDINATES.flatMap((y) =>
    CUBIE_COORDINATES.map((z) => [x, y, z] as CubiePosition),
  ),
);

type RubiksCube3DProps = {
  cube: CubeState;
};

export function RubiksCube3D({ cube }: RubiksCube3DProps) {
  return (
    <group>
      {CUBIE_POSITIONS.map((position) => (
        <Cubie key={position.join(",")} cube={cube} position={position} />
      ))}
    </group>
  );
}
