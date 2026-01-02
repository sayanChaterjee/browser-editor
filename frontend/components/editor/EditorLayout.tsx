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
  
  const violationLock = useRef(false);
  const MAX_WARNINGS = 3;

  const [html, setHtml] = useState("<h1>Hello World</h1>");
  const [css, setCss] = useState("h1 { color: red; }");
  const [js, setJs] = useState("console.log('Hello JS');");

  const logoutUser = () => {
    localStorage.clear();
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
    } catch (err) {
      console.error("Fullscreen restoration failed");
    }
  };

  useEffect(() => {
    if (!contestStarted) return;

    const handleSecurityBreach = () => {
      if (document.hidden || !document.hasFocus()) {
        violate();
      }
    };

    const onFullscreenChange = () => {
      if (!document.fullscreenElement && !violationLock.current && !showWarningModal) {
        violate();
      }
    };

    const onBlur = () => {
      setTimeout(() => {
        const activeElem = document.activeElement;
        const isInternal = activeElem?.tagName === "IFRAME" || activeElem?.closest('.editor-center');
        if (!isInternal) handleSecurityBreach();
      }, 100);
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("visibilitychange", handleSecurityBreach);
    window.addEventListener("blur", onBlur);

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("visibilitychange", handleSecurityBreach);
      window.removeEventListener("blur", onBlur);
    };
  }, [contestStarted, strikeCount, showWarningModal]);

  const startContest = async () => {
    try {
      await document.documentElement.requestFullscreen();
      setStrikeCount(0);
      setContestStarted(true);
    } catch (err) {
      alert("Fullscreen is required to start.");
    }
  };

  const quitContest = () => {
    if (confirm("Are you sure you want to quit? This will end your session.")) {
      logoutUser();
    }
  };

  return (
    <div className="editor-layout-wrapper" onContextMenu={(e) => e.preventDefault()}>
      {showWarningModal && (
        <div className="violation-overlay">
          <div className="warning-card">
            <h2>Security Violation</h2>
            <p>Warning {strikeCount} of {MAX_WARNINGS}</p>
            <p className="sub-text">Switching tabs or exiting fullscreen is prohibited.</p>
            <div className="modal-buttons">
              <button className="resume-btn" onClick={resumeContest}>Return to Contest</button>
              <button className="quit-btn" onClick={quitContest}>Quit Contest</button>
            </div>
          </div>
        </div>
      )}

      <div className="contest-bar">
        <span>Warnings: {strikeCount} / {MAX_WARNINGS}</span>
        <div className="contest-controls">
           <button className="start-btn" onClick={startContest} disabled={contestStarted}>
            {contestStarted ? "Contest Active" : "Start Contest"}
          </button>
          {contestStarted && <button className="quit-link" onClick={quitContest}>Quit</button>}
        </div>
      </div>

      <div className={`editor-layout ${showWarningModal ? "blur-effect" : ""}`}>
        <FileExplorer activeFile={activeFile} setActiveFile={setActiveFile} />
        <div className="editor-center">
          <div className="tabs">{activeFile}</div>
          <CodeEditor {...getEditorConfig(activeFile, { html, setHtml, css, setCss, js, setJs })} />
        </div>
        <div className="preview-panel">
          <button onClick={() => setShowQuestion(!showQuestion)} className="preview-toggle">
            {showQuestion ? "Preview" : "Question"}
          </button>
          {showQuestion ? <QuestionPanel /> : <Preview html={html} css={css} js={js} />}
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
  };
  return configs[activeFile];
}