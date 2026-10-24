"use client";

import { useEffect, useRef } from "react";
import { saveLocalProject } from "../lib/indexedDB";

interface PersistenceProps {
    html: string;
    css: string;
    js: string;
    timeLeft: number;
    projectName: string;
    projectId: string | null;
    userId: string | null;
    contestStarted: boolean;
    isLoading: boolean;
}

export function useEditorPersistence({
    html,
    css,
    js,
    timeLeft,
    projectName,
    projectId,
    userId,
    contestStarted,
    isLoading,
}: PersistenceProps) {
    const syncRef = useRef<NodeJS.Timeout | null>(null);

    const saveToIDB = async () => {
        if (isLoading || !projectId || !userId) return;
        try {
            await saveLocalProject({
                id: projectId,
                userId: userId,
                name: projectName,
                html,
                css,
                js,
                updatedAt: new Date().toISOString(),
                isSynced: true
            });
        } catch (err) {
            console.error("IDB Save failed", err);
        }
    };

    const syncToBackend = async () => {
        if (isLoading || !projectId || !projectName) return;

        try {
            await fetch(
                `/api/v1/code/save`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    credentials: 'include',
                    body: JSON.stringify({ name: projectName, html, css, js, timeLeft }),
                }
            );
        } catch (error) {
            console.error("Auto-sync failed", error);
        }
    };

    // 2s Auto-save to IndexedDB (only if NOT loading and project exists)
    useEffect(() => {
        if (isLoading || !projectId) return;

        const interval = setInterval(() => {
            saveToIDB();
        }, 2000);
        return () => clearInterval(interval);
    }, [html, css, js, timeLeft, isLoading, projectId]);

    // 10s Periodic Sync to Backend
    useEffect(() => {
        if (!contestStarted || isLoading || !projectId) return;

        syncRef.current = setInterval(() => {
            syncToBackend();
        }, 10000);

        return () => {
            if (syncRef.current) clearInterval(syncRef.current);
        };
    }, [contestStarted, html, css, js, timeLeft, projectName, isLoading, projectId]);

    return { saveToIDB, syncToBackend };
}
