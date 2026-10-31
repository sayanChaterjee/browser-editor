"use client";

import Link from "next/link";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { LogoMark } from "@/components/ui/logo";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_65%)]" />
      <div className="relative w-full max-w-[380px]">
        <Link href="/" className="mb-8 flex justify-center text-foreground" aria-label="CEditor home">
          <LogoMark className="size-9" />
        </Link>
        <div className="rounded-xl border border-border bg-card p-8 shadow-2xl shadow-black">
          <h1 className="text-center text-xl font-semibold tracking-tight text-foreground">{title}</h1>
          <p className="mt-1.5 text-center text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-7">{children}</div>
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>
      </div>
    </div>
  );
}

export function FormMessage({ message }: { message: { text: string; type: "error" | "success" } | null }) {
  if (!message) return null;
  const error = message.type === "error";
  const Icon = error ? AlertCircle : CheckCircle2;
  return (
    <div
      role={error ? "alert" : "status"}
      className={cn(
        "mb-5 flex items-start gap-2 rounded-md border px-3 py-2.5 text-[13px]",
        error ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-success/30 bg-success/10 text-success",
      )}
    >
      <Icon className="mt-px size-4 shrink-0" />
      <span>{message.text}</span>
    </div>
  );
}

export function FieldError({ children }: { children?: string }) {
  if (!children) return null;
  return <p className="mt-1.5 text-[12px] text-destructive">{children}</p>;
}

export function OrDivider({ label = "or" }: { label?: string }) {
  return (
    <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-wider text-subtle-foreground">
      <span className="h-px flex-1 bg-border" />
      {label}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

export function GoogleButton({ onClick, loading = false }: { onClick: () => void; loading?: boolean }) {
  if (loading) {
    return (
      <div
        role="status"
        className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-border-strong bg-background text-sm text-muted-foreground"
      >
        <Spinner className="size-4" /> Taking you to Google…
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-border-strong bg-background text-sm font-medium text-foreground transition-colors hover:bg-accent"
    >
      <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
        <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.7 2.3 2.4 6.6 2.4 11.9s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z" />
      </svg>
      Continue with Google
    </button>
  );
}
