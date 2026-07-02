import { Html } from "@react-three/drei";

import type { Face } from "@/src/lib/cube";

const FACE_LABELS: ReadonlyArray<{
  face: Face;
  position: [number, number, number];
}> = [
  { face: "U", position: [0, 1.85, 0] },
  { face: "D", position: [0, -1.85, 0] },
  { face: "F", position: [0, 0, 1.85] },
  { face: "B", position: [0, 0, -1.85] },
  { face: "R", position: [1.85, 0, 0] },
  { face: "L", position: [-1.85, 0, 0] },
];

export function CanonicalFaceLabels() {
  return (
    <group>
      {FACE_LABELS.map(({ face, position }) => (
        <Html
          key={face}
          position={position}
          center
          occlude
          pointerEvents="none"
        >
          <span className="select-none rounded-md bg-zinc-950/90 px-2 py-1 text-sm font-bold text-white shadow-md ring-1 ring-white/80">
            {face}
          </span>
        </Html>
      ))}
    </group>
  );
}
