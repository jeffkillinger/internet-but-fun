import {
  parseMoveNotation,
  type Move,
  type MoveNotation,
} from "@/src/lib/cube";

const FACE_ORDER = ["U", "D", "L", "R", "F", "B"] as const;
const SUFFIXES = ["", "'", "2"] as const;

type MoveControlsProps = {
  onMove: (move: Move) => void;
  pendingMove: Move | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export function MoveControls({
  onMove,
  pendingMove,
  onConfirm,
  onCancel,
}: MoveControlsProps) {
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
                  aria-pressed={pendingMove?.notation === notation}
                  className={`rounded border px-3 py-2 font-mono text-sm ${
                    pendingMove?.notation === notation
                      ? "border-fuchsia-700 bg-fuchsia-100 text-fuchsia-950"
                      : "border-zinc-300 bg-white hover:bg-zinc-100"
                  }`}
                >
                  {notation}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={!pendingMove}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Confirm Move
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={!pendingMove}
          className="rounded border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}
