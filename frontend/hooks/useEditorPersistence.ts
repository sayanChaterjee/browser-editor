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
    contestStarted: boolean;
    isLoading: boolean;
    onLoadFromIDB?: (data: any) => void;
}

export function useEditorPersistence({
    html,
    css,
    js,
    timeLeft,
    projectName,
    projectId,
    contestStarted,
    isLoading,
    onLoadFromIDB,
}: PersistenceProps) {
    const syncRef = useRef<NodeJS.Timeout | null>(null);

    const saveToIDB = async () => {
        if (isLoading || !projectId) return;
        try {
            await saveLocalProject({
                id: projectId,
                name: projectName,
                html,
                css,
                js,
                updatedAt: new Date().toISOString(),
                isSynced: true // For now, we'll mark as synced immediately
            });
        } catch (err) {
            console.error("IDB Save failed", err);
        }
    };

    const syncToBackend = async () => {
        // Prevent sync if loading or no project active
        if (isLoading || !projectId || !projectName) return;

        const token = localStorage.getItem("token");
        if (!token) return;

        try {
            await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/api/v1/code/save`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
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
