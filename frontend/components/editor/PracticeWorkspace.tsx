"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderOpen, Plus, Save, Trophy } from "lucide-react";
import Workbench, { type Code } from "./Workbench";
import CreateProjectModal from "./CreateProjectModal";
import { useEditorPersistence } from "../../hooks/useEditorPersistence";
import { useProjectManager } from "../../hooks/useProjectManager";
import { signOutCompletely } from "../../lib/session";
import ToastNotification, { useToast } from "../ui/ToastNotification";
import { Button, buttonVariants } from "../ui/button";
import { Spinner } from "../ui/spinner";

/** Practice: your projects, edited freely. Contests have their own pages (/contests). */
export default function PracticeWorkspace() {
  const router = useRouter();
  const { toasts, showToast, dismissToast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);

  const {
    html, setHtml, css, setCss, js, setJs,
    projectName, projectId, projects,
    showCreateModal, setShowCreateModal, isCreatingProject, isModalCancelable, setIsModalCancelable,
    handleCreateProject, saveCode, isLoading, loadingMessage,
  } = useProjectManager({
    onLogout: async () => {
      await signOutCompletely();
      router.push("/login");
    },
    showToast,
    onUserLoaded: setUserId,
  });

  // Local copy in IndexedDB (a newer local copy wins on reload)
  useEditorPersistence({
    html, css, js, timeLeft: 0, projectName, projectId, userId, contestStarted: false, isLoading,
  });

  const setCode = (code: Code) => {
    if (code.html !== html) setHtml(code.html);
    if (code.css !== css) setCss(code.css);
    if (code.js !== js) setJs(code.js);
  };

  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    await saveCode({ html, css, js });
    setSaving(false);
  };

  const openNewProject = () => {
    setIsModalCancelable(true);
    setShowCreateModal(true);
  };

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      <ToastNotification toasts={toasts} onDismiss={dismissToast} />

      {isLoading && (
        // Covers the empty editor until projects load: on Render's free tier the first
        // request after idle can take up to a minute while services wake up
        <div className="fixed inset-0 top-14 z-40 flex items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-3 px-6 text-center">
            <Spinner className="size-5" />
            <span className="text-sm font-medium text-foreground">{loadingMessage}</span>
            <span className="max-w-xs text-[13px] text-muted-foreground">
              The first load after a quiet spell can take up to a minute while the servers wake up.
            </span>
          </div>
        </div>
      )}

      {showCreateModal && (
        <CreateProjectModal
          onSubmit={handleCreateProject}
          onCancel={() => setShowCreateModal(false)}
          isCreating={isCreatingProject}
          isCancelable={isModalCancelable}
          existingProjectNames={projects.map((p) => p.name)}
        />
      )}

      <div className="flex h-12 items-center justify-between border-b border-border bg-background px-4">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <span className="rounded-md border border-border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Practice
          </span>
          <span className="truncate font-medium text-foreground">{projectName || "Untitled"}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/profile" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            <FolderOpen /> Projects
          </Link>
          <Button size="sm" variant="secondary" onClick={openNewProject}>
            <Plus /> New project
          </Button>
          <div className="mx-1 h-5 w-px bg-border" />
          <Link href="/contests" className={buttonVariants({ variant: "secondary", size: "sm" })}>
            <Trophy /> Contests
          </Link>
        </div>
      </div>

      <Workbench
        className="h-[calc(100vh-104px)]"
        code={{ html, css, js }}
        onChange={setCode}
        toolbar={
          <div className="flex h-11 items-center gap-2 border-b border-border px-3">
            <span className="text-[13px] text-subtle-foreground">Changes save automatically</span>
            <Button size="sm" variant="secondary" className="ml-auto" onClick={save} disabled={saving}>
              {saving ? <Spinner className="size-4" /> : <Save />} {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        }
      />
    </div>
  );
}
