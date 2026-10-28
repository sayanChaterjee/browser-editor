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

export function useEditorPersistence(props: PersistenceProps) {
    const { contestStarted, isLoading, projectId } = props;

    // The timers below run on a steady interval and read the latest values from here.
    // (Restarting them on every edit meant that while someone kept typing they never fired.)
    const latest = useRef(props);
    useEffect(() => {
        latest.current = props;
    });

    const saveToIDB = async () => {
        const { isLoading, projectId, userId, projectName, html, css, js } = latest.current;
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
        const { isLoading, projectId, projectName, html, css, js, timeLeft } = latest.current;
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

    // Local copy in IndexedDB every 2s
    const saveToIDBRef = useRef(saveToIDB);
    const syncToBackendRef = useRef(syncToBackend);
    useEffect(() => {
        saveToIDBRef.current = saveToIDB;
        syncToBackendRef.current = syncToBackend;
    });

    useEffect(() => {
        if (isLoading || !projectId) return;
        const interval = setInterval(() => saveToIDBRef.current(), 2000);
        return () => clearInterval(interval);
    }, [isLoading, projectId]);

    // During a contest, a full save to the backend every 10s
    useEffect(() => {
        if (!contestStarted || isLoading || !projectId) return;
        const interval = setInterval(() => syncToBackendRef.current(), 10000);
        return () => clearInterval(interval);
    }, [contestStarted, isLoading, projectId]);

    return { saveToIDB, syncToBackend };
}
