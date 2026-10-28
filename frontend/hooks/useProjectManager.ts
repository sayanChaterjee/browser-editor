"use client";

import { useState, useEffect, useRef } from "react";
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
    // Contest strikes recorded for this project (kept in step by the backend)
    warningCount?: number;
}

// A new user's starter project is created asynchronously after sign-up (code-service handles
// the user.registered.v1 event), and on Render's free tier a sleeping code-service can take up
// to a minute to wake up and process it. So for a brand-new account an empty project list is
// re-checked for up to a minute before the user is asked to create a project; older accounts
// with no projects get the dialog straight away.
const NEW_ACCOUNT_MS = 5 * 60 * 1000;
const STARTER_PROJECT_WAIT_MS = 60_000;
const STARTER_PROJECT_POLL_MS = 2_000;

async function fetchProjectList(waitForStarterProject: boolean, onWaiting: () => void): Promise<Response> {
    let res = await fetch(`/api/v1/code`, { credentials: 'include' });
    // Counted from the first answer: on a cold start that request alone can take most of a minute
    const deadline = Date.now() + STARTER_PROJECT_WAIT_MS;
    while (waitForStarterProject && res.ok && Date.now() < deadline) {
        const data = await res.clone().json().catch(() => null);
        if (!Array.isArray(data) || data.length > 0) break;
        onWaiting();
        await new Promise((resolve) => setTimeout(resolve, STARTER_PROJECT_POLL_MS));
        res = await fetch(`/api/v1/code`, { credentials: 'include' });
    }
    return res;
}

interface UseProjectManagerProps {
    onLogout: () => void;
    onContestStart: () => void;
    isContestPending: boolean;
    setIsContestPending: (pending: boolean) => void;
    setTimeLeft: (time: number) => void;
    setIgnoreNextBlur?: (val: boolean) => void;
    showToast?: (message: string, type: "success" | "error" | "warning" | "info") => void;
    onUserLoaded?: (id: string) => void;
}

