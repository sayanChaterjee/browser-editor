"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

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

const TOAST_ICONS: Record<ToastType, { icon: LucideIcon; color: string }> = {
  success: { icon: CheckCircle2, color: "text-success" },
  error: { icon: XCircle, color: "text-destructive" },
  warning: { icon: AlertTriangle, color: "text-warning" },
  info: { icon: Info, color: "text-link" },
};

function SingleToast({ toast, onDismiss }: { toast: ToastData; onDismiss: (id: number) => void }) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onDismiss(toast.id), 200);
    }, 3500);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const { icon: Icon, color } = TOAST_ICONS[toast.type];

  return (
    <div
      role="status"
      className={cn(
        "flex w-[360px] max-w-[calc(100vw-2rem)] items-start gap-3 rounded-lg border border-border-strong bg-popover px-4 py-3 shadow-2xl shadow-black transition-all duration-200",
        isExiting ? "translate-y-2 opacity-0" : "animate-fadeIn opacity-100",
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", color)} />
      <p className="flex-1 text-sm text-foreground">{toast.message}</p>
      <button
        aria-label="Dismiss"
        onClick={() => {
          setIsExiting(true);
          setTimeout(() => onDismiss(toast.id), 200);
        }}
        className="shrink-0 text-subtle-foreground transition-colors hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

export default function ToastNotification({ toasts, onDismiss }: ToastNotificationProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[99999] flex flex-col gap-2">
      {toasts.map((toast) => (
        <SingleToast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
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
