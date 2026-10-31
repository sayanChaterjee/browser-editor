"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LogOut, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { signOutCompletely } from "@/lib/session";
import { Logo } from "@/components/ui/logo";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const initials = (name?: string | null) =>
  (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  // A section stays highlighted on its sub-pages (a contest room under Contests)
  const active = pathname === href || pathname?.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm transition-colors",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

export default function Navbar() {
  const router = useRouter();
  const { user, isLoading, isAuthenticated } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the account menu on any click outside it
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const handleLogout = async () => {
    await signOutCompletely();
    router.push("/login");
  };

  return (
    <nav className="sticky top-0 z-[1000] h-14 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="flex h-full items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-4">
          <Logo />
          <div className="ml-2 hidden items-center sm:flex">
            <NavLink href="/practice">Practice</NavLink>
            <NavLink href="/contests">Contests</NavLink>
            {isAuthenticated && <NavLink href="/profile">Projects</NavLink>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isLoading ? (
            <span className="size-8 animate-pulse rounded-full bg-secondary" />
          ) : !isAuthenticated ? (
            <>
              <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Log in
              </Link>
              <Link href="/register" className={buttonVariants({ variant: "primary", size: "sm" })}>
                Sign up
              </Link>
            </>
          ) : (
            <div ref={menuRef} className="relative">
              <button
                onClick={() => setMenuOpen((open) => !open)}
                aria-label="Account menu"
                className="flex size-8 items-center justify-center rounded-full border border-border-strong bg-secondary text-xs font-medium text-foreground transition-colors hover:border-foreground/40"
              >
                {initials(user?.name)}
              </button>

              {menuOpen && user && (
                <div className="animate-fadeIn absolute right-0 top-full mt-2 w-64 rounded-lg border border-border bg-popover p-1 shadow-2xl shadow-black/60">
                  <div className="px-3 py-2.5">
                    <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
                    <p className="truncate text-[13px] text-muted-foreground">{user.email}</p>
                  </div>
                  <div className="my-1 h-px bg-border" />
                  <Link
                    href="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <User className="size-4" /> Projects
                  </Link>
                  <Button
                    variant="ghost"
                    onClick={handleLogout}
                    className="h-auto w-full justify-start px-3 py-2 font-normal"
                  >
                    <LogOut /> Log out
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
