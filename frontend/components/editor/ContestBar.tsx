"use client";

import React from "react";

interface ContestBarProps {
  timeLeft: number;
  strikeCount: number;
  MAX_WARNINGS: number;
  projectName: string;
  contestStarted: boolean;
  onStartContest: () => void;
  onNewProject: () => void;
  formatTime: (seconds: number) => string;
  activeContest: { _id: string, title: string, imageUrl: string } | null;
}

export default function ContestBar({
  timeLeft,
  strikeCount,
  MAX_WARNINGS,
  projectName,
  contestStarted,
  onStartContest,
  onNewProject,
  formatTime,
  activeContest,
}: ContestBarProps) {
  return (
    <div className="bg-[#0f172a] border-b border-[#1e293b] h-[50px] px-5 flex items-center justify-between">
      <div className="flex items-center gap-5">
        <span className={`font-semibold text-[1.1rem] font-mono ${timeLeft < 300 ? "text-[#f87171]" : "text-[#38bdf8]"}`}>
          ⏱ {formatTime(timeLeft)}
        </span>
        <div className="h-5 w-[1px] bg-[#334155]" />
        <span className="text-[#94a3b8] text-[0.9rem]">
          Strikes: <span className={strikeCount > 0 ? "text-[#f87171]" : "text-[#10b981]"}>{strikeCount} / {MAX_WARNINGS}</span>
        </span>
        {projectName && (
          <>
            <div className="h-5 w-[1px] bg-[#334155]" />
            <span className="text-[#38bdf8] text-[0.95rem] font-semibold">
              📂 {projectName}
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2.5">
        <button
          onClick={onNewProject}
          className="bg-gradient-to-br from-[#10b981] to-[#059669] text-white px-4 py-2 rounded-md border-none text-[14px] font-semibold cursor-pointer shadow-[0_4px_12px_rgba(16,185,129,0.3)] transition-all hover:opacity-90 active:scale-95"
        >
          + New Project
        </button>
        <button
          onClick={onStartContest}
          disabled={contestStarted || !activeContest}
          className={`px-5 py-2 rounded-md border-none text-[14px] font-semibold transition-all ${
            contestStarted 
              ? "bg-[#1e293b] text-white cursor-not-allowed shadow-none" 
              : !activeContest
              ? "bg-[#334155] text-[#94a3b8] cursor-not-allowed shadow-none"
              : "bg-gradient-to-br from-[#0ea5e9] to-[#2563eb] text-white cursor-pointer shadow-[0_4px_12px_rgba(37,99,235,0.3)] hover:opacity-90 active:scale-95"
          }`}
        >
          {contestStarted ? "Contest Active" : !activeContest ? "No live contest" : "Start Contest"}
        </button>
      </div>
    </div>
  );
}
