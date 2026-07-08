import type { ThreeEvent } from "@react-three/fiber";
import { CatmullRomCurve3, Quaternion, Vector3 } from "three";

import {
  getArrowAffordancesForFace,
  type ArrowAffordance,
  type ArrowDirection,
} from "./getArrowAffordancesForFace";
import type { FaceNormal, SelectedFace } from "./getSelectedFace";

const ARROW_PLANE_OFFSET = 1.72;
const ARROW_RADIUS = 1.82;
const ARC_SEGMENTS = 24;
const UP = new Vector3(0, 1, 0);

type SelectedFaceArrowsProps = {
  selectedFace: SelectedFace;
  onSelectArrow: (direction: ArrowDirection) => void;
};

type TurnArrowProps = {
  affordance: ArrowAffordance;
  onSelectArrow: (direction: ArrowDirection) => void;
};

function scaledVector(
  [x, y, z]: FaceNormal,
  scale: number,
): Vector3 {
  return new Vector3(x * scale, y * scale, z * scale);
}

function getArcCurve(affordance: ArrowAffordance) {
  const center = scaledVector(affordance.normal, ARROW_PLANE_OFFSET);
  const right = new Vector3(...affordance.right);
  const up = new Vector3(...affordance.up);
  const points = Array.from({ length: ARC_SEGMENTS + 1 }, (_, index) => {
    const progress = index / ARC_SEGMENTS;
    const angle =
      affordance.startAngle +
      (affordance.endAngle - affordance.startAngle) * progress;

    return center
      .clone()
      .addScaledVector(right, Math.cos(angle) * ARROW_RADIUS)
      .addScaledVector(up, Math.sin(angle) * ARROW_RADIUS);
  });

  return new CatmullRomCurve3(points);
}

function stopPointerEvent(event: ThreeEvent<PointerEvent>) {
  event.stopPropagation();
}

function TurnArrow({ affordance, onSelectArrow }: TurnArrowProps) {
  const curve = getArcCurve(affordance);
  const arrowheadDirection = curve.getTangent(1).normalize();
  const arrowheadPosition = curve
    .getPoint(1)
    .addScaledVector(arrowheadDirection, 0.1);
  const arrowheadQuaternion = new Quaternion().setFromUnitVectors(
    UP,
    arrowheadDirection,
  );
  const color =
    affordance.direction === "clockwise" ? "#0891b2" : "#db2777";

  function handleClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    if (event.delta > 2) return;

    onSelectArrow(affordance.direction);
  }

  return (
    <group
      onClick={handleClick}
      onPointerDown={stopPointerEvent}
      onPointerUp={stopPointerEvent}
      name={`${affordance.move.face}-${affordance.direction}-arrow`}
    >
      <mesh>
        <tubeGeometry args={[curve, 40, 0.055, 10, false]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh
        position={arrowheadPosition}
        quaternion={arrowheadQuaternion}
      >
        <coneGeometry args={[0.2, 0.38, 20]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh>
        <tubeGeometry args={[curve, 32, 0.2, 8, false]} />
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
  onSelectArrow,
}: SelectedFaceArrowsProps) {
  const affordances = getArrowAffordancesForFace(selectedFace.face);

  return (
    <group name={`${selectedFace.face}-turn-affordances`}>
      {affordances.map((affordance) => (
        <TurnArrow
          key={affordance.direction}
          affordance={affordance}
          onSelectArrow={onSelectArrow}
        />
      ))}
    </group>
  );
}
