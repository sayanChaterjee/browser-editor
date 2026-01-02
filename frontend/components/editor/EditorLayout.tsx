"use client";

import { useState, useEffect, useRef } from "react";
import FileExplorer from "./FileExplorer";
import CodeEditor from "./CodeEditor";
import Preview from "./Preview";
import QuestionPanel from "./QuestionPanel";

export default function EditorLayout() {
  const [activeFile, setActiveFile] = useState("index.html");
  const [showQuestion, setShowQuestion] = useState(false);

  const [contestStarted, setContestStarted] = useState(false);
  const [locked, setLocked] = useState(false);

  const strikes = useRef(0);
  const violationLock = useRef(false); 
  const MAX_WARNINGS = 3;

  const [html, setHtml] = useState("<h1>Hello World</h1>");
  const [css, setCss] = useState("h1 { color: red; }");
  const [js, setJs] = useState("console.log('Hello JS');");

  
  useEffect(() => {
    if (!contestStarted) return;

    const violate = () => {
      if (violationLock.current || locked) return;

      violationLock.current = true;
      strikes.current += 1;

      if (strikes.current > MAX_WARNINGS) {
        setLocked(true);
        alert("❌ Contest locked due to multiple violations.");
        return;
      }

      alert(
        `⚠ Warning ${strikes.current}/${MAX_WARNINGS}\nDo not switch tabs or exit fullscreen!`
      );

      document.documentElement.requestFullscreen().catch(() => {});

     
      setTimeout(() => {
        violationLock.current = false;
      }, 1500);
    };

    const onFullscreenChange = () => {
      if (!document.fullscreenElement) violate();
    };

    const onVisibilityChange = () => {
      if (document.hidden) violate();
    };

    const onBlur = () => {
      violate();
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
    };
  }, [contestStarted, locked]);


  const getEditorConfig = () => {
    switch (activeFile) {
      case "index.html":
        return {
          language: "html" as const,
          value: html,
          onChange: setHtml,
        };

      case "styles.css":
        return {
          language: "css" as const,
          value: css,
          onChange: setCss,
        };

      case "script.js":
        return {
          language: "javascript" as const,
          value: js,
          onChange: setJs,
        };
    }
  };

  const startContest = async () => {
    await document.documentElement.requestFullscreen();
    strikes.current = 0;
    violationLock.current = false;
    setContestStarted(true);
  };

 
  if (locked) {
    return (
      <div className="locked-screen">
        <h2>Contest Locked 🔒</h2>
        <p>You violated contest rules multiple times.</p>
      </div>
    );
  }


  return (
    <div className="editor-layout-wrapper">
      
      <div className="contest-bar">
        <span>
          ⚠ Leaving fullscreen or switching tabs gives 3 warnings. After that,
          contest locks.
        </span>

        <button
          className="start-btn"
          onClick={startContest}
          disabled={contestStarted}
        >
          {contestStarted ? "Contest Running" : "Start Contest"}
        </button>
      </div>

      {/* MAIN EDITOR */}
      <div className="editor-layout">
        <FileExplorer
          activeFile={activeFile}
          setActiveFile={setActiveFile}
        />

        <div className="editor-center">
          <div className="tabs">{activeFile}</div>
          <CodeEditor {...getEditorConfig()!} />
        </div>

        <div className="preview-panel">
          <button
            onClick={() => setShowQuestion((v) => !v)}
            className="preview-toggle"
          >
            {showQuestion ? "View Preview" : "View Question"}
          </button>

          {showQuestion ? (
            <QuestionPanel />
          ) : (
            <Preview html={html} css={css} js={js} />
          )}
        </div>
      </div>
    </div>
  );
}
