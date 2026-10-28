"use client";

import { useState, useRef } from "react";
import Editor, { type BeforeMount, type OnMount } from "@monaco-editor/react";

// Monaco theme matching the app: near-black, dim gutter, blue selection
const defineTheme: BeforeMount = (monaco) => {
  monaco.editor.defineTheme("ceditor", {
    base: "vs-dark",
    inherit: true,
    rules: [{ token: "comment", foreground: "6b6b6b", fontStyle: "italic" }],
    colors: {
      "editor.background": "#0a0a0a",
      "editor.lineHighlightBackground": "#ffffff08",
      "editor.lineHighlightBorder": "#00000000",
      "editorLineNumber.foreground": "#3d3d3d",
      "editorLineNumber.activeForeground": "#a1a1a1",
      "editorIndentGuide.background1": "#1c1c1c",
      "editorIndentGuide.activeBackground1": "#333333",
      "editor.selectionBackground": "#0070f344",
      "editor.inactiveSelectionBackground": "#0070f322",
      "editorCursor.foreground": "#ededed",
      "editorWidget.background": "#0a0a0a",
      "editorWidget.border": "#262626",
      "editorGutter.background": "#0a0a0a",
      "scrollbarSlider.background": "#2e2e2e80",
      "scrollbarSlider.hoverBackground": "#3d3d3d",
    },
  });
};
import { X, Copy, ClipboardPaste } from "lucide-react";

type Props = {
  language: "html" | "css" | "javascript" | "markdown";
  value: string;
  onChange: (value: string) => void;
};

// Global-ish clipboard for the app session
let internalClipboard = "";

type FloatingAction = {
  type: 'copy' | 'paste';
  text?: string;
  top: number;
  left: number;
} | null;

export default function CodeEditor({ language, value, onChange }: Props) {
  const [floatingAction, setFloatingAction] = useState<FloatingAction>(null);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  const handleCopy = () => {
    if (floatingAction && floatingAction.type === 'copy' && floatingAction.text) {
      internalClipboard = floatingAction.text;
      
      // Switch to Paste mode where the Copy button was
      setFloatingAction({
        type: 'paste',
        top: floatingAction.top,
        left: floatingAction.left
      });
    }
  };

  const handlePaste = () => {
    if (internalClipboard && editorRef.current) {
      const editor = editorRef.current;
      const selectionObj = editor.getSelection();
      if (!selectionObj) return; // nothing to paste into (e.g. editor not focused yet)
      const id = { major: 1, minor: 1 };
      const op = { identifier: id, range: selectionObj, text: internalClipboard, forceMoveMarkers: true };
      editor.executeEdits("custom-paste", [op]);
      setFloatingAction(null);
    }
  };

  const closeFloating = () => {
    setFloatingAction(null);
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-editor">
      {/* Floating Toolbar */}
      {floatingAction && (
        <div 
          className="animate-fadeIn absolute z-[100] flex items-center gap-1 rounded-lg border border-border-strong bg-popover p-1 shadow-2xl shadow-black"
          style={{ top: Math.max(10, floatingAction.top - 50), left: Math.max(10, floatingAction.left - 20) }}
        >
          {floatingAction.type === 'copy' ? (
             <button
               onClick={handleCopy}
               className="flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/85"
             >
               <Copy size={13} /> Copy
             </button>
          ) : (
             <button
               onClick={handlePaste}
               className="flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/85"
             >
               <ClipboardPaste size={13} /> Paste
             </button>
          )}
          <div className="mx-0.5 h-4 w-px bg-border"></div>
          <button 
             onClick={closeFloating}
             aria-label="Close"
             className="rounded-md p-1 text-subtle-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <Editor
        height="100%"
        theme="ceditor"
        beforeMount={defineTheme}
        language={language}
        value={value}
        onChange={(val) => onChange(val || "")}
        options={{
          minimap: { enabled: false },
          fontSize: 13.5,
          lineHeight: 22,
          fontFamily: "var(--font-geist-mono), Menlo, monospace",
          fontLigatures: true,
          padding: { top: 12 },
          renderLineHighlight: "line",
          guides: { indentation: true },
          wordWrap: "on",
          automaticLayout: true,
          readOnly: false,
          contextmenu: false,
          links: false,
          // Disable built-in search
          find: {
            addExtraSpaceOnTop: false,
            autoFindInSelection: 'never',
            seedSearchStringFromSelection: 'never'
          },
          scrollbar: {
            vertical: 'visible',
            horizontal: 'visible'
          }
        }}
        onMount={(editor) => {
          editorRef.current = editor;

          // Block OS level clipboard shortcuts (Ctrl+C/V/X) and Search (Ctrl+F)
          editor.onKeyDown((e) => {
            const { ctrlKey, metaKey, code } = e;
            if ((ctrlKey || metaKey) && (code === 'KeyC' || code === 'KeyV' || code === 'KeyX' || code === 'KeyF')) {
              e.preventDefault();
              e.stopPropagation();
              
              // If user tries to paste, show the custom paste button
              if (code === 'KeyV' && internalClipboard) {
                const selectionObj = editor.getSelection();
                if (selectionObj) {
                  const position = editor.getScrolledVisiblePosition(selectionObj.getStartPosition());
                  if (position) {
                     setFloatingAction({ type: 'paste', top: position.top, left: position.left });
                     
                     // Auto hide after 4 seconds
                     setTimeout(() => {
                        setFloatingAction(prev => prev?.type === 'paste' ? null : prev);
                     }, 4000);
                  }
                }
              }
            }
          });

          // Detect selection to show the Copy button
          editor.onDidChangeCursorSelection(() => {
            const selectionObj = editor.getSelection();
            const model = editor.getModel();
            
            if (selectionObj && !selectionObj.isEmpty() && model) {
              const text = model.getValueInRange(selectionObj);
              const position = editor.getScrolledVisiblePosition(selectionObj.getStartPosition());
              const domNode = editor.getDomNode();

              if (position && domNode) {
                setFloatingAction({
                  type: 'copy',
                  text,
                  top: position.top,
                  left: position.left
                });
                return;
              }
            }
            // Only clear selection if we are currently in copy mode or we no longer have a selection
            // We want to keep paste mode open if they just clicked copy.
            setFloatingAction(prev => prev?.type === 'copy' ? null : prev);
          });

          // Show paste indicator when clicking inside if content exists
          // Disabling generic bottom-right paste. Let it just be shown when pasting via keyboard OR after copy.
        }}
      />
    </div>
  );
}