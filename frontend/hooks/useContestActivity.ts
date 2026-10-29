"use client";

import { useCallback, useEffect, useRef } from "react";

// Matches HEARTBEAT_SECONDS in contest-service (domain/activity.ts)
const HEARTBEAT_MS = 15_000;

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
  /** Total size of the code; the first heartbeat sends it as the starting size */
  codeSize: number;
}

/**
 * Contest heartbeats: every 15 s while a contest runs, tells contest-service what was typed and
 * pasted since the last one. The server records them (and the silences between them) for the
 * admin's review; see ADR 0011.
 */
export function useContestActivity({ contestStarted, projectId, codeSize }: Props) {
  const pending = useRef<Counters>(empty());
  const startSent = useRef(false);
  const codeSizeRef = useRef(codeSize);
  useEffect(() => {
    codeSizeRef.current = codeSize;
  });

  const body = useCallback(() => {
    const report: Counters & { startChars?: number } = { ...pending.current };
    if (!startSent.current) report.startChars = codeSizeRef.current;
    return report;
  }, []);

  const flush = useCallback(async () => {
    if (!projectId) return;
    const sent = body();
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
    navigator.sendBeacon(
      `/api/v1/contest/activity/${projectId}`,
      new Blob([JSON.stringify(body())], { type: "application/json" }),
    );
    pending.current = empty();
  }, [projectId, body]);

  useEffect(() => {
    if (!contestStarted || !projectId) return;
    startSent.current = false;
    flush(); // the first heartbeat records the starting size
    const interval = setInterval(flush, HEARTBEAT_MS);
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
