"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock } from "lucide-react";
import { Countdown } from "./Countdown";

interface Row {
  _id: string;
  title: string;
  startTime: string;
  endTime: string;
  joined: boolean;
  submitted: boolean;
}

/** For signed-in visitors of the landing page: the contest live now, or the next one. */
export default function NextContest() {
  const [contest, setContest] = useState<{ row: Row; live: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/v1/contest/list", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((lists: { live: Row[]; upcoming: Row[] } | null) => {
        const live = lists?.live.find((c) => !c.submitted);
        const next = live ?? lists?.upcoming[0];
        if (next) setContest({ row: next, live: !!live });
      })
      .catch(() => {});
  }, []);

  if (!contest) return null;
  const { row, live } = contest;
  return (
    <Link
      href={`/contests/${row._id}`}
      className="animate-fadeIn group mt-8 flex items-center gap-3 rounded-full border border-border bg-card py-1.5 pl-2 pr-4 text-sm transition-colors hover:border-border-strong"
    >
      {live ? (
        <span className="flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
          <span className="size-1.5 animate-pulse rounded-full bg-success" /> Live
        </span>
      ) : (
        <span className="flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
          <CalendarClock className="size-3" /> Next
        </span>
      )}
      <span className="font-medium text-foreground">{row.title}</span>
      <span className="text-muted-foreground">
        {live ? "ends in " : "starts in "}
        <Countdown to={live ? row.endTime : row.startTime} className="text-sm" />
      </span>
      <ArrowRight className="size-3.5 text-subtle-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
