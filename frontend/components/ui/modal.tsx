"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";

/** Centered dialog over a dimmed backdrop. Escape calls onClose when provided. */
export function Modal({
  children,
  onClose,
  className,
  z = "z-[10001]",
}: {
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
  z?: string;
}) {
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={cn("fixed inset-0 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm", z)}>
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "animate-fadeIn w-full max-w-md rounded-xl border border-border bg-card shadow-2xl shadow-black",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function ModalBody({ title, description, children }: { title: string; description?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
      {description && <div className="mt-2 text-sm leading-6 text-muted-foreground">{description}</div>}
      {children}
    </div>
  );
}

export function ModalFooter({ children }: { children: React.ReactNode }) {
  return <div className="flex justify-end gap-2 rounded-b-xl border-t border-border bg-background/40 px-6 py-4">{children}</div>;
}
