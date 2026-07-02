"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";

import { RubiksCube3D } from "./RubiksCube3D";

export default function CubeScene() {
  return (
    <div className="h-80 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
      <Canvas camera={{ position: [5, 5, 7], fov: 45 }}>
        <ambientLight intensity={1.5} />
        <directionalLight position={[4, 5, 3]} intensity={2.5} />
        <RubiksCube3D />
        <OrbitControls enablePan={false} />
      </Canvas>
    </div>
  );
}
