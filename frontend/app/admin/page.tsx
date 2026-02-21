'use client';

import { useEffect, useState } from 'react';
import { 
  User, 
  Project, 
  Submission, 
  fetchAllUsers, 
  fetchUserProjectsAdmin, 
  fetchUserSubmissionsAdmin 
} from '@/lib/adminApi';
import UserList from '@/components/admin/UserList';
import PreviewPanel from '@/components/admin/PreviewPanel';
import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<Project | Submission | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

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
          setSelectedActivity(subData[0] as any);
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
      <div className="flex items-center justify-center h-screen bg-[#0a0e1a] text-gray-400">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
          <span className="text-sm font-medium animate-pulse">Initializing Admin Dashboard...</span>
        </div>
      </div>
    );
  }

  if (isAuthorized === false) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0e1a] text-gray-400 p-8 text-center">
        <div className="max-w-md flex flex-col items-center gap-6">
          <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 text-4xl shadow-lg shadow-red-900/10">
            🔒
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Access Restricted</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            This terminal is reserved for administrative personnel. Your account does not have the necessary clearance to view user data.
          </p>
          <button 
            onClick={() => router.push('/editor')}
            className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors font-medium border border-gray-700"
          >
            Return to Editor
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0a0e1a] text-gray-200 overflow-hidden font-sans">
      {/* Left Sidebar: User List */}
      <aside className="w-80 border-r border-gray-800 bg-[#0c1222] flex flex-col shadow-2xl z-10">
        <div className="p-6 border-b border-gray-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold shadow-lg shadow-cyan-900/20">
            A
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white uppercase">Admin Console</h1>
            <p className="text-[10px] text-gray-500 font-medium">Internal Security Protocol</p>
          </div>
        </div>
        
        <div className="flex-1 overflow-hidden">
          <UserList 
            users={users}
            selectedUserId={selectedUser?._id || null}
            onSelectUser={setSelectedUser}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0a0e1a]">
        {selectedUser ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header / Info Bar */}
            <header className="h-16 px-8 border-b border-gray-800 flex items-center justify-between bg-[#0c1222]/50 backdrop-blur-md">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-cyan-900/40 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold">
                  {selectedUser.name[0]?.toUpperCase()}
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white tracking-tight">{selectedUser.name}</h2>
                  <p className="text-[11px] text-gray-500 font-mono italic">{selectedUser.email}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-6">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Warnings</span>
                  <span className={`text-sm font-bold ${
                    !selectedActivity ? 'text-gray-500' :
                    (selectedActivity.warningCount || 0) >= 3 ? 'text-red-400' : 
                    (selectedActivity.warningCount || 0) > 0 ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                    {selectedActivity ? `${selectedActivity.warningCount || 0} / 4` : '-'}
                  </span>
                </div>
                <div className="h-8 w-[1px] bg-gray-800"></div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Joined</span>
                  <span className="text-sm font-semibold text-gray-300">
                    {new Date(selectedUser.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </header>

            {/* Split View: List and Preview */}
            <div className="flex-1 flex min-h-0 overflow-hidden">
              {/* Activity List (Projects & Submissions) */}
              <div className="w-72 border-r border-gray-800 bg-[#0c1222]/30 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-gray-800 bg-gray-900/20">
                  <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Active Projects</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-1 py-2">
                  {dataLoading ? (
                    <div className="p-4 flex justify-center">
                      <div className="w-5 h-5 border-2 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin"></div>
                    </div>
                  ) : projects.length === 0 ? (
                    <div className="p-4 text-center text-gray-600 text-xs italic">No active projects</div>
                  ) : (
                    projects.map((p) => (
                      <button
                        key={p._id}
                        onClick={() => setSelectedActivity(p)}
                        className={`w-full text-left px-4 py-3 rounded-lg mb-1 transition-all group ${
                          selectedActivity?._id === p._id 
                            ? 'bg-cyan-500/10 ring-1 ring-cyan-500/30' 
                            : 'hover:bg-gray-800/40'
                        }`}
                      >
                        <div className="text-xs font-semibold text-gray-200 group-hover:text-white mb-1 truncate">
                          {p.name}
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-gray-500">
                          <span>Project</span>
                          <span>{new Date(p.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </button>
                    ))
                  )}
                  
                  <div className="mt-4 p-4 border-b border-gray-800 bg-gray-900/20 mb-2">
                    <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Previous Submissions</h3>
                  </div>
                  {submissions.map((s) => {
                    // Contest duration is 120 minutes (7200 seconds).
                    // Time elapsed = Total Duration - Time Left
                    const timeElapsedSeconds = 7200 - s.timeLeft;
                    const minutes = Math.floor(timeElapsedSeconds / 60);
                    const seconds = timeElapsedSeconds % 60;
                    const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                    
                    return (
                      <button
                        key={s._id}
                        onClick={() => setSelectedActivity(s)}
                        className={`w-full text-left px-4 py-3 rounded-lg mb-1 transition-all group ${
                          selectedActivity?._id === s._id 
                            ? 'bg-emerald-500/10 ring-1 ring-emerald-500/30' 
                            : 'hover:bg-gray-800/40'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <div className="text-xs font-semibold text-gray-200 group-hover:text-white truncate flex items-center gap-2">
                            <span>Submission {s._id.slice(-6)}</span>
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                              ⏱ {formattedTime} taken
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-gray-500">
                          <span className="text-emerald-500/80 uppercase font-bold tracking-tighter">Final</span>
                          <span>{new Date(s.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Preview Panel */}
              <div className="flex-1 bg-white relative">
                {selectedActivity ? (
                  <PreviewPanel 
                    html={selectedActivity.html}
                    css={selectedActivity.css}
                    js={selectedActivity.js}
                    projectName={(selectedActivity as any).name || `Submission ${selectedActivity._id.slice(-6)}`}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-600 bg-[#0a0e1a]">
                    <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-gray-800 flex items-center justify-center mb-4">
                      <span className="text-2xl opacity-20">🗂</span>
                    </div>
                    <p className="text-sm font-medium">Select a project or submission to preview</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-[#0a0e1a] text-center p-12">
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-cyan-500/20 blur-3xl rounded-full"></div>
              <div className="relative w-24 h-24 rounded-3xl bg-gray-900 border border-gray-800 flex items-center justify-center shadow-2xl">
                <span className="text-4xl text-cyan-400">🛡️</span>
              </div>
            </div>
            <h2 className="text-xl font-bold text-white mb-2 tracking-tight">Integrated Admin Terminal</h2>
            <p className="text-gray-500 max-w-sm text-sm">
              Monitoring user activity, warnings, and persistence across Redis, MongoDB, and IndexedDB. Select a user to begin audit.
            </p>
            <div className="mt-8 flex gap-3">
              <div className="px-4 py-2 bg-gray-800/50 rounded-lg border border-gray-700/50 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                Storage: Multi-Node | PERSISTENT
              </div>
              <div className="px-4 py-2 bg-gray-800/50 rounded-lg border border-gray-700/50 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                Status: Audit Ready
              </div>
            </div>
          </div>
        )}
      </main>

      {error && (
        <div className="fixed bottom-6 right-6 px-6 py-4 bg-red-950/80 border border-red-500/50 text-red-200 text-sm rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4">
          <span className="text-lg">⛔</span>
          <span>{error}</span>
          <button 
            onClick={() => setError(null)}
            className="ml-4 text-red-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
