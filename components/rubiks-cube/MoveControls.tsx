import {
  parseMoveNotation,
  type Move,
  type MoveNotation,
} from "@/src/lib/cube";

const FACE_ORDER = ["U", "D", "L", "R", "F", "B"] as const;
const SUFFIXES = ["", "'", "2"] as const;

type MoveControlsProps = {
  onMove: (move: Move) => void;
};

export function MoveControls({ onMove }: MoveControlsProps) {
  return (
    <section aria-labelledby="move-controls">
      <h2 id="move-controls" className="text-lg font-semibold">
        Moves
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FACE_ORDER.map((face) => (
          <div key={face} className="grid grid-cols-3 gap-2">
            {SUFFIXES.map((suffix) => {
              const notation = `${face}${suffix}` as MoveNotation;
              return (
                <button
                  key={notation}
                  type="button"
                  onClick={() => onMove(parseMoveNotation(notation))}
                  className="rounded border border-zinc-300 bg-white px-3 py-2 font-mono text-sm hover:bg-zinc-100"
                >
                  {notation}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
