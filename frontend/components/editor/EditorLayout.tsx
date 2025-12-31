"use client";

import { useState } from "react";
import FileExplorer from "./FileExplorer";
import CodeEditor from "./CodeEditor";
import Preview from "./Preview";

export default function EditorLayout() {
  const [activeFile, setActiveFile] = useState("index.html");

  const [html, setHtml] = useState("<h1>Hello World</h1>");
  const [css, setCss] = useState("h1 { color: red; }");
  const [js, setJs] = useState("console.log('Hello JS');");

  const getEditorConfig = () => {
    switch (activeFile) {
      case "index.html":
        return { language: "html" as const, value: html, onChange: setHtml };
      case "styles.css":
        return { language: "css" as const, value: css, onChange: setCss };
      case "script.js":
        return {
          language: "javascript" as const,
          value: js,
          onChange: setJs,
        };
    }
  };

  return (
    <div className="editor-layout">
      <FileExplorer
        activeFile={activeFile}
        setActiveFile={setActiveFile}
      />

      <div className="editor-center">
        <div className="tabs">{activeFile}</div>
        <CodeEditor {...getEditorConfig()!} />
      </div>

      <Preview html={html} css={css} js={js} />
    </div>
  );
}
