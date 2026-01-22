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
    <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[9999]">
      <div className="bg-[#181818] p-10 rounded-lg border border-[#333] text-center max-w-[400px]">
        <div className="text-[3rem] mb-4">⚠️</div>
        <h2 className="text-white font-bold text-xl mb-2">Security Violation</h2>
        <p className={`font-bold mb-2 ${strikeCount >= 2 ? "text-[#ff5555]" : "text-[#ffcc00]"}`}>
          Warning {strikeCount} of {MAX_WARNINGS}
        </p>
        <p className="text-[#888] text-[0.9rem] my-[10px_20px] mb-5">
          Switching tabs, exiting fullscreen, or opening devtools is strictly prohibited.
          One more violation may end your session.
        </p>
        <div className="flex gap-[15px] justify-center">
          <button className="px-5 py-2.5 bg-[#007acc] text-white border-none rounded cursor-pointer transition-colors hover:bg-[#005fa3]" onClick={onResume}>
            Return to Contest
          </button>
          <button className="px-5 py-2.5 bg-transparent text-[#ff5555] border border-[#ff5555] rounded cursor-pointer transition-colors hover:bg-[#ff5555]/10" onClick={onSubmit}>
            Submit & Exit
          </button>
        </div>
      </div>
    </div>
  );
}
