"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import ConfirmModal from "@/components/ui/ConfirmModal";
import ToastNotification, { useToast } from "@/components/ui/ToastNotification";
import { FileCode2, FolderCode, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn, timeAgo } from "@/lib/utils";

interface Project {
  _id: string;
  name: string;
  html: string;
  css: string;
  js: string;
  createdAt: string;
  updatedAt: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, isAuthenticated } = useAuth();
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [fetchingProjects, setFetchingProjects] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const { toasts, showToast, dismissToast } = useToast();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  // Fetch projects when user is available
  useEffect(() => {
    if (!user) return;

    const fetchProjects = async () => {
      try {
        const projRes = await fetch(`/api/v1/code`, {
          credentials: 'include',
          cache: 'no-store',
        });
        
        if (projRes.ok) {
          const projData = await projRes.json();
          setProjects(Array.isArray(projData) ? projData : []);
        } else {
          console.error("Failed to fetch projects:", projRes.status);
          setProjects([]);
        }
      } catch (err) {
        console.error("Profile page load failed", err);
      } finally {
        setFetchingProjects(false);
      }
    };

    fetchProjects();
  }, [user, pathname]);

  const deleteProject = async (projectId: string) => {
    try {
      const res = await fetch(`/api/v1/code/${projectId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (res.ok) {
        setProjects(projects.filter(p => p._id !== projectId));
        showToast("Project deleted successfully", "success");
      }
    } catch (err) {
      console.error("Delete failed", err);
      showToast("Failed to delete project", "error");
    }
  };

  const handleDeleteConfirm = () => {
    if (deleteTarget) {
      deleteProject(deleteTarget);
      setDeleteTarget(null);
    }
  };

  const visibleProjects = projects.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()));

  if (isLoading || fetchingProjects) {
    return (
      <div className="flex min-h-[calc(100vh-56px)] items-center justify-center">
        <Spinner className="size-5" />
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  return (
    <div className="mx-auto min-h-[calc(100vh-56px)] max-w-6xl px-6 py-10">
      <ToastNotification toasts={toasts} onDismiss={dismissToast} />

      <ConfirmModal
        isVisible={!!deleteTarget}
        title="Delete project"
        message="This permanently deletes the project and its code. This can't be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />

      <header className="flex flex-wrap items-center justify-between gap-6 border-b border-border pb-8">
        <div className="flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-full border border-border-strong bg-secondary text-lg font-medium text-foreground">
            {user.name?.[0]?.toUpperCase() || "U"}
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{user.name}</h1>
            <p className="text-sm text-muted-foreground">
              {user.email}
              {user.createdAt && <> · Joined {new Date(user.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</>}
            </p>
          </div>
        </div>
        <Button variant="primary" onClick={() => router.push("/practice")}>
          <Plus /> New project
        </Button>
      </header>

      <div className="mt-8 flex items-center justify-between gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" />
          <Input
            placeholder="Search projects..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <span className="shrink-0 text-sm text-muted-foreground">
          {projects.length} project{projects.length === 1 ? "" : "s"}
        </span>
      </div>

      {projects.length === 0 ? (
        <div className="mt-6 flex flex-col items-center rounded-xl border border-dashed border-border-strong px-6 py-20 text-center">
          <FolderCode className="size-8 text-subtle-foreground" />
          <p className="mt-4 font-medium text-foreground">No projects yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Create one in the editor; it shows up here.</p>
          <Button variant="primary" className="mt-6" onClick={() => router.push("/practice")}>
            <Plus /> New project
          </Button>
        </div>
      ) : visibleProjects.length === 0 ? (
        <p className="mt-16 text-center text-sm text-muted-foreground">No projects match &ldquo;{query}&rdquo;.</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleProjects.map((proj) => (
            <div
              key={proj._id}
              role="link"
              tabIndex={0}
              onClick={() => router.push(`/practice?projectId=${proj._id}`)}
              onKeyDown={(e) => e.key === "Enter" && router.push(`/practice?projectId=${proj._id}`)}
              className="group flex cursor-pointer flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:border-border-strong hover:bg-muted"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-background">
                    <FileCode2 className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-medium text-foreground">{proj.name}</h3>
                    <p className="text-[13px] text-muted-foreground">Updated {timeAgo(proj.updatedAt)}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${proj.name}`}
                  className="opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(proj._id);
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
              <div className="mt-5 flex gap-1.5 font-mono">
                {(["html", "css", "js"] as const).map((file) => (
                  <span
                    key={file}
                    className={cn(
                      "rounded border border-border px-1.5 py-0.5 text-[11px]",
                      proj[file]?.trim() ? "text-muted-foreground" : "text-subtle-foreground/60",
                    )}
                  >
                    {file}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
