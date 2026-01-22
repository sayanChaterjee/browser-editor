"use client";

import { useState } from "react";

interface CreateProjectModalProps {
  onSubmit: (projectName: string) => void;
  onCancel?: () => void;
  isCreating?: boolean;
  isCancelable?: boolean;
}

export default function CreateProjectModal({ 
  onSubmit, 
  onCancel, 
  isCreating = false,
  isCancelable = true 
}: CreateProjectModalProps) {
  const [projectName, setProjectName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (projectName.trim()) {
      onSubmit(projectName.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[10000]">
      <div className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] p-10 rounded-[20px] border border-[#334155] shadow-[0_20px_60px_rgba(0,0,0,0.5)] max-w-[500px] w-[90%] animate-in fade-in zoom-in duration-200">
        <h2 className="text-2xl font-bold text-[#f8fafc] mb-3 text-center">
          🚀 Create Your Project
        </h2>
        <p className="text-[#94a3b8] text-sm mb-8 text-center">
          Enter a unique name for your coding project
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="e.g., My Awesome Website"
            autoFocus
            className="w-full px-[18px] py-3.5 text-base bg-[#0f172a] border-2 border-[#334155] rounded-[10px] text-[#f8fafc] outline-none mb-6 transition-colors focus:border-[#38bdf8]"
          />

          <div className="flex gap-3">
            {onCancel && isCancelable && (
              <button
                type="button"
                onClick={onCancel}
                disabled={isCreating}
                className="flex-1 py-3 bg-transparent border border-[#334155] rounded-[10px] text-[#94a3b8] text-[15px] font-semibold transition-all hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={!projectName.trim() || isCreating}
              className={`py-3 rounded-[10px] text-white text-[15px] font-bold transition-all flex items-center justify-center gap-2 ${
                onCancel && isCancelable ? "flex-[2]" : "flex-1"
              } ${
                projectName.trim() && !isCreating
                  ? "bg-gradient-to-r from-[#38bdf8] to-[#2563eb] cursor-pointer shadow-[0_4px_14px_rgba(56,189,248,0.4)] hover:opacity-90 active:scale-95" 
                  : "bg-[#334155] cursor-not-allowed"
              }`}
            >
              {isCreating ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Project"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
