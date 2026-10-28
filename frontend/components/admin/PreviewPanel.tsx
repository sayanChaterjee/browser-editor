'use client';

import { useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { buildPreviewDocument } from '@/lib/previewDocument';

interface PreviewPanelProps {
  html: string;
  css: string;
  js: string;
  projectName?: string;
}

export default function PreviewPanel({ html, css, js, projectName }: PreviewPanelProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const buildSrcDoc = () => {
    // Preview-only behaviour: no context menu; errors (incl. syntax errors) logged
    const systemScriptHead = `
<script>
(function() {
  window.onerror = function(msg) { console.error(msg); return false; };
  document.addEventListener('contextmenu', function(e) { e.preventDefault(); });
})();
</script>`;

    return buildPreviewDocument({ html, css, js, systemScript: systemScriptHead });
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
