"use client";

import { useEffect, useState } from "react";

type Props = {
  html: string;
  css: string;
  js: string;
};

export default function Preview({ html, css, js }: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Build srcDoc with properly isolated system scripts in <head>
  const buildSrcDoc = () => {
    // Use hex-escaped strings for script tags to prevent any potential parsing issues
    const OPEN_SCRIPT = '\x3cscript\x3e';
    const CLOSE_SCRIPT = '\x3c/script\x3e';

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

    // System scripts moved to head and wrapped in DOMContentLoaded to prevent rendering issues
    const systemScriptHead = `${OPEN_SCRIPT}
(function() {
  function setup() {
    document.addEventListener('contextmenu', function(e) {
      e.preventDefault();
    });
    document.addEventListener('visibilitychange', function() {
      if (document.hidden) {
        window.parent.postMessage({ type: 'CONTEST_VIOLATION', reason: 'TAB_SWITCH', timestamp: new Date().toISOString() }, '*');
      }
    });
    document.addEventListener('click', function(e) {
      var link = e.target.closest('a');
      if (link && link.getAttribute('href') && link.getAttribute('href') !== '#') {
        e.preventDefault();
        window.parent.postMessage({ type: 'PREVIEW_LINK_CLICK' }, '*');
      }
    }, true);
    window.onerror = function(msg, url, lineNo, columnNo, error) {
      console.error("Preview Error:", msg, error);
      return false;
    };
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();
${CLOSE_SCRIPT}`;

    // User JS runs in a separate script block
    const userJsBlock = js.trim()
      ? `${OPEN_SCRIPT}
try {
  ${js}
} catch(err) {
  console.error("Execution Error:", err);
}
${CLOSE_SCRIPT}`
      : "";

    const hasBody = html.toLowerCase().includes("<body");
    const hasHead = html.toLowerCase().includes("<head");

    let doc = "";
    if (hasBody) {
      doc = html;
      
      // Inject styles and system scripts into <head> if exists, otherwise before <body>
      const headContent = `<style>${systemStyles}</style>${systemScriptHead}`;
      
      if (hasHead) {
        doc = doc.replace(/<\/head>/i, `${headContent}</head>`);
      } else if (doc.toLowerCase().includes("<html")) {
        doc = doc.replace(/<html[^>]*>/i, `$&<head>${headContent}</head>`);
      } else {
        // Fallback: insert at the very beginning
        doc = `<head>${headContent}</head>` + doc;
      }

      // Inject user JS at the end of body if exists, or just at the end
      if (doc.toLowerCase().includes("</body>")) {
         doc = doc.replace(/<\/body>/i, `${userJsBlock}</body>`);
      } else {
         doc += userJsBlock;
      }
    } else {
      // Boilerplate mode for HTML fragments
      doc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${systemStyles}</style>
  ${systemScriptHead}
</head>
<body>
  <div id="user-content-root">${html}</div>
  ${userJsBlock}
</body>
</html>`;
    }
    return doc;
  };

  const srcDoc = buildSrcDoc();

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
