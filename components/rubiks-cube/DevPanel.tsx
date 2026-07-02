import { serializeCube, type CubeState, type Move } from "@/src/lib/cube";

type DevPanelProps = {
  currentCube: CubeState;
  previewCube: CubeState;
  pendingMove: Move | null;
  scramble: readonly Move[];
  history: readonly Move[];
  currentSolved: boolean;
  previewSolved: boolean;
};

function formatMoves(moves: readonly Move[]) {
  return moves.length > 0
    ? moves.map((move) => move.notation).join(" ")
    : "None";
}

export function DevPanel({
  currentCube,
  previewCube,
  pendingMove,
  scramble,
  history,
  currentSolved,
  previewSolved,
}: DevPanelProps) {
  return (
    <details className="rounded border border-zinc-300 bg-zinc-50 p-4">
      <summary className="cursor-pointer font-semibold">Developer state</summary>
      <dl className="mt-4 grid gap-3">
        <div>
          <dt className="font-medium">Pending move (temporary)</dt>
          <dd className="mt-1 font-mono text-sm">
            {pendingMove?.notation ?? "None"}
          </dd>
        </div>
        <div>
          <dt className="font-medium">
            Current cube (authoritative, serialized)
          </dt>
          <dd className="mt-1 break-all font-mono text-sm">
            {serializeCube(currentCube)}
          </dd>
        </div>
        <div>
          <dt className="font-medium">Preview cube (temporary, serialized)</dt>
          <dd className="mt-1 break-all font-mono text-sm">
            {serializeCube(previewCube)}
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
          <dt className="font-medium">Current cube solved (authoritative)</dt>
          <dd className="mt-1 font-mono text-sm">{String(currentSolved)}</dd>
        </div>
        <div>
          <dt className="font-medium">Preview cube solved (temporary)</dt>
          <dd className="mt-1 font-mono text-sm">{String(previewSolved)}</dd>
        </div>
      </dl>
    </details>
  );
}
