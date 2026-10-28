"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowRight, Laptop } from "lucide-react";

// Pages that need a large screen; the rest (landing, sign-in, projects) work on any size
const DESKTOP_ONLY = ["/editor", "/admin"];

export default function DeviceRestriction({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);
  const desktopOnly = DESKTOP_ONLY.some((path) => pathname?.startsWith(path));

  useEffect(() => {
    const checkSize = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkSize();
    window.addEventListener("resize", checkSize);
    return () => window.removeEventListener("resize", checkSize);
  }, []);

  if (isMobile && desktopOnly) {
    return (
      <div className="fixed inset-0 z-[100000] flex flex-col items-center justify-center bg-background p-6 text-center">
        <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_65%)]" />
        <div className="relative w-full max-w-sm">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl border border-border bg-card">
            <Laptop className="size-5 text-foreground" />
          </div>
          <h2 className="mt-6 text-2xl font-semibold tracking-tight text-foreground">Open CEditor on a larger screen</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            The editor needs room for code, preview and console side by side. Use a laptop or desktop
            (at least 1024 px wide) to continue.
          </p>
          <a
            href="https://github.com/sayanChaterjee/browser-editor"
            target="_blank"
            rel="noreferrer"
            className="mt-8 inline-flex items-center gap-1.5 text-sm text-link hover:underline"
          >
            View the project on GitHub <ArrowRight className="size-4" />
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
