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
    <div className="modal-overlay" style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0, 0, 0, 0.8)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 10000,
    }}>
      <div className="modal-content" style={{
        background: "linear-gradient(145deg, #1e293b, #0f172a)",
        padding: "40px",
        borderRadius: "20px",
        border: "1px solid #334155",
        boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
        maxWidth: "500px",
        width: "90%",
      }}>
        <h2 style={{ 
          fontSize: "24px", 
          fontWeight: "700", 
          color: "#f8fafc", 
          marginBottom: "12px",
          textAlign: "center"
        }}>
          🚀 Create Your Project
        </h2>
        <p style={{ 
          color: "#94a3b8", 
          fontSize: "14px", 
          marginBottom: "32px",
          textAlign: "center"
        }}>
          Enter a unique name for your coding project
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="e.g., My Awesome Website"
            autoFocus
            style={{
              width: "100%",
              padding: "14px 18px",
              fontSize: "16px",
              background: "#0f172a",
              border: "2px solid #334155",
              borderRadius: "10px",
              color: "#f8fafc",
              outline: "none",
              marginBottom: "24px",
              transition: "border-color 0.2s",
            }}
            onFocus={(e) => e.target.style.borderColor = "#38bdf8"}
            onBlur={(e) => e.target.style.borderColor = "#334155"}
          />

          <div style={{ display: "flex", gap: "12px" }}>
            {onCancel && isCancelable && (
              <button
                type="button"
                onClick={onCancel}
                disabled={isCreating}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: "transparent",
                  border: "1px solid #334155",
                  borderRadius: "10px",
                  color: "#94a3b8",
                  fontSize: "15px",
                  fontWeight: "600",
                  cursor: isCreating ? "not-allowed" : "pointer",
                  transition: "all 0.2s",
                }}
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={!projectName.trim() || isCreating}
              style={{
                flex: (onCancel && isCancelable) ? 2 : 1,
                padding: "12px",
                background: (projectName.trim() && !isCreating)
                  ? "linear-gradient(135deg, #38bdf8, #2563eb)" 
                  : "#334155",
                border: "none",
                borderRadius: "10px",
                color: "white",
                fontSize: "15px",
                fontWeight: "700",
                cursor: (projectName.trim() && !isCreating) ? "pointer" : "not-allowed",
                boxShadow: (projectName.trim() && !isCreating)
                  ? "0 4px 14px rgba(56, 189, 248, 0.4)" 
                  : "none",
                transition: "all 0.2s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px"
              }}
            >
              {isCreating ? (
                <>
                  <span className="spinner" style={{
                    width: "16px",
                    height: "16px",
                    border: "2px solid #ffffff40",
                    borderTop: "2px solid white",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite"
                  }} />
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
