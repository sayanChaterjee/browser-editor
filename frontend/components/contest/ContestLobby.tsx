"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock, CheckCircle2, Code2, Radio, Trophy } from "lucide-react";
import { Countdown, formatSchedule } from "./Countdown";
import { Badge } from "../ui/badge";
import { buttonVariants } from "../ui/button";
import { Spinner } from "../ui/spinner";
import { cn } from "@/lib/utils";

interface ContestRow {
  _id: string;
  title: string;
  startTime: string;
  endTime: string;
  phase: "upcoming" | "live" | "ended";
  joined: boolean;
  submitted: boolean;
}

interface Lists {
  live: ContestRow[];
  upcoming: ContestRow[];
  past: ContestRow[];
}

/** Every published contest: live now, coming up, and past ones with how you did. */
export default function ContestLobby() {
  const [lists, setLists] = useState<Lists | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/v1/contest/list", { credentials: "include" });
        if (!res.ok) throw new Error(`Could not load contests (${res.status})`);
        setLists(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load contests");
      }
    };
    load();
    // Upcoming contests go live on their own; keep the page current
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Contests</h1>
          <p className="mt-1 text-sm text-muted-foreground">Build the target against the clock. Join a room before the start and wait there.</p>
        </div>
        <Link href="/practice" className={buttonVariants({ variant: "secondary", size: "sm" })}>
          <Code2 /> Practice instead
        </Link>
      </div>

      {error && <p className="mt-6 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      {!lists && !error && <div className="flex justify-center py-16"><Spinner className="size-5" /></div>}

      {lists && (
        <>
          <Section title="Live now" icon={Radio} empty="Nothing running right now.">
            {lists.live.map((c) => <Card key={c._id} contest={c} />)}
          </Section>
          <Section title="Upcoming" icon={CalendarClock} empty="No contests scheduled yet.">
            {lists.upcoming.map((c) => <Card key={c._id} contest={c} />)}
          </Section>
          {lists.past.length > 0 && (
            <Section title="Past" icon={Trophy}>
              {lists.past.map((c) => <Card key={c._id} contest={c} />)}
            </Section>
          )}
        </>
      )}
    </main>
  );
}

function Section({ title, icon: Icon, empty, children }: { title: string; icon: React.ElementType; empty?: string; children: React.ReactNode[] }) {
  return (
    <section className="mt-10">
      <h2 className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-subtle-foreground">
        <Icon className="size-3.5" /> {title}
      </h2>
      {children.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-subtle-foreground">{empty}</p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">{children}</div>
      )}
    </section>
  );
}

function Card({ contest }: { contest: ContestRow }) {
  const { phase } = contest;
  const action =
    phase === "ended"
      ? contest.submitted ? "View" : null
      : contest.submitted ? "View" : contest.joined ? "Back to the room" : phase === "live" ? "Join now" : "Join the room";

  return (
    <div className={cn("flex flex-col rounded-xl border bg-card p-5", phase === "live" ? "border-success/30" : "border-border")}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium text-foreground">{contest.title}</h3>
        {phase === "live" && <Badge tone="success"><span className="size-1.5 animate-pulse rounded-full bg-success" /> Live</Badge>}
        {contest.submitted && <Badge tone="info"><CheckCircle2 className="size-3" /> Submitted</Badge>}
        {phase === "ended" && !contest.submitted && <Badge>{contest.joined ? "Not submitted" : "Ended"}</Badge>}
      </div>
      <p className="mt-1 text-[13px] text-muted-foreground">{formatSchedule(contest.startTime, contest.endTime)}</p>
      {phase !== "ended" && (
        <p className="mt-3 text-sm text-muted-foreground">
          {phase === "live" ? "Ends in " : "Starts in "}
          <Countdown to={phase === "live" ? contest.endTime : contest.startTime} className="text-sm" />
        </p>
      )}
      {action && (
        <Link
          href={`/contests/${contest._id}`}
          className={cn(buttonVariants({ variant: phase === "live" && !contest.submitted ? "primary" : "secondary", size: "sm" }), "mt-4 self-start")}
        >
          {action} <ArrowRight />
        </Link>
      )}
    </div>
  );
}
