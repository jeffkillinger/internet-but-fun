import { CUBIE_COORDINATES, type CubiePosition } from "./constants";
import { Cubie } from "./Cubie";

const CUBIE_POSITIONS: CubiePosition[] = CUBIE_COORDINATES.flatMap((x) =>
  CUBIE_COORDINATES.flatMap((y) =>
    CUBIE_COORDINATES.map((z) => [x, y, z] as CubiePosition),
  ),
);

export function RubiksCube3D() {
  return (
    <group>
      {CUBIE_POSITIONS.map((position) => (
        <Cubie key={position.join(",")} position={position} />
      ))}
    </group>
  );
}
