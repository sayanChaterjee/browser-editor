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
      }}
    />
  );
}
