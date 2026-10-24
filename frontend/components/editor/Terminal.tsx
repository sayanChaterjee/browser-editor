"use client";

import { useEffect, useRef, useState } from "react";
import type { Terminal as XTerm } from "xterm";
import type { FitAddon } from "xterm-addon-fit";


interface TerminalProps {
  logs: { type: string; args: unknown[] }[];
}

export default function Terminal({ logs }: TerminalProps) {
  const [isTerminalReady, setIsTerminalReady] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const lastLogIndexRef = useRef(0);

  useEffect(() => {
    if (!terminalRef.current) return;

    let term: XTerm;
    let fitAddon: FitAddon;

    const initTerminal = async () => {
      const { Terminal: XTermClass } = await import("xterm");
      const { FitAddon: FitAddonClass } = await import("xterm-addon-fit");
      await import("xterm/css/xterm.css");

      term = new XTermClass({
        theme: {
          background: "#020617",
          foreground: "#f8fafc",
        },
        fontFamily: 'Consolas, "Courier New", monospace',
        fontSize: 13,
        disableStdin: true,
        cursorBlink: false,
      });
      
      fitAddon = new FitAddonClass();
      term.loadAddon(fitAddon);

      term.open(terminalRef.current!);
      fitAddon.fit();

      xtermRef.current = term;
      fitAddonRef.current = fitAddon;

      term.writeln("\x1b[32m> Console Ready\x1b[0m");
      setIsTerminalReady(true);

      const handleResize = () => {
        fitAddon?.fit();
      };
      window.addEventListener("resize", handleResize);
    };

    initTerminal();

    return () => {
      window.removeEventListener("resize", () => fitAddon?.fit());
      term?.dispose();
    };
  }, []);

  // Update terminal when logs change
  useEffect(() => {
    if (!isTerminalReady || !xtermRef.current) return;
    const term = xtermRef.current;

    if (logs.length === 0) {
      term.clear();
      term.writeln("\x1b[32m> Console Ready\x1b[0m");
      lastLogIndexRef.current = 0;
      return;
    }

    for (let i = lastLogIndexRef.current; i < logs.length; i++) {
      const log = logs[i];
      const formatArg = (arg: unknown): string => {
        if (typeof arg === "string") return arg;
        if (arg instanceof Error) return arg.toString();
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      };

      const message = log.args.map(formatArg).join(" ");
      
      let prefix = "";
      if (log.type === "error") {
        prefix = "\x1b[31m"; // Red
      } else if (log.type === "warn") {
        prefix = "\x1b[33m"; // Yellow
      } else if (log.type === "info") {
        prefix = "\x1b[36m"; // Cyan
      }

      const suffix = "\x1b[0m"; // Reset

      // writeln handles new lines natively in xterm
      term.writeln(`${prefix}${message}${suffix}`);
    }

    lastLogIndexRef.current = logs.length;
  }, [logs, isTerminalReady]);

  return (
    <div className="flex flex-col h-full w-full bg-[#020617] border-t border-[#333]">
      <style>{`
        .xterm-viewport::-webkit-scrollbar {
          display: none;
        }
        .xterm-viewport {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
      <div className="h-9 px-3 shrink-0 flex items-center justify-between text-[#e5e7eb] text-[12px] font-medium border-b border-[#1e293b]">
        <span>Console</span>
      </div>
      <div className="flex-1 overflow-hidden p-2" ref={terminalRef} />
    </div>
  );
}
