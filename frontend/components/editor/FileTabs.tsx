"use client";

import React from "react";
import { WandSparkles } from "lucide-react";

interface FileTabsProps {
  activeFile: string;
  /** Re-indents the open file (Monaco's formatter); hidden when the file has none */
  onFormat?: () => void;
}

const FileTabs: React.FC<FileTabsProps> = ({ activeFile, onFormat }) => {
  return (
    <div className="z-10 flex h-9 shrink-0 items-end justify-between border-b border-border bg-background px-2">
      <span className="-mb-px border-b border-foreground px-3 pb-2 font-mono text-[12px] text-foreground">{activeFile}</span>
      {onFormat && (
        <button
          type="button"
          onClick={onFormat}
          title="Format document (Shift+Alt+F)"
          className="mb-1.5 flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground [&_svg]:size-3.5"
        >
          <WandSparkles /> Format
        </button>
      )}
    </div>
  );
};

export default FileTabs;
