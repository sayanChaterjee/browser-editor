"use client";

import React from "react";

interface FileTabsProps {
  activeFile: string;
}

const FileTabs: React.FC<FileTabsProps> = ({ activeFile }) => {
  return (
    <div className="z-10 flex h-9 shrink-0 items-end border-b border-border bg-background px-2">
      <span className="-mb-px border-b border-foreground px-3 pb-2 font-mono text-[12px] text-foreground">{activeFile}</span>
    </div>
  );
};

export default FileTabs;
