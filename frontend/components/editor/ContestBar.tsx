"use client";

import React from "react";
import { Folder, Plus, ShieldAlert, Timer, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ContestBarProps {
  timeLeft: number;
  strikeCount: number;
  MAX_WARNINGS: number;
  projectName: string;
  contestStarted: boolean;
  onStartContest: () => void;
  onNewProject: () => void;
  formatTime: (seconds: number) => string;
  activeContest: { _id: string, title: string, imageUrl: string, endTime?: string } | null;
}

export default function ContestBar({
  timeLeft,
  strikeCount,
  MAX_WARNINGS,
  projectName,
  contestStarted,
  onStartContest,
  onNewProject,
  formatTime,
  activeContest,
}: ContestBarProps) {
  const [isEnded, setIsEnded] = React.useState(false);

  React.useEffect(() => {
    if (!activeContest?.endTime) {
      setIsEnded(false);
      return;
    }

    const checkEnded = () => {
      setIsEnded(new Date(activeContest.endTime!).getTime() <= Date.now());
    };

    checkEnded();
    const interval = setInterval(checkEnded, 1000);
    return () => clearInterval(interval);
  }, [activeContest?.endTime]);

  const lowTime = contestStarted && timeLeft < 300;
  const contestLabel = contestStarted
    ? "Contest in progress"
    : !activeContest
    ? "No live contest"
    : isEnded
    ? "Contest ended"
    : "Start contest";

  return (
    <div className="flex h-12 items-center justify-between border-b border-border bg-background px-4">
      <div className="flex min-w-0 items-center gap-3 text-sm">
        <Folder className="size-4 shrink-0 text-subtle-foreground" />
        <span className="truncate font-medium text-foreground">{projectName || "Untitled"}</span>
        {activeContest && (
          <span className="hidden items-center gap-1.5 truncate text-muted-foreground md:flex">
            <span className="text-subtle-foreground">/</span>
            <Trophy className="size-3.5" />
            {activeContest.title}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[13px] tabular-nums",
            lowTime ? "border-destructive/40 text-destructive" : contestStarted ? "border-border-strong text-foreground" : "border-border text-subtle-foreground",
          )}
          title="Time left"
        >
          <Timer className="size-3.5" />
          {formatTime(timeLeft)}
        </span>
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[13px] tabular-nums",
            strikeCount > 0 ? "border-warning/40 text-warning" : "border-border text-muted-foreground",
          )}
          title="Anti-cheat strikes"
        >
          <ShieldAlert className="size-3.5" />
          {strikeCount}/{MAX_WARNINGS}
        </span>
        <div className="mx-1 h-5 w-px bg-border" />
        <Button size="sm" variant="secondary" onClick={onNewProject}>
          <Plus /> New project
        </Button>
        <Button
          size="sm"
          variant={contestStarted || !activeContest || isEnded ? "secondary" : "primary"}
          onClick={onStartContest}
          disabled={contestStarted || !activeContest || isEnded}
        >
          {contestStarted && <span className="size-1.5 animate-pulse rounded-full bg-success" />}
          {contestLabel}
        </Button>
      </div>
    </div>
  );
}
