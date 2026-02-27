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
    <div className="p-2.5 flex gap-2.5 border-b border-[#1e293b]">
      <button
        onClick={() => setShowQuestion(!showQuestion)}
        disabled={!contestStarted}
        className={`flex-1 p-2 rounded border transition-colors ${
          !contestStarted
            ? "bg-[#1e293b] border-[#334155] text-[#94a3b8] cursor-not-allowed opacity-70"
            : showQuestion 
              ? "bg-[#334155] border-[#334155] text-white cursor-pointer" 
              : "bg-[#1e293b] border-[#334155] text-white cursor-pointer"
        }`}
      >
        {showQuestion ? "👁 Preview" : "📝 Question"}
      </button>
      <button
        onClick={onSave}
        className="flex-1 p-2 bg-gradient-to-br from-[#10b981] to-[#059669] border-none rounded text-white font-bold cursor-pointer shadow-[0_4px_10px_rgba(16,185,129,0.2)] transition-opacity hover:opacity-90"
      >
        💾 Save
      </button>
      <button
        onClick={onSubmit}
        disabled={!contestStarted}
        className={`flex-1 p-2 border-none rounded font-bold transition-all ${
          contestStarted 
            ? "bg-gradient-to-br from-[#0ea5e9] to-[#2563eb] text-white cursor-pointer shadow-[0_4px_10px_rgba(14,165,233,0.2)] hover:opacity-90" 
            : "bg-[#334155] text-[#94a3b8] cursor-not-allowed opacity-70"
        }`}
      >
        🚀 Submit
      </button>
    </div>
  );
};

export default EditorToolbar;
