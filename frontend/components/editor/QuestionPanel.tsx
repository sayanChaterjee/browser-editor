import { useState } from "react";
import { RefreshCw } from "lucide-react";

interface QuestionPanelProps {
  imageUrl?: string;
  html?: string;
  css?: string;
  js?: string;
}

export default function QuestionPanel({ imageUrl, html, css, js }: QuestionPanelProps) {
  const hasCodePreview = html || css || js;
  const [refreshKey, setRefreshKey] = useState(0);

  const srcDoc = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>${css || ""}</style>
      </head>
      <body>
        ${html || ""}
        <script>${js || ""}</script>
      </body>
    </html>
  `;

  return (
    <div className="w-full min-w-[320px] flex flex-col bg-[#1e1e1e] border-l border-[#333] overflow-hidden flex-1 h-full">
      <div className="h-9 px-3 flex items-center justify-between bg-[#020617] text-[#e5e7eb] text-[12px] font-medium border-b border-[#1e293b]">
        <span>Question Target</span>

        {hasCodePreview && !imageUrl && (
          <button
            className="text-[#e5e7eb] hover:text-white transition-colors"
            title="Refresh Animation"
            onClick={() => setRefreshKey((k) => k + 1)}
          >
            <RefreshCw size={14} />
          </button>
        )}
      </div>

      <div className="p-4 overflow-auto flex-1 flex">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Question"
            className="w-full"
          />
        ) : hasCodePreview ? (
          <iframe
            key={refreshKey}
            srcDoc={srcDoc}
            title="target-preview"
            sandbox="allow-scripts allow-same-origin allow-modals"
            className="w-full h-full bg-white rounded flex-1"
          />
        ) : (
          <div className="flex items-center justify-center p-8 text-gray-500 text-sm italic w-full">
            Waiting for contest image or target code...
          </div>
        )}
      </div>
    </div>
  );
}
