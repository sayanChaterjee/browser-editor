export interface User {
    _id: string;
    id: string;
    name: string;
    warningCount: number;
    createdAt: string;
}

export interface Submission {
    _id: string;
    userId: string;
    projectId: string;
    html: string;
    css: string;
    js: string;
    timeLeft: number;
    createdAt: string;
    updatedAt: string;
}

export interface Project {
    _id: string;
    userId: string;
    name: string;
    html: string;
    css: string;
    js: string;
    timeLeft: number;
    createdAt: string;
    updatedAt: string;
}

const BASE = '';

export async function fetchAllUsers(): Promise<User[]> {
    const res = await fetch(`${BASE}/api/v1/user/all`, { credentials: 'include' });
    if (!res.ok) throw new Error(`Failed to fetch users: ${res.status}`);
    return res.json();
}

export async function fetchUserProjectsAdmin(userId: string): Promise<Project[]> {
    const res = await fetch(`${BASE}/api/v1/code/admin/projects/${userId}`, { credentials: 'include' });
    if (!res.ok) throw new Error(`Failed to fetch projects: ${res.status}`);
    return res.json();
}

export async function fetchUserSubmissionsAdmin(userId: string): Promise<Submission[]> {
    const res = await fetch(`${BASE}/api/v1/code/admin/submissions/${userId}`, { credentials: 'include' });
    if (!res.ok) throw new Error(`Failed to fetch submissions: ${res.status}`);
    return res.json();
}

export async function fetchProjectById(projectId: string): Promise<Project> {
    const res = await fetch(`${BASE}/api/v1/code/${projectId}`, { credentials: 'include' });
    if (!res.ok) throw new Error(`Failed to fetch project: ${res.status}`);
    return res.json();
}
