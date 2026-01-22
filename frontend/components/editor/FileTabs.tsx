"use client";

import React from "react";

interface FileTabsProps {
  activeFile: string;
}

const FileTabs: React.FC<FileTabsProps> = ({ activeFile }) => {
  return (
    <div className="h-9 flex items-center bg-[#1e293b] text-[#94a3b8] border-b border-[#0f172a] text-[13px] z-10 px-3">
      <span className="border-b-2 border-[#38bdf8] py-2 px-4 color-[#f8fafc] text-[#f8fafc]">{activeFile}</span>
    </div>
  );
};

export default FileTabs;
