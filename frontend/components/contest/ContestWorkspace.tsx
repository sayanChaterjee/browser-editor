"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, FileQuestion, Send, ShieldAlert, Timer, Trophy } from "lucide-react";
import Workbench, { type Code } from "../editor/Workbench";
import QuestionPanel from "../editor/QuestionPanel";
import SecurityWarningModal from "../editor/SecurityWarningModal";
import ConfirmModal from "../ui/ConfirmModal";
import { Button } from "../ui/button";
import { Spinner } from "../ui/spinner";
import { useContestTimer } from "../../hooks/useContestTimer";
import { useContestSecurity } from "../../hooks/useContestSecurity";
import { useContestActivity } from "../../hooks/useContestActivity";
import { useEditorPersistence } from "../../hooks/useEditorPersistence";
import { getLocalProject } from "../../lib/indexedDB";
import { INITIAL_CSS, INITIAL_HTML, INITIAL_JS } from "../../utils/constants";
import { cn } from "@/lib/utils";

const MAX_WARNINGS = 4;

export interface ContestInfo {
  _id: string;
  title: string;
  endTime: string;
}

export type FinishReason = "submitted" | "time" | "strikes" | "failed";

interface Props {
  contest: ContestInfo;
  /** The contest project already linked to this participant, if any */
  projectId: string | null;
  /** Server clock minus local clock, so the timer is right whatever the local clock says */
  clockOffsetMs: number;
  onFinished: (reason: FinishReason, message?: string) => void;
}

interface Question {
  imageUrl: string;
  html: string;
  css: string;
  js: string;
}

const json = async (res: Response) => {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || `Request failed (${res.status})`);
  return body;
};

/**
 * Sets up the participant's contest project: the one already linked, or a new one linked now
 * (the server keeps the first link, so two tabs end up in the same project).
 */
async function contestProject(contest: ContestInfo, linked: string | null): Promise<string> {
  if (linked) return linked;
  // Saved by name, so the name carries the contest id: it can never overwrite a practice project
  const name = `${contest.title} · contest ${contest._id.slice(-4)}`;
  const created = await json(await fetch("/api/v1/code/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name, html: INITIAL_HTML, css: INITIAL_CSS, js: INITIAL_JS }),
  }));
  const { projectId } = await json(await fetch(`/api/v1/contest/${contest._id}/project`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ projectId: created._id }),
  }));
  return projectId;
}

