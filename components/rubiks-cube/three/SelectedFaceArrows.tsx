import type { ThreeEvent } from "@react-three/fiber";
import { Quaternion, Vector3 } from "three";

import type { Move } from "@/src/lib/cube";

import {
  getArrowAffordancesForFace,
  type ArrowAffordance,
} from "./getArrowAffordancesForFace";
import type { SelectedFace } from "./getSelectedFace";

const UP = new Vector3(0, 1, 0);

type SelectedFaceArrowsProps = {
  selectedFace: SelectedFace;
  onSelectMove: (move: Move) => void;
};

type TurnArrowProps = {
  affordance: ArrowAffordance;
  onSelectMove: (move: Move) => void;
};

function TurnArrow({ affordance, onSelectMove }: TurnArrowProps) {
  const quaternion = new Quaternion().setFromUnitVectors(
    UP,
    new Vector3(...affordance.travelDirection),
  );
  const color =
    affordance.direction === "clockwise" ? "#0891b2" : "#db2777";

  function handleClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    if (event.delta > 2) return;

    onSelectMove(affordance.move);
  }

  return (
    <group
      position={affordance.position}
      quaternion={quaternion}
      onClick={handleClick}
      name={`${affordance.move.face}-${affordance.direction}-arrow`}
    >
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.075, 0.075, 0.65, 16]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.38, 0]}>
        <coneGeometry args={[0.2, 0.32, 20]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 1.15, 12]} />
        <meshBasicMaterial
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

export function SelectedFaceArrows({
  selectedFace,
  onSelectMove,
}: SelectedFaceArrowsProps) {
  const affordances = getArrowAffordancesForFace(selectedFace.face);

  return (
    <group name={`${selectedFace.face}-turn-affordances`}>
      {affordances.map((affordance) => (
        <TurnArrow
          key={affordance.direction}
          affordance={affordance}
          onSelectMove={onSelectMove}
        />
      ))}
    </group>
  );
}
