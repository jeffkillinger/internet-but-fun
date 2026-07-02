import { serializeCube, type CubeState, type Move } from "@/src/lib/cube";

type DevPanelProps = {
  cube: CubeState;
  scramble: readonly Move[];
  history: readonly Move[];
  solved: boolean;
};

function formatMoves(moves: readonly Move[]) {
  return moves.length > 0
    ? moves.map((move) => move.notation).join(" ")
    : "None";
}

export function DevPanel({
  cube,
  scramble,
  history,
  solved,
}: DevPanelProps) {
  return (
    <details className="rounded border border-zinc-300 bg-zinc-50 p-4">
      <summary className="cursor-pointer font-semibold">Developer state</summary>
      <dl className="mt-4 grid gap-3">
        <div>
          <dt className="font-medium">Serialized cube</dt>
          <dd className="mt-1 break-all font-mono text-sm">
            {serializeCube(cube)}
          </dd>
        </div>
        <div>
          <dt className="font-medium">Scramble</dt>
          <dd className="mt-1 break-words font-mono text-sm">
            {formatMoves(scramble)}
          </dd>
        </div>
        <div>
          <dt className="font-medium">History</dt>
          <dd className="mt-1 break-words font-mono text-sm">
            {formatMoves(history)}
          </dd>
        </div>
        <div>
          <dt className="font-medium">Solved</dt>
          <dd className="mt-1 font-mono text-sm">{String(solved)}</dd>
        </div>
      </dl>
    </details>
  );
}
