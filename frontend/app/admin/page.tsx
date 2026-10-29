'use client';

import { useEffect, useState } from 'react';
import { 
  User, 
  Project, 
  Submission, 
  fetchAllUsers, 
  fetchUserProjectsAdmin, 
  fetchUserSubmissionsAdmin,
  setUserBanned
} from '@/lib/adminApi';
import UserList from '@/components/admin/UserList';
import PreviewPanel from '@/components/admin/PreviewPanel';
import SubmissionSignals from '@/components/admin/SubmissionSignals';
import ContestManager from '@/components/admin/ContestManager';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Ban, Clock, Lock, MousePointerClick, ShieldCheck, TriangleAlert, Users, X, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';
import { Spinner } from '@/components/ui/spinner';
import { cn, timeAgo } from '@/lib/utils';

export default function AdminDashboard() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'contests'>('users');
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<Project | Submission | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [moderating, setModerating] = useState(false);
  const [moderationError, setModerationError] = useState<string | null>(null);

  const toggleBan = async () => {
    if (!selectedUser) return;
    const ban = !selectedUser.banned;
    if (ban && !window.confirm(`Ban ${selectedUser.name}? They are signed out immediately and can't sign in again until unbanned.`)) return;
    setModerating(true);
    setModerationError(null);
    try {
      const updated = await setUserBanned(selectedUser._id, ban);
      setSelectedUser(updated);
      setUsers((prev) => prev.map((u) => (u._id === updated._id ? updated : u)));
    } catch (err) {
      setModerationError(err instanceof Error ? err.message : 'Moderation failed');
    } finally {
      setModerating(false);
    }
  };

  // Initial fetch of all users and check authorization
  useEffect(() => {
    const init = async () => {
      try {
        // Fetch current user profile to check isAdmin flag
        const profileRes = await fetch('/api/v1/user/profile', { credentials: 'include' });
        if (!profileRes.ok) {
           router.push('/login');
           return;
        }
        const profile = await profileRes.json();
        
        if (!profile.isAdmin) {
          setIsAuthorized(false);
          setLoading(false);
          return;
        }

        setIsAuthorized(true);
        const userData = await fetchAllUsers();
        setUsers(userData);
      } catch (err) {
        console.error('Failed to init dashboard:', err);
        setError('Failed to load users. Please ensure you are logged in.');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [router]);

  // Fetch projects/submissions when user is selected
  useEffect(() => {
    if (!selectedUser) return;

    const fetchUserData = async () => {
      setDataLoading(true);
      try {
        const [projData, subData] = await Promise.all([
          fetchUserProjectsAdmin(selectedUser._id),
          fetchUserSubmissionsAdmin(selectedUser._id)
        ]);
        setProjects(projData);
        setSubmissions(subData);
        
        // Auto-select the most recent activity
        if (projData.length > 0) {
          setSelectedActivity(projData[0]);
        } else if (subData.length > 0) {
          setSelectedActivity(subData[0]);
        } else {
          setSelectedActivity(null);
        }
      } catch (err) {
        console.error('Failed to fetch user data:', err);
      } finally {
        setDataLoading(false);
      }
    };

    fetchUserData();
  }, [selectedUser]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Spinner className="size-5" />
      </div>
    );
  }

  if (isAuthorized === false) {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-8 text-center">
        <div className="flex max-w-sm flex-col items-center">
          <div className="flex size-10 items-center justify-center rounded-full border border-border bg-card">
            <Lock className="size-4 text-muted-foreground" />
          </div>
          <h1 className="mt-4 text-lg font-semibold tracking-tight text-foreground">Admins only</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your account doesn&apos;t have access to the admin console.</p>
          <Button variant="secondary" className="mt-6" onClick={() => router.push('/editor')}>
            <ArrowLeft /> Back to the editor
          </Button>
        </div>
      </div>
    );
  }

  const strikes = selectedActivity?.warningCount || 0;

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar: users and contests */}
      <aside className="z-10 flex w-80 shrink-0 flex-col border-r border-border bg-background">
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <Logo href="/editor" />
            <Badge>Admin</Badge>
          </div>
          <Button variant="ghost" size="icon" aria-label="Back to the editor" title="Back to the editor" onClick={() => router.push('/editor')}>
            <ArrowLeft />
          </Button>
        </div>

        <div className="flex gap-1 border-b border-border px-3">
          {(['users', 'contests'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                '-mb-px border-b px-2.5 py-2.5 text-sm capitalize transition-colors',
                activeTab === tab ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-hidden">
          {activeTab === 'users' ? (
            <UserList 
              users={users}
              selectedUserId={selectedUser?._id || null}
              onSelectUser={(user) => { setSelectedUser(user); setModerationError(null); }}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />
          ) : (
            <p className="p-6 text-center text-sm text-muted-foreground">Manage contests on the right.</p>
          )}
        </div>
      </aside>

      {/* Main area */}
      <main className="flex min-w-0 flex-1 flex-col bg-background">
        {activeTab === 'contests' ? (
          <ContestManager />
        ) : selectedUser ? (
          <div className="flex flex-1 flex-col overflow-hidden">
            <header className="flex h-16 shrink-0 items-center justify-between gap-6 border-b border-border px-6">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border-strong bg-secondary text-sm font-medium">
                  {selectedUser.name[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h2 className="flex items-center gap-2 truncate text-sm font-medium text-foreground">
                    {selectedUser.name}
                    {selectedUser.banned && <Badge tone="danger">Banned</Badge>}
                  </h2>
                  <p className="truncate font-mono text-[12px] text-muted-foreground">{selectedUser.email}</p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-6">
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-wider text-subtle-foreground">Strikes</p>
                  <p className={cn(
                    'text-sm font-medium tabular-nums',
                    !selectedActivity ? 'text-subtle-foreground' : strikes >= 3 ? 'text-destructive' : strikes > 0 ? 'text-warning' : 'text-foreground',
                  )}>
                    {selectedActivity ? `${strikes} / 4` : '-'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-wider text-subtle-foreground">Joined</p>
                  <p className="text-sm font-medium text-foreground">{new Date(selectedUser.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex flex-col items-end">
                  <Button
                    size="sm"
                    variant={selectedUser.banned ? 'secondary' : 'danger-outline'}
                    onClick={toggleBan}
                    disabled={moderating}
                  >
                    {moderating ? <Spinner /> : selectedUser.banned ? <><ShieldCheck /> Unban</> : <><Ban /> Ban</>}
                  </Button>
                  {moderationError && (
                    <span className="mt-1 max-w-[200px] text-right text-[11px] text-destructive">{moderationError}</span>
                  )}
                </div>
              </div>
            </header>

            <div className="flex min-h-0 flex-1 overflow-hidden">
              {/* Projects and submissions */}
              <div className="flex w-72 shrink-0 flex-col overflow-hidden border-r border-border">
                <div className="flex-1 overflow-y-auto p-2">
                  <h3 className="px-2 pb-2 pt-1 text-[11px] font-medium uppercase tracking-wider text-subtle-foreground">Projects</h3>
                  {dataLoading ? (
                    <div className="flex justify-center p-4"><Spinner /></div>
                  ) : projects.length === 0 ? (
                    <p className="px-2 pb-2 text-[13px] text-subtle-foreground">No projects</p>
                  ) : (
                    projects.map((p) => (
                      <button
                        key={p._id}
                        onClick={() => setSelectedActivity(p)}
                        className={cn(
                          'mb-0.5 w-full rounded-md px-3 py-2 text-left transition-colors',
                          selectedActivity?._id === p._id ? 'bg-secondary' : 'hover:bg-muted',
                        )}
                      >
                        <div className="truncate text-[13px] font-medium text-foreground">{p.name}</div>
                        <div className="text-[12px] text-muted-foreground">Updated {timeAgo(p.updatedAt)}</div>
                      </button>
                    ))
                  )}

                  <h3 className="px-2 pb-2 pt-5 text-[11px] font-medium uppercase tracking-wider text-subtle-foreground">Submissions</h3>
                  {!dataLoading && submissions.length === 0 && (
                    <p className="px-2 text-[13px] text-subtle-foreground">No submissions</p>
                  )}
                  {submissions.map((s) => {
                    const timeElapsedSeconds = s.timeTaken || 0;
                    const hours = Math.floor(timeElapsedSeconds / 3600);
                    const minutes = Math.floor((timeElapsedSeconds % 3600) / 60);
                    const seconds = timeElapsedSeconds % 60;
                    const formattedTime = hours > 0 ? `${hours}h ${minutes}m` : minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

                    return (
                      <button
                        key={s._id}
                        onClick={() => setSelectedActivity(s)}
                        className={cn(
                          'mb-0.5 w-full rounded-md px-3 py-2 text-left transition-colors',
                          selectedActivity?._id === s._id ? 'bg-secondary' : 'hover:bg-muted',
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-mono text-[12px] text-foreground">#{s._id.slice(-6)}</span>
                          <span className="flex items-center gap-1">
                            {(s.flags?.length ?? 0) > 0 && (
                              <Badge tone="warning" title={`Flagged for review: ${s.flags!.join(', ')}`}>
                                <TriangleAlert className="size-3" />{s.flags!.length}
                              </Badge>
                            )}
                            {s.disqualified ? (
                              <Badge tone="danger" title="The user is banned">Disqualified</Badge>
                            ) : (
                              <Badge>Final</Badge>
                            )}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between text-[12px] text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock className="size-3" /> {formattedTime}</span>
                          <span>{new Date(s.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Preview */}
              <div className="relative flex min-w-0 flex-1 flex-col">
                {selectedActivity && !('name' in selectedActivity) && (
                  <SubmissionSignals submission={selectedActivity} />
                )}
                {selectedActivity ? (
                  <div className="min-h-0 flex-1">
                    <PreviewPanel
                      html={selectedActivity.html}
                      css={selectedActivity.css}
                      js={selectedActivity.js}
                      projectName={('name' in selectedActivity && selectedActivity.name) || `Submission #${selectedActivity._id.slice(-6)}`}
                    />
                  </div>
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center text-center">
                    <MousePointerClick className="size-5 text-subtle-foreground" />
                    <p className="mt-3 text-sm text-muted-foreground">Select a project or submission to preview it</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center p-12 text-center">
            <div className="flex size-10 items-center justify-center rounded-full border border-border bg-card">
              <Users className="size-4 text-muted-foreground" />
            </div>
            <h2 className="mt-4 text-lg font-semibold tracking-tight text-foreground">Select a user</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              See their projects and contest submissions, preview their code, and ban or unban them.
            </p>
          </div>
        )}
      </main>

      {error && (
        <div className="animate-fadeIn fixed bottom-4 right-4 flex items-start gap-3 rounded-lg border border-border-strong bg-popover px-4 py-3 text-sm shadow-2xl shadow-black">
          <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <span className="text-foreground">{error}</span>
          <button onClick={() => setError(null)} aria-label="Dismiss" className="text-subtle-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
