import type { Move } from "@/src/lib/cube";

type MoveHistoryProps = {
  history: readonly Move[];
  moveCount: number;
};

export function MoveHistory({ history, moveCount }: MoveHistoryProps) {
  return (
    <section aria-labelledby="game-information">
      <h2 id="game-information" className="text-lg font-semibold">
        Game information
      </h2>
      <dl className="mt-3 grid gap-3 sm:grid-cols-[8rem_1fr]">
        <dt className="font-medium">Move count</dt>
        <dd>{moveCount}</dd>
        <dt className="font-medium">Move history</dt>
        <dd className="min-h-6 break-words font-mono text-sm">
          {history.length > 0
            ? history.map((move) => move.notation).join(" ")
            : "No player moves"}
        </dd>
      </dl>
    </section>
  );
}
