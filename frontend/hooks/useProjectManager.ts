"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getLocalProject } from "../lib/indexedDB";
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

    useEffect(() => {
        const initData = async () => {
            const token = localStorage.getItem("token");
            if (!token) {
                router.push("/login");
                return;
            }

            // 1. Fetch User Profile
            try {
                const profRes = await fetch(
                    `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/api/v1/user/profile`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                if (profRes.ok) {
                    const profText = await profRes.text();
                    if (profText) {
                        try {
                            const profData = JSON.parse(profText);
                            setUserProfile(profData);
                        } catch (e) {
                            console.error("Profile JSON parse error", e);
                        }
                    }
                } else if (profRes.status === 401) {
                    onLogout();
                    return;
                }
            } catch (err) {
                console.error("Profile fetch failed", err);
            }

            // 2. Fetch Projects
            try {
                const res = await fetch(
                    `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/api/v1/code`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data) && data.length > 0) {
                        setProjects(data);

                        let targetProject = data[0];
                        if (requestedProjectId) {
                            const found = data.find((p) => p._id === requestedProjectId);
                            if (found) targetProject = found;
                        }

                        setProjectId(targetProject._id);
                        setProjectName(targetProject.name);

                        const localData = await getLocalProject(targetProject._id);
                        if (localData && new Date(localData.updatedAt) > new Date(targetProject.updatedAt)) {
                            setHtml(localData.html);
                            setCss(localData.css);
                            setJs(localData.js);
                        } else {
                            setHtml(targetProject.html || "");
                            setCss(targetProject.css || "");
                            setJs(targetProject.js || "");
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
            }
        };

        initData();
    }, [router, requestedProjectId]);

    const handleCreateProject = async (name: string) => {
        setIsCreatingProject(true);

        const token = localStorage.getItem("token");
        if (!token) {
            if (setIgnoreNextBlur) setIgnoreNextBlur(true);
            alert("You must be logged in to create a project");
            setIsCreatingProject(false);
            setShowCreateModal(false);
            return;
        }

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/api/v1/code/save`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
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

                if (newData._id) {
                    setProjectName(name);
                    setHtml(INITIAL_HTML);
                    setCss(INITIAL_CSS);
                    setJs(INITIAL_JS);
                    setProjectId(newData._id);
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
        const token = localStorage.getItem("token");
        if (!token) return;

        try {
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/api/v1/code/save`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        name: projectName,
                        ...currentData
                    }),
                }
            );
            if (res.ok) {
                const data = await res.json();
                setProjectId(data._id);
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
    };
}
