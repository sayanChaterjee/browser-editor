"use client";

import { useEffect, useRef } from "react";

interface PersistenceProps {
    html: string;
    css: string;
    js: string;
    timeLeft: number;
    projectName: string;
    contestStarted: boolean;
    onLoadFromIDB?: (data: any) => void;
}

export function useEditorPersistence({
    html,
    css,
    js,
    timeLeft,
    projectName,
    contestStarted,
    onLoadFromIDB,
}: PersistenceProps) {
    const idbRef = useRef<IDBDatabase | null>(null);
    const syncRef = useRef<NodeJS.Timeout | null>(null);

    // Initialize IndexedDB
    useEffect(() => {
        if (typeof window === "undefined") return;
        const request = indexedDB.open("EditorDB", 1);
        request.onupgradeneeded = (e: any) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains("code")) {
                db.createObjectStore("code", { keyPath: "id" });
            }
        };
        request.onsuccess = (e: any) => {
            idbRef.current = e.target.result;
            loadFromIDB();
        };
    }, []);

    const saveToIDB = () => {
        if (!idbRef.current) return;
        try {
            const transaction = idbRef.current.transaction("code", "readwrite");
            const store = transaction.objectStore("code");
            store.put({ id: "current", html, css, js, timeLeft, updatedAt: Date.now() });
        } catch (err) {
            console.error("IDB Save failed", err);
        }
    };

    const loadFromIDB = () => {
        if (!idbRef.current) return;
        const transaction = idbRef.current.transaction("code", "readonly");
        const store = transaction.objectStore("code");
        const request = store.get("current");
        request.onsuccess = (e: any) => {
            const data = e.target.result;
            if (data && onLoadFromIDB) {
                onLoadFromIDB(data);
            }
        };
    };

    const syncToBackend = async () => {
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

    // 2s Auto-save to IndexedDB
    useEffect(() => {
        const interval = setInterval(() => {
            saveToIDB();
        }, 2000);
        return () => clearInterval(interval);
    }, [html, css, js, timeLeft]);

    // 10s Periodic Sync to Backend
    useEffect(() => {
        if (!contestStarted) return;

        syncRef.current = setInterval(() => {
            syncToBackend();
        }, 10000);

        return () => {
            if (syncRef.current) clearInterval(syncRef.current);
        };
    }, [contestStarted, html, css, js, timeLeft, projectName]);

    return { saveToIDB, loadFromIDB, syncToBackend };
}
