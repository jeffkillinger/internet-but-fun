import { FormEvent, useState } from "react";

import {
  hashCubeState,
  parseMoveNotation,
  serializeCube,
  type CubeState,
  type Move,
} from "@/src/lib/cube";

type DevPanelProps = {
  currentCube: CubeState;
  previewCube: CubeState;
  pendingMove: Move | null;
  scramble: readonly Move[];
  history: readonly Move[];
  currentSolved: boolean;
  previewSolved: boolean;
  onApplySequence: (moves: readonly Move[]) => void;
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
  onApplySequence,
}: DevPanelProps) {
  const [sequence, setSequence] = useState("");
  const [sequenceError, setSequenceError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const serializedCurrentCube = serializeCube(currentCube);
  const serializedPreviewCube = serializeCube(previewCube);

  function handleSequenceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const tokens = sequence.trim().split(/\s+/).filter(Boolean);

    if (tokens.length === 0) {
      setSequenceError("Enter at least one move.");
      return;
    }

    try {
      const moves = tokens.map((token) =>
        parseMoveNotation(token.toUpperCase()),
      );
      onApplySequence(moves);
      setSequence("");
      setSequenceError(null);
    } catch (error) {
      setSequenceError(
        error instanceof Error ? error.message : "Invalid move sequence.",
      );
    }
  }

  async function handleCopyState() {
    try {
      await navigator.clipboard.writeText(serializedCurrentCube);
      setCopyStatus("Copied");
    } catch {
      setCopyStatus("Copy failed");
    }
  }

  return (
    <details className="rounded border border-zinc-300 bg-zinc-50 p-4">
      <summary className="cursor-pointer font-semibold">Developer state</summary>
      <form className="mt-4 grid gap-2" onSubmit={handleSequenceSubmit}>
        <label className="font-medium" htmlFor="debug-move-sequence">
          Move sequence
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id="debug-move-sequence"
            type="text"
            value={sequence}
            onChange={(event) => {
              setSequence(event.target.value);
              setSequenceError(null);
            }}
            placeholder="R U R' U'"
            className="min-w-64 flex-1 rounded border border-zinc-300 bg-white px-3 py-2 font-mono text-sm"
            aria-describedby={sequenceError ? "move-sequence-error" : undefined}
            aria-invalid={sequenceError ? true : undefined}
          />
          <button
            type="submit"
            className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-100"
          >
            Apply Sequence
          </button>
        </div>
        {sequenceError ? (
          <p id="move-sequence-error" className="text-sm text-red-700" role="alert">
            {sequenceError}
          </p>
        ) : null}
      </form>
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
            {serializedCurrentCube}
          </dd>
          <button
            type="button"
            onClick={handleCopyState}
            className="mt-2 rounded border border-zinc-300 bg-white px-2 py-1 text-sm font-medium hover:bg-zinc-100"
          >
            Copy Serialized State
          </button>
          {copyStatus ? (
            <span className="ml-2 text-sm text-zinc-600" role="status">
              {copyStatus}
            </span>
          ) : null}
        </div>
        <div>
          <dt className="font-medium">Current state hash (authoritative)</dt>
          <dd className="mt-1 font-mono text-sm">
            {hashCubeState(serializedCurrentCube)}
          </dd>
        </div>
        <div>
          <dt className="font-medium">Preview cube (temporary, serialized)</dt>
          <dd className="mt-1 break-all font-mono text-sm">
            {serializedPreviewCube}
          </dd>
        </div>
        <div>
          <dt className="font-medium">Preview state hash (temporary)</dt>
          <dd className="mt-1 font-mono text-sm">
            {hashCubeState(serializedPreviewCube)}
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
