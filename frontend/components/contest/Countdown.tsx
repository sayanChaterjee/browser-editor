"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** "2d 4h", "3h 05m", "12:04": the larger units only while they matter. */
export function formatRemaining(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${pad(minutes)}m`;
  return `${pad(minutes)}:${pad(seconds)}`;
}

export function formatSchedule(start: string, end: string): string {
  const from = new Date(start);
  const to = new Date(end);
  const day = from.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  const time = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${day} · ${time(from)}–${time(to)}`;
}

/** Ticks down to `to` on the server's clock; calls onDone once when it reaches zero. */
export function Countdown({
  to,
  clockOffsetMs = 0,
  onDone,
  className,
}: {
  to: string;
  clockOffsetMs?: number;
  onDone?: () => void;
  className?: string;
}) {
  const remaining = () => new Date(to).getTime() - (Date.now() + clockOffsetMs);
  const [ms, setMs] = useState(remaining);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    let done = false;
    const tick = () => {
      const left = new Date(to).getTime() - (Date.now() + clockOffsetMs);
      setMs(left);
      if (left <= 0 && !done) {
        done = true;
        onDoneRef.current?.();
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [to, clockOffsetMs]);

  return <span className={cn("font-mono tabular-nums tracking-tight text-foreground", className)}>{formatRemaining(ms)}</span>;
}