/** The live contest: timer, question, anti-cheat, heartbeats and submit. Runs in full screen. */
export default function ContestWorkspace({ contest, projectId: linkedProject, clockOffsetMs, onFinished }: Props) {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");
  const [code, setCode] = useState<Code>({ html: "", css: "", js: "" });
  const [question, setQuestion] = useState<Question | null>(null);
  const [showQuestion, setShowQuestion] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [started, setStarted] = useState(false);
  const startedAtRef = useRef(0);
  const codeRef = useRef(code);
  useEffect(() => {
    codeRef.current = code;
  });
  const finishingRef = useRef(false);

  const secondsLeft = () =>
    Math.max(0, Math.floor((new Date(contest.endTime).getTime() - (Date.now() + clockOffsetMs)) / 1000));

  const { timeLeft, setTimeLeft, startTimer, stopTimer, formatTime } = useContestTimer(0, () => finish("time"));

  const { strikeCount, setStrikeCount, resumeContest, isQuittingRef, setIgnoreNextBlur } = useContestSecurity({
    contestStarted: started,
    maxWarnings: MAX_WARNINGS,
    onLogout: () => finish("strikes"),
    showWarningModal,
    setShowWarningModal,
    userId,
    projectId,
  });

  const activity = useContestActivity({
    contestStarted: started,
    projectId,
    codeSize: code.html.length + code.css.length + code.js.length,
  });

  // Local copy every 2 s and a full save to the server every 10 s
  useEditorPersistence({
    ...code, timeLeft, projectName, projectId, userId, contestStarted: started, isLoading: loading,
  });

  // Load: who I am, my contest project, its code (a newer local copy wins), and the question
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profile = await json(await fetch("/api/v1/user/profile", { credentials: "include" }));
        const uid: string = profile.id || profile.email;
        const id = await contestProject(contest, linkedProject);
        const [project, q] = await Promise.all([
          json(await fetch(`/api/v1/code/${id}`, { credentials: "include" })),
          json(await fetch(`/api/v1/contest/${contest._id}/question`, { credentials: "include" })),
        ]);
        const local = await getLocalProject(id, uid);
        const fromServer = { html: project.html || INITIAL_HTML, css: project.css || INITIAL_CSS, js: project.js || INITIAL_JS };
        const newer = local && new Date(local.updatedAt) > new Date(project.updatedAt);
        if (cancelled) return;

        setUserId(uid);
        setProjectId(id);
        setProjectName(project.name);
        setCode(newer ? { html: local.html, css: local.css, js: local.js } : fromServer);
        setQuestion(q);
        setStrikeCount(project.warningCount ?? 0);
        setTimeLeft(secondsLeft());
        startedAtRef.current = Date.now();
        startTimer();
        setStarted(true);
        setLoading(false);
      } catch (err) {
        if (!cancelled) onFinished("failed", err instanceof Error ? err.message : "Could not start the contest");
      }
    })();
    return () => {
      cancelled = true;
    };
    // Runs once when the participant enters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submission = () => ({
    contestId: contest._id,
    projectId,
    ...codeRef.current,
    timeLeft: secondsLeft(),
    timeTaken: Math.round((Date.now() - startedAtRef.current) / 1000),
  });

  async function finish(reason: Exclude<FinishReason, "failed">) {
    if (finishingRef.current || !projectId) return;
    finishingRef.current = true;
    isQuittingRef.current = true;
    stopTimer();
    setShowWarningModal(false);
    try {
      // The last few seconds of typing, so the submission's numbers include them
      await activity.flush();
      const res = await fetch("/api/v1/contest/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(submission()),
      });
      await json(res);
      onFinished(reason === "submitted" ? "submitted" : reason);
    } catch (err) {
      onFinished("failed", err instanceof Error ? err.message : "Submission failed");
    } finally {
      setStarted(false);
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    }
  }

  // Closing the window during the contest submits what is there (a beacon outlives the page)
  useEffect(() => {
    if (!started) return;
    const onUnload = () => {
      if (isQuittingRef.current) return;
      activity.flushBeacon();
      navigator.sendBeacon(
        "/api/v1/contest/submissions",
        new Blob([JSON.stringify(submission())], { type: "application/json" }),
      );
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  });

  const askToSubmit = () => {
    setIgnoreNextBlur(true);
    setShowSubmitConfirm(true);
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-56px)] items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-center">
          <Spinner className="size-5" />
          <span className="text-sm font-medium text-foreground">Setting up your contest workspace…</span>
        </div>
      </div>
    );
  }

  const lowTime = timeLeft < 300;

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col" onContextMenu={(e) => e.preventDefault()}>
      <SecurityWarningModal
        isVisible={showWarningModal}
        strikeCount={strikeCount}
        MAX_WARNINGS={MAX_WARNINGS}
        onResume={resumeContest}
        onSubmit={askToSubmit}
      />
      <ConfirmModal
        isVisible={showSubmitConfirm}
        title="Submit and finish?"
        message="Your code is submitted and the contest ends for you. You can't change it afterwards."
        confirmText="Submit"
        onConfirm={() => {
          setShowSubmitConfirm(false);
          finish("submitted");
        }}
        onCancel={() => setShowSubmitConfirm(false)}
      />

      <div className="flex h-12 items-center justify-between border-b border-border bg-background px-4">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <Trophy className="size-4 shrink-0 text-warning" />
          <span className="truncate font-medium text-foreground">{contest.title}</span>
          <span className="flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
            <span className="size-1.5 animate-pulse rounded-full bg-success" /> Live
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[13px] tabular-nums",
              lowTime ? "border-destructive/40 text-destructive" : "border-border-strong text-foreground",
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
        </div>
      </div>

      <Workbench
        className={cn("h-[calc(100vh-104px)]", showWarningModal && "pointer-events-none blur-sm")}
        code={code}
        onChange={setCode}
        contest={{ onInsert: (chars, kind) => (kind === "pasted" ? activity.recordPasted(chars) : activity.recordTyped(chars)) }}
        toolbar={
          <div className="flex h-11 items-center gap-2 border-b border-border px-3">
            <Button size="sm" variant="ghost" onClick={() => setShowQuestion((v) => !v)}>
              {showQuestion ? <><Eye /> Preview</> : <><FileQuestion /> Question</>}
            </Button>
            <Button size="sm" variant="primary" className="ml-auto" onClick={askToSubmit}>
              <Send /> Submit
            </Button>
          </div>
        }
        sidePanel={showQuestion && question ? <QuestionPanel {...question} /> : undefined}
      />
    </div>
  );
}
