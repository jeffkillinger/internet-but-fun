import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Rubik's Cube | Internet, But Fun",
  description: "A shared Rubik's Cube where every visitor gets one move.",
};

export default function RubiksCubePage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 sm:py-24">
      <Link
        href="/"
        className="text-sm text-zinc-600 underline decoration-1 underline-offset-4"
      >
        Back to projects
      </Link>

      <header className="mt-10">
        <h1 className="text-4xl font-bold tracking-tight">Rubik&apos;s Cube</h1>
        <p className="mt-4 max-w-xl text-lg leading-8 text-zinc-700">
          A multiplayer experiment where every visitor gets exactly one move
          on a shared Rubik&apos;s Cube.
        </p>
      </header>

      <section className="mt-14" aria-labelledby="development-status">
        <h2 id="development-status" className="text-xl font-semibold">
          Development Status
        </h2>
        <p className="mt-3 leading-7 text-zinc-700">
          The cube engine is being built first. It will define and validate the
          canonical state before a visual, interactive cube is added.
        </p>
      </section>
    </main>
  );
}
