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
  onQuitContest: () => void;
  formatTime: (seconds: number) => string;
}

export default function ContestBar({
  timeLeft,
  strikeCount,
  MAX_WARNINGS,
  projectName,
  contestStarted,
  onStartContest,
  onNewProject,
  onQuitContest,
  formatTime,
}: ContestBarProps) {
  return (
    <div className="contest-bar" style={{ 
      background: "#0f172a", 
      borderBottom: "1px solid #1e293b", 
      height: "50px", 
      padding: "0 20px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
        <span style={{ 
          color: timeLeft < 300 ? "#f87171" : "#38bdf8", 
          fontWeight: "600", 
          fontSize: "1.1rem", 
          fontFamily: "monospace" 
        }}>
          ⏱ {formatTime(timeLeft)}
        </span>
        <div style={{ height: "20px", width: "1px", background: "#334155" }} />
        <span style={{ color: "#94a3b8", fontSize: "0.9rem" }}>
          Strikes: <span style={{ color: strikeCount > 0 ? "#f87171" : "#10b981" }}>{strikeCount} / {MAX_WARNINGS}</span>
        </span>
        {projectName && (
          <>
            <div style={{ height: "20px", width: "1px", background: "#334155" }} />
            <span style={{ color: "#38bdf8", fontSize: "0.95rem", fontWeight: "600" }}>
              📂 {projectName}
            </span>
          </>
        )}
      </div>

      <div className="contest-controls" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <button
          onClick={onNewProject}
          style={{ 
            background: "linear-gradient(135deg, #10b981, #059669)",
            color: "white",
            padding: "8px 16px",
            borderRadius: "6px",
            border: "none",
            fontSize: "14px",
            fontWeight: "600",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)",
            transition: "all 0.2s"
          }}
        >
          + New Project
        </button>
        <button
          className="start-btn"
          onClick={onStartContest}
          disabled={contestStarted}
          style={{ 
            background: contestStarted ? "#1e293b" : "linear-gradient(135deg, #0ea5e9, #2563eb)",
            color: "white",
            padding: "8px 20px",
            borderRadius: "6px",
            boxShadow: contestStarted ? "none" : "0 4px 12px rgba(37, 99, 235, 0.3)"
          }}
        >
          {contestStarted ? "Contest Active" : "Start Contest"}
        </button>
        {contestStarted && (
          <button 
            className="quit-link" 
            onClick={onQuitContest} 
            style={{ 
              color: "#94a3b8", 
              fontSize: "0.85rem", 
              textDecoration: "none",
              background: "none",
              border: "none",
              cursor: "pointer"
            }}
          >
            Quit
          </button>
        )}
      </div>
    </div>
  );
}
