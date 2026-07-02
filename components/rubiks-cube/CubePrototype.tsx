"use client";

import { useMemo, useState } from "react";

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

const DEVELOPMENT_BUTTON =
  "rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50";

export function CubePrototype() {
  const [scramble, setScramble] = useState<Move[]>([]);
  const [history, setHistory] = useState<Move[]>([]);

  const cube = useMemo(
    () => applyMoves(applyMoves(createSolvedCube(), scramble), history),
    [scramble, history],
  );
  const solved = isSolved(cube);
  const moveCount = countMoves(history);

  function handleScramble() {
    setScramble(generateScramble(20));
    setHistory([]);
  }

  function handleReset() {
    setScramble([]);
    setHistory([]);
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
        <div className="mt-4 flex justify-center overflow-x-auto">
          <CubeNet cube={cube} />
        </div>
      </section>

      <MoveControls onMove={(move) => setHistory((moves) => [...moves, move])} />

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
            onClick={() => setHistory((moves) => moves.slice(0, -1))}
            disabled={history.length === 0}
            className={DEVELOPMENT_BUTTON}
          >
            Undo
          </button>
          <button
            type="button"
            onClick={() => setHistory([])}
            disabled={history.length === 0}
            className={DEVELOPMENT_BUTTON}
          >
            Clear History
          </button>
        </div>
      </section>

      <MoveHistory history={history} moveCount={moveCount} />
      <DevPanel
        cube={cube}
        scramble={scramble}
        history={history}
        solved={solved}
      />
    </div>
  );
}
