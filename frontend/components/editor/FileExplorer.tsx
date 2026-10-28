"use client";

import { Braces, FileCode2, FileText, Hash } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  activeFile: string;
  setActiveFile: (file: string) => void;
};

const files = [
  { name: "index.html", icon: FileCode2 },
  { name: "styles.css", icon: Hash },
  { name: "script.js", icon: Braces },
  { name: "README.md", icon: FileText },
];

export default function FileExplorer({ activeFile, setActiveFile }: Props) {
  return (
    <div className="w-52 shrink-0 border-r border-border bg-background px-2 py-3">
      <h4 className="mb-2 px-2 text-[11px] font-medium uppercase tracking-wider text-subtle-foreground">Files</h4>

      {files.map(({ name, icon: Icon }) => {
        const active = activeFile === name;
        return (
          <button
            key={name}
            onClick={() => setActiveFile(name)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 font-mono text-[13px] transition-colors",
              active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className={cn("size-3.5", active ? "text-foreground" : "text-subtle-foreground")} />
            {name}
          </button>
        );
      })}
    </div>
  );
}
