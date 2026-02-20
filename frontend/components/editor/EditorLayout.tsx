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
import { clearLocalProjects } from "../../lib/indexedDB";

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

  const handleSubmit = async () => {
    if (!contestStarted) return;
    
    isQuittingRef.current = true;
    setIgnoreNextBlur(true);

    if (confirm("Are you sure you want to submit? This will save your progress and exit.")) {
      try {
        // First save to standard save endpoint
        await saveCode({ html, css, js, timeLeft });

        // Then submit to snapshot endpoint
        const res = await fetch(`/api/v1/code/submit`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: 'include',
          body: JSON.stringify({ projectId, html, css, js, timeLeft }),
        });

        if (res.ok) {
          alert("Project submitted successfully! Your progress has been saved.");
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
    }

    isQuittingRef.current = false;
  };

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col select-none" onContextMenu={(e) => e.preventDefault()}>
      <SecurityWarningModal 
        isVisible={showWarningModal}
        strikeCount={strikeCount}
        MAX_WARNINGS={MAX_WARNINGS}
        onResume={resumeContest}
        onSubmit={handleSubmit}
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
            onSubmit={handleSubmit}
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