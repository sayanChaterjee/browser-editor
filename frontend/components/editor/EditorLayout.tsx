"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from "react-resizable-panels";
import FileExplorer from "./FileExplorer";
import CodeEditor from "./CodeEditor";
import Preview from "./Preview";
import Terminal from "./Terminal";
import QuestionPanel from "./QuestionPanel";
import CreateProjectModal from "./CreateProjectModal";
import { INITIAL_README } from "../../utils/constants";
import { useEditorPersistence } from "../../hooks/useEditorPersistence";
import ContestBar from "./ContestBar";
import SecurityWarningModal from "./SecurityWarningModal";
import EditorToolbar from "./EditorToolbar";
import FileTabs from "./FileTabs";
import { clearLocalProjects } from "../../lib/indexedDB";
import ToastNotification, { useToast } from "../ui/ToastNotification";
import ConfirmModal from "../ui/ConfirmModal";

// Hooks
import { useProjectManager } from "../../hooks/useProjectManager";
import { useContestTimer } from "../../hooks/useContestTimer";
import { useContestSecurity } from "../../hooks/useContestSecurity";
import { signOut } from "../../lib/auth-client";

const MAX_WARNINGS = 4;

export default function EditorLayout() {
  const router = useRouter();
  const [showQuestion, setShowQuestion] = useState(false);
  const [contestStarted, setContestStarted] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [isContestPending, setIsContestPending] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [startDuration, setStartDuration] = useState<number>(0);
  const startDurationRef = useRef(0);
  const timeLeftRef = useRef(0);
  const [logs, setLogs] = useState<{ type: string; args: unknown[] }[]>([]);

  const { toasts, showToast, dismissToast } = useToast();

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    
    const handleMessage = (e: MessageEvent) => {
        if (e.data?.type === 'CONSOLE_LOG') {
            setLogs(prev => [...prev, { type: e.data.logType, args: e.data.args }]);
        }
    };

    document.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("message", handleMessage);
    
    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  const logoutUser = async () => {
    stopTimer();
    await clearLocalProjects();
    await signOut();
    router.push("/login");
  };

  const {
    activeFile,
    setActiveFile,
    html,
    setHtml,
    css,
    setCss,
    js,
    setJs,
    projectName,
    projectId,
    projects,
    showCreateModal,
    setShowCreateModal,
    isCreatingProject,
    isModalCancelable,
    setIsModalCancelable,
    handleCreateProject,
    saveCode,
    isLoading,
    activeContest,
  } = useProjectManager({
    onLogout: logoutUser,
    onContestStart: () => {
        handleContestStart();
    },
    isContestPending,
    setIsContestPending,
    setTimeLeft: (t: number) => setTimeLeft(t),
    setIgnoreNextBlur: (b: boolean) => {
        if (setIgnoreNextBlurRef.current) setIgnoreNextBlurRef.current(b);
    },
    showToast,
    onUserLoaded: (id: string) => setCurrentUserId(id),
  });

  const {
    strikeCount,
    setStrikeCount,
    resumeContest,
    isQuittingRef,
    setIgnoreNextBlur,
  } = useContestSecurity({
    contestStarted,
    maxWarnings: MAX_WARNINGS,
    onLogout: logoutUser,
    showWarningModal,
    setShowWarningModal,
    userId: currentUserId,
    projectId: projectId,
  });

  // Hacky ref to pass down setIgnoreNextBlur to useProjectManager before it's defined
  const setIgnoreNextBlurRef = useRef<((b: boolean) => void) | null>(null);
  useEffect(() => {
    setIgnoreNextBlurRef.current = setIgnoreNextBlur;
  }, [setIgnoreNextBlur]);

  const {
    timeLeft,
    setTimeLeft,
    startTimer,
    stopTimer,
    formatTime,
  } = useContestTimer(0, async () => {
    setIgnoreNextBlur(true);
    showToast("Time's up! Auto-submitting your project...", "info");
    await submitProject(true);
  });

  // Keep refs in sync with state to avoid stale closures in timer/beacon callbacks
  useEffect(() => { startDurationRef.current = startDuration; }, [startDuration]);
  useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);

  const submitProject = async (isAutoSubmit = false) => {
    isQuittingRef.current = true;
    setIgnoreNextBlur(true);

    try {
      await saveCode({ html, css, js, timeLeft });

      const timeTaken = Math.max(0, startDurationRef.current - timeLeftRef.current);

      const res = await fetch(`/api/v1/code/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: 'include',
        body: JSON.stringify({ projectId, html, css, js, timeLeft, timeTaken }),
      });

      if (res.ok) {
        showToast(isAutoSubmit ? "Time's up! Project autosubmitted successfully!" : "Project submitted successfully! Your progress has been saved.", "success");
      }
    } catch (err) {
      console.error("Submission/Save failed", err);
    } finally {
      if (document.fullscreenElement) {
        try {
          await document.exitFullscreen();
        } catch (err) {
          console.error("Error exiting fullscreen:", err);
        }
      }

      setHtml("");
      setCss("");
      setJs("");
      setContestStarted(false);
      stopTimer();
      setTimeLeft(0);
      
      logoutUser();
    }
  };

  useEditorPersistence({
    html,
    css,
    js,
    timeLeft,
    projectName,
    projectId,
    userId: currentUserId,
    contestStarted,
    isLoading,
  });

  // Auto-submit via sendBeacon when user closes the browser window
  useEffect(() => {
    if (!contestStarted) return;

    const handleBeforeUnload = () => {
      if (isQuittingRef.current) return; // Already submitting via normal flow
      const timeTaken = Math.max(0, startDurationRef.current - timeLeftRef.current);
      const payload = JSON.stringify({
        projectId, html, css, js,
        timeLeft: timeLeftRef.current,
        timeTaken,
      });
      navigator.sendBeacon('/api/v1/code/submit', new Blob([payload], { type: 'application/json' }));
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [contestStarted, projectId, html, css, js]);

  const handleContestStart = async () => {
    try {
      await document.documentElement.requestFullscreen();
      setStrikeCount(0);
      setContestStarted(true);

      // Determine duration dynamically based on the active contest
      let duration = 0;
      if (activeContest?.startTime && activeContest?.endTime) {
         duration = Math.max(0, Math.floor((new Date(activeContest.endTime).getTime() - Date.now()) / 1000));
      }
      setStartDuration(duration);
      setTimeLeft(duration);
      startTimer();
    } catch {
      setIgnoreNextBlur(true);
      showToast("Fullscreen is required to start the contest.", "error");
    }
  };

  const startContest = async () => {
    // If user already has a project from the current contest (e.g. admin extended time),
    // allow them to resume it directly instead of forcing a new project.
    if (projectId && activeContest?.startTime) {
      const existingProject = projects.find(p => p._id === projectId);
      if (existingProject && new Date(existingProject.updatedAt) >= new Date(activeContest.startTime)) {
        handleContestStart();
        return;
      }
    }
    // Otherwise, force the user to create a new project for the contest
    setIsContestPending(true);
    setIsModalCancelable(true);
    setShowCreateModal(true);
  };

  const openNewProjectModal = () => {
    setIsContestPending(false);
    setIsModalCancelable(true);
    setShowCreateModal(true);
  };

  const handleCancelCreate = () => {
    setShowCreateModal(false);
    setIsContestPending(false);
  };

  const handleSubmitRequest = () => {
    if (!contestStarted) return;
    setIgnoreNextBlur(true);
    setShowSubmitConfirm(true);
  };



  const handleSubmitConfirm = async () => {
    setShowSubmitConfirm(false);
    await submitProject();
  };

  const handleSubmitCancel = () => {
    setShowSubmitConfirm(false);
    isQuittingRef.current = false;
  };

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col" onContextMenu={(e) => e.preventDefault()}>
      <ToastNotification toasts={toasts} onDismiss={dismissToast} />

      <ConfirmModal
        isVisible={showSubmitConfirm}
        title="Submit & Exit"
        message="Are you sure you want to submit? This will save your progress and exit the contest."
        confirmText="Submit"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleSubmitConfirm}
        onCancel={handleSubmitCancel}
      />

      <SecurityWarningModal 
        isVisible={showWarningModal}
        strikeCount={strikeCount}
        MAX_WARNINGS={MAX_WARNINGS}
        onResume={resumeContest}
        onSubmit={handleSubmitRequest}
      />

      {showCreateModal && (
        <CreateProjectModal 
          onSubmit={handleCreateProject} 
          onCancel={handleCancelCreate}
          isCreating={isCreatingProject} 
          isCancelable={isModalCancelable}
          existingProjectNames={projects.map((p) => p.name)}
        />
      )}

      <ContestBar 
        timeLeft={contestStarted ? timeLeft : 0}
        strikeCount={strikeCount}
        MAX_WARNINGS={MAX_WARNINGS}
        projectName={projectName}
        contestStarted={contestStarted}
        onStartContest={startContest}
        onNewProject={openNewProjectModal}
        formatTime={formatTime}
        activeContest={activeContest}
      />

      <div className={`flex h-[calc(100vh-100px)] min-w-0 ${showWarningModal ? "blur-sm pointer-events-none" : ""}`}>
        <FileExplorer activeFile={activeFile} setActiveFile={setActiveFile} />

        <PanelGroup orientation="horizontal" className="flex-1 w-full min-w-0">
          <Panel defaultSize={50} minSize={20} className="flex flex-col min-w-0 overflow-hidden bg-[#0f172a]">
            <PanelGroup orientation="vertical">
              <Panel defaultSize={70} minSize={30} className="flex flex-col border-b border-[#333]">
                <FileTabs activeFile={activeFile} />
                <div className="flex-1 overflow-hidden">
                  <CodeEditor
                    {...getEditorConfig(activeFile, {
                      html,
                      setHtml,
                      css,
                      setCss,
                      js,
                      setJs,
                    })}
                  />
                </div>
              </Panel>
              
              <PanelResizeHandle className="h-1 bg-[#1e293b] hover:bg-cyan-500 transition-colors w-full cursor-row-resize flex justify-center items-center z-10">
                <div className="h-0.5 w-8 bg-slate-500 rounded-full" />
              </PanelResizeHandle>
              
              <Panel defaultSize={30} minSize={10} className="flex flex-col">
                <Terminal logs={logs} />
              </Panel>
            </PanelGroup>
          </Panel>

          <PanelResizeHandle className="w-1.5 bg-[#1e293b] hover:bg-cyan-500 transition-colors h-full cursor-col-resize flex flex-col items-center justify-center z-10">
            <div className="w-0.5 h-8 bg-slate-500 rounded-full" />
          </PanelResizeHandle>

          <Panel defaultSize={50} minSize={20} className="flex flex-col bg-[#0f172a] border-l border-[#333] overflow-hidden">
            <EditorToolbar 
              showQuestion={showQuestion}
              setShowQuestion={setShowQuestion}
              contestStarted={contestStarted}
              onSave={() => {
                  setIgnoreNextBlur(true);
                  saveCode({ html, css, js, timeLeft });
              }}
              onSubmit={handleSubmitRequest}
            />
            <div className="flex-1 overflow-hidden flex flex-col">
              {showQuestion ? (
                <QuestionPanel 
                  imageUrl={activeContest?.imageUrl}
                  html={activeContest?.html}
                  css={activeContest?.css}
                  js={activeContest?.js}
                />
              ) : (
                <Preview html={html} css={css} js={js} />
              )}
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}

type EditorStates = {
  html: string;
  css: string;
  js: string;
  setHtml: (value: string) => void;
  setCss: (value: string) => void;
  setJs: (value: string) => void;
};

type EditorConfig = {
  language: "html" | "css" | "javascript" | "markdown";
  value: string;
  onChange: (value: string) => void;
};

function getEditorConfig(activeFile: string, states: EditorStates) {
  const configs: Record<string, EditorConfig> = {
    "index.html": { language: "html", value: states.html, onChange: states.setHtml },
    "styles.css": { language: "css", value: states.css, onChange: states.setCss },
    "script.js": { language: "javascript", value: states.js, onChange: states.setJs },
    "README.md": { language: "markdown", value: INITIAL_README, onChange: () => {} },
  };

  return configs[activeFile];
}