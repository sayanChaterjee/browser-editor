export interface User {
    _id: string;
    id: string;
    name: string;
    warningCount: number;
    createdAt: string;
    email?: string;
    isAdmin?: boolean;
    banned?: boolean;
    // "admin" users reach the admin pages; owners (identity-service ADMIN_EMAILS) always are
    role?: 'user' | 'admin';
    isOwner?: boolean;
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
    // Set while the user is banned
    disqualified?: boolean;
    // Review evidence from contest-service (absent on submissions made before it existed)
    signals?: SubmissionSignals | null;
    flags?: SubmissionFlag[];
    createdAt: string;
    updatedAt: string;
}

export type SubmissionFlag =
    | 'missing-heartbeats'
    | 'offline'
    | 'large-paste'
    | 'code-without-typing'
    | 'similar-submission'
    | 'matches-target';

export interface SubmissionSignals {
    heartbeats: number;
    expectedHeartbeats: number;
    gaps: number;
    offlineSeconds: number;
    typedChars: number;
    pastedChars: number;
    pasteCount: number;
    largestPaste: number;
    unexplainedChars: number;
    similarity: { score: number; submissionId: string; userId: string } | null;
    targetSimilarity: number;
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

// Promote or demote; takes effect at the user's next request (the role is in their token)
export async function setUserRole(userId: string, role: 'user' | 'admin'): Promise<User> {
    const res = await fetch(`${BASE}/api/v1/user/admin/${userId}/role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role }),
    });
    if (!res.ok) throw await errorFrom(res, `Failed to change role: ${res.status}`);
    return res.json();
}

export interface ReplayPoint {
    at: string;
    typed: number;
    pasted: number;
    largestPaste: number;
    chars: number | null;
}

/** How a submission came about (contest-service domain/replay): no code, just the outline. */
export interface Replay {
    submission: { _id: string; submittedAt: string; timeTaken: number; chars: number; flags: string[] };
    contest: { title: string; startTime: string; endTime: string } | null;
    timeline: ReplayPoint[];
    snapshots: { _id: string; at: string; chars: number }[];
}

export async function fetchReplay(submissionId: string): Promise<Replay> {
    const res = await fetch(`${BASE}/api/v1/contest/admin/replay/${submissionId}`, { credentials: 'include' });
    if (!res.ok) throw await errorFrom(res, `Failed to load the replay: ${res.status}`);
    return res.json();
}

export async function fetchSnapshotCode(submissionId: string, snapshotId: string): Promise<{ html: string; css: string; js: string }> {
    const res = await fetch(`${BASE}/api/v1/contest/admin/replay/${submissionId}/snapshots/${snapshotId}`, { credentials: 'include' });
    if (!res.ok) throw await errorFrom(res, `Failed to load the snapshot: ${res.status}`);
    return res.json();
}

export async function fetchUserProjectsAdmin(userId: string): Promise<Project[]> {
    const res = await fetch(`${BASE}/api/v1/code/admin/projects/${userId}`, { credentials: 'include' });
    if (!res.ok) throw new Error(`Failed to fetch projects: ${res.status}`);
    return res.json();
}

export async function fetchUserSubmissionsAdmin(userId: string): Promise<Submission[]> {
    const res = await fetch(`${BASE}/api/v1/contest/admin/submissions/${userId}`, { credentials: 'include' });
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
