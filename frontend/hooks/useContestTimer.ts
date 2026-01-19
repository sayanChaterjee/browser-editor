"use client";

import { useState, useRef, useEffect } from "react";

export function useContestTimer(initialDuration: number, onTimeUp: () => void) {
    const [timeLeft, setTimeLeft] = useState(initialDuration);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const startTimer = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    if (timerRef.current) clearInterval(timerRef.current);
                    onTimeUp();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const stopTimer = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    };

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    return {
        timeLeft,
        setTimeLeft,
        startTimer,
        stopTimer,
        formatTime,
    };
}
