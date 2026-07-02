import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import { Group, Vector3 } from "three";

import type { CubeState, Move } from "@/src/lib/cube";

import { getMoveGeometry, type MoveGeometry } from "./getMoveGeometry";
import { CUBIE_POSITIONS, RubiksCube3D } from "./RubiksCube3D";

const QUARTER_TURN_DURATION_SECONDS = 0.3;

type ActiveAnimation = {
  elapsed: number;
  duration: number;
  geometry: MoveGeometry;
};

type AnimatedRubiksCube3DProps = {
  currentCube: CubeState;
  previewCube: CubeState;
  pendingMove: Move | null;
};

function isAnimatedMove(move: Move | null): move is Move {
  return move?.face === "R";
}

export function AnimatedRubiksCube3D({
  currentCube,
  previewCube,
  pendingMove,
}: AnimatedRubiksCube3DProps) {
  const sourceGroup = useRef<Group>(null);
  const sliceGroup = useRef<Group>(null);
  const destinationGroup = useRef<Group>(null);
  const animation = useRef<ActiveAnimation | null>(null);
  const rotationAxis = useRef(new Vector3());
  const previousCurrentCube = useRef(currentCube);

  const geometry = isAnimatedMove(pendingMove)
    ? getMoveGeometry(pendingMove)
    : null;
  const [slicePositions, stationaryPositions] = useMemo(() => {
    if (!geometry) return [[], CUBIE_POSITIONS] as const;

    return [
      CUBIE_POSITIONS.filter(geometry.slicePredicate),
      CUBIE_POSITIONS.filter(
        (position) => !geometry.slicePredicate(position),
      ),
    ] as const;
  }, [geometry]);

  useLayoutEffect(() => {
    const source = sourceGroup.current;
    const slice = sliceGroup.current;
    const destination = destinationGroup.current;
    if (!source || !slice || !destination) return;

    const currentStateUnchanged = previousCurrentCube.current === currentCube;
    const shouldStart =
      currentStateUnchanged && isAnimatedMove(pendingMove);

    animation.current = null;
    slice.rotation.set(0, 0, 0);
    source.visible = shouldStart;
    destination.visible = !shouldStart;

    if (shouldStart) {
      const moveGeometry = getMoveGeometry(pendingMove);
      animation.current = {
        elapsed: 0,
        duration:
          QUARTER_TURN_DURATION_SECONDS * Math.abs(pendingMove.amount),
        geometry: moveGeometry,
      };
    }

    previousCurrentCube.current = currentCube;
  }, [currentCube, pendingMove, previewCube]);

  useFrame((_, delta) => {
    const active = animation.current;
    const slice = sliceGroup.current;
    const source = sourceGroup.current;
    const destination = destinationGroup.current;
    if (!active || !slice || !source || !destination) return;

    active.elapsed = Math.min(active.elapsed + delta, active.duration);
    const progress = active.elapsed / active.duration;
    const [x, y, z] = active.geometry.axis;
    rotationAxis.current.set(x, y, z);
    slice.quaternion.setFromAxisAngle(
      rotationAxis.current,
      active.geometry.angle * progress,
    );

    if (progress === 1) {
      source.visible = false;
      destination.visible = true;
      slice.rotation.set(0, 0, 0);
      animation.current = null;
    }
  });

  return (
    <group>
      <group ref={sourceGroup} visible={false}>
        <RubiksCube3D cube={currentCube} positions={stationaryPositions} />
        <group ref={sliceGroup}>
          <RubiksCube3D cube={currentCube} positions={slicePositions} />
        </group>
      </group>
      <group ref={destinationGroup}>
        <RubiksCube3D cube={previewCube} />
      </group>
    </group>
  );
}
