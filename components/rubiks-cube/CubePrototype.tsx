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
import { DynamicCubeScene } from "./three/DynamicCubeScene";
import type { PendingAnimationIntent } from "./three/animationIntent";
import type { ArrowDirection } from "./three/getArrowAffordancesForFace";
import { getNextArrowPreview } from "./three/getNextArrowPreview";
import type { SelectedFace } from "./three/getSelectedFace";
import { usePendingMove } from "./usePendingMove";

const DEVELOPMENT_BUTTON =
  "rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50";

export function CubePrototype() {
  const [scramble, setScramble] = useState<Move[]>([]);
  const [history, setHistory] = useState<Move[]>([]);
  const [selectedFace, setSelectedFace] = useState<SelectedFace | null>(null);
  const [pendingAnimationIntent, setPendingAnimationIntent] =
    useState<PendingAnimationIntent | null>(null);

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
  const activePendingAnimationIntent =
    pendingMove &&
    pendingAnimationIntent?.moveNotation === pendingMove.notation
      ? pendingAnimationIntent
      : null;
  const arrowDoubleTurnHint =
    pendingMove &&
    activePendingAnimationIntent &&
    selectedFace?.face === pendingMove.face &&
    Math.abs(pendingMove.amount) === 1
      ? `Tap the same arrow again for ${pendingMove.face}2.`
      : null;

  function handleSelectMove(move: Move) {
    setSelectedFace(null);
    setPendingAnimationIntent(null);
    selectMove(move);
  }

  function handleSelectArrow(direction: ArrowDirection) {
    if (!selectedFace) return;

    const nextPreview = getNextArrowPreview(
      selectedFace.face,
      direction,
      pendingMove,
    );

    setPendingAnimationIntent(nextPreview.animationIntent);
    selectMove(nextPreview.move);
  }

  function handleConfirmMove() {
    setSelectedFace(null);
    setPendingAnimationIntent(null);
    confirmMove();
  }

  function handleCancelMove() {
    setSelectedFace(null);
    setPendingAnimationIntent(null);
    cancelMove();
  }

  function handleScramble() {
    setSelectedFace(null);
    setPendingAnimationIntent(null);
    cancelMove();
    setScramble(generateScramble(20));
    setHistory([]);
  }

  function handleReset() {
    setSelectedFace(null);
    setPendingAnimationIntent(null);
    cancelMove();
    setScramble([]);
    setHistory([]);
  }

  function handleUndo() {
    setSelectedFace(null);
    setPendingAnimationIntent(null);
    cancelMove();
    setHistory((moves) => moves.slice(0, -1));
  }

  function handleClearHistory() {
    setSelectedFace(null);
    setPendingAnimationIntent(null);
    cancelMove();
    setHistory([]);
  }

  function handleApplySequence(moves: readonly Move[]) {
    setSelectedFace(null);
    setPendingAnimationIntent(null);
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
        {arrowDoubleTurnHint ? (
          <p className="mt-1 text-sm text-zinc-500">{arrowDoubleTurnHint}</p>
        ) : null}
        <div className="mt-4 flex justify-center overflow-x-auto">
          <CubeNet currentCube={currentCube} previewCube={previewCube} />
        </div>
      </section>

      <section aria-labelledby="experimental-cube-scene">
        <h2 id="experimental-cube-scene" className="text-lg font-semibold">
          Experimental 3D scene
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          Derived from the same cube state as the net. Pending move previews
          animate; other state changes snap to their resulting state.
        </p>
        <p className="mt-2 max-w-2xl text-sm text-zinc-500">
          Moves are cube-relative. R always turns the cube&apos;s Right face,
          even if you rotate the camera. Use Reset View to return to the
          canonical orientation.
        </p>
        <div className="mt-4">
          <DynamicCubeScene
            currentCube={currentCube}
            previewCube={previewCube}
            pendingMove={pendingMove}
            pendingAnimationIntent={activePendingAnimationIntent}
            selectedFace={selectedFace}
            onSelectFace={setSelectedFace}
            onSelectArrow={handleSelectArrow}
          />
        </div>
      </section>

      <MoveControls
        onMove={handleSelectMove}
        pendingMove={pendingMove}
        onConfirm={handleConfirmMove}
        onCancel={handleCancelMove}
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
