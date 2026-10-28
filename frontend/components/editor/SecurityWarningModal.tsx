"use client";

import React from "react";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

interface SecurityWarningModalProps {
  isVisible: boolean;
  strikeCount: number;
  MAX_WARNINGS: number;
  onResume: () => void;
  onSubmit: () => void;
}

export default function SecurityWarningModal({
  isVisible,
  strikeCount,
  MAX_WARNINGS,
  onResume,
  onSubmit,
}: SecurityWarningModalProps) {
  if (!isVisible) return null;
  const lastChance = strikeCount >= MAX_WARNINGS - 1;

  return (
    <Modal z="z-[9999]" className="max-w-sm">
      <div className="p-6">
        <div className="flex size-10 items-center justify-center rounded-full border border-warning/30 bg-warning/10">
          <ShieldAlert className="size-5 text-warning" />
        </div>
        <h2 className="mt-4 text-lg font-semibold tracking-tight text-foreground">You left the contest</h2>
        <p className={cn("mt-1 text-sm font-medium", lastChance ? "text-destructive" : "text-warning")}>
          Strike {strikeCount} of {MAX_WARNINGS}
        </p>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Switching tabs, leaving full screen or opening developer tools counts as a strike.
          {lastChance ? " One more ends your session." : " Reaching the limit ends your session."}
        </p>
        <div className="mt-4 flex gap-1">
          {Array.from({ length: MAX_WARNINGS }, (_, i) => (
            <span key={i} className={cn("h-1 flex-1 rounded-full", i < strikeCount ? (lastChance ? "bg-destructive" : "bg-warning") : "bg-border-strong")} />
          ))}
        </div>
      </div>
      <ModalFooter>
        <Button variant="danger-outline" onClick={onSubmit}>
          Submit &amp; exit
        </Button>
        <Button variant="primary" onClick={onResume}>
          Return to contest
        </Button>
      </ModalFooter>
    </Modal>
  );
}
