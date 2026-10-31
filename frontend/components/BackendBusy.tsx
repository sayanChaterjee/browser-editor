"use client";

import { useSyncExternalStore } from "react";
import { Spinner } from "./ui/spinner";

/**
 * When the API proxy answers "busy" (a 503 with x-backend-busy: Render's Cloudflare edge is
 * challenging Vercel's servers, see app/api/[...proxy]), the request never reached the backend,
 * so it is retried here with growing waits while a banner says what's happening. Callers just
 * see their request take longer instead of failing.
 *
 * Done once, by wrapping window.fetch for this app's /api/ calls, so every page and hook gets
 * it without changes.
 */

const RETRY_DELAYS_MS = [2_000, 4_000, 8_000, 8_000];
const SKIP = ["/api/wake", "/api/csp-report"];

let waiting = 0;
const listeners = new Set<() => void>();
const setWaiting = (change: number) => {
  waiting += change;
  listeners.forEach((listener) => listener());
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const isBusy = (res: Response) => res.status === 503 && res.headers.get("x-backend-busy") === "1";

function apiPath(input: RequestInfo | URL): string | null {
  const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
  if (url.origin !== window.location.origin || !url.pathname.startsWith("/api/")) return null;
  return SKIP.includes(url.pathname) ? null : url.pathname;
}

let installed = false;
function install() {
  if (installed) return;
  installed = true;
  const original = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    if (!apiPath(input)) return original(input, init);
    // A Request's body can be read once; keep a copy for the retries
    const again = () => original(input instanceof Request ? input.clone() : input, init);
    let res = await again();
    if (!isBusy(res)) return res;

    setWaiting(1);
    try {
      for (const delay of RETRY_DELAYS_MS) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        res = await again();
        if (!isBusy(res)) break;
      }
      return res;
    } finally {
      setWaiting(-1);
    }
  };
}

// As soon as this module loads in the browser: before any page's first request (a component's
// effect would run after its children's, too late for their initial fetches)
if (typeof window !== "undefined") install();

export default function BackendBusy() {
  const busy = useSyncExternalStore(subscribe, () => waiting > 0, () => false);
  if (!busy) return null;
  return (
    <div
      role="status"
      className="animate-fadeIn fixed bottom-4 left-1/2 z-[100001] flex -translate-x-1/2 items-center gap-2.5 rounded-full border border-border-strong bg-popover px-4 py-2 text-sm text-foreground shadow-2xl shadow-black"
    >
      <Spinner className="size-3.5" />
      Server busy, retrying…
    </div>
  );
}
