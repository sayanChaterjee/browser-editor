"use client";

import { useState, useRef, useEffect } from "react";
import Editor from "@monaco-editor/react";

type Props = {
  language: "html" | "css" | "javascript";
  value: string;
  onChange: (value: string) => void;
};

// Global-ish clipboard for the app session
let internalClipboard = "";

export default function CodeEditor({ language, value, onChange }: Props) {
  const [selection, setSelection] = useState<{ text: string; top: number; left: number } | null>(null);
  const [showPaste, setShowPaste] = useState(false);
  const editorRef = useRef<any>(null);

  const handleCopy = () => {
    if (selection) {
      internalClipboard = selection.text;
      setSelection(null);
      // Success feedback could be added here
    }
  };

  const handlePaste = () => {
    if (internalClipboard && editorRef.current) {
      const editor = editorRef.current;
      const selectionObj = editor.getSelection();
      const id = { major: 1, minor: 1 };
      const op = { identifier: id, range: selectionObj, text: internalClipboard, forceMoveMarkers: true };
      editor.executeEdits("custom-paste", [op]);
      setShowPaste(false);
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Custom Copy Button - Appears near selection */}
      {selection && (
        <button
          onClick={handleCopy}
          className="absolute z-[100] px-3 py-1 bg-[#38bdf8] text-white text-xs font-bold rounded shadow-lg hover:bg-[#0ea5e9] transition-all animate-in fade-in zoom-in duration-150"
          style={{ top: selection.top - 35, left: selection.left }}
        >
          Copy
        </button>
      )}

      {/* Floating Paste Button - Appears when clipboard has items */}
      {showPaste && (
        <button
          onClick={handlePaste}
          className="absolute z-[100] bottom-6 right-6 px-4 py-2 bg-[#10b981] text-white text-sm font-bold rounded-full shadow-2xl hover:bg-[#059669] transition-all animate-bounce"
        >
          📋 Paste
        </button>
      )}

      <Editor
        height="100%"
        theme="vs-dark"
        language={language}
        value={value}
        onChange={(val) => onChange(val || "")}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          wordWrap: "on",
          automaticLayout: true,
          readOnly: false,
          contextmenu: false,
          links: false,
          scrollbar: {
            vertical: 'visible',
            horizontal: 'visible'
          }
        }}
        onMount={(editor) => {
          editorRef.current = editor;

          // Block OS level clipboard shortcuts (Ctrl+C/V/X) 
          // but allow other features like Shift+Tab, Ctrl+F, etc.
          editor.onKeyDown((e) => {
            const { ctrlKey, metaKey, code } = e;
            if ((ctrlKey || metaKey) && (code === 'KeyC' || code === 'KeyV' || code === 'KeyX')) {
              e.preventDefault();
              e.stopPropagation();
              
              // If user tries to paste, show the custom paste button
              if (code === 'KeyV' && internalClipboard) {
                setShowPaste(true);
                setTimeout(() => setShowPaste(false), 3000);
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
                setSelection({
                  text,
                  top: position.top,
                  left: position.left
                });
                return;
              }
            }
            setSelection(null);
          });

          // Show paste indicator when clicking inside if content exists
          editor.onMouseDown(() => {
            if (internalClipboard) {
              setShowPaste(true);
              setTimeout(() => setShowPaste(false), 5000);
            }
          });
        }}
      />
    </div>
  );
}