"use client";

import { useEffect, useRef } from "react";

// Served by the app with its own Content-Security-Policy (see public/preview-frame.html)
const PREVIEW_FRAME_URL = "/preview-frame.html";

// Cheap string hash: a new document gets a new key, so the frame reloads (as srcdoc did)
function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return `${text.length}-${h >>> 0}`;
}

interface PreviewFrameProps {
  /** The full document to show, from buildPreviewDocument */
  html: string;
  title: string;
  /** Never add allow-same-origin: with allow-scripts it would let the user's code run as this app */
  sandbox: string;
  className?: string;
}

/**
 * A sandboxed iframe showing `html`. The frame page asks for its document once loaded
 * (PREVIEW_READY) and gets it back in a message.
 */
export default function PreviewFrame({ html, title, sandbox, className }: PreviewFrameProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const htmlRef = useRef(html);
  useEffect(() => {
    htmlRef.current = html;
  });

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const frame = frameRef.current?.contentWindow;
      if (!frame || event.source !== frame || event.data?.type !== "PREVIEW_READY") return;
      // The frame's origin is opaque ("null"), so "*" is the only target that reaches it
      frame.postMessage({ type: "PREVIEW_RENDER", html: htmlRef.current }, "*");
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <iframe
      key={hash(html)}
      ref={frameRef}
      src={PREVIEW_FRAME_URL}
      sandbox={sandbox}
      title={title}
      className={className}
    />
  );
}
