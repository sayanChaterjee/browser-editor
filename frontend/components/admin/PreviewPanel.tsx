'use client';

import { useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

interface PreviewPanelProps {
  html: string;
  css: string;
  js: string;
  projectName?: string;
}

export default function PreviewPanel({ html, css, js, projectName }: PreviewPanelProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const buildSrcDoc = () => {
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

    // System scripts injected into head for maximum isolation
    const systemScriptHead = `
<script>
(function() {
  function setup() {
    document.addEventListener('contextmenu', function(e) { e.preventDefault(); });
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
</script>`;

    // User JS wrapped in a script block
    const userJsBlock = js.trim()
      ? `
<script>
try {
  ${js}
} catch(err) {
  console.error("Execution Error:", err);
}
</script>`
      : "";

    const hasBody = html.toLowerCase().includes('<body');
    const hasHead = html.toLowerCase().includes('<head');

    let doc = '';
    if (hasBody) {
      doc = html;
      const headContent = `<style>${systemStyles}</style>${systemScriptHead}`;

      if (hasHead) {
        doc = doc.replace(/<\/head>/i, `${headContent}</head>`);
      } else if (doc.toLowerCase().includes('<html')) {
        doc = doc.replace(/<html[^>]*>/i, `$&<head>${headContent}</head>`);
      } else {
        doc = `<head>${headContent}</head>` + doc;
      }

      if (doc.toLowerCase().includes('</body>')) {
        doc = doc.replace(/<\/body>/i, `${userJsBlock}</body>`);
      } else {
        doc += userJsBlock;
      }
    } else {
      // User JS goes after the markup, so scripts can find the elements they use
      doc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${systemStyles}</style>
  ${systemScriptHead}
</head>
<body>
  ${html}
  ${userJsBlock}
</body>
</html>`;
    }
    return doc;
  };

  const srcDoc = buildSrcDoc();

  return (
    <div className={`flex h-full flex-col ${isFullscreen ? 'fixed inset-0 z-[99999] bg-background' : ''}`}>
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border bg-background px-3">
        <span className="truncate text-[12px] font-medium text-muted-foreground">{projectName || 'Preview'}</span>
        <button
          className="flex items-center gap-1.5 rounded px-2 py-1 text-[12px] text-subtle-foreground transition-colors hover:bg-accent hover:text-foreground"
          onClick={() => setIsFullscreen((v) => !v)}
        >
          {isFullscreen ? <><Minimize2 className="size-3.5" /> Exit</> : <><Maximize2 className="size-3.5" /> Expand</>}
        </button>
      </div>

      {/* iframe Preview */}
      <div className="flex-1 bg-white">
        <iframe
          className="w-full h-full border-none block"
          srcDoc={srcDoc}
          sandbox="allow-scripts"
          title="admin-preview"
        />
      </div>
    </div>
  );
}
