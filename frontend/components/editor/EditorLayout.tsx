"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import FileExplorer from "./FileExplorer";
import CodeEditor from "./CodeEditor";
import Preview from "./Preview";
import QuestionPanel from "./QuestionPanel";
import CreateProjectModal from "./CreateProjectModal";
import { getLocalProject } from "../../lib/indexedDB";
import { INITIAL_README, INITIAL_HTML, INITIAL_CSS, INITIAL_JS } from "../../utils/constants";
import { useEditorPersistence } from "../../hooks/useEditorPersistence";
import ContestBar from "./ContestBar";
import SecurityWarningModal from "./SecurityWarningModal";

let hasPromptedInSession = false;


export default function EditorLayout() {
  const router = useRouter();

  const [activeFile, setActiveFile] = useState("index.html");
  const [showQuestion, setShowQuestion] = useState(false);
  const [contestStarted, setContestStarted] = useState(false);
  const [strikeCount, setStrikeCount] = useState(0);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isContestPending, setIsContestPending] = useState(false);
  const [isModalCancelable, setIsModalCancelable] = useState(true);
  const [userProfile, setUserProfile] = useState<{ name: string; email: string } | null>(null);

  const violationLock = useRef(false);
  const isQuittingRef = useRef(false);

  const MAX_WARNINGS = 4;

  const CONTEST_DURATION = 180 * 60;
  const [timeLeft, setTimeLeft] = useState(CONTEST_DURATION);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const securityLoopRef = useRef<NodeJS.Timeout | null>(null);

  const [html, setHtml] = useState("");
  const [css, setCss] = useState("");
  const [js, setJs] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projects, setProjects] = useState<any[]>([]);

  const { saveToIDB, syncToBackend } = useEditorPersistence({
    html,
    css,
    js,
    timeLeft,
    projectName,
    contestStarted,
    onLoadFromIDB: (data) => {
      if (!contestStarted) {
      }
    },
  });

  const logoutUser = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (securityLoopRef.current) clearInterval(securityLoopRef.current);
    localStorage.clear();
    document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.push("/login");
  };

  
  const violate = () => {
    if (violationLock.current) return;

    violationLock.current = true;
    const newStrikes = strikeCount + 1;
    setStrikeCount(newStrikes);

    if (newStrikes >= MAX_WARNINGS) {
      logoutUser();
      return;
    }

    setShowWarningModal(true);

    setTimeout(() => {
      violationLock.current = false;
    }, 1000);
  };

  const resumeContest = async () => {
    try {
      await document.documentElement.requestFullscreen();
      setShowWarningModal(false);
    } catch {
      console.error("Fullscreen restore failed");
    }
  };

  // 🛡 CONTEST SECURITY HARDENING
  useEffect(() => {
    if (!contestStarted) return;

    // 1. Console Deterrent (Exploit debugger)
    securityLoopRef.current = setInterval(() => {
      const startTime = performance.now();
      debugger;
      const endTime = performance.now();
      if (endTime - startTime > 100) {
        // Console was likely open
        violate();
      }
    }, 1000);

    // 2. Prevent Keyboard Shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape key violation
      if (e.key === "Escape") {
        e.preventDefault();
        violate();
        return false;
      }

      // F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U, Ctrl+Shift+C
      if (
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "J" || e.key === "C")) ||
        (e.ctrlKey && e.key === "u") ||
        (e.ctrlKey && e.key === "s")
      ) {
        e.preventDefault();
        violate();
        return false;
      }
    };

   const handleSecurityBreach = () => {
  if (isQuittingRef.current) return;

  if (document.hidden || !document.hasFocus()) {
    violate();
  }
};


  const onFullscreenChange = () => {
  if (isQuittingRef.current) return;

  if (
    !document.fullscreenElement &&
    !violationLock.current &&
    !showWarningModal
  ) {
    violate();
  }
};


    const onBlur = () => {
      setTimeout(() => {
        const activeElem = document.activeElement;
        const isInternal =
          activeElem?.closest(".editor-center") ||
          activeElem?.closest(".preview-panel");

        if (!isInternal) handleSecurityBreach();
      }, 150);
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("visibilitychange", handleSecurityBreach);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", onBlur);

    return () => {
      if (securityLoopRef.current) clearInterval(securityLoopRef.current);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("visibilitychange", handleSecurityBreach);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", onBlur);
    };
  }, [contestStarted, showWarningModal]);


  const startContest = async () => {
    // Force a fresh project for contest
    setIsContestPending(true);
    setIsModalCancelable(true); // Can cancel to not start contest
    setShowCreateModal(true);
  };

  const openNewProjectModal = () => {
    setIsContestPending(false);
    setIsModalCancelable(true);
    setShowCreateModal(true);
  };

  const handleContestStart = async () => {
    try {
      await document.documentElement.requestFullscreen();
      setStrikeCount(0);
      setContestStarted(true);
      setTimeLeft(CONTEST_DURATION);
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    } catch {
      alert("Fullscreen is required.");
    }
  };

  const handleCancelCreate = () => {
    setShowCreateModal(false);
    setIsContestPending(false);
  };

  const searchParams = useSearchParams();
  const requestedProjectId = searchParams.get("projectId");

  useEffect(() => {
    const initData = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login"); // Strict redirect if no token
        return;
      }

      // 1. Fetch User Profile
      try {
        const profRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/api/v1/user/profile`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (profRes.ok) {
          const profText = await profRes.text();
          if (profText) {
            try {
              const profData = JSON.parse(profText);
              setUserProfile(profData);
            } catch (e) {
              console.error("Profile JSON parse error", e);
            }
          }
        } else if (profRes.status === 401) {
           // Token invalid
           logoutUser();
           return;
        }
      } catch (err) {
        console.error("Profile fetch failed", err);
      }

      // 2. Fetch Projects
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/api/v1/code`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setProjects(data);
            
            let targetProject = data[0]; 
            if (requestedProjectId) {
              const found = data.find(p => p._id === requestedProjectId);
              if (found) targetProject = found;
            }

            setProjectId(targetProject._id);
            setProjectName(targetProject.name);
            
            // Try to load from local cache first
            const localData = await getLocalProject(targetProject._id);
            if (localData && new Date(localData.updatedAt) > new Date(targetProject.updatedAt)) {
              setHtml(localData.html);
              setCss(localData.css);
              setJs(localData.js);
            } else {
              setHtml(targetProject.html || "");
              setCss(targetProject.css || "");
              setJs(targetProject.js || "");
            }

            if (targetProject.timeLeft !== undefined) {
              setTimeLeft(targetProject.timeLeft);
            }
          } else {
            // No projects found - mandatory creation
            setIsModalCancelable(false);
            setIsContestPending(false);
            setShowCreateModal(true);
          }
        }
      } catch (error) {
        console.error("Failed to fetch projects", error);
      }
    };

    initData();
  }, [router]); // Re-fetch when navigating back to this page



  const handleCreateProject = async (name: string) => {
    setIsCreatingProject(true);
    
    // Immediately save it to backend
    const token = localStorage.getItem("token");
    if (!token) {
      console.error("No token found, cannot save project");
      alert("You must be logged in to create a project");
      setIsCreatingProject(false);
      setShowCreateModal(false);
      return;
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/api/v1/code/save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          name, 
          html: INITIAL_HTML, 
          css: INITIAL_CSS, 
          js: INITIAL_JS, 
          timeLeft: CONTEST_DURATION 
        }),
      });
      
      if (res.ok) {
        const newData = await res.json();
        
        if (newData._id) {
          // Success: Update main states
          setProjectName(name);
          setHtml(INITIAL_HTML);
          setCss(INITIAL_CSS);
          setJs(INITIAL_JS);
          setProjectId(newData._id);
          setProjects([newData]);
          alert(`Project "${name}" created successfully!`);

          if (isContestPending) {
            handleContestStart();
            setIsContestPending(false);
          }
        } else {
          console.error("No _id in response:", newData);
          alert("Project created but missing ID");
        }
      } else {
        const errorText = await res.text();
        console.error("Failed to save project. Status:", res.status, "Error:", errorText);
        alert(`Failed to create project: ${res.status} ${errorText}`);
      }
    } catch (error) {
      console.error("Exception while saving project:", error);
      alert("Network error while creating project. Check console for details.");
    } finally {
      setIsCreatingProject(false);
      setShowCreateModal(false);
    }
  };


  const saveCode = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/api/v1/code/save`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name: projectName, html, css, js, timeLeft }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        setProjectId(data._id);
        alert("Code saved successfully!");
      } else {
        throw new Error("Save failed");
      }
    } catch (error) {
      console.error("Failed to save code", error);
      alert("Failed to save code. Please check your connection.");
    }
  };

  // ⏱ AUTO END WHEN TIME OVER
  useEffect(() => {
    if (contestStarted && timeLeft <= 0) {
      alert("Time's up!");
      logoutUser();
    }
  }, [timeLeft, contestStarted]);

 const quitContest = async () => {
  isQuittingRef.current = true;

  if (confirm("Are you sure you want to quit? This will save your progress and exit.")) {
    await saveCode();

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
    setTimeLeft(CONTEST_DURATION);
    if (timerRef.current) clearInterval(timerRef.current);
    if (securityLoopRef.current) clearInterval(securityLoopRef.current);

    alert("Contest exited. Your data has been saved and editor cleared.");
    logoutUser();
  }

  isQuittingRef.current = false;
};



  // ⏱ FORMAT TIME → H:MM:SS
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
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
          <div className="tabs" style={{ background: "#1e293b", color: "#94a3b8", borderBottom: "1px solid #0f172a" }}>
            <span style={{ borderBottom: "2px solid #38bdf8", padding: "8px 16px", color: "#f8fafc" }}>{activeFile}</span>
          </div>
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
          <div style={{ padding: "10px", display: "flex", gap: "10px", borderBottom: "1px solid #1e293b" }}>
            <button
              onClick={() => setShowQuestion(!showQuestion)}
              className="preview-toggle"
              style={{
                flex: 1,
                padding: "8px",
                background: showQuestion ? "#334155" : "#1e293b",
                border: "1px solid #334155",
                borderRadius: "4px",
                color: "white",
                cursor: "pointer"
              }}
            >
              {showQuestion ? "👁 Preview" : "📝 Question"}
            </button>
            <button 
              onClick={saveCode} 
              className="preview-toggle" 
              style={{ 
                flex: 1,
                padding: "8px",
                background: "linear-gradient(135deg, #10b981, #059669)", 
                border: "none",
                borderRadius: "4px",
                color: "white",
                fontWeight: "bold",
                cursor: "pointer",
                boxShadow: "0 4px 10px rgba(16, 185, 129, 0.2)"
              }}
            >
              💾 Save
            </button>
            <button 
              onClick={async () => {
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
                  if (res.ok) alert("Snapshot submitted successfully! View it in your profile.");
                } catch (err) {
                  console.error("Submission failed", err);
                }
              }} 
              disabled={!contestStarted}
              className="preview-toggle" 
              style={{ 
                flex: 1,
                padding: "8px",
                background: contestStarted 
                  ? "linear-gradient(135deg, #0ea5e9, #2563eb)" 
                  : "#334155", 
                border: "none",
                borderRadius: "4px",
                color: contestStarted ? "white" : "#94a3b8",
                fontWeight: "bold",
                cursor: contestStarted ? "pointer" : "not-allowed",
                boxShadow: contestStarted 
                  ? "0 4px 10px rgba(14, 165, 233, 0.2)" 
                  : "none",
                opacity: contestStarted ? 1 : 0.7
              }}
            >
              🚀 Submit
            </button>
          </div>
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
