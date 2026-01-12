"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import FileExplorer from "./FileExplorer";
import CodeEditor from "./CodeEditor";
import Preview from "./Preview";
import QuestionPanel from "./QuestionPanel";

export default function EditorLayout() {
  const router = useRouter();

  const [activeFile, setActiveFile] = useState("index.html");
  const [showQuestion, setShowQuestion] = useState(false);
  const [contestStarted, setContestStarted] = useState(false);
  const [strikeCount, setStrikeCount] = useState(0);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [userProfile, setUserProfile] = useState<{ name: string; email: string } | null>(null);

  const violationLock = useRef(false);
  const MAX_WARNINGS = 3;

  const CONTEST_DURATION = 180 * 60;
  const [timeLeft, setTimeLeft] = useState(CONTEST_DURATION);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const syncRef = useRef<NodeJS.Timeout | null>(null);
  const idbRef = useRef<IDBDatabase | null>(null);
  const securityLoopRef = useRef<NodeJS.Timeout | null>(null);

  const [html, setHtml] = useState("<h1>Hello World</h1>");
  const [css, setCss] = useState("h1 { color: red; }");
  const [js, setJs] = useState("console.log('Hello JS');");
  const [projectName, setProjectName] = useState("My Project");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projects, setProjects] = useState<any[]>([]);

  // IndexedDB Init
  useEffect(() => {
    if (typeof window === "undefined") return;
    const request = indexedDB.open("EditorDB", 1);
    request.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("code")) {
        db.createObjectStore("code", { keyPath: "id" });
      }
    };
    request.onsuccess = (e: any) => {
      idbRef.current = e.target.result;
      loadFromIndexedDB();
    };
  }, []);

  const saveToIndexedDB = () => {
    if (!idbRef.current) return;
    try {
      const transaction = idbRef.current.transaction("code", "readwrite");
      const store = transaction.objectStore("code");
      store.put({ id: "current", html, css, js, timeLeft, updatedAt: Date.now() });
    } catch (err) {
      console.error("IDB Save failed", err);
    }
  };

  const loadFromIndexedDB = () => {
    if (!idbRef.current) return;
    const transaction = idbRef.current.transaction("code", "readonly");
    const store = transaction.objectStore("code");
    const request = store.get("current");
    request.onsuccess = (e: any) => {
      const data = e.target.result;
      if (data && !contestStarted) {
        // Fallback if network fails, or load if fresher
        // setHtml(data.html); ...
      }
    };
  };

  // 2s Auto-save to IndexedDB
  useEffect(() => {
    const interval = setInterval(() => {
      saveToIndexedDB();
    }, 2000);
    return () => clearInterval(interval);
  }, [html, css, js, timeLeft]);

  // 10s Periodic Sync to Backend
  useEffect(() => {
    if (!contestStarted) return;

    syncRef.current = setInterval(() => {
      syncToBackend();
    }, 10000);

    return () => {
      if (syncRef.current) clearInterval(syncRef.current);
    };
  }, [contestStarted, html, css, js, timeLeft]);

  const syncToBackend = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      await fetch(
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
    } catch (error) {
      console.error("Auto-sync failed", error);
    }
  };

  const logoutUser = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (syncRef.current) clearInterval(syncRef.current);
    if (securityLoopRef.current) clearInterval(securityLoopRef.current);
    localStorage.clear();
    // Clear token cookie
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
      console.error("Fullscreen restoration failed");
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
      if (document.hidden || !document.hasFocus()) {
        violate();
      }
    };

    const onFullscreenChange = () => {
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
          activeElem?.tagName === "IFRAME" ||
          activeElem?.closest(".editor-center");
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
  }, [contestStarted, strikeCount, showWarningModal]);

  // ⏱ START CONTEST + TIMER
  const startContest = async () => {
    try {
      await document.documentElement.requestFullscreen();
      setStrikeCount(0);
      setContestStarted(true);

      setTimeLeft(timeLeft > 0 ? timeLeft : CONTEST_DURATION);
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    } catch {
      alert("Fullscreen is required to start.");
    }
  };

  useEffect(() => {
    const initData = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;

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
            const latest = data[0]; // Sorted by updatedAt -1 on backend
            setProjectId(latest._id);
            setProjectName(latest.name);
            setHtml(latest.html || "");
            setCss(latest.css || "");
            setJs(latest.js || "");
            if (latest.timeLeft !== undefined) {
              setTimeLeft(latest.timeLeft);
            }
          }
        }
      } catch (error) {
        console.error("Failed to fetch projects", error);
      }
    };

    initData();
  }, []);

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
    if (!contestStarted) return;

    if (timeLeft <= 0) {
      alert("Time's up! Contest ended.");
      logoutUser();
    }
  }, [timeLeft, contestStarted]);

  const quitContest = async () => {
    if (confirm("Are you sure you want to quit? This will save your progress and exit.")) {
      // 1. Save content to DB
      await saveCode();

      // 2. Exit full screen if active
      if (document.fullscreenElement) {
        try {
          await document.exitFullscreen();
        } catch (err) {
          console.error("Error exiting fullscreen:", err);
        }
      }

      // 3. Clear content from editor
      setHtml("");
      setCss("");
      setJs("");

      // 4. Reset contest state
      setContestStarted(false);
      if (timerRef.current) clearInterval(timerRef.current);
      if (syncRef.current) clearInterval(syncRef.current);
      if (securityLoopRef.current) clearInterval(securityLoopRef.current);
      
      alert("Contest exited. Your data has been saved and editor cleared.");
    }
  };

  // ⏱ FORMAT TIME → H:MM:SS
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div
      className="editor-layout-wrapper"
      onContextMenu={(e) => e.preventDefault()}
    >
      {showWarningModal && (
        <div className="violation-overlay">
          <div className="warning-card">
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
            <h2>Security Violation</h2>
            <p style={{ color: strikeCount >= 2 ? "#ff5555" : "#ffcc00", fontWeight: "bold" }}>
              Warning {strikeCount} of {MAX_WARNINGS}
            </p>
            <p className="sub-text">
              Switching tabs, exiting fullscreen, or opening devtools is strictly prohibited.
              One more violation may end your session.
            </p>
            <div className="modal-buttons">
              <button className="resume-btn" onClick={resumeContest}>
                Return to Contest
              </button>
              <button className="quit-btn" onClick={quitContest}>
                Quit Contest
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="contest-bar" style={{ background: "#0f172a", borderBottom: "1px solid #1e293b", height: "50px", padding: "0 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <span style={{ color: timeLeft < 300 ? "#f87171" : "#38bdf8", fontWeight: "600", fontSize: "1.1rem", fontFamily: "monospace" }}>
            ⏱ {formatTime(timeLeft)}
          </span>
          <div style={{ height: "20px", width: "1px", background: "#334155" }} />
          <span style={{ color: "#94a3b8", fontSize: "0.9rem" }}>
            Strikes: <span style={{ color: strikeCount > 0 ? "#f87171" : "#10b981" }}>{strikeCount} / {MAX_WARNINGS}</span>
          </span>
        </div>

        {userProfile && (
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
               <select 
                  value={projectName}
                  onChange={(e) => {
                    const selected = projects.find(p => p.name === e.target.value);
                    if (selected) {
                      setProjectId(selected._id);
                      setProjectName(selected.name);
                      setHtml(selected.html);
                      setCss(selected.css);
                      setJs(selected.js);
                      setTimeLeft(selected.timeLeft);
                    } else if (e.target.value === "NEW_PROJECT") {
                      const name = prompt("Enter project name:");
                      if (name) {
                        setProjectId(null);
                        setProjectName(name);
                        setHtml("<h1>New Project</h1>");
                        setCss("");
                        setJs("");
                        setTimeLeft(CONTEST_DURATION);
                      }
                    }
                  }}
                  style={{ background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", borderRadius: "4px", fontSize: "12px", padding: "2px 8px" }}
               >
                  {projects.map(p => <option key={p._id} value={p.name}>{p.name}</option>)}
                  <option value="NEW_PROJECT">+ New Project</option>
               </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px", background: "#1e293b", padding: "4px 12px", borderRadius: "20px", border: "1px solid #334155" }}>
              <div style={{ width: "24px", height: "24px", background: "#0ea5e9", borderRadius: "50%", display: "flex", alignItems: "center", justifyItems: "center", fontSize: "12px", fontWeight: "bold", color: "white", justifyContent: "center" }}>
                {userProfile.name?.[0]?.toUpperCase() || "U"}
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "12px", fontWeight: "600", color: "#e2e8f0", lineHeight: "1" }}>{userProfile.name || "User"}</span>
                <span style={{ fontSize: "10px", color: "#94a3b8" }}>{userProfile.email || "No Email"}</span>
              </div>
            </div>
          </div>
        )}

        <div className="contest-controls" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            className="start-btn"
            onClick={startContest}
            disabled={contestStarted}
            style={{ 
              background: contestStarted ? "#1e293b" : "linear-gradient(135deg, #0ea5e9, #2563eb)",
              color: "white",
              padding: "8px 20px",
              borderRadius: "6px",
              boxShadow: contestStarted ? "none" : "0 4px 12px rgba(37, 99, 235, 0.3)"
            }}
          >
            {contestStarted ? "Contest Active" : "Start Contest"}
          </button>
          {contestStarted && (
            <button className="quit-link" onClick={quitContest} style={{ color: "#94a3b8", fontSize: "0.85rem", textDecoration: "none" }}>
              Quit
            </button>
          )}
        </div>
      </div>

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
              className="preview-toggle" 
              style={{ 
                flex: 1,
                padding: "8px",
                background: "linear-gradient(135deg, #0ea5e9, #2563eb)", 
                border: "none",
                borderRadius: "4px",
                color: "white",
                fontWeight: "bold",
                cursor: "pointer",
                boxShadow: "0 4px 10px rgba(14, 165, 233, 0.2)"
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
    "index.html": {
      language: "html",
      value: states.html,
      onChange: states.setHtml,
    },
    "styles.css": {
      language: "css",
      value: states.css,
      onChange: states.setCss,
    },
    "script.js": {
      language: "javascript",
      value: states.js,
      onChange: states.setJs,
    },
  };

  return configs[activeFile];
}
