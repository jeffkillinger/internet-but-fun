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
  highlighted?: boolean;
};

export function Sticker({
  color,
  position,
  highlighted = false,
}: StickerProps) {
  return (
    <div
      className={`aspect-square rounded-sm border border-zinc-900 ${STICKER_COLORS[color]} ${
        highlighted ? "relative z-10 ring-2 ring-fuchsia-500 ring-inset" : ""
      }`}
      aria-label={`${color} sticker ${position + 1}`}
    />
  );
}
