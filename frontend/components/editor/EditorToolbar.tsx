"use client";

import React from "react";
import { Eye, FileQuestion, Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EditorToolbarProps {
  showQuestion: boolean;
  setShowQuestion: (show: boolean) => void;
  contestStarted: boolean;
  onSave: () => void;
  onSubmit: () => void;
}

const EditorToolbar: React.FC<EditorToolbarProps> = ({
  showQuestion,
  setShowQuestion,
  contestStarted,
  onSave,
  onSubmit,
}) => {
  return (
    <div className="flex h-11 items-center gap-2 border-b border-border px-3">
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setShowQuestion(!showQuestion)}
        disabled={!contestStarted}
        title={contestStarted ? undefined : "Available during a contest"}
      >
        {showQuestion ? <><Eye /> Preview</> : <><FileQuestion /> Question</>}
      </Button>
      <div className="ml-auto flex items-center gap-2">
        <Button size="sm" variant="secondary" onClick={onSave}>
          <Save /> Save
        </Button>
        <Button size="sm" variant="primary" onClick={onSubmit} disabled={!contestStarted}>
          <Send /> Submit
        </Button>
      </div>
    </div>
  );
};

export default EditorToolbar;
