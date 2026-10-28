"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface CreateProjectModalProps {
  onSubmit: (projectName: string) => void;
  onCancel?: () => void;
  isCreating?: boolean;
  isCancelable?: boolean;
  existingProjectNames?: string[];
}

export default function CreateProjectModal({ 
  onSubmit, 
  onCancel, 
  isCreating = false,
  isCancelable = true,
  existingProjectNames = [],
}: CreateProjectModalProps) {
  const [projectName, setProjectName] = useState("");
  const [duplicateError, setDuplicateError] = useState("");

  const checkDuplicate = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      setDuplicateError("");
      return false;
    }
    const isDuplicate = existingProjectNames.some(
      (existing) => existing.toLowerCase() === trimmed.toLowerCase()
    );
    setDuplicateError(isDuplicate ? `A project named "${trimmed}" already exists` : "");
    return isDuplicate;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = projectName.trim();
    if (!trimmed) return;
    if (checkDuplicate(trimmed)) return;
    onSubmit(trimmed);
  };

  const handleChange = (value: string) => {
    setProjectName(value);
    checkDuplicate(value);
  };

  const canSubmit = !!projectName.trim() && !isCreating && !duplicateError;

  return (
    <Modal z="z-[10000]" onClose={onCancel && isCancelable && !isCreating ? onCancel : undefined}>
      <form onSubmit={handleSubmit}>
        <div className="p-6">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">New project</h2>
          <p className="mt-1 text-sm text-muted-foreground">Give it a name. You can have as many projects as you like.</p>
          <Label htmlFor="project-name" className="mt-6 block">
            Project name
          </Label>
          <Input
            id="project-name"
            value={projectName}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="my-portfolio"
            autoFocus
            className={cn("mt-1.5", duplicateError && "border-destructive focus:border-destructive focus:ring-destructive/30")}
          />
          {duplicateError && <p className="mt-1.5 text-[12px] text-destructive">{duplicateError}</p>}
        </div>
        <ModalFooter>
          {onCancel && isCancelable && (
            <Button type="button" variant="secondary" onClick={onCancel} disabled={isCreating}>
              Cancel
            </Button>
          )}
          <Button type="submit" variant="primary" disabled={!canSubmit}>
            {isCreating ? (
              <>
                <Spinner className="border-primary-foreground/30 border-t-primary-foreground" /> Creating...
              </>
            ) : (
              "Create project"
            )}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
