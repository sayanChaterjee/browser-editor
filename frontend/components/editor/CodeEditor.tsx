"use client";

import Editor from "@monaco-editor/react";

type Props = {
  language: "html" | "css" | "javascript";
  value: string;
  onChange: (value: string) => void;
};

export default function CodeEditor({ language, value, onChange }: Props) {
  return (
    <Editor
      height="95%"
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
      }}
      onMount={(editor) => {
        editor.onKeyDown((e) => {
          const { ctrlKey, metaKey, code } = e;
          if ((ctrlKey || metaKey) && (code === 'KeyC' || code === 'KeyV' || code === 'KeyX')) {
            e.preventDefault();
          }
        });
      }}
    />
  );
}