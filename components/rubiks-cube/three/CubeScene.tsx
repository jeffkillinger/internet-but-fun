"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useCallback, useEffect, useRef } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import type { CubeState, Move } from "@/src/lib/cube";

import { AnimatedRubiksCube3D } from "./AnimatedRubiksCube3D";
import { CanonicalFaceLabels } from "./CanonicalFaceLabels";
import type { SelectedFace } from "./getSelectedFace";

type CubeSceneProps = {
  currentCube: CubeState;
  previewCube: CubeState;
  pendingMove: Move | null;
  selectedFace: SelectedFace | null;
  onSelectFace: (selectedFace: SelectedFace | null) => void;
};

export default function CubeScene({
  currentCube,
  previewCube,
  pendingMove,
  selectedFace,
  onSelectFace,
}: CubeSceneProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);

  useEffect(() => {
    controlsRef.current?.saveState();
  }, []);

  const resetView = useCallback(() => {
    controlsRef.current?.reset();
  }, []);

  return (
    <div className="relative h-80 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
      <Canvas
        camera={{ position: [5, 5, 7], fov: 45 }}
        onPointerMissed={() => onSelectFace(null)}
      >
        <ambientLight intensity={1.5} />
        <directionalLight position={[4, 5, 3]} intensity={2.5} />
        <AnimatedRubiksCube3D
          currentCube={currentCube}
          previewCube={previewCube}
          pendingMove={pendingMove}
          selectedFace={selectedFace}
          onSelectFace={onSelectFace}
        />
        <CanonicalFaceLabels />
        <OrbitControls ref={controlsRef} enablePan={false} />
      </Canvas>
      <button
        type="button"
        onClick={resetView}
        className="absolute top-3 right-3 rounded-md border border-zinc-300 bg-white/95 px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
      >
        Reset View
      </button>
    </div>
  );
}
