import type { Face } from "@/src/lib/cube";

const STICKER_COLORS: Readonly<Record<Face, string>> = {
  U: "bg-white",
  R: "bg-red-600",
  F: "bg-green-600",
  D: "bg-yellow-300",
  L: "bg-orange-500",
  B: "bg-blue-600",
};

type StickerProps = {
  color: Face;
  position: number;
};

export function Sticker({ color, position }: StickerProps) {
  return (
    <div
      className={`aspect-square rounded-sm border border-zinc-900 ${STICKER_COLORS[color]}`}
      aria-label={`${color} sticker ${position + 1}`}
    />
  );
}
