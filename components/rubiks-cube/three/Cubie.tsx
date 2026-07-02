import {
  BOX_MATERIAL_FACES,
  CUBIE_SIZE,
  type CubiePosition,
} from "./constants";
import { getCubieFaceColors } from "./getCubieFaceColors";

type CubieProps = {
  position: CubiePosition;
};

export function Cubie({ position }: CubieProps) {
  const faceColors = getCubieFaceColors(position);

  return (
    <mesh position={position}>
      <boxGeometry args={[CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE]} />
      {BOX_MATERIAL_FACES.map((face, materialIndex) => (
        <meshStandardMaterial
          key={face}
          attach={`material-${materialIndex}`}
          color={faceColors[face]}
          roughness={0.5}
        />
      ))}
    </mesh>
  );
}
