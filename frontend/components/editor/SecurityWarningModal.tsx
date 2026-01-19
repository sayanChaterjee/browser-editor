"use client";

import React from "react";

interface SecurityWarningModalProps {
  isVisible: boolean;
  strikeCount: number;
  MAX_WARNINGS: number;
  onResume: () => void;
  onSubmit: () => void;
}

export default function SecurityWarningModal({
  isVisible,
  strikeCount,
  MAX_WARNINGS,
  onResume,
  onSubmit,
}: SecurityWarningModalProps) {
  if (!isVisible) return null;

  return (
    <div className="violation-overlay">
      <div className="warning-card">
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
        <h2>Security Violation</h2>
        <p style={{ color: strikeCount >= 2 ? "#ff5555" : "#ffcc00", fontWeight: "bold" }}>
          Warning {strikeCount} of {MAX_WARNINGS}
        </p>
        <p className="sub-text">
          Switching tabs, exiting fullscreen, or opening devtools is strictly prohibited.
          One more violation may end your session.
        </p>
        <div className="modal-buttons">
          <button className="resume-btn" onClick={onResume}>
            Return to Contest
          </button>
          <button className="quit-btn" onClick={onSubmit}>
            Submit & Exit
          </button>
        </div>
      </div>
    </div>
  );
}
