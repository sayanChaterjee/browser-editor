"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import FileExplorer from "./FileExplorer";
import CodeEditor from "./CodeEditor";
import Preview from "./Preview";
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
const CONTEST_DURATION = 180 * 60;

export default function EditorLayout() {
  const router = useRouter();
  const [showQuestion, setShowQuestion] = useState(false);
  const [contestStarted, setContestStarted] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [isContestPending, setIsContestPending] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  const { toasts, showToast, dismissToast } = useToast();

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    document.addEventListener("contextmenu", handleContextMenu);
    return () => document.removeEventListener("contextmenu", handleContextMenu);
  }, []);

  const logoutUser = async () => {
    stopTimer();
    await clearLocalProjects();
    await signOut();
    router.push("/login");
  };

  const {
    timeLeft,
    setTimeLeft,
    startTimer,
    stopTimer,
    formatTime,
  } = useContestTimer(CONTEST_DURATION, () => {
    setIgnoreNextBlur(true);
    showToast("Time's up! Your session has ended.", "warning");
    logoutUser();
  });

  const {
    strikeCount,
    setStrikeCount,
    violate,
    resumeContest,
    isQuittingRef,
    setIgnoreNextBlur,
  } = useContestSecurity({
    contestStarted,
    maxWarnings: MAX_WARNINGS,
    onLogout: logoutUser,
    showWarningModal,
    setShowWarningModal,
  });

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
    userProfile,
    showCreateModal,
    setShowCreateModal,
    isCreatingProject,
    isModalCancelable,
    setIsModalCancelable,
    handleCreateProject,
    saveCode,
    isLoading,
  } = useProjectManager({
    onLogout: logoutUser,
    contestDuration: CONTEST_DURATION,
    onContestStart: () => {
        handleContestStart();
    },
    isContestPending,
    setIsContestPending,
    setTimeLeft,
    setIgnoreNextBlur,
    showToast,
  });

  const { saveToIDB } = useEditorPersistence({
    html,
    css,
    js,
    timeLeft,
    projectName,
    projectId,
    userId: (userProfile as any)?.id || null,
    contestStarted,
    isLoading,
    onLoadFromIDB: () => {},
  });

  const handleContestStart = async () => {
    try {
      await document.documentElement.requestFullscreen();
      setStrikeCount(0);
      setContestStarted(true);
      setTimeLeft(CONTEST_DURATION);
      startTimer();
    } catch {
      setIgnoreNextBlur(true);
      showToast("Fullscreen is required to start the contest.", "error");
    }
  };

  const startContest = async () => {
    if (projectId) {
        handleContestStart();
    } else {
        setIsContestPending(true);
        setIsModalCancelable(true);
        setShowCreateModal(true);
    }
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
    isQuittingRef.current = true;
    setIgnoreNextBlur(true);

    try {
      await saveCode({ html, css, js, timeLeft });

      const res = await fetch(`/api/v1/code/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: 'include',
        body: JSON.stringify({ projectId, html, css, js, timeLeft }),
      });

      if (res.ok) {
        showToast("Project submitted successfully! Your progress has been saved.", "success");
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
      setTimeLeft(CONTEST_DURATION);
      
      logoutUser();
    }
  };

  const handleSubmitCancel = () => {
    setShowSubmitConfirm(false);
    isQuittingRef.current = false;
  };

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col select-none" onContextMenu={(e) => e.preventDefault()}>
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
        timeLeft={timeLeft}
        strikeCount={strikeCount}
        MAX_WARNINGS={MAX_WARNINGS}
        projectName={projectName}
        contestStarted={contestStarted}
        onStartContest={startContest}
        onNewProject={openNewProjectModal}
        formatTime={formatTime}
      />

      <div className={`flex h-[calc(100vh-100px)] min-w-0 ${showWarningModal ? "blur-sm pointer-events-none" : ""}`}>
        <FileExplorer activeFile={activeFile} setActiveFile={setActiveFile} />

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#0f172a]">
          <FileTabs activeFile={activeFile} />
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

        <div className="flex-1 w-full min-w-[320px] flex flex-col bg-[#0f172a] border-l border-[#333] overflow-hidden">
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
          <div className="flex-1 overflow-hidden">
            {showQuestion ? (
              <QuestionPanel />
            ) : (
              <Preview html={html} css={css} js={js} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getEditorConfig(activeFile: string, states: any) {
  const configs: Record<string, any> = {
    "index.html": { language: "html", value: states.html, onChange: states.setHtml },
    "styles.css": { language: "css", value: states.css, onChange: states.setCss },
    "script.js": { language: "javascript", value: states.js, onChange: states.setJs },
    "README.md": { language: "markdown", value: INITIAL_README, onChange: () => {} },
  };

  return configs[activeFile];
}