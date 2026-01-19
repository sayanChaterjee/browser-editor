"use client";

import { useState, useRef, useEffect } from "react";

interface SecurityProps {
    contestStarted: boolean;
    maxWarnings: number;
    onLogout: () => void;
    showWarningModal: boolean;
    setShowWarningModal: (show: boolean) => void;
}

export function useContestSecurity({
    contestStarted,
    maxWarnings,
    onLogout,
    showWarningModal,
    setShowWarningModal,
}: SecurityProps) {
    const [strikeCount, setStrikeCount] = useState(0);
    const violationLock = useRef(false);
    const isQuittingRef = useRef(false);
    const ignoreNextBlur = useRef(false);
    const securityLoopRef = useRef<NodeJS.Timeout | null>(null);

    const violate = () => {
        if (violationLock.current) return;

        violationLock.current = true;
        const newStrikes = strikeCount + 1;
        setStrikeCount(newStrikes);

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
            const startTime = performance.now();
            debugger;
            const endTime = performance.now();
            if (endTime - startTime > 100) {
                violate();
            }
        }, 1000);

        // 2. Keyboard Shortcuts
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                violate();
                return false;
            }

            if (
                e.key === "F12" ||
                (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "J" || e.key === "C")) ||
                (e.ctrlKey && e.key === "u")
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

        // 4. Window Focus Loss
        const handleBlur = () => {
            if (isQuittingRef.current || violationLock.current || ignoreNextBlur.current) {
                if (ignoreNextBlur.current) {
                    ignoreNextBlur.current = false;
                }
                return;
            }
            violate();
        };

        // 5. Fullscreen Exit
        const handleFullscreenChange = () => {
            if (isQuittingRef.current) return;
            if (!document.fullscreenElement && !violationLock.current && !showWarningModal) {
                violate();
            }
        };

        // 6. Page Hide
        const handlePageHide = () => {
            if (!isQuittingRef.current && !violationLock.current) {
                violate();
            }
        };

        document.addEventListener("fullscreenchange", handleFullscreenChange);
        document.addEventListener("visibilitychange", handleVisibilityChange);
        document.addEventListener("keydown", handleKeyDown);
        window.addEventListener("blur", handleBlur);
        window.addEventListener("pagehide", handlePageHide);

        return () => {
            if (securityLoopRef.current) clearInterval(securityLoopRef.current);
            document.removeEventListener("fullscreenchange", handleFullscreenChange);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            document.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("blur", handleBlur);
            window.removeEventListener("pagehide", handlePageHide);
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
