import type { Metadata } from "next";
import Link from "next/link";

import { CubePrototype } from "@/components/rubiks-cube/CubePrototype";

export const metadata: Metadata = {
  title: "Rubik's Cube | Internet, But Fun",
  description: "An interactive Rubik's Cube developer prototype.",
};

export default function RubiksCubePage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16 sm:py-24">
      <Link
        href="/"
        className="text-sm text-zinc-600 underline decoration-1 underline-offset-4"
      >
        Back to projects
      </Link>

      <header className="mt-10">
        <h1 className="text-4xl font-bold tracking-tight">Rubik&apos;s Cube</h1>
        <p className="mt-4 max-w-xl text-lg leading-8 text-zinc-700">
          A local developer prototype driven by the canonical cube engine. Use
          the net and serialized state to verify every move.
        </p>
      </header>

      <section className="mt-14">
        <CubePrototype />
      </section>
    </main>
  );
}
