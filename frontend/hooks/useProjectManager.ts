"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getLocalProject, clearMismatchingProjects } from "../lib/indexedDB";
import { INITIAL_HTML, INITIAL_CSS, INITIAL_JS } from "../utils/constants";

interface Project {
    _id: string;
    name: string;
    html: string;
    css: string;
    js: string;
    updatedAt: string;
    timeLeft?: number;
}

interface UseProjectManagerProps {
    onLogout: () => void;
    contestDuration: number;
    onContestStart: () => void;
    isContestPending: boolean;
    setIsContestPending: (pending: boolean) => void;
    setTimeLeft: (time: number) => void;
    setIgnoreNextBlur?: (val: boolean) => void;
}

export function useProjectManager({
    onLogout,
    contestDuration,
    onContestStart,
    isContestPending,
    setIsContestPending,
    setTimeLeft,
    setIgnoreNextBlur,
}: UseProjectManagerProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const requestedProjectId = searchParams.get("projectId");

    const [activeFile, setActiveFile] = useState("index.html");
    const [html, setHtml] = useState("");
    const [css, setCss] = useState("");
    const [js, setJs] = useState("");
    const [projectName, setProjectName] = useState("");
    const [projectId, setProjectId] = useState<string | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [userProfile, setUserProfile] = useState<{ name: string; email: string } | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [isCreatingProject, setIsCreatingProject] = useState(false);
    const [isModalCancelable, setIsModalCancelable] = useState(true);
    const [isLoading, setIsLoading] = useState(true);

    const [lastSyncedHtml, setLastSyncedHtml] = useState("");
    const [lastSyncedCss, setLastSyncedCss] = useState("");
    const [lastSyncedJs, setLastSyncedJs] = useState("");

    useEffect(() => {
        const initData = async () => {
            let profile: any = null;
            // 1. Fetch User Profile
            try {
                const profRes = await fetch(
                    `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/api/v1/user/profile`,
                    { credentials: 'include' }
                );
                if (profRes.ok) {
                    const profText = await profRes.text();
                    if (profText) {
                        try {
                            profile = JSON.parse(profText);
                            setUserProfile(profile);
                        } catch (e) {
                            console.error("Profile JSON parse error", e);
                        }
                    }
                } else if (profRes.status === 401) {
                    onLogout();
                    return;
                }
                if (profile?.id || profile?.email) {
                    await clearMismatchingProjects(profile.id || profile.email);
                }
            } catch (err) {
                console.error("Profile fetch failed", err);
            }

            // 2. Fetch Projects
            try {
                const res = await fetch(
                    `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/api/v1/code`,
                    { credentials: 'include' }
                );
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data) && data.length > 0) {
                        setProjects(data);

                        let targetProject = data[0];
                        if (requestedProjectId) {
                            const found = data.find((p) => p._id === requestedProjectId);
                            if (found) {
                                // Fetch full details to ensure we have the latest code, 
                                // especially if the list was stale due to flusher delay
                                try {
                                    const fullRes = await fetch(
                                        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/api/v1/code/${requestedProjectId}`,
                                        { credentials: 'include' }
                                    );
                                    if (fullRes.ok) {
                                        const fullProject = await fullRes.json();
                                        setProjectId(fullProject._id);
                                        setProjectName(fullProject.name);

                                        const localData = await getLocalProject(fullProject._id, profile?.id || profile?.email || 'anonymous');
                                        if (localData && new Date(localData.updatedAt) > new Date(fullProject.updatedAt)) {
                                            setHtml(localData.html);
                                            setCss(localData.css);
                                            setJs(localData.js);
                                            setLastSyncedHtml(localData.html);
                                            setLastSyncedCss(localData.css);
                                            setLastSyncedJs(localData.js);
                                        } else {
                                            const h = fullProject.html?.trim() ? fullProject.html : INITIAL_HTML;
                                            const c = fullProject.css || INITIAL_CSS;
                                            const j = fullProject.js || INITIAL_JS;
                                            setHtml(h);
                                            setCss(c);
                                            setJs(j);
                                            setLastSyncedHtml(h);
                                            setLastSyncedCss(c);
                                            setLastSyncedJs(j);
                                        }

                                        if (fullProject.timeLeft !== undefined) {
                                            setTimeLeft(fullProject.timeLeft);
                                        }
                                        setIsLoading(false);
                                        return; // Skip the default behavior below
                                    }
                                } catch (err) {
                                    console.error("Failed to fetch full project details", err);
                                }
                                targetProject = found;
                            }
                        }

                        setProjectId(targetProject._id);
                        setProjectName(targetProject.name);

                        const localData = await getLocalProject(targetProject._id, (userProfile as any)?.id || (userProfile as any)?.email || 'anonymous');
                        if (localData && new Date(localData.updatedAt) > new Date(targetProject.updatedAt)) {
                            setHtml(localData.html);
                            setCss(localData.css);
                            setJs(localData.js);
                            setLastSyncedHtml(localData.html);
                            setLastSyncedCss(localData.css);
                            setLastSyncedJs(localData.js);
                        } else {
                            const h = targetProject.html?.trim() ? targetProject.html : INITIAL_HTML;
                            const c = targetProject.css || INITIAL_CSS;
                            const j = targetProject.js || INITIAL_JS;
                            setHtml(h);
                            setCss(c);
                            setJs(j);
                            setLastSyncedHtml(h);
                            setLastSyncedCss(c);
                            setLastSyncedJs(j);
                        }

                        if (targetProject.timeLeft !== undefined) {
                            setTimeLeft(targetProject.timeLeft);
                        }
                    } else {
                        setIsModalCancelable(false);
                        setIsContestPending(false);
                        setShowCreateModal(true);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch projects", error);
            } finally {
                setIsLoading(false);
            }
        };

        initData();
    }, [router, requestedProjectId]);

    // Fragment-Based Auto-Sync Logic (Write-Behind)
    useEffect(() => {
        if (!projectId || isLoading) return;

        // Don't sync if nothing changed since last sync
        if (html === lastSyncedHtml && css === lastSyncedCss && js === lastSyncedJs) {
            return;
        }

        const syncDebounce = setTimeout(async () => {
            const payload: any = {};
            if (html !== lastSyncedHtml) payload.html = html;
            if (css !== lastSyncedCss) payload.css = css;
            if (js !== lastSyncedJs) payload.js = js;

            try {
                const res = await fetch(
                    `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/api/v1/code/sync/${projectId}`,
                    {
                        method: "PATCH",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        credentials: 'include',
                        body: JSON.stringify(payload),
                    }
                );

                if (res.ok) {
                    setLastSyncedHtml(html);
                    setLastSyncedCss(css);
                    setLastSyncedJs(js);
                    console.log("Auto-sync: Successfully updated fragments.");
                }
            } catch (err) {
                console.error("Auto-sync failed:", err);
            }
        }, 1500); // 1.5s debounce to minimize requests while typing

        return () => clearTimeout(syncDebounce);
    }, [html, css, js, projectId, isLoading, lastSyncedHtml, lastSyncedCss, lastSyncedJs]);

    const handleCreateProject = async (name: string) => {
        setIsCreatingProject(true);

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/api/v1/code/save`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: 'include',
                body: JSON.stringify({
                    name,
                    html: INITIAL_HTML,
                    css: INITIAL_CSS,
                    js: INITIAL_JS,
                    timeLeft: contestDuration,
                }),
            });

            if (res.ok) {
                const newData = await res.json();

                const project_id = newData._id || newData.id;
                if (project_id) {
                    setProjectName(name);
                    setHtml(INITIAL_HTML);
                    setCss(INITIAL_CSS);
                    setJs(INITIAL_JS);
                    setProjectId(project_id);
                    setProjects([newData]);
                    if (setIgnoreNextBlur) setIgnoreNextBlur(true);
                    alert(`Project "${name}" created successfully!`);

                    if (isContestPending) {
                        onContestStart();
                        setIsContestPending(false);
                    }
                } else {
                    if (setIgnoreNextBlur) setIgnoreNextBlur(true);
                    alert("Project created but missing ID");
                }
            } else {
                const errorText = await res.text();
                if (setIgnoreNextBlur) setIgnoreNextBlur(true);
                alert(`Failed to create project: ${res.status} ${errorText}`);
            }
        } catch (error) {
            if (setIgnoreNextBlur) setIgnoreNextBlur(true);
            alert("Network error while creating project.");
        } finally {
            setIsCreatingProject(false);
            setShowCreateModal(false);
        }
    };

    const saveCode = async (currentData: { html: string; css: string; js: string; timeLeft: number }) => {
        try {
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/api/v1/code/save`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        name: projectName,
                        html,
                        css,
                        js,
                        timeLeft: currentData.timeLeft
                    }),
                }
            );
            if (res.ok) {
                const data = await res.json();
                const project_id = data._id || data.id;
                if (project_id) setProjectId(project_id);
                if (setIgnoreNextBlur) setIgnoreNextBlur(true);
                alert("Code saved successfully!");
            } else {
                throw new Error("Save failed");
            }
        } catch (error) {
            console.error("Failed to save code", error);
            if (setIgnoreNextBlur) setIgnoreNextBlur(true);
            alert("Failed to save code. Please check your connection.");
        }
    };

    return {
        activeFile,
        setActiveFile,
        html,
        setHtml,
        css,
        setCss,
        js,
        setJs,
        projectName,
        projectId,
        projects,
        userProfile,
        showCreateModal,
        setShowCreateModal,
        isCreatingProject,
        isModalCancelable,
        setIsModalCancelable,
        handleCreateProject,
        saveCode,
        isLoading,
    };
}
