import { FACES, type CubeState, type Face } from "@/src/lib/cube";

import { Sticker } from "./Sticker";

const FACE_POSITIONS: Readonly<Record<Face, string>> = {
  U: "col-start-4 row-start-1",
  L: "col-start-1 row-start-4",
  F: "col-start-4 row-start-4",
  R: "col-start-7 row-start-4",
  B: "col-start-10 row-start-4",
  D: "col-start-4 row-start-7",
};

type CubeNetProps = {
  currentCube: CubeState;
  previewCube: CubeState;
};

export function CubeNet({ currentCube, previewCube }: CubeNetProps) {
  return (
    <div
      className="grid w-full max-w-xl grid-cols-12 grid-rows-9 gap-0.5"
      role="img"
      aria-label="Unfolded Rubik's Cube net"
    >
      {FACES.map((face, faceIndex) => (
        <div
          key={face}
          className={`col-span-3 row-span-3 grid grid-cols-3 gap-0.5 rounded bg-zinc-900 p-0.5 ${FACE_POSITIONS[face]}`}
          aria-label={`${face} face`}
        >
          {previewCube
            .slice(faceIndex * 9, faceIndex * 9 + 9)
            .map((color, index) => {
              const cubeIndex = faceIndex * 9 + index;
              return (
                <Sticker
                  key={`${face}-${index}`}
                  color={color}
                  position={index}
                  highlighted={
                    currentCube[cubeIndex] !== previewCube[cubeIndex]
                  }
                />
              );
            })}
        </div>
      ))}
    </div>
  );
}
