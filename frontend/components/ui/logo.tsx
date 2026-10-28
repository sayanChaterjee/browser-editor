import Link from "next/link";
import { cn } from "@/lib/utils";

/** CEditor mark: an angle bracket pair in a rounded square. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("size-6", className)}>
      <rect width="24" height="24" rx="6" fill="currentColor" />
      <path
        d="M9.5 8 6 12l3.5 4M14.5 8 18 12l-3.5 4"
        fill="none"
        stroke="#000"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2 text-foreground", className)}>
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-tight">CEditor</span>
    </Link>
  );
}
