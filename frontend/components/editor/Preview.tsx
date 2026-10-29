"use client";

import { useEffect, useState } from "react";
import { Maximize2, Minimize2, RefreshCw } from "lucide-react";
import PanelHeader, { PanelIconButton } from "./PanelHeader";
import { buildPreviewDocument } from "@/lib/previewDocument";
import PreviewFrame from "@/components/PreviewFrame";

type Props = {
  html: string;
  css: string;
  js: string;
};

export default function Preview({ html, css, js }: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const buildSrcDoc = () => {
    const systemScriptHead = `
<script>
(function() {
  // Intercept console messages immediately, before any user scripts execute
  const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
  };

  function sendLog(type, args) {
    window.parent.postMessage({
      type: 'CONSOLE_LOG',
      logType: type,
      // Strings as-is (not JSON-quoted); values that can't be sent as-is become readable text
      args: Array.from(args).map(arg => {
          if (typeof arg === 'string') return arg;
          if (arg === undefined || typeof arg === 'function' || typeof arg === 'symbol') return String(arg);
          if (arg instanceof Error) return arg.toString();
          if (arg instanceof Node) return arg.outerHTML || arg.nodeName;
          try { return JSON.stringify(arg); } catch { return String(arg); }
      })
    }, '*');
  }

  console.log = function(...args) { originalConsole.log(...args); sendLog('log', args); };
  console.warn = function(...args) { originalConsole.warn(...args); sendLog('warn', args); };
  console.error = function(...args) { originalConsole.error(...args); sendLog('error', args); };
  console.info = function(...args) { originalConsole.info(...args); sendLog('info', args); };

  // Installed now, before the user's script runs, so syntax errors and errors thrown
  // later (e.g. in event handlers) reach the console panel
  // (No line number: it would point into this generated page, not the user's script)
  window.onerror = function(msg) {
    console.error(msg);
    return false;
  };

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
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();
</script>`;

    return buildPreviewDocument({ html, css, js, systemScript: systemScriptHead });
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
    <div className={`flex h-full w-full min-w-[320px] flex-1 flex-col overflow-hidden border-l border-border bg-background ${isFullscreen ? "fixed bottom-0 left-0 right-0 top-14 z-[99999] h-[calc(100vh-56px)] w-screen border-l-0" : ""}`}>
      <PanelHeader title="Preview">
        <PanelIconButton title="Refresh preview" aria-label="Refresh preview" onClick={() => setRefreshKey((k) => k + 1)}>
          <RefreshCw />
        </PanelIconButton>
        <PanelIconButton
          title={isFullscreen ? "Exit full screen (Esc)" : "Full screen"}
          aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
          onClick={() => setIsFullscreen((v) => !v)}
        >
          {isFullscreen ? <Minimize2 /> : <Maximize2 />}
        </PanelIconButton>
      </PanelHeader>

      <PreviewFrame
        key={refreshKey}
        className="flex-1 w-full h-full border-none bg-white block"
        html={srcDoc}
        sandbox="allow-scripts"
        title="preview"
      />
    </div>
  );
}
