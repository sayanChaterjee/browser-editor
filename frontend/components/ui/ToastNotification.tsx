"use client";

import { useEffect, useState } from "react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastData {
  message: string;
  type: ToastType;
  id: number;
}

interface ToastNotificationProps {
  toasts: ToastData[];
  onDismiss: (id: number) => void;
}

const TOAST_ICONS: Record<ToastType, string> = {
  success: "✓",
  error: "✕",
  warning: "⚠",
  info: "ℹ",
};

const TOAST_COLORS: Record<ToastType, { bg: string; border: string; text: string; icon: string }> = {
  success: {
    bg: "bg-[#0a2e1a]",
    border: "border-[#10b981]",
    text: "text-[#6ee7b7]",
    icon: "bg-[#10b981] text-white",
  },
  error: {
    bg: "bg-[#2e0a0a]",
    border: "border-[#ef4444]",
    text: "text-[#fca5a5]",
    icon: "bg-[#ef4444] text-white",
  },
  warning: {
    bg: "bg-[#2e2a0a]",
    border: "border-[#f59e0b]",
    text: "text-[#fde68a]",
    icon: "bg-[#f59e0b] text-black",
  },
  info: {
    bg: "bg-[#0a1e2e]",
    border: "border-[#38bdf8]",
    text: "text-[#7dd3fc]",
    icon: "bg-[#38bdf8] text-black",
  },
};

function SingleToast({ toast, onDismiss }: { toast: ToastData; onDismiss: (id: number) => void }) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onDismiss(toast.id), 300);
    }, 3500);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const colors = TOAST_COLORS[toast.type];

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${colors.bg} ${colors.border} shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-sm min-w-[280px] max-w-[420px] transition-all duration-300 ${
        isExiting ? "opacity-0 translate-x-[100%]" : "opacity-100 translate-x-0"
      }`}
      style={{ animation: isExiting ? "none" : "slideInRight 0.3s ease-out" }}
    >
      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${colors.icon}`}>
        {TOAST_ICONS[toast.type]}
      </span>
      <p className={`text-sm font-medium flex-1 ${colors.text}`}>{toast.message}</p>
      <button
        onClick={() => {
          setIsExiting(true);
          setTimeout(() => onDismiss(toast.id), 300);
        }}
        className="text-white/40 hover:text-white/80 transition-colors text-lg leading-none shrink-0"
      >
        ×
      </button>
    </div>
  );
}

export default function ToastNotification({ toasts, onDismiss }: ToastNotificationProps) {
  if (toasts.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(100%); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
      <div className="fixed top-4 right-4 z-[99999] flex flex-col gap-2">
        {toasts.map((toast) => (
          <SingleToast key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </div>
    </>
  );
}

// Hook for managing toasts
let toastIdCounter = 0;

export function useToast() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const showToast = (message: string, type: ToastType = "info") => {
    const id = ++toastIdCounter;
    setToasts((prev) => [...prev, { message, type, id }]);
  };

  const dismissToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return { toasts, showToast, dismissToast };
}
