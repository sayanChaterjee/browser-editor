import { useState } from "react";
import { RefreshCw } from "lucide-react";
import PanelHeader, { PanelIconButton } from "./PanelHeader";
import { buildPreviewDocument } from "@/lib/previewDocument";
import PreviewFrame from "@/components/PreviewFrame";

interface QuestionPanelProps {
  imageUrl?: string;
  html?: string;
  css?: string;
  js?: string;
}

export default function QuestionPanel({ imageUrl, html, css, js }: QuestionPanelProps) {
  const hasCodePreview = html || css || js;
  const [refreshKey, setRefreshKey] = useState(0);

  const srcDoc = buildPreviewDocument({ html: html || "", css: css || "", js: js || "" });

  return (
    <div className="flex h-full w-full min-w-[320px] flex-1 flex-col overflow-hidden border-l border-border bg-background">
      <PanelHeader title="Target">
        {hasCodePreview && !imageUrl && (
          <PanelIconButton title="Replay" aria-label="Replay" onClick={() => setRefreshKey((k) => k + 1)}>
            <RefreshCw />
          </PanelIconButton>
        )}
      </PanelHeader>

      <div className="p-4 overflow-auto flex-1 flex">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary admin-entered URL; next/image needs known hosts
          <img
            src={imageUrl}
            alt="Question"
            className="w-full rounded-lg border border-border"
          />
        ) : hasCodePreview ? (
          <PreviewFrame
            key={refreshKey}
            html={srcDoc}
            title="target-preview"
            // No allow-same-origin: with allow-scripts it would let the target's code run as
            // this app (e.g. call the API as the contestant)
            sandbox="allow-scripts allow-modals"
            className="h-full w-full flex-1 rounded-lg border border-border bg-white"
          />
        ) : (
          <div className="flex w-full items-center justify-center p-8 text-sm text-subtle-foreground">
            The contest target appears here once it&apos;s published.
          </div>
        )}
      </div>
    </div>
  );
}
