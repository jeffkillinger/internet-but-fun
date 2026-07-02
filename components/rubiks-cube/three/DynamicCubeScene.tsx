"use client";

import dynamic from "next/dynamic";

const CubeScene = dynamic(() => import("./CubeScene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-80 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-100 text-sm text-zinc-600">
      Loading 3D scene…
    </div>
  ),
});

export function DynamicCubeScene() {
  return <CubeScene />;
}
