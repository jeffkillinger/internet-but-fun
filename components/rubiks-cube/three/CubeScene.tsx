"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";

import type { CubeState, Move } from "@/src/lib/cube";

import { AnimatedRubiksCube3D } from "./AnimatedRubiksCube3D";

type CubeSceneProps = {
  currentCube: CubeState;
  previewCube: CubeState;
  pendingMove: Move | null;
};

export default function CubeScene({
  currentCube,
  previewCube,
  pendingMove,
}: CubeSceneProps) {
  return (
    <div className="h-80 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
      <Canvas camera={{ position: [5, 5, 7], fov: 45 }}>
        <ambientLight intensity={1.5} />
        <directionalLight position={[4, 5, 3]} intensity={2.5} />
        <AnimatedRubiksCube3D
          currentCube={currentCube}
          previewCube={previewCube}
          pendingMove={pendingMove}
        />
        <OrbitControls enablePan={false} />
      </Canvas>
    </div>
  );
}