export function useProjectManager({
    onLogout,
    onContestStart,
    isContestPending,
    setIsContestPending,
    setTimeLeft,
    setIgnoreNextBlur,
    showToast,
    onUserLoaded,
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
    const [loadingMessage, setLoadingMessage] = useState("Loading your workspace...");
    const [activeContest, setActiveContest] = useState<{ _id: string, title: string, imageUrl: string, startTime: string, endTime: string, html?: string, css?: string, js?: string } | null>(null);

    const [lastSyncedHtml, setLastSyncedHtml] = useState("");
    const [lastSyncedCss, setLastSyncedCss] = useState("");
    const [lastSyncedJs, setLastSyncedJs] = useState("");

    const notify = (message: string, type: "success" | "error" | "warning" | "info" = "info") => {
        if (showToast) {
            showToast(message, type);
        }
    };

    // The loader runs when the requested project changes, using the caller's latest
    // callbacks (they are new functions on every render)
    const callbacks = useRef({ onLogout, onUserLoaded, setIsContestPending, setTimeLeft });
    useEffect(() => {
        callbacks.current = { onLogout, onUserLoaded, setIsContestPending, setTimeLeft };
    });

    useEffect(() => {
        const initData = async () => {
            let profile: { id?: string; name: string; email: string; createdAt?: string } | null = null;

            // 0. Fetch Active Contest
            try {
                const contestRes = await fetch(`/api/v1/contest/active`, { credentials: 'include' });
                if (contestRes.ok) {
                    const contestInfo = await contestRes.json();
                    setActiveContest(contestInfo);
                }
            } catch (err) {
                console.error("Failed to fetch active contest", err);
            }

            // 1. Fetch User Profile
            try {
                const profRes = await fetch(
                    `/api/v1/user/profile`,
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
                    callbacks.current.onLogout();
                    return;
                }
                if (profile?.id || profile?.email) {
                    const uid = profile.id || profile.email;
                    await clearMismatchingProjects(uid);
                    if (callbacks.current.onUserLoaded) callbacks.current.onUserLoaded(uid);
                }
            } catch (err) {
                console.error("Profile fetch failed", err);
            }

            // 2. Fetch Projects
            try {
                const isNewAccount = !!profile?.createdAt
                    && Date.now() - new Date(profile.createdAt).getTime() < NEW_ACCOUNT_MS;
                const res = await fetchProjectList(isNewAccount, () => setLoadingMessage("Setting up your workspace..."));
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data) && data.length > 0) {
                        setProjects(data);

                        let targetProject = data[0];
                        if (requestedProjectId) {
                            const found = data.find((p) => p._id === requestedProjectId);
                            if (found) {
                                try {
                                    const fullRes = await fetch(
                                        `/api/v1/code/${requestedProjectId}`,
                                        { credentials: 'include' }
                                    );
                                    if (fullRes.ok) {
                                        const fullProject = await fullRes.json();
                                        setProjectId(fullProject._id);
                                        setProjectName(fullProject.name);

                                        const localData = await getLocalProject(fullProject._id, profile?.id || profile?.email || '');
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
                                            callbacks.current.setTimeLeft(fullProject.timeLeft);
                                        }
                                        setIsLoading(false);
                                        return;
                                    }
                                } catch (err) {
                                    console.error("Failed to fetch full project details", err);
                                }
                                targetProject = found;
                            }
                        }

                        setProjectId(targetProject._id);
                        setProjectName(targetProject.name);

                        const localData = await getLocalProject(targetProject._id, profile?.id || profile?.email || '');
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
                            callbacks.current.setTimeLeft(targetProject.timeLeft);
                        }
                    } else {
                        setIsModalCancelable(false);
                        callbacks.current.setIsContestPending(false);
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

        if (html === lastSyncedHtml && css === lastSyncedCss && js === lastSyncedJs) {
            return;
        }

        const syncDebounce = setTimeout(async () => {
            const payload: { html?: string; css?: string; js?: string } = {};
            if (html !== lastSyncedHtml) payload.html = html;
            if (css !== lastSyncedCss) payload.css = css;
            if (js !== lastSyncedJs) payload.js = js;

            try {
                const res = await fetch(
                    `/api/v1/code/sync/${projectId}`,
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
        }, 1500);

        return () => clearTimeout(syncDebounce);
    }, [html, css, js, projectId, isLoading, lastSyncedHtml, lastSyncedCss, lastSyncedJs]);

    const handleCreateProject = async (name: string) => {
        // Check for duplicate project name
        const isDuplicate = projects.some(
            (p) => p.name.toLowerCase() === name.toLowerCase()
        );
        if (isDuplicate) {
            notify(`A project named "${name}" already exists. Please choose a different name.`, "error");
            return;
        }

        setIsCreatingProject(true);

        try {
            const res = await fetch(`/api/v1/code/save`, {
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
                    timeLeft: 0, // updated on start
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
                    setProjects((prev) => [...prev, newData]);
                    if (setIgnoreNextBlur) setIgnoreNextBlur(true);
                    notify(`Project "${name}" created successfully!`, "success");

                    if (isContestPending) {
                        onContestStart();
                        setIsContestPending(false);
                    }
                } else {
                    if (setIgnoreNextBlur) setIgnoreNextBlur(true);
                    notify("Project created but missing ID. Please try again.", "warning");
                }
            } else {
                const errorText = await res.text();
                if (setIgnoreNextBlur) setIgnoreNextBlur(true);
                notify(`Failed to create project: ${errorText}`, "error");
            }
        } catch {
            if (setIgnoreNextBlur) setIgnoreNextBlur(true);
            notify("Network error while creating project.", "error");
        } finally {
            setIsCreatingProject(false);
            setShowCreateModal(false);
        }
    };

    const saveCode = async (currentData: { html: string; css: string; js: string; timeLeft: number }) => {
        try {
            const res = await fetch(
                `/api/v1/code/save`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    credentials: 'include',
                    // Exactly the code the caller passed (e.g. at time-up), not this render's copy
                    body: JSON.stringify({
                        name: projectName,
                        html: currentData.html,
                        css: currentData.css,
                        js: currentData.js,
                        timeLeft: currentData.timeLeft
                    }),
                }
            );
            if (res.ok) {
                const data = await res.json();
                const project_id = data._id || data.id;
                if (project_id) setProjectId(project_id);
                if (setIgnoreNextBlur) setIgnoreNextBlur(true);
                notify("Code saved successfully!", "success");
            } else {
                throw new Error("Save failed");
            }
        } catch (error) {
            console.error("Failed to save code", error);
            if (setIgnoreNextBlur) setIgnoreNextBlur(true);
            notify("Failed to save code. Please check your connection.", "error");
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
        loadingMessage,
        activeContest,
    };
}
