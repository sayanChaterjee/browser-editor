export interface User {
    _id: string;
    id: string;
    name: string;
    warningCount: number;
    createdAt: string;
    email?: string;
    isAdmin?: boolean;
}

export interface Submission {
    _id: string;
    userId: string;
    projectId: string;
    html: string;
    css: string;
    js: string;
    timeLeft: number;
    warningCount?: number;
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
    warningCount?: number;
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

export interface Contest {
    _id: string;
    title: string;
    startTime: string;
    endTime: string;
    imageUrl: string;
    status: 'pending' | 'active' | 'ended';
    createdAt: string;
    updatedAt: string;
}

export async function fetchAllContests(): Promise<Contest[]> {
    const res = await fetch(`${BASE}/api/v1/contest/all`, { credentials: 'include' });
    if (!res.ok) throw new Error(`Failed to fetch contests: ${res.status}`);
    return res.json();
}

export async function fetchActiveContest(): Promise<Contest | null> {
    const res = await fetch(`${BASE}/api/v1/contest/active`, { credentials: 'include' });
    if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`Failed to fetch active contest: ${res.status}`);
    }
    return res.json();
}

export async function createContest(data: { title: string; startTime: string; endTime: string; imageUrl: string }): Promise<Contest> {
    const res = await fetch(`${BASE}/api/v1/contest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(`Failed to create contest: ${res.status}`);
    return res.json();
}

export async function updateContestStatus(id: string, status: 'pending' | 'active' | 'ended'): Promise<Contest> {
    const res = await fetch(`${BASE}/api/v1/contest/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status })
    });
    if (!res.ok) throw new Error(`Failed to update contest status: ${res.status}`);
    return res.json();
}
