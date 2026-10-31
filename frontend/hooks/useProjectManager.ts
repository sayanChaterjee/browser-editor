"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getLocalProject, getAllLocalProjects, clearMismatchingProjects } from "../lib/indexedDB";
import { isContestProject, rememberUser, rememberedUser } from "../lib/session";
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
    showToast?: (message: string, type: "success" | "error" | "warning" | "info") => void;
    onUserLoaded?: (id: string) => void;
}

/** The practice workspace's projects: loading, switching, creating, auto-sync and saving. */
export function useProjectManager({
    onLogout,
    showToast,
    onUserLoaded,
}: UseProjectManagerProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const requestedProjectId = searchParams.get("projectId");

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
    const callbacks = useRef({ onLogout, onUserLoaded });
    useEffect(() => {
        callbacks.current = { onLogout, onUserLoaded };
    });

    // Opened from this browser's local copy before the server answered (see initData)
    const preloaded = useRef<{ id: string; html: string; css: string; js: string } | null>(null);
    const codeRef = useRef({ html, css, js });
    useEffect(() => {
        codeRef.current = { html, css, js };
    });

    useEffect(() => {
        /**
         * Shows a project's code, unless it is the project opened from the local copy and the
         * user has edited it since: those edits are newer than anything the server has.
         */
        const applyCode = (id: string, code: { html: string; css: string; js: string }) => {
            const opened = preloaded.current;
            const current = codeRef.current;
            const edited = opened?.id === id
                && (current.html !== opened.html || current.css !== opened.css || current.js !== opened.js);
            if (edited) return;
            setHtml(code.html);
            setCss(code.css);
            setJs(code.js);
            setLastSyncedHtml(code.html);
            setLastSyncedCss(code.css);
            setLastSyncedJs(code.js);
        };

        const initData = async () => {
            let profile: { id?: string; name: string; email: string; createdAt?: string } | null = null;

            // 0. Open straight away from this browser's copy (the user who last worked here):
            // on a cold start the server can take ~20 s, and the user can work meanwhile.
            // The server's answer below then takes over (keeping any edits made in between).
            const lastUser = rememberedUser();
            if (lastUser) {
                try {
                    const local = (await getAllLocalProjects(lastUser))
                        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
                    const pick = requestedProjectId
                        ? local.find((p) => p.id === requestedProjectId)
                        : local.find((p) => !isContestProject(p.name)) ?? local[0];
                    if (pick) {
                        setProjectId(pick.id);
                        setProjectName(pick.name);
                        applyCode(pick.id, pick);
                        // After applying: edits are measured from what was opened
                        preloaded.current = { id: pick.id, html: pick.html, css: pick.css, js: pick.js };
                        callbacks.current.onUserLoaded?.(lastUser);
                        setIsLoading(false);
                    }
                } catch {
                    // no local copy to open: wait for the server as before
                }
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
                    rememberUser(uid);
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

                        // Stay on the project opened from the local copy; otherwise the most
                        // recent practice project (a finished contest's project only if that's all)
                        let targetProject =
                            data.find((p) => p._id === preloaded.current?.id)
                            ?? data.find((p) => !isContestProject(p.name))
                            ?? data[0];
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
                                            applyCode(fullProject._id, localData);
                                        } else {
                                            applyCode(fullProject._id, {
                                                html: fullProject.html?.trim() ? fullProject.html : INITIAL_HTML,
                                                css: fullProject.css || INITIAL_CSS,
                                                js: fullProject.js || INITIAL_JS,
                                            });
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
                            applyCode(targetProject._id, localData);
                        } else {
                            applyCode(targetProject._id, {
                                html: targetProject.html?.trim() ? targetProject.html : INITIAL_HTML,
                                css: targetProject.css || INITIAL_CSS,
                                js: targetProject.js || INITIAL_JS,
                            });
                        }
                    } else {
                        setIsModalCancelable(false);
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
                    notify(`Project "${name}" created successfully!`, "success");
                } else {
                    notify("Project created but missing ID. Please try again.", "warning");
                }
            } else {
                const errorText = await res.text();
                notify(`Failed to create project: ${errorText}`, "error");
            }
        } catch {
            notify("Network error while creating project.", "error");
        } finally {
            setIsCreatingProject(false);
            setShowCreateModal(false);
        }
    };

    const saveCode = async (currentData: { html: string; css: string; js: string }) => {
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
                    }),
                }
            );
            if (res.ok) {
                const data = await res.json();
                const project_id = data._id || data.id;
                if (project_id) setProjectId(project_id);
                notify("Code saved successfully!", "success");
            } else {
                throw new Error("Save failed");
            }
        } catch (error) {
            console.error("Failed to save code", error);
            notify("Failed to save code. Please check your connection.", "error");
        }
    };

    return {
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
    };
}
