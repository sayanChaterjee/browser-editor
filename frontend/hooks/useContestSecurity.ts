"use client";

import { useState, useRef, useEffect } from "react";
import { isFromOwnFrame } from "@/lib/utils";

interface SecurityProps {
    contestStarted: boolean;
    maxWarnings: number;
    onLogout: () => void;
    showWarningModal: boolean;
    setShowWarningModal: (show: boolean) => void;
    userId?: string | null;
    projectId?: string | null;
}

export function useContestSecurity({
    contestStarted,
    maxWarnings,
    onLogout,
    showWarningModal,
    setShowWarningModal,
    userId,
    projectId,
}: SecurityProps) {
    const [strikeCount, setStrikeCountState] = useState(0);
    // Mirrors strikeCount for event handlers, which would otherwise see a stale value
    const strikesRef = useRef(0);
    const endedRef = useRef(false);
    const violationLock = useRef(false);
    const isQuittingRef = useRef(false);
    const ignoreNextBlur = useRef(false);
    const securityLoopRef = useRef<NodeJS.Timeout | null>(null);

    const setStrikeCount = (count: number) => {
        strikesRef.current = count;
        setStrikeCountState(count);
    };

    const endSession = () => {
        if (endedRef.current) return;
        endedRef.current = true;
        onLogout();
    };

    /** Records the strike with contest-service; returns its total (the source of truth), or null. */
    const persistWarning = async (): Promise<number | null> => {
        if (!userId || !projectId) return null;
        try {
            const res = await fetch(`/api/v1/contest/strikes/${projectId}`, {
                method: 'POST',
                credentials: 'include',
            });
            if (!res.ok) return null;
            const { warningCount } = await res.json();
            return typeof warningCount === 'number' ? warningCount : null;
        } catch (err) {
            console.error('Failed to persist warning:', err);
            return null;
        }
    };

    const violate = () => {
        if (violationLock.current) return;

        violationLock.current = true;
        const newStrikes = strikesRef.current + 1;
        setStrikeCount(newStrikes);

        // The server's count wins: strikes recorded before a reload still count
        persistWarning().then((serverCount) => {
            if (serverCount !== null && serverCount > strikesRef.current) {
                setStrikeCount(serverCount);
                if (serverCount >= maxWarnings) endSession();
            }
        });

        if (newStrikes >= maxWarnings) {
            endSession();
            return;
        }

        setShowWarningModal(true);

        setTimeout(() => {
            violationLock.current = false;
        }, 1000);
    };

    const resumeContest = async () => {
        try {
            if (!document.fullscreenElement) {
                await document.documentElement.requestFullscreen();
            }
            setShowWarningModal(false);
        } catch {
            console.error("Fullscreen restore failed");
        }
    };

    const setIgnoreNextBlur = (val: boolean) => {
        ignoreNextBlur.current = val;
    };

    const violateRef = useRef(violate);
    useEffect(() => {
        violateRef.current = violate;
    });

    useEffect(() => {
        if (!contestStarted) return;
        endedRef.current = false;
        const violate = () => violateRef.current();

        // 1. Console Deterrent
        securityLoopRef.current = setInterval(() => {
            if (isQuittingRef.current) return;
            const startTime = performance.now();
            debugger;
            const endTime = performance.now();
            if (endTime - startTime > 100) {
                violate();
            }
        }, 1000);

        const handleContextMenu = (e: MouseEvent) => {
            e.preventDefault();
            return false;
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (isQuittingRef.current) return;
            if (e.key === "Escape") {
                e.preventDefault();
                violate();
                return false;
            }

            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const ctrlKey = isMac ? e.metaKey : e.ctrlKey;

            if (
                e.key === "F12" ||
                (ctrlKey && e.shiftKey && (e.key === "I" || e.key === "J" || e.key === "C")) ||
                (ctrlKey && (e.key === "u" || e.key === "U")) ||
                (ctrlKey && (e.key === "s" || e.key === "S"))
            ) {
                e.preventDefault();
                violate();
                return false;
            }
        };

        // 3. Tab/Window Switch Detection
        const handleVisibilityChange = () => {
            if (isQuittingRef.current || violationLock.current) return;
            if (document.hidden) {
                violate();
            }
        };

        // ... existing handlers ...
        const handleBlur = () => {
            if (isQuittingRef.current || violationLock.current || ignoreNextBlur.current) {
                if (ignoreNextBlur.current) {
                    ignoreNextBlur.current = false;
                }
                return;
            }

            setTimeout(() => {
                if (document.activeElement?.tagName === "IFRAME") {
                    return;
                }
                violate();
            }, 100);
        };

        const handleFullscreenChange = () => {
            if (isQuittingRef.current) return;
            if (!document.fullscreenElement && !violationLock.current && !showWarningModal) {
                violate();
            }
        };

        const handlePageHide = () => {
            if (!isQuittingRef.current && !violationLock.current) {
                violate();
            }
        };

        const handleMessage = (e: MessageEvent) => {
            if (isQuittingRef.current) return;
            // Only the preview may report a link click (it counts as a strike)
            if (e.data?.type === "PREVIEW_LINK_CLICK" && isFromOwnFrame(e)) {
                violate();
            }
        };

        document.addEventListener("contextmenu", handleContextMenu);
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        document.addEventListener("visibilitychange", handleVisibilityChange);
        document.addEventListener("keydown", handleKeyDown);
        window.addEventListener("blur", handleBlur);
        window.addEventListener("pagehide", handlePageHide);
        window.addEventListener("message", handleMessage);

        return () => {
            if (securityLoopRef.current) clearInterval(securityLoopRef.current);
            document.removeEventListener("contextmenu", handleContextMenu);
            document.removeEventListener("fullscreenchange", handleFullscreenChange);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            document.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("blur", handleBlur);
            window.removeEventListener("pagehide", handlePageHide);
            window.removeEventListener("message", handleMessage);
        };
    }, [contestStarted, showWarningModal]);

    return {
        strikeCount,
        setStrikeCount,
        violate,
        resumeContest,
        isQuittingRef,
        setIgnoreNextBlur,
    };
}
