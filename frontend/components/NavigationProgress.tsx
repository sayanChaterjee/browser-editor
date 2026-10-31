"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Gives up if a navigation never arrives (e.g. it failed), so the bar can't hang around
const GIVE_UP_MS = 20_000;

const here = () => `${window.location.pathname}?${new URLSearchParams(window.location.search)}`;

/**
 * A thin bar across the top while a page is on its way: from a click on an internal link
 * until the location changes (wherever it lands, redirects included). Pages here render on the
 * server per request, so without it a slow navigation looks like nothing happened.
 */
export default function NavigationProgress() {
  const location = `${usePathname()}?${useSearchParams()}`;
  // Where the user was when they clicked; null when nothing is loading
  const [leaving, setLeaving] = useState<string | null>(null);

  // Arrived somewhere else: done (adjusting state while rendering, as React recommends)
  if (leaving !== null && leaving !== location) setLeaving(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setLeaving(here());
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (leaving === null) return;
    const timer = setTimeout(() => setLeaving(null), GIVE_UP_MS);
    return () => clearTimeout(timer);
  }, [leaving]);

  if (leaving === null) return null;
  return (
    <div role="progressbar" aria-label="Loading page" className="fixed inset-x-0 top-0 z-[100002] h-0.5 overflow-hidden">
      <div className="nav-progress h-full w-1/3 bg-ring" />
    </div>
  );
}
