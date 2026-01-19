"use client";

import { useState } from "react";
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

// Hooks
import { useProjectManager } from "../../hooks/useProjectManager";
import { useContestTimer } from "../../hooks/useContestTimer";
import { useContestSecurity } from "../../hooks/useContestSecurity";

const MAX_WARNINGS = 4;
const CONTEST_DURATION = 180 * 60;

export default function EditorLayout() {
  const router = useRouter();
  const [showQuestion, setShowQuestion] = useState(false);
  const [contestStarted, setContestStarted] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [isContestPending, setIsContestPending] = useState(false);

  const logoutUser = () => {
    stopTimer();
    localStorage.clear();
    document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
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
    alert("Time's up!");
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
  });

  const { saveToIDB } = useEditorPersistence({
    html,
    css,
    js,
    timeLeft,
    projectName,
    contestStarted,
    onLoadFromIDB: () => {},
  });

  const handleContestStart = async () => {
    try {
      await document.documentElement.requestFullscreen();
      setStrikeCount(0);
      setContestStarted(true);
      startTimer();
    } catch {
      setIgnoreNextBlur(true);
      alert("Fullscreen is required.");
    }
  };

  const startContest = async () => {
    // Check if we have a project loaded
    if (projectId) {
        handleContestStart();
    } else {
        // No project, show modal but it's for starting contest
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

  const quitContest = async () => {
    isQuittingRef.current = true;
    setIgnoreNextBlur(true);
    if (confirm("Are you sure you want to quit? This will save your progress and exit.")) {
      await saveCode({ html, css, js, timeLeft });

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

      alert("Contest exited. Your data has been saved and editor cleared.");
      logoutUser();
    }

    isQuittingRef.current = false;
  };

  const handleSubmit = async () => {
    if (!contestStarted) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/api/v1/code/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ projectId, html, css, js, timeLeft }),
      });
      if (res.ok) {
        setIgnoreNextBlur(true);
        alert("Snapshot submitted successfully! View it in your profile.");
      }
    } catch (err) {
      console.error("Submission failed", err);
    }
  };

  return (
    <div className="editor-layout-wrapper" onContextMenu={(e) => e.preventDefault()}>
      <SecurityWarningModal 
        isVisible={showWarningModal}
        strikeCount={strikeCount}
        MAX_WARNINGS={MAX_WARNINGS}
        onResume={resumeContest}
        onQuit={quitContest}
      />

      {showCreateModal && (
        <CreateProjectModal 
          onSubmit={handleCreateProject} 
          onCancel={handleCancelCreate}
          isCreating={isCreatingProject} 
          isCancelable={isModalCancelable}
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
        onQuitContest={quitContest}
        formatTime={formatTime}
      />

      <div className={`editor-layout ${showWarningModal ? "blur-effect" : ""}`} style={{ height: "calc(100vh - 100px)" }}>
        <FileExplorer activeFile={activeFile} setActiveFile={setActiveFile} />

        <div className="editor-center" style={{ background: "#0f172a" }}>
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

        <div className="preview-panel" style={{ background: "#0f172a" }}>
          <EditorToolbar 
            showQuestion={showQuestion}
            setShowQuestion={setShowQuestion}
            contestStarted={contestStarted}
            onSave={() => {
                setIgnoreNextBlur(true);
                saveCode({ html, css, js, timeLeft });
            }}
            onSubmit={handleSubmit}
          />
          <div style={{ flex: 1, overflow: "hidden" }}>
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