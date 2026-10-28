import Link from "next/link";
import { ArrowRight, Eye, HardDriveDownload, Timer } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

const FEATURES = [
  {
    icon: Eye,
    title: "Live preview",
    body: "HTML, CSS and JavaScript side by side, with the result and its console output updating as you type.",
  },
  {
    icon: HardDriveDownload,
    title: "Saved as you go",
    body: "Every change is kept in your browser and synced to the cloud in the background, so a reload never loses work.",
  },
  {
    icon: Timer,
    title: "Timed contests",
    body: "Join a live challenge, build against the clock and submit. Fullscreen mode keeps it fair.",
  },
];

// A static picture of the editor for the hero
function EditorPreview() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-black">
      <div className="flex h-10 items-center gap-2 border-b border-border px-4">
        <span className="size-2.5 rounded-full bg-border-strong" />
        <span className="size-2.5 rounded-full bg-border-strong" />
        <span className="size-2.5 rounded-full bg-border-strong" />
        <div className="ml-4 flex gap-1 font-mono text-xs">
          <span className="rounded bg-secondary px-2 py-1 text-foreground">index.html</span>
          <span className="px-2 py-1 text-subtle-foreground">styles.css</span>
          <span className="px-2 py-1 text-subtle-foreground">script.js</span>
        </div>
      </div>
      <div className="grid md:grid-cols-2">
        <pre className="overflow-hidden border-b border-border p-5 font-mono text-[13px] leading-6 text-muted-foreground md:border-b-0 md:border-r">
          <code>
            <span className="text-subtle-foreground">{"<"}</span>
            <span className="text-link">main</span>
            <span className="text-subtle-foreground">{">"}</span>
            {"\n  "}
            <span className="text-subtle-foreground">{"<"}</span>
            <span className="text-link">h1</span>
            <span className="text-subtle-foreground">{">"}</span>
            <span className="text-foreground">Hello, world</span>
            <span className="text-subtle-foreground">{"</"}</span>
            <span className="text-link">h1</span>
            <span className="text-subtle-foreground">{">"}</span>
            {"\n  "}
            <span className="text-subtle-foreground">{"<"}</span>
            <span className="text-link">button</span> <span className="text-warning">id</span>
            <span className="text-subtle-foreground">=</span>
            <span className="text-success">{'"go"'}</span>
            <span className="text-subtle-foreground">{">"}</span>
            <span className="text-foreground">Run</span>
            <span className="text-subtle-foreground">{"</"}</span>
            <span className="text-link">button</span>
            <span className="text-subtle-foreground">{">"}</span>
            {"\n"}
            <span className="text-subtle-foreground">{"</"}</span>
            <span className="text-link">main</span>
            <span className="text-subtle-foreground">{">"}</span>
          </code>
        </pre>
        <div className="flex flex-col items-start justify-center gap-3 bg-white p-8 text-black">
          <span className="text-2xl font-semibold tracking-tight">Hello, world</span>
          <span className="rounded-md border border-black/20 px-3 py-1 text-sm">Run</span>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="relative overflow-hidden">
      <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]" />

      <section className="relative mx-auto flex max-w-5xl flex-col items-center px-6 pt-24 pb-16 text-center md:pt-32">
        <span className="mb-6 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
          HTML · CSS · JavaScript, in the browser
        </span>
        <h1 className="max-w-3xl text-5xl font-semibold tracking-tighter text-foreground md:text-7xl">
          Write, preview and ship your ideas.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          A fast code editor with a live preview, automatic saving and timed coding contests.
          Nothing to install.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link href="/editor" className={buttonVariants({ variant: "primary", size: "lg" })}>
            Start coding <ArrowRight />
          </Link>
          <Link href="/register" className={buttonVariants({ variant: "secondary", size: "lg" })}>
            Create an account
          </Link>
        </div>
      </section>

      <section className="relative mx-auto max-w-5xl px-6 pb-24">
        <EditorPreview />
      </section>

      <section className="relative mx-auto grid max-w-5xl gap-px overflow-hidden border-y border-border bg-border md:grid-cols-3 md:rounded-xl md:border">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <div key={title} className="bg-background p-8">
            <Icon className="size-5 text-foreground" />
            <h3 className="mt-4 text-[15px] font-medium text-foreground">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
          </div>
        ))}
      </section>

      <footer className="relative mx-auto flex max-w-5xl items-center justify-between px-6 py-10 text-[13px] text-subtle-foreground">
        <span>CEditor</span>
        <a href="https://github.com/sayanChaterjee/browser-editor" className="hover:text-foreground">
          GitHub
        </a>
      </footer>
    </main>
  );
}
