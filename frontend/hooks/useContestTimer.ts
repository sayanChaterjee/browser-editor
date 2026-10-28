"use client";

import { useState, useRef, useEffect } from "react";

export function useContestTimer(initialDuration: number, onTimeUp: () => void) {
    const [timeLeft, setTimeLeft] = useState(initialDuration);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const timeLeftRef = useRef(initialDuration);

    // Always call the latest onTimeUp: it submits the code as it is at time-up, not as it
    // was when the timer started
    const onTimeUpRef = useRef(onTimeUp);
    useEffect(() => {
        onTimeUpRef.current = onTimeUp;
    });

    const setRemaining = (seconds: number) => {
        timeLeftRef.current = seconds;
        setTimeLeft(seconds);
    };

    const stopTimer = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    const startTimer = () => {
        stopTimer();
        timerRef.current = setInterval(() => {
            const next = Math.max(0, timeLeftRef.current - 1);
            setRemaining(next);
            if (next === 0) {
                // Side effects stay outside state updaters (React may run those twice)
                stopTimer();
                onTimeUpRef.current();
            }
        }, 1000);
    };

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    };

    useEffect(() => stopTimer, []);

    return {
        timeLeft,
        setTimeLeft: setRemaining,
        startTimer,
        stopTimer,
        formatTime,
    };
}
