"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ClipboardList, Clock, Maximize, ShieldAlert, Timer, Trophy, Users, XCircle } from "lucide-react";
import ContestWorkspace, { type FinishReason } from "./ContestWorkspace";
import { Countdown, formatSchedule } from "./Countdown";
import { Button, buttonVariants } from "../ui/button";
import { Spinner } from "../ui/spinner";

type Phase = "upcoming" | "live" | "ended";

interface Room {
  contest: { _id: string; title: string; startTime: string; endTime: string; phase: Phase };
  serverTime: string;
  participants: number;
  me: { joinedAt: string; projectId: string | null; submittedAt: string | null } | null;
}

// The room refreshes this often while waiting (the count, and the start)
const POLL_MS = 5_000;

const RULES = [
  { icon: Maximize, text: "The contest runs in full screen. Leaving it, switching tabs or opening developer tools is a strike." },
  { icon: ShieldAlert, text: "4 strikes end your contest and submit what you have." },
  { icon: Timer, text: "The timer runs to the contest's end. At time-up your code is submitted automatically." },
  { icon: ClipboardList, text: "Copy and paste work inside the editor only. Typing and pasting are recorded for review." },
];

export default function ContestRoom({ contestId }: { contestId: string }) {
  const [room, setRoom] = useState<Room | null>(null);
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [inWorkspace, setInWorkspace] = useState(false);
  const [finished, setFinished] = useState<{ reason: FinishReason; message?: string } | null>(null);

  // GET the room (or POST to join it), then show what came back
  const load = useCallback((init?: RequestInit) => {
    const sentAt = Date.now();
    return fetch(`/api/v1/contest/${contestId}${init ? "/join" : "/room"}`, { credentials: "include", ...init })
      .then(async (res) => ({ res, body: await res.json().catch(() => ({})) }))
      .then(({ res, body }) => {
        if (!res.ok) {
          setError(body.message || "Could not load the contest");
          return;
        }
        // The server's clock, corrected for half the round trip
        setClockOffsetMs(new Date(body.serverTime).getTime() - (sentAt + Date.now()) / 2);
        setRoom(body);
        setError(null);
      })
      .catch(() => setError("Could not reach the server. Retrying…"));
  }, [contestId]);

  useEffect(() => {
    load();
  }, [load]);

  // While waiting, keep the count and the phase fresh
  useEffect(() => {
    if (inWorkspace || finished || room?.contest.phase === "ended") return;
    const interval = setInterval(() => load(), POLL_MS);
    return () => clearInterval(interval);
  }, [load, inWorkspace, finished, room?.contest.phase]);

  const join = async () => {
    setJoining(true);
    await load({ method: "POST" });
    setJoining(false);
  };

  // Full screen needs a click, so entering the live contest is one
  const enter = async () => {
    try {
      await document.documentElement.requestFullscreen();
      setInWorkspace(true);
    } catch {
      setError("Full screen is required for the contest. Allow it and try again.");
    }
  };

  if (inWorkspace && room?.me && !finished) {
    return (
      <ContestWorkspace
        contest={room.contest}
        projectId={room.me.projectId}
        clockOffsetMs={clockOffsetMs}
        onFinished={(reason, message) => {
          setInWorkspace(false);
          setFinished({ reason, message });
          load();
        }}
      />
    );
  }

  if (!room) {
    return (
      <Shell>
        {error ? <Message icon={XCircle} title={error} /> : <div className="flex justify-center py-16"><Spinner className="size-5" /></div>}
      </Shell>
    );
  }

  const { contest, me, participants } = room;
  const submitted = !!me?.submittedAt;

  return (
    <Shell>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Trophy className="size-4 text-warning" />
        <span>{formatSchedule(contest.startTime, contest.endTime)}</span>
      </div>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{contest.title}</h1>

      {error && <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      {finished || submitted ? (
        <Finished reason={finished?.reason ?? "submitted"} message={finished?.message} submittedAt={me?.submittedAt ?? null} />
      ) : contest.phase === "ended" ? (
        <Message icon={Clock} title="This contest has ended" body={me ? "You joined but didn't submit." : "It's over; look out for the next one."} />
      ) : !me ? (
        <div className="mt-8 rounded-xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            {contest.phase === "live" ? "The contest is live. Join to take part." : "Join the room now and wait for the start."}
          </p>
          <div className="mt-4 flex items-center gap-4">
            <Button variant="primary" onClick={join} disabled={joining}>
              {joining ? <Spinner className="size-4" /> : <Users />} Join the room
            </Button>
            <span className="text-sm text-subtle-foreground">{participants} joined</span>
          </div>
        </div>
      ) : contest.phase === "upcoming" ? (
        <div className="mt-8 rounded-xl border border-border bg-card p-6 text-center">
          <p className="text-[11px] font-medium uppercase tracking-wider text-subtle-foreground">Starts in</p>
          <Countdown to={contest.startTime} clockOffsetMs={clockOffsetMs} onDone={() => load()} className="mt-2 block text-5xl" />
          <div className="mt-5 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <span className="size-2 animate-pulse rounded-full bg-success" />
            You&apos;re in the room · <Users className="size-3.5" /> {participants} waiting
          </div>
          <p className="mt-2 text-[13px] text-subtle-foreground">The contest opens here automatically. Keep this page open.</p>
        </div>
      ) : (
        <div className="mt-8 rounded-xl border border-success/30 bg-success/5 p-6 text-center">
          <p className="flex items-center justify-center gap-2 text-sm font-medium text-success">
            <span className="size-2 animate-pulse rounded-full bg-success" /> The contest is live
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Ends in <Countdown to={contest.endTime} clockOffsetMs={clockOffsetMs} onDone={() => load()} className="inline text-sm" />
          </p>
          <Button variant="primary" size="lg" className="mt-5" onClick={enter}>
            <Maximize /> Enter full screen and start
          </Button>
        </div>
      )}

      {!submitted && !finished && contest.phase !== "ended" && (
        <div className="mt-8">
          <h2 className="text-[11px] font-medium uppercase tracking-wider text-subtle-foreground">Before you start</h2>
          <ul className="mt-3 space-y-3">
            {RULES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex gap-3 text-sm text-muted-foreground">
                <Icon className="mt-0.5 size-4 shrink-0 text-subtle-foreground" />
                {text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <Link href="/contests" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All contests
      </Link>
      {children}
    </main>
  );
}

function Message({ icon: Icon, title, body }: { icon: React.ElementType; title: string; body?: string }) {
  return (
    <div className="mt-8 rounded-xl border border-border bg-card p-6 text-center">
      <Icon className="mx-auto size-6 text-subtle-foreground" />
      <p className="mt-3 font-medium text-foreground">{title}</p>
      {body && <p className="mt-1 text-sm text-muted-foreground">{body}</p>}
    </div>
  );
}

const FINISH_TEXT: Record<FinishReason, string> = {
  submitted: "Your code is in. Results are reviewed by the organisers.",
  time: "Time's up: your code was submitted automatically.",
  strikes: "Your contest ended after 4 strikes; what you had was submitted.",
  failed: "Something went wrong.",
};

function Finished({ reason, message, submittedAt }: { reason: FinishReason; message?: string; submittedAt: string | null }) {
  const failed = reason === "failed";
  return (
    <div className="mt-8 rounded-xl border border-border bg-card p-6 text-center">
      {failed ? <XCircle className="mx-auto size-7 text-destructive" /> : <CheckCircle2 className="mx-auto size-7 text-success" />}
      <p className="mt-3 text-lg font-semibold tracking-tight text-foreground">{failed ? "Couldn't finish" : "Submitted"}</p>
      <p className="mt-1 text-sm text-muted-foreground">{message ?? FINISH_TEXT[reason]}</p>
      {submittedAt && (
        <p className="mt-1 text-[13px] text-subtle-foreground">
          {new Date(submittedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
        </p>
      )}
      <div className="mt-5 flex justify-center gap-2">
        <Link href="/contests" className={buttonVariants({ variant: "secondary", size: "sm" })}>All contests</Link>
        <Link href="/practice" className={buttonVariants({ variant: "ghost", size: "sm" })}>Practice</Link>
      </div>
    </div>
  );
}
