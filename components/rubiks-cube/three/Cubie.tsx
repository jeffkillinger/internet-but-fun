import type { ThreeEvent } from "@react-three/fiber";

import type { CubeState } from "@/src/lib/cube";

import {
  BOX_MATERIAL_FACES,
  CUBIE_SIZE,
  type CubiePosition,
} from "./constants";
import { getCubieFaceColors } from "./getCubieFaceColors";
import {
  getSelectedFace,
  isCubieOnSelectedFace,
  type SelectedFace,
} from "./getSelectedFace";

type CubieProps = {
  cube: CubeState;
  position: CubiePosition;
  selectedFace: SelectedFace | null;
  onSelectFace: (selectedFace: SelectedFace) => void;
};

export function Cubie({
  cube,
  position,
  selectedFace,
  onSelectFace,
}: CubieProps) {
  const faceColors = getCubieFaceColors(cube, position);
  const isSelected =
    selectedFace !== null && isCubieOnSelectedFace(position, selectedFace);

  function handleClick(event: ThreeEvent<MouseEvent>) {
    if (event.delta > 2 || !event.face) return;

    event.stopPropagation();
    const { x, y, z } = event.face.normal;
    onSelectFace(getSelectedFace(position, [x, y, z]));
  }

  return (
    <mesh position={position} onClick={handleClick}>
      <boxGeometry args={[CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE]} />
      {BOX_MATERIAL_FACES.map((face, materialIndex) => (
        <meshStandardMaterial
          key={face}
          attach={`material-${materialIndex}`}
          color={faceColors[face]}
          emissive={isSelected ? "#7c3aed" : "#000000"}
          emissiveIntensity={isSelected ? 0.45 : 0}
          roughness={0.5}
        />
      ))}
    </mesh>
  );
}
