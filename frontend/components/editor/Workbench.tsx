"use client";

import { useEffect, useRef, useState } from "react";
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from "react-resizable-panels";
import FileExplorer from "./FileExplorer";
import FileTabs from "./FileTabs";
import CodeEditor from "./CodeEditor";
import Preview from "./Preview";
import Terminal, { type ConsoleLine } from "./Terminal";
import { INITIAL_README } from "../../utils/constants";
import { isFromOwnFrame } from "@/lib/utils";

const MAX_CONSOLE_LINES = 500;

export interface Code {
  html: string;
  css: string;
  js: string;
}

interface WorkbenchProps {
  code: Code;
  onChange: (code: Code) => void;
  /** Bar above the preview (save, submit, question toggle...) */
  toolbar: React.ReactNode;
  /** Shown instead of the preview when set (the contest's target) */
  sidePanel?: React.ReactNode;
  /** Contest: block the OS clipboard and report what was typed or pasted */
  contest?: { onInsert: (chars: number, kind: "typed" | "pasted") => void };
  className?: string;
}

/** The editing area shared by practice and contests: files, editor, console and preview. */
export default function Workbench({ code, onChange, toolbar, sidePanel, contest, className }: WorkbenchProps) {
  const [activeFile, setActiveFile] = useState("index.html");
  const nextLogId = useRef(1);

  // Every edit re-runs the preview, so each run starts with a clean console: lines are kept
  // with the version of the code that printed them, and only the current run's are shown
  const run = `${code.html}\u0000${code.css}\u0000${code.js}`;
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  });
  const [output, setOutput] = useState<{ run: string; lines: ConsoleLine[] }>({ run, lines: [] });
  const logs = output.run === run ? output.lines : [];

  // Console output from the preview frame
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === "CONSOLE_LOG" && isFromOwnFrame(e)) {
        const line = { id: nextLogId.current++, type: e.data.logType, args: e.data.args };
        setOutput((prev) => {
          const lines = prev.run === runRef.current ? prev.lines : [];
          // Capped so a script logging in a loop can't grow this without bound
          return { run: runRef.current, lines: [...lines, line].slice(-MAX_CONSOLE_LINES) };
        });
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const files = {
    "index.html": { language: "html", value: code.html, onChange: (html: string) => onChange({ ...code, html }) },
    "styles.css": { language: "css", value: code.css, onChange: (css: string) => onChange({ ...code, css }) },
    "script.js": { language: "javascript", value: code.js, onChange: (js: string) => onChange({ ...code, js }) },
    "README.md": { language: "markdown", value: INITIAL_README, onChange: () => {} },
  } as const;
  const file = files[activeFile as keyof typeof files];

  return (
    <div className={`flex min-w-0 ${className ?? ""}`}>
      <FileExplorer activeFile={activeFile} setActiveFile={setActiveFile} />

      <PanelGroup orientation="horizontal" className="flex-1 w-full min-w-0">
        <Panel defaultSize={50} minSize={20} className="flex min-w-0 flex-col overflow-hidden bg-editor">
          <PanelGroup orientation="vertical">
            <Panel defaultSize={70} minSize={30} className="flex flex-col">
              <FileTabs activeFile={activeFile} />
              <div className="flex-1 overflow-hidden">
                <CodeEditor
                  language={file.language}
                  value={file.value}
                  onChange={file.onChange}
                  restrictClipboard={!!contest}
                  onInsert={contest?.onInsert}
                />
              </div>
            </Panel>

            <PanelResizeHandle className="z-10 h-px w-full cursor-row-resize bg-border transition-colors hover:bg-ring data-[resize-handle-state=drag]:bg-ring" />

            <Panel defaultSize={30} minSize={10} className="flex flex-col">
              <Terminal logs={logs} />
            </Panel>
          </PanelGroup>
        </Panel>

        <PanelResizeHandle className="z-10 h-full w-px cursor-col-resize bg-border transition-colors hover:bg-ring data-[resize-handle-state=drag]:bg-ring" />

        <Panel defaultSize={50} minSize={20} className="flex flex-col overflow-hidden bg-background">
          {toolbar}
          <div className="flex flex-1 flex-col overflow-hidden">
            {sidePanel ?? <Preview html={code.html} css={code.css} js={code.js} />}
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}
