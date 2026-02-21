"use client";

import { useState, useRef, useEffect } from "react";

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
    const [strikeCount, setStrikeCount] = useState(0);
    const violationLock = useRef(false);
    const isQuittingRef = useRef(false);
    const ignoreNextBlur = useRef(false);
    const securityLoopRef = useRef<NodeJS.Timeout | null>(null);

    const persistWarning = async () => {
        if (!userId || !projectId) return;
        try {
            await fetch(`/api/v1/code/warning/${projectId}`, {
                method: 'POST',
                credentials: 'include',
            });
        } catch (err) {
            console.error('Failed to persist warning:', err);
        }
    };

    const violate = () => {
        if (violationLock.current) return;

        violationLock.current = true;
        const newStrikes = strikeCount + 1;
        setStrikeCount(newStrikes);

        // Persist warning to backend (fire-and-forget)
        persistWarning();

        if (newStrikes >= maxWarnings) {
            onLogout();
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

    useEffect(() => {
        if (!contestStarted) return;

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
            if (e.data?.type === "PREVIEW_LINK_CLICK") {
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
    }, [contestStarted, showWarningModal, strikeCount]);

    return {
        strikeCount,
        setStrikeCount,
        violate,
        resumeContest,
        isQuittingRef,
        setIgnoreNextBlur,
    };
}
