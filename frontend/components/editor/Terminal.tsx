"use client";

import { useEffect, useRef, useState } from "react";
import type { Terminal as XTerm } from "xterm";
import PanelHeader from "./PanelHeader";

export interface ConsoleLine {
  id: number; // increasing, so lines already printed are skipped even after old ones are trimmed
  type: string;
  args: unknown[];
}

interface TerminalProps {
  logs: ConsoleLine[];
}

const EMPTY_MESSAGE = "\x1b[90mConsole output from the preview appears here.\x1b[0m";

const formatArg = (arg: unknown): string => {
  if (typeof arg === "string") return arg;
  if (arg instanceof Error) return arg.toString();
  try {
    return JSON.stringify(arg, null, 2);
  } catch {
    return String(arg);
  }
};

const COLORS: Record<string, string> = {
  error: "\x1b[31m",
  warn: "\x1b[33m",
  info: "\x1b[36m",
};

export default function Terminal({ logs }: TerminalProps) {
  const [isTerminalReady, setIsTerminalReady] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const lastPrintedIdRef = useRef(0);

  useEffect(() => {
    const container = terminalRef.current;
    if (!container) return;

    // The terminal loads asynchronously; if this effect is cleaned up first (unmount, or
    // React's development double-run), don't open a second terminal in the same box
    let cancelled = false;
    let term: XTerm | null = null;
    let observer: ResizeObserver | null = null;

    (async () => {
      const { Terminal: XTermClass } = await import("xterm");
      const { FitAddon } = await import("xterm-addon-fit");
      await import("xterm/css/xterm.css");
      if (cancelled) return;

      term = new XTermClass({
        theme: {
          background: "#0a0a0a",
          foreground: "#ededed",
          cursor: "#0a0a0a",
          selectionBackground: "#0070f340",
        },
        fontFamily: 'Menlo, "SF Mono", Consolas, "Liberation Mono", monospace',
        lineHeight: 1.4,
        fontSize: 13,
        disableStdin: true,
        cursorBlink: false,
      });
      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(container);
      fitAddon.fit();
      term.writeln(EMPTY_MESSAGE);

      // Refit on any size change of the panel (window resize or dragging the divider)
      observer = new ResizeObserver(() => fitAddon.fit());
      observer.observe(container);

      xtermRef.current = term;
      setIsTerminalReady(true);
    })();

    return () => {
      cancelled = true;
      observer?.disconnect();
      term?.dispose();
      xtermRef.current = null;
    };
  }, []);

  // Print new lines; an empty list means a new run, so the terminal is cleared
  useEffect(() => {
    const term = xtermRef.current;
    if (!isTerminalReady || !term) return;

    if (logs.length === 0) {
      term.reset();
      term.writeln(EMPTY_MESSAGE);
      return;
    }

    for (const log of logs) {
      if (log.id <= lastPrintedIdRef.current) continue;
      const message = log.args.map(formatArg).join(" ");
      const color = COLORS[log.type];
      term.writeln(color ? `${color}${message}\x1b[0m` : message);
      lastPrintedIdRef.current = log.id;
    }
  }, [logs, isTerminalReady]);

  return (
    <div className="flex h-full w-full flex-col border-t border-border bg-editor">
      <style>{`
        .xterm-viewport::-webkit-scrollbar {
          display: none;
        }
        .xterm-viewport {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
      <PanelHeader title="Console" />
      <div className="flex-1 overflow-hidden px-3 py-2" ref={terminalRef} />
    </div>
  );
}
