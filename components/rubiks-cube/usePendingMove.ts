import { useCallback, useMemo, useState } from "react";

import { applyMove, type CubeState, type Move } from "@/src/lib/cube";

type UsePendingMoveOptions = {
  currentCube: CubeState;
  commitMove: (move: Move) => void;
};

export function usePendingMove({
  currentCube,
  commitMove,
}: UsePendingMoveOptions) {
  const [pendingMove, setPendingMove] = useState<Move | null>(null);

  const previewCube = useMemo(
    () => (pendingMove ? applyMove(currentCube, pendingMove) : currentCube),
    [currentCube, pendingMove],
  );

  const selectMove = useCallback((move: Move) => {
    setPendingMove(move);
  }, []);

  const confirmMove = useCallback(() => {
    if (!pendingMove) return;

    commitMove(pendingMove);
    setPendingMove(null);
  }, [commitMove, pendingMove]);

  const cancelMove = useCallback(() => {
    setPendingMove(null);
  }, []);

  return {
    pendingMove,
    previewCube,
    selectMove,
    confirmMove,
    cancelMove,
  };
}
