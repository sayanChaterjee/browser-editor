"use client";

import React from "react";

interface FileTabsProps {
  activeFile: string;
}

const FileTabs: React.FC<FileTabsProps> = ({ activeFile }) => {
  return (
    <div className="tabs" style={{ background: "#1e293b", color: "#94a3b8", borderBottom: "1px solid #0f172a" }}>
      <span style={{ borderBottom: "2px solid #38bdf8", padding: "8px 16px", color: "#f8fafc" }}>{activeFile}</span>
    </div>
  );
};

export default FileTabs;
