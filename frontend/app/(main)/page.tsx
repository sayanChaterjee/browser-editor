import Link from "next/link";
import { cookies } from "next/headers";
import {
  ArrowRight,
  Code2,
  Eye,
  HardDriveDownload,
  Maximize,
  ShieldCheck,
  Timer,
  Trophy,
  Users,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import WakeBackend from "@/components/WakeBackend";
import NextContest from "@/components/contest/NextContest";
import { cn } from "@/lib/utils";

// Same cookies the middleware checks; a present one means "signed in" for choosing the buttons
const SESSION_COOKIES = ["better-auth.session_token", "__Secure-better-auth.session_token"];

const MODES = [
  {
    icon: Code2,
    title: "Practice",
    href: "/practice",
    body: "Your projects, edited freely. HTML, CSS and JavaScript with a live preview and console.",
    points: ["Live preview and console as you type", "Saved in your browser and synced to the cloud", "Opens instantly, even while the server wakes"],
  },
  {
    icon: Trophy,
    title: "Contests",
    href: "/contests",
    body: "Scheduled challenges: build the target before the clock runs out.",
    points: ["Join a room and wait for the start together", "Full screen, timer and the target side by side", "Submissions reviewed by the organisers"],
  },
];

const STEPS = [
  { icon: Users, title: "Join the room", body: "Pick a contest and join before it starts. You see the countdown and who's waiting." },
  { icon: Timer, title: "It opens on time", body: "At the start the room goes live by itself. One click enters full screen." },
  { icon: Eye, title: "Build the target", body: "The target sits next to your editor. The timer runs to the contest's end." },
  { icon: ShieldCheck, title: "Submit", body: "Submit when you're done, or it's submitted for you at time-up." },
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

export default async function Home() {
  const jar = await cookies();
  const signedIn = SESSION_COOKIES.some((name) => jar.get(name)?.value);

  return (
    <main className="relative overflow-hidden">
      <WakeBackend />
      <div className="bg-grid pointer-events-none absolute inset-0 h-[720px] [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]" />

      <section className="relative mx-auto flex max-w-5xl flex-col items-center px-6 pt-24 pb-14 text-center md:pt-32">
        <span className="mb-6 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
          {signedIn ? "Welcome back" : "HTML · CSS · JavaScript, in the browser"}
        </span>
        <h1 className="max-w-3xl text-5xl font-semibold tracking-tighter text-foreground md:text-7xl">
          Build for the web, right in your browser.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Practise with a live preview and automatic saving, or race the clock in scheduled coding contests.
          Nothing to install.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          {signedIn ? (
            <>
              <Link href="/practice" className={buttonVariants({ variant: "primary", size: "lg" })}>
                Open practice <ArrowRight />
              </Link>
              <Link href="/contests" className={buttonVariants({ variant: "secondary", size: "lg" })}>
                <Trophy /> Contests
              </Link>
            </>
          ) : (
            <>
              <Link href="/register" className={buttonVariants({ variant: "primary", size: "lg" })}>
                Get started <ArrowRight />
              </Link>
              <Link href="/login" className={buttonVariants({ variant: "secondary", size: "lg" })}>
                Log in
              </Link>
            </>
          )}
        </div>
        {signedIn && <NextContest />}
      </section>

      <section className="relative mx-auto max-w-5xl px-6 pb-24">
        <EditorPreview />
      </section>

      <section className="relative mx-auto max-w-5xl px-6 pb-24">
        <h2 className="text-center text-3xl font-semibold tracking-tight text-foreground">Two ways to code</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {MODES.map(({ icon: Icon, title, href, body, points }) => (
            <div key={title} className="flex flex-col rounded-xl border border-border bg-card p-6">
              <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-background">
                <Icon className="size-4 text-foreground" />
              </div>
              <h3 className="mt-4 text-lg font-medium text-foreground">{title}</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{body}</p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                {points.map((point) => (
                  <li key={point} className="flex gap-2">
                    <span className="mt-2 size-1 shrink-0 rounded-full bg-subtle-foreground" />
                    {point}
                  </li>
                ))}
              </ul>
              <Link
                href={signedIn ? href : "/register"}
                className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "mt-6 self-start")}
              >
                {signedIn ? `Open ${title.toLowerCase()}` : "Sign up to start"} <ArrowRight />
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="relative border-y border-border bg-card/40">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <h2 className="text-center text-3xl font-semibold tracking-tight text-foreground">How a contest works</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
            Everyone starts at the same moment, and the target is revealed only then.
          </p>
          <ol className="mt-12 grid gap-8 md:grid-cols-4">
            {STEPS.map(({ icon: Icon, title, body }, index) => (
              <li key={title}>
                <div className="flex items-center gap-3">
                  <span className="flex size-8 items-center justify-center rounded-full border border-border-strong font-mono text-[13px] text-foreground">
                    {index + 1}
                  </span>
                  <Icon className="size-4 text-subtle-foreground" />
                </div>
                <h3 className="mt-4 text-[15px] font-medium text-foreground">{title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="relative mx-auto flex max-w-5xl flex-col items-center px-6 py-24 text-center">
        <div className="flex gap-3 text-subtle-foreground">
          <HardDriveDownload className="size-5" />
          <Maximize className="size-5" />
          <ShieldCheck className="size-5" />
        </div>
        <h2 className="mt-5 text-3xl font-semibold tracking-tight text-foreground">
          {signedIn ? "Pick up where you left off." : "Start building in seconds."}
        </h2>
        <p className="mt-3 max-w-md text-muted-foreground">
          {signedIn ? "Your projects are waiting in practice." : "Sign up with Google and your first project is ready."}
        </p>
        <Link
          href={signedIn ? "/practice" : "/register"}
          className={cn(buttonVariants({ variant: "primary", size: "lg" }), "mt-8")}
        >
          {signedIn ? "Open practice" : "Get started"} <ArrowRight />
        </Link>
      </section>

      <footer className="relative border-t border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-8 text-[13px] text-subtle-foreground">
          <span>CEditor</span>
          <a href="https://github.com/sayanChaterjee/browser-editor" className="hover:text-foreground">
            GitHub
          </a>
        </div>
      </footer>
    </main>
  );
}
