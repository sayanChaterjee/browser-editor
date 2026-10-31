"use client";

import { useCallback, useEffect, useRef } from "react";

// Matches HEARTBEAT_SECONDS in contest-service (domain/activity.ts)
const HEARTBEAT_MS = 15_000;
// The code itself rides along about once a minute, when it changed (the admin's replay)
const SNAPSHOT_EVERY_MS = 60_000;
// A beacon (window closing) carries at most ~64 KB; a bigger snapshot stays behind
const BEACON_SNAPSHOT_MAX = 50_000;

interface Code {
  html: string;
  css: string;
  js: string;
}

interface Counters {
  typedChars: number;
  pastedChars: number;
  pasteCount: number;
  largestPaste: number;
}

const empty = (): Counters => ({ typedChars: 0, pastedChars: 0, pasteCount: 0, largestPaste: 0 });

interface Props {
  contestStarted: boolean;
  projectId: string | null;
  /** The code now: its size goes with every heartbeat, the code itself about once a minute */
  code: Code;
}

const sizeOf = (code: Code) => code.html.length + code.css.length + code.js.length;
const same = (a: Code | null, b: Code) => !!a && a.html === b.html && a.css === b.css && a.js === b.js;

/**
 * Contest heartbeats: every 15 s while a contest runs, tells contest-service what was typed and
 * pasted since the last one and how big the code is, and about once a minute (when it changed)
 * sends the code itself. The server records them (and the silences between them) for the
 * admin's review and replay; see ADR 0011 and 0015.
 */
export function useContestActivity({ contestStarted, projectId, code }: Props) {
  const pending = useRef<Counters>(empty());
  const startSent = useRef(false);
  const codeRef = useRef(code);
  useEffect(() => {
    codeRef.current = code;
  });
  // The last snapshot the server has, and when it was sent
  const lastSnapshot = useRef<{ code: Code; at: number } | null>(null);

  type Report = Counters & { startChars?: number; codeChars: number; snapshot?: Code };
  const body = useCallback((forceSnapshot = false): Report => {
    const now = codeRef.current;
    const report: Report = { ...pending.current, codeChars: sizeOf(now) };
    if (!startSent.current) report.startChars = sizeOf(now);
    const due = !lastSnapshot.current || Date.now() - lastSnapshot.current.at >= SNAPSHOT_EVERY_MS;
    if ((due || forceSnapshot) && !same(lastSnapshot.current?.code ?? null, now)) report.snapshot = now;
    return report;
  }, []);

  /** Sends a heartbeat now; `final` (at submit) always includes the code if it changed. */
  const flush = useCallback(async (final = false) => {
    if (!projectId) return;
    const sent = body(final);
    pending.current = empty();
    try {
      const res = await fetch(`/api/v1/contest/activity/${projectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(sent),
      });
      if (!res.ok) throw new Error(`activity ${res.status}`);
      startSent.current = true;
      if (sent.snapshot) lastSnapshot.current = { code: sent.snapshot, at: Date.now() };
    } catch {
      // Keep the counts for the next heartbeat
      const p = pending.current;
      p.typedChars += sent.typedChars;
      p.pastedChars += sent.pastedChars;
      p.pasteCount += sent.pasteCount;
      p.largestPaste = Math.max(p.largestPaste, sent.largestPaste);
    }
  }, [projectId, body]);

  /** For the window closing: a beacon outlives the page */
  const flushBeacon = useCallback(() => {
    if (!projectId) return;
    const report = body(true);
    if (report.snapshot && sizeOf(report.snapshot) > BEACON_SNAPSHOT_MAX) delete report.snapshot;
    navigator.sendBeacon(
      `/api/v1/contest/activity/${projectId}`,
      new Blob([JSON.stringify(report)], { type: "application/json" }),
    );
    pending.current = empty();
  }, [projectId, body]);

  useEffect(() => {
    if (!contestStarted || !projectId) return;
    startSent.current = false;
    flush(); // the first heartbeat records the starting size
    const interval = setInterval(() => flush(), HEARTBEAT_MS);
    return () => clearInterval(interval);
  }, [contestStarted, projectId, flush]);

  const recordTyped = useCallback((chars: number) => {
    pending.current.typedChars += chars;
  }, []);

  const recordPasted = useCallback((chars: number) => {
    const p = pending.current;
    p.pastedChars += chars;
    p.pasteCount += 1;
    p.largestPaste = Math.max(p.largestPaste, chars);
  }, []);

  return { flush, flushBeacon, recordTyped, recordPasted };
}
