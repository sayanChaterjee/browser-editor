"use client";

import { useState } from "react";

interface CreateProjectModalProps {
  onSubmit: (projectName: string) => void;
  onCancel?: () => void;
  isCreating?: boolean;
  isCancelable?: boolean;
  existingProjectNames?: string[];
}

export default function CreateProjectModal({ 
  onSubmit, 
  onCancel, 
  isCreating = false,
  isCancelable = true,
  existingProjectNames = [],
}: CreateProjectModalProps) {
  const [projectName, setProjectName] = useState("");
  const [duplicateError, setDuplicateError] = useState("");

  const checkDuplicate = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      setDuplicateError("");
      return false;
    }
    const isDuplicate = existingProjectNames.some(
      (existing) => existing.toLowerCase() === trimmed.toLowerCase()
    );
    setDuplicateError(isDuplicate ? `A project named "${trimmed}" already exists` : "");
    return isDuplicate;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = projectName.trim();
    if (!trimmed) return;
    if (checkDuplicate(trimmed)) return;
    onSubmit(trimmed);
  };

  const handleChange = (value: string) => {
    setProjectName(value);
    checkDuplicate(value);
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
            onChange={(e) => handleChange(e.target.value)}
            placeholder="e.g., My Awesome Website"
            autoFocus
            className={`w-full px-[18px] py-3.5 text-base bg-[#0f172a] border-2 rounded-[10px] text-[#f8fafc] outline-none transition-colors focus:border-[#38bdf8] ${
              duplicateError ? "border-[#ef4444] focus:border-[#ef4444]" : "border-[#334155]"
            } ${duplicateError ? "mb-2" : "mb-6"}`}
          />
          
          {duplicateError && (
            <p className="text-[#ef4444] text-xs mb-4 flex items-center gap-1.5">
              <span>⚠</span> {duplicateError}
            </p>
          )}

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
              disabled={!projectName.trim() || isCreating || !!duplicateError}
              className={`py-3 rounded-[10px] text-white text-[15px] font-bold transition-all flex items-center justify-center gap-2 ${
                onCancel && isCancelable ? "flex-[2]" : "flex-1"
              } ${
                projectName.trim() && !isCreating && !duplicateError
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
