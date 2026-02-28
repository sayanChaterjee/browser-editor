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
    timeTaken?: number;
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
    imageUrl?: string;
    html?: string;
    css?: string;
    js?: string;
    status: 'pending' | 'active' | 'ended';
    createdAt: string;
    updatedAt: string;
}

export async function fetchAllContests(): Promise<Contest[]> {
    const res = await fetch(`${BASE}/api/v1/contest/all`, { credentials: 'include' });
    if (!res.ok) {
        try { const err = await res.json(); throw new Error(err.message || `Failed to fetch contests: ${res.status}`); }
        catch (e: any) { throw new Error(e.message || `Failed to fetch contests: ${res.status}`); }
    }
    return res.json();
}

export async function fetchActiveContest(): Promise<Contest | null> {
    const res = await fetch(`${BASE}/api/v1/contest/active`, { credentials: 'include' });
    if (!res.ok) {
        if (res.status === 404) return null;
        try { const err = await res.json(); throw new Error(err.message || `Failed to fetch active contest: ${res.status}`); }
        catch (e: any) { throw new Error(e.message || `Failed to fetch active contest: ${res.status}`); }
    }
    return res.json();
}

export async function createContest(data: { title: string; startTime: string; endTime: string; imageUrl?: string; html?: string; css?: string; js?: string; }): Promise<Contest> {
    const res = await fetch(`${BASE}/api/v1/contest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        try { const err = await res.json(); throw new Error(err.message || `Failed to create contest: ${res.status}`); }
        catch (e: any) { throw new Error(e.message || `Failed to create contest: ${res.status}`); }
    }
    return res.json();
}

export async function updateContest(id: string, data: { title: string; startTime: string; endTime: string; imageUrl?: string; html?: string; css?: string; js?: string; }): Promise<Contest> {
    const res = await fetch(`${BASE}/api/v1/contest/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        try { const err = await res.json(); throw new Error(err.message || `Failed to update contest: ${res.status}`); }
        catch (e: any) { throw new Error(e.message || `Failed to update contest: ${res.status}`); }
    }
    return res.json();
}

export async function updateContestStatus(id: string, status: 'pending' | 'active' | 'ended'): Promise<Contest> {
    const res = await fetch(`${BASE}/api/v1/contest/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status })
    });
    if (!res.ok) {
        try { const err = await res.json(); throw new Error(err.message || `Failed to update contest status: ${res.status}`); }
        catch (e: any) { throw new Error(e.message || `Failed to update contest status: ${res.status}`); }
    }
    return res.json();
}

export async function deleteContest(id: string): Promise<{ message: string }> {
    const res = await fetch(`${BASE}/api/v1/contest/${id}`, {
        method: 'DELETE',
        credentials: 'include'
    });
    if (!res.ok) {
        try { const err = await res.json(); throw new Error(err.message || `Failed to delete contest: ${res.status}`); }
        catch (e: any) { throw new Error(e.message || `Failed to delete contest: ${res.status}`); }
    }
    return res.json();
}
