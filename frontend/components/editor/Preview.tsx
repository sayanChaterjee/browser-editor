"use client";

import { useEffect, useState } from "react";

type Props = {
  html: string;
  css: string;
  js: string;
};

export default function Preview({ html, css, js }: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const srcDoc = `
<!DOCTYPE html>
<html>
  <head>
    <style>
      body {
        margin: 0;
        padding: 16px;
        font-family: sans-serif;
      }
      ${css}
    </style>
  </head>
  <body>
    ${html}
    <script>
      ${js}
    <\/script>
  </body>
</html>
`;

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);

  return (
    <div className={`preview-panel ${isFullscreen ? "fullscreen" : ""}`}>
      <div className="preview-header">
        <span>Preview</span>

        <button
          className="preview-toggle-btn"
          onClick={() => setIsFullscreen((v) => !v)}
        >
          {isFullscreen ? "Exit" : "⛶"}
        </button>
      </div>

      <iframe
        className="preview-iframe"
        srcDoc={srcDoc}
        sandbox="allow-scripts"
        title="preview"
      />
    </div>
  );
}
