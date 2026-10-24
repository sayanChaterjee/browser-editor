export interface User {
    _id: string;
    id: string;
    name: string;
    warningCount: number;
    createdAt: string;
    email?: string;
    isAdmin?: boolean;
    banned?: boolean;
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

// Error carrying the API's message when the body has one, else the fallback.
async function errorFrom(res: Response, fallback: string): Promise<Error> {
    try {
        const body = await res.json();
        return new Error(body.message || fallback);
    } catch {
        return new Error(fallback);
    }
}

export async function fetchAllUsers(): Promise<User[]> {
    const res = await fetch(`${BASE}/api/v1/user/all`, { credentials: 'include' });
    if (!res.ok) throw new Error(`Failed to fetch users: ${res.status}`);
    return res.json();
}

// Ban signs the user out everywhere immediately and blocks sign-in; unban lifts the block.
export async function setUserBanned(userId: string, banned: boolean): Promise<User> {
    const res = await fetch(`${BASE}/api/v1/user/admin/${userId}/${banned ? 'ban' : 'unban'}`, {
        method: 'POST',
        credentials: 'include'
    });
    if (!res.ok) {
        throw await errorFrom(res, `Failed to ${banned ? 'ban' : 'unban'} user: ${res.status}`);
    }
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
        throw await errorFrom(res, `Failed to fetch contests: ${res.status}`);
    }
    return res.json();
}

export async function fetchActiveContest(): Promise<Contest | null> {
    const res = await fetch(`${BASE}/api/v1/contest/active`, { credentials: 'include' });
    if (!res.ok) {
        if (res.status === 404) return null;
        throw await errorFrom(res, `Failed to fetch active contest: ${res.status}`);
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
        throw await errorFrom(res, `Failed to create contest: ${res.status}`);
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
        throw await errorFrom(res, `Failed to update contest: ${res.status}`);
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
        throw await errorFrom(res, `Failed to update contest status: ${res.status}`);
    }
    return res.json();
}

export async function deleteContest(id: string): Promise<{ message: string }> {
    const res = await fetch(`${BASE}/api/v1/contest/${id}`, {
        method: 'DELETE',
        credentials: 'include'
    });
    if (!res.ok) {
        throw await errorFrom(res, `Failed to delete contest: ${res.status}`);
    }
    return res.json();
}
