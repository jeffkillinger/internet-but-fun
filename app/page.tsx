type Project = {
  day: number;
  title: string;
  description: string;
  href: string;
  status: "built" | "planned";
};

const projects: Project[] = [
  {
    day: 1,
    title: "One Good Thing",
    description: "A small place to save one good thing from each day.",
    href: "#",
    status: "planned",
  },
  {
    day: 2,
    title: "Tiny Weather",
    description: "A weather page that only tells you what matters.",
    href: "#",
    status: "planned",
  },
  {
    day: 3,
    title: "Lunch Decider",
    description: "A quick answer for the hardest question of the workday.",
    href: "#",
    status: "planned",
  },
  {
    day: 4,
    title: "Compliment Machine",
    description: "A button that gives sincere, oddly specific compliments.",
    href: "#",
    status: "planned",
  },
  {
    day: 5,
    title: "Five-Minute Timer",
    description: "A distraction-free timer for doing one small task.",
    href: "#",
    status: "planned",
  },
  {
    day: 6,
    title: "Color of the Day",
    description: "One color, its name, and a little bit of its history.",
    href: "#",
    status: "planned",
  },
  {
    day: 7,
    title: "Window Seat",
    description: "A quiet collection of views from imaginary train rides.",
    href: "#",
    status: "planned",
  },
  {
    day: 8,
    title: "Internet Postcard",
    description: "Write and share a simple postcard-sized message.",
    href: "#",
    status: "planned",
  },
  {
    day: 9,
    title: "Pocket Museum",
    description: "A tiny daily exhibit about an overlooked object.",
    href: "#",
    status: "planned",
  },
  {
    day: 10,
    title: "Goodnight, Internet",
    description: "A calmer final page to visit before closing the browser.",
    href: "#",
    status: "planned",
  },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 sm:py-24">
      <header className="mb-14">
        <h1 className="text-4xl font-bold tracking-tight">Internet, But Fun</h1>
        <p className="mt-4 max-w-xl text-lg leading-8 text-zinc-700">
          I&apos;m making small, useful, and occasionally silly websites. One
          project at a time, listed here in the order they are built.
        </p>
      </header>

      <section aria-labelledby="projects-heading">
        <h2 id="projects-heading" className="mb-6 text-xl font-semibold">
          Projects
        </h2>
        <ol className="space-y-8">
          {projects.map((project) => (
            <li key={project.day}>
              <p className="mb-1 text-sm text-zinc-500">
                Day {project.day} · {project.status}
              </p>
              <h3 className="text-lg font-semibold">
                <a
                  href={project.href}
                  className="underline decoration-1 underline-offset-4"
                >
                  {project.title}
                </a>
              </h3>
              <p className="mt-1 leading-7 text-zinc-700">
                {project.description}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
