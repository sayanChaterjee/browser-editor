'use client';

import { useState } from 'react';

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
    <div className={`flex flex-col h-full ${isFullscreen ? 'fixed inset-0 z-[99999] bg-[#0a0e1a]' : ''}`}>
      {/* Preview Header */}
      <div className="h-10 px-4 flex items-center justify-between bg-[#0a0e1a] border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></div>
          </div>
          <span className="text-xs text-gray-400 font-medium">
            {projectName || 'Preview'}
          </span>
        </div>

        <button
          className="text-gray-400 hover:text-white transition-colors text-sm px-2 py-1 rounded hover:bg-gray-800"
          onClick={() => setIsFullscreen((v) => !v)}
        >
          {isFullscreen ? '✕ Exit' : '⛶ Expand'}
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
