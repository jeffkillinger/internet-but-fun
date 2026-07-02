"use client";

import { useCallback, useMemo, useState } from "react";

import {
  applyMoves,
  countMoves,
  createSolvedCube,
  generateScramble,
  isSolved,
  type Move,
} from "@/src/lib/cube";

import { CubeNet } from "./CubeNet";
import { DevPanel } from "./DevPanel";
import { MoveControls } from "./MoveControls";
import { MoveHistory } from "./MoveHistory";
import { usePendingMove } from "./usePendingMove";

const DEVELOPMENT_BUTTON =
  "rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50";

export function CubePrototype() {
  const [scramble, setScramble] = useState<Move[]>([]);
  const [history, setHistory] = useState<Move[]>([]);

  const currentCube = useMemo(
    () => applyMoves(applyMoves(createSolvedCube(), scramble), history),
    [scramble, history],
  );
  const commitMove = useCallback((move: Move) => {
    setHistory((moves) => [...moves, move]);
  }, []);
  const {
    pendingMove,
    previewCube,
    selectMove,
    confirmMove,
    cancelMove,
  } = usePendingMove({ currentCube, commitMove });
  const solved = isSolved(currentCube);
  const previewSolved = isSolved(previewCube);
  const moveCount = countMoves(history);

  function handleScramble() {
    cancelMove();
    setScramble(generateScramble(20));
    setHistory([]);
  }

  function handleReset() {
    cancelMove();
    setScramble([]);
    setHistory([]);
  }

  function handleUndo() {
    cancelMove();
    setHistory((moves) => moves.slice(0, -1));
  }

  function handleClearHistory() {
    cancelMove();
    setHistory([]);
  }

  function handleApplySequence(moves: readonly Move[]) {
    cancelMove();
    setHistory((currentHistory) => [...currentHistory, ...moves]);
  }

  return (
    <div className="grid gap-10">
      <section aria-labelledby="cube-net">
        <div className="flex items-center justify-between gap-4">
          <h2 id="cube-net" className="text-lg font-semibold">
            Cube net
          </h2>
          {history.length > 0 && solved ? (
            <p className="font-semibold text-green-700" role="status">
              Solved!
            </p>
          ) : null}
        </div>
        <p className="mt-2 text-sm font-medium text-zinc-600">
          {pendingMove
            ? `Previewing: ${pendingMove.notation}`
            : "Current cube"}
        </p>
        <div className="mt-4 flex justify-center overflow-x-auto">
          <CubeNet currentCube={currentCube} previewCube={previewCube} />
        </div>
      </section>

      <MoveControls
        onMove={selectMove}
        pendingMove={pendingMove}
        onConfirm={confirmMove}
        onCancel={cancelMove}
      />

      <section aria-labelledby="development-controls">
        <h2 id="development-controls" className="text-lg font-semibold">
          Development controls
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleScramble}
            className={DEVELOPMENT_BUTTON}
          >
            Scramble
          </button>
          <button
            type="button"
            onClick={handleReset}
            className={DEVELOPMENT_BUTTON}
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleUndo}
            disabled={history.length === 0}
            className={DEVELOPMENT_BUTTON}
          >
            Undo
          </button>
          <button
            type="button"
            onClick={handleClearHistory}
            disabled={history.length === 0}
            className={DEVELOPMENT_BUTTON}
          >
            Clear History
          </button>
        </div>
      </section>

      <MoveHistory history={history} moveCount={moveCount} />
      <DevPanel
        currentCube={currentCube}
        previewCube={previewCube}
        pendingMove={pendingMove}
        scramble={scramble}
        history={history}
        currentSolved={solved}
        previewSolved={previewSolved}
        onApplySequence={handleApplySequence}
      />
    </div>
  );
}
