"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
  /** Characters the user put in: typed, or pasted (one insertion of BULK_INSERT_CHARS or more) */
  onInsert?: (chars: number, kind: "typed" | "pasted") => void;
  /**
   * Contest mode: the OS clipboard shortcuts are blocked and copying works only inside the
   * editor (its own Copy/Paste buttons). Practice keeps the normal clipboard.
   */
  restrictClipboard?: boolean;
  /** Gets the Monaco editor once it is ready (for actions like formatting) */
  onEditorReady?: (editor: Parameters<OnMount>[0]) => void;
};

// One insertion this large didn't come from typing (autocomplete inserts far less): a paste
// (e.g. Shift+Insert), a drop, or a script editing the editor
const BULK_INSERT_CHARS = 80;

// How many of its own recent values the editor recognises as echoes (see CodeEditor)
const ECHOES_KEPT = 50;

// Global-ish clipboard for the app session
let internalClipboard = "";

type FloatingAction = {
  type: 'copy' | 'paste';
  text?: string;
  top: number;
  left: number;
} | null;

export default function CodeEditor({ language, value, onChange, onInsert, restrictClipboard = false, onEditorReady }: Props) {
  const [floatingAction, setFloatingAction] = useState<FloatingAction>(null);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  const onInsertRef = useRef(onInsert);
  useEffect(() => {
    onInsertRef.current = onInsert;
  });
  // The value the app last set. A layout effect, so it's current before the editor library
  // applies a new value (in its own passive effect), e.g. when switching files.
  const valueRef = useRef(value);
  useLayoutEffect(() => {
    valueRef.current = value;
  });
  // The next edit is the in-app Paste button (the user's own copied code)
  const internalPasteRef = useRef(false);

  // Values this editor itself reported through onChange (for the current file). React's state
  // can lag a keystroke or two behind fast typing; handing such an echo back as `value` makes
  // the editor library replace the newer text with it, dropping keystrokes. So only values that
  // came from elsewhere (loading a project, switching files) are pushed into the editor.
  const [echoes, setEchoes] = useState<{ language: string; values: string[] }>({ language, values: [] });
  const isEcho = echoes.language === language && echoes.values.includes(value);
  const report = (next: string) => {
    setEchoes((prev) => ({
      language,
      values: [...(prev.language === language ? prev.values : []), next].slice(-ECHOES_KEPT),
    }));
    onChange(next);
  };
  const restrictRef = useRef(restrictClipboard);
  useEffect(() => {
    restrictRef.current = restrictClipboard;
  });

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
      internalPasteRef.current = true;
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
      {restrictClipboard && floatingAction && (
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
        value={isEcho ? undefined : value}
        onChange={(val) => report(val || "")}
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
        onMount={(editor, monaco) => {
          editorRef.current = editor;
          onEditorReady?.(editor);

          // Format document: also on Shift+Alt+F (Monaco's own binding doesn't reach it here)
          editor.addAction({
            id: "ceditor.formatDocument",
            label: "Format document",
            keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF],
            run: (ed) => ed.getAction("editor.action.formatDocument")?.run(),
          });

          // Contest activity: what the user put in, by typing or in bulk. Not counted: the app
          // setting the value (loading a project, switching files) and undo/redo.
          editor.onDidChangeModelContent((e) => {
            const fromOwnClipboard = internalPasteRef.current;
            internalPasteRef.current = false;
            if (e.isFlush || e.isUndoing || e.isRedoing || editor.getValue() === valueRef.current) return;
            const inserted = e.changes.reduce((total, change) => total + change.text.length, 0);
            if (inserted === 0) return;
            const bulk = !fromOwnClipboard && inserted >= BULK_INSERT_CHARS;
            onInsertRef.current?.(inserted, bulk ? "pasted" : "typed");
          });

          // Block OS level clipboard shortcuts (Ctrl+C/V/X) and Search (Ctrl+F)
          editor.onKeyDown((e) => {
            if (!restrictRef.current) return;
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
            if (!restrictRef.current) return;
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