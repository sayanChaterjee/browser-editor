"use client";

import { useEffect } from "react";

/**
 * Asks the gateway to start any sleeping backend services (Render's free tier sleeps them when
 * idle, and a cold start takes ~20 s). Called where sign-in is about to happen, so the start-up
 * overlaps with the user reading or typing instead of following their click.
 */
export function useWakeBackend() {
  useEffect(() => {
    fetch("/api/wake", { cache: "no-store" }).catch(() => {
      // Best effort: the real requests still work, just slower
    });
  }, []);
}

/** For server-rendered pages: renders nothing */
export default function WakeBackend() {
  useWakeBackend();
  return null;
}
