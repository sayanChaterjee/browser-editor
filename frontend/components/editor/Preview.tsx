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
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { 
          margin: 0; 
          padding: 16px; 
          font-family: sans-serif; 
          background-color: white;
          color: black;
        }
        ${css}
    </style>
    <script>
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

        window.onload = () => {
            try {
                ${js}
            } catch (err) {
                console.error("Preview Error:", err);
            }
        };
    </script>
</head>
<body>
    ${html}
</body>
</html>`;

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
