"use client";

import React from "react";

interface EditorToolbarProps {
  showQuestion: boolean;
  setShowQuestion: (show: boolean) => void;
  contestStarted: boolean;
  onSave: () => void;
  onSubmit: () => void;
}

const EditorToolbar: React.FC<EditorToolbarProps> = ({
  showQuestion,
  setShowQuestion,
  contestStarted,
  onSave,
  onSubmit,
}) => {
  return (
    <div style={{ padding: "10px", display: "flex", gap: "10px", borderBottom: "1px solid #1e293b" }}>
      <button
        onClick={() => setShowQuestion(!showQuestion)}
        className="preview-toggle"
        style={{
          flex: 1,
          padding: "8px",
          background: showQuestion ? "#334155" : "#1e293b",
          border: "1px solid #334155",
          borderRadius: "4px",
          color: "white",
          cursor: "pointer",
        }}
      >
        {showQuestion ? "👁 Preview" : "📝 Question"}
      </button>
      <button
        onClick={onSave}
        className="preview-toggle"
        style={{
          flex: 1,
          padding: "8px",
          background: "linear-gradient(135deg, #10b981, #059669)",
          border: "none",
          borderRadius: "4px",
          color: "white",
          fontWeight: "bold",
          cursor: "pointer",
          boxShadow: "0 4px 10px rgba(16, 185, 129, 0.2)",
        }}
      >
        💾 Save
      </button>
      <button
        onClick={onSubmit}
        disabled={!contestStarted}
        className="preview-toggle"
        style={{
          flex: 1,
          padding: "8px",
          background: contestStarted ? "linear-gradient(135deg, #0ea5e9, #2563eb)" : "#334155",
          border: "none",
          borderRadius: "4px",
          color: contestStarted ? "white" : "#94a3b8",
          fontWeight: "bold",
          cursor: contestStarted ? "pointer" : "not-allowed",
          boxShadow: contestStarted ? "0 4px 10px rgba(14, 165, 233, 0.2)" : "none",
          opacity: contestStarted ? 1 : 0.7,
        }}
      >
        🚀 Submit
      </button>
    </div>
  );
};

export default EditorToolbar;
