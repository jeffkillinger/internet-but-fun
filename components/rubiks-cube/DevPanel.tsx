import { FormEvent, useState } from "react";

import {
  applyMoves,
  createSolvedCube,
  hashCubeState,
  parseMoveNotation,
  serializeCube,
  type CubeState,
  type Move,
  type MoveNotation,
} from "@/src/lib/cube";
import type { StatusFullResponse } from "@/src/lib/api/types";

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

type ServerStatusProbe =
  | {
      status: "idle" | "loading";
    }
  | {
      status: "success";
      epochId: string;
      scramble: MoveNotation[];
      serializedCube: string;
      localHash: string;
      serverHash: string;
      hashesMatch: boolean;
    }
  | {
      status: "error";
      message: string;
    };

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
  const [serverStatusProbe, setServerStatusProbe] =
    useState<ServerStatusProbe>({ status: "idle" });
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

  async function handleLoadStatusFull() {
    setServerStatusProbe({ status: "loading" });

    try {
      const response = await fetch("/api/rubiks-cube/status?gameId=rubiks-cube");
      if (!response.ok) {
        throw new Error(`StatusFull request failed with ${response.status}.`);
      }

      const status = (await response.json()) as StatusFullResponse;
      const reconstructedCube = applyMoves(createSolvedCube(), status.scramble);
      const serializedCube = serializeCube(reconstructedCube);
      const localHash = hashCubeState(serializedCube);

      setServerStatusProbe({
        status: "success",
        epochId: status.epochId,
        scramble: status.scramble,
        serializedCube,
        localHash,
        serverHash: status.stateHash,
        hashesMatch: localHash === status.stateHash,
      });
    } catch (error) {
      setServerStatusProbe({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "StatusFull verification failed.",
      });
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
          <dt className="font-medium">Server StatusFull probe</dt>
          <dd className="mt-2">
            <button
              type="button"
              onClick={handleLoadStatusFull}
              disabled={serverStatusProbe.status === "loading"}
              className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Load StatusFull from Server
            </button>
            {serverStatusProbe.status === "loading" ? (
              <p className="mt-2 text-sm text-zinc-600" role="status">
                Loading
              </p>
            ) : null}
            {serverStatusProbe.status === "error" ? (
              <p className="mt-2 text-sm text-red-700" role="alert">
                {serverStatusProbe.message}
              </p>
            ) : null}
            {serverStatusProbe.status === "success" ? (
              <dl className="mt-3 grid gap-2 text-sm">
                <div>
                  <dt className="font-medium">Epoch ID</dt>
                  <dd className="mt-1 break-all font-mono">
                    {serverStatusProbe.epochId}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium">Returned scramble</dt>
                  <dd className="mt-1 break-words font-mono">
                    {serverStatusProbe.scramble.join(" ")}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium">Reconstructed cube</dt>
                  <dd className="mt-1 break-all font-mono">
                    {serverStatusProbe.serializedCube}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium">Local hash</dt>
                  <dd className="mt-1 font-mono">
                    {serverStatusProbe.localHash}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium">Server hash</dt>
                  <dd className="mt-1 font-mono">
                    {serverStatusProbe.serverHash}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium">Hashes match</dt>
                  <dd className="mt-1 font-mono">
                    {String(serverStatusProbe.hashesMatch)}
                  </dd>
                </div>
              </dl>
            ) : null}
          </dd>
        </div>
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
