"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import FileExplorer from "./FileExplorer";
import CodeEditor from "./CodeEditor";
import Preview from "./Preview";
import QuestionPanel from "./QuestionPanel";
import ReactMarkdown from "react-markdown";
import { AiOutlineWarning } from "react-icons/ai"; 

export default function EditorLayout() {
  const router = useRouter();

  const [activeFile, setActiveFile] = useState("index.html");
  const [showQuestion, setShowQuestion] = useState(false);
  const [contestStarted, setContestStarted] = useState(false);
  const [strikeCount, setStrikeCount] = useState(0);
  const [showWarningModal, setShowWarningModal] = useState(false);

  const violationLock = useRef(false);
  const MAX_WARNINGS = 3;

  const CONTEST_DURATION = 180 * 60;
  const [timeLeft, setTimeLeft] = useState(CONTEST_DURATION);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [html, setHtml] = useState("<h1>Hello World</h1>");
  const [css, setCss] = useState("h1 { color: red; }");
  const [js, setJs] = useState("console.log('Hello JS');");

 const [md] = useState(`
# HTML TAG REFERENCE

## Structural Tags
- <div>: Generic container used for layout
- <span>: Inline container for styling text
- <header>: Represents introductory content or navigation
- <footer>: Represents footer content
- <section>: Semantic section of a page
- <article>: Self-contained content
- <main>: Main content of the document
- <nav>: Navigation links
- <aside>: Sidebar content
- <figure>: Content with optional caption
- <figcaption>: Caption for <figure>

## Headings & Text
- <h1> – <h6>: Headings from most important to least
- <p>: Paragraph text
- <hr>: Horizontal rule (line)
- <blockquote>: Quoted content
- <pre>: Preformatted text
- <code>: Inline code

## Lists
- <ul>: Unordered list
- <ol>: Ordered list
- <li>: List item
- <dl>: Description list
- <dt>: Description term
- <dd>: Description definition

## Forms & Input
- <form>: Groups inputs for submission
- <input>: Accepts user input
- <textarea>: Multi-line input
- <select>: Dropdown select box
- <option>: Option inside select
- <label>: Label for input
- <button>: Clickable button
- <fieldset>: Groups related inputs
- <legend>: Title for fieldset

## Links & Media
- <a>: Creates a hyperlink
- <img>: Displays an image
- <video>: Embeds a video
- <audio>: Embeds audio
- <source>: Media source
- <map>: Image map
- <area>: Area inside a map

## Tables
- <table>: Table container
- <tr>: Table row
- <th>: Table header cell
- <td>: Table data cell
- <caption>: Table caption
- <thead>: Table header group
- <tbody>: Table body group
- <tfoot>: Table footer group

## Semantic & Misc
- <em>: Emphasized text
- <strong>: Important text
- <b>: Bold text
- <i>: Italic text
- <u>: Underlined text
- <s>: Strikethrough text
- <mark>: Highlighted text
- <abbr>: Abbreviation
- <time>: Date/time value
- <details>: Collapsible content
- <summary>: Summary for details
- <progress>: Progress bar
- <dialog>: Dialog box


`);




  const logoutUser = () => {
    if (timerRef.current) clearInterval(timerRef.current);
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
    } catch {
      console.error("Fullscreen restore failed");
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
      if (!document.fullscreenElement && !showWarningModal) {
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
  }, [contestStarted, showWarningModal]);


  const startContest = async () => {
    try {
      await document.documentElement.requestFullscreen();
      setStrikeCount(0);
      setContestStarted(true);
      setTimeLeft(CONTEST_DURATION);

      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } catch {
      alert("Fullscreen is required.");
    }
  };

  useEffect(() => {
    if (contestStarted && timeLeft <= 0) {
      alert("Time's up!");
      logoutUser();
    }
  }, [timeLeft, contestStarted]);

  const quitContest = () => {
    if (confirm("Are you sure you want to quit?")) {
      logoutUser();
    }
  };

  const hours = Math.floor(timeLeft / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;


  return (
    <div className="editor-layout-wrapper" onContextMenu={(e) => e.preventDefault()}>
      {showWarningModal && (
        <div className="violation-overlay">
          <div className="warning-card">
                            <h2 style={{  display: "flex",
    flexDirection: "column",
    alignItems: "center",    
    justifyContent: "center",
    gap: "12px",             
    color: "orange",
    fontSize: "24px",
    fontWeight: "bold",
    marginBottom: "20px" }}>
                        <AiOutlineWarning size={24} />
                  Security Violation
                </h2>
            <p>Warning {strikeCount} of {MAX_WARNINGS}</p><br/>
            <p>Switching tabs or exiting fullscreen is prohibited.</p><br/>
            <button className="return" onClick={resumeContest}>Return</button>
            <button className="return" onClick={quitContest}>Quit</button>
          </div>
        </div>
      )}

      <div className="contest-bar">
        ⏱ {hours}:{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        <button onClick={startContest} disabled={contestStarted}>
          {contestStarted ? "Active" : "Start"}
        </button>
        {contestStarted && <button onClick={quitContest}>Quit</button>}
      </div>

      <div className="editor-layout">
        <FileExplorer activeFile={activeFile} setActiveFile={setActiveFile} />

        <div className="editor-center">
          <div className="tabs">
            <span>{activeFile === "README.md" ? "HTML Reference" : activeFile}</span>
          </div>

          {activeFile === "README.md" ? (
            <div className="markdown-preview exam-doc">
              <ReactMarkdown>{md}</ReactMarkdown>
            </div>
          ) : (
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
          )}
        </div>

        <div className="preview-panel">
          <button onClick={() => setShowQuestion(!showQuestion)}>
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
