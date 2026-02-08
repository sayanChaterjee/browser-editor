"use client";

import { useEffect, useState } from "react";

type Props = {
  html: string;
  css: string;
  js: string;
};

export default function Preview({ html, css, js }: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Intelligent srcDoc generation
  let srcDoc = "";
  const hasBody = html.toLowerCase().includes("<body");

  const systemStyles = `
    body { 
      margin: 0; 
      padding: 16px; 
      font-family: sans-serif; 
      background-color: white;
      color: black;
    }
    ${css}
  `;

  const systemScripts = `
    // System Injection: Visibility Change Listener (Anti-Cheating)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            window.parent.postMessage({ 
                type: 'CONTEST_VIOLATION', 
                reason: 'TAB_SWITCH',
                timestamp: new Date().toISOString()
            }, '*');
        }
    });

    // Security: Prevent navigation via links
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (link && link.getAttribute('href') && link.getAttribute('href') !== '#') {
            e.preventDefault();
            window.parent.postMessage({ type: 'PREVIEW_LINK_CLICK' }, '*');
        }
    }, true);

    window.onerror = (msg, url, lineNo, columnNo, error) => {
        console.error("Preview Error:", msg, error);
        return false;
    };

    window.onload = () => {
        try {
            // Safely inject user JS
            ${JSON.stringify(js)}.split('\\n').join('\\n'); 
            // The above is a trick to get the string, but better is:
            eval(${JSON.stringify(js)});
        } catch (err) {
            console.error("Execution Error:", err);
        }
    };
  `;

  if (hasBody) {
    // Inject scripts and styles into the existing document
    srcDoc = html;
    
    if (srcDoc.toLowerCase().includes("</head>")) {
        srcDoc = srcDoc.replace(/<\/head>/i, `<style>${systemStyles}</style></head>`);
    } else if (srcDoc.toLowerCase().includes("<html")) {
        srcDoc = srcDoc.replace(/<html[^>]*>/i, `$&<head><style>${systemStyles}</style></head>`);
    }

    if (srcDoc.toLowerCase().includes("</body>")) {
        srcDoc = srcDoc.replace(/<\/body>/i, `<script>${systemScripts}</script></body>`);
    } else {
        srcDoc += `<script>${systemScripts}</script>`;
    }
  } else {
    // Use boilerplate for fragments
    // Wrap user HTML in a div to prevent unclosed tags (like <h1) from swallowing the script tag
    // Also using a safer way to construct srcDoc that doesn't rely on nested backticks
    const htmlBoilerplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>\${systemStyles}</style>
</head>
<body>
    <div id="user-content-root">\${html}</div>
    <script>\${systemScripts}</script>
</body>
</html>`;

    srcDoc = htmlBoilerplate
        .replace('\${systemStyles}', systemStyles)
        .replace('\${html}', html)
        .replace('\${systemScripts}', systemScripts);
  }

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);

  return (
    <div className={`w-full min-w-[320px] flex flex-col bg-[#1e1e1e] border-l border-[#333] overflow-hidden flex-1 h-full ${isFullscreen ? "fixed top-[56px] left-0 right-0 bottom-0 w-screen h-[calc(100vh-56px)] z-[99999] border-l-0" : ""}`}>
      <div className="h-9 px-3 flex items-center justify-between bg-[#020617] text-[#e5e7eb] text-[12px] font-medium border-b border-[#1e293b]">
        <span>Preview</span>

        <button
          className="text-[#e5e7eb] hover:text-white transition-colors"
          onClick={() => setIsFullscreen((v) => !v)}
        >
          {isFullscreen ? "Exit" : "⛶"}
        </button>
      </div>

      <iframe
        className="flex-1 w-full h-full border-none bg-white block"
        srcDoc={srcDoc}
        sandbox="allow-scripts"
        title="preview"
      />
    </div>
  );
}
