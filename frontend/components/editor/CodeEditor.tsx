"use client";

import { useState, useRef } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
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
    <div className="relative h-full w-full overflow-hidden">
      {/* Floating Toolbar */}
      {floatingAction && (
        <div 
          className="absolute z-[100] flex items-center gap-1 bg-[#1e293b] border border-slate-700 p-1.5 rounded-lg shadow-2xl animate-in fade-in zoom-in duration-150"
          style={{ top: Math.max(10, floatingAction.top - 50), left: Math.max(10, floatingAction.left - 20) }}
        >
          {floatingAction.type === 'copy' ? (
             <button
               onClick={handleCopy}
               className="flex items-center gap-1.5 px-3 py-1.5 bg-[#38bdf8] hover:bg-[#0ea5e9] text-white text-xs font-bold rounded-md transition-all"
             >
               <Copy size={14} /> Copy
             </button>
          ) : (
             <button
               onClick={handlePaste}
               className="flex items-center gap-1.5 px-3 py-1.5 bg-[#10b981] hover:bg-[#059669] text-white text-xs font-bold rounded-md transition-all"
             >
               <ClipboardPaste size={14} /> Paste
             </button>
          )}
          <div className="w-[1px] h-5 bg-slate-700 mx-0.5"></div>
          <button 
             onClick={closeFloating}
             className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-md transition-colors"
          >
            <X size={14} />
          </button>
        </div>
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