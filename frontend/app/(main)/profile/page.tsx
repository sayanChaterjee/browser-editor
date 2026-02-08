"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

interface Project {
  _id: string;
  name: string;
  html: string;
  css: string;
  js: string;
  createdAt: string;
  updatedAt: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, isAuthenticated } = useAuth();
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [fetchingProjects, setFetchingProjects] = useState(true);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  // Fetch projects when user is available
  useEffect(() => {
    if (!user) return;

    const fetchProjects = async () => {
      try {
        // Fetch with credentials (cookies) - no Authorization header needed
        const projRes = await fetch(`/api/v1/code`, {
          credentials: 'include', // Include cookies
          cache: 'no-store', // Disable browser-side/Next.js caching for this request
        });
        
        if (projRes.ok) {
          const projData = await projRes.json();
          setProjects(Array.isArray(projData) ? projData : []);
        } else {
          console.error("Failed to fetch projects:", projRes.status);
          setProjects([]);
        }
      } catch (err) {
        console.error("Profile page load failed", err);
      } finally {
        setFetchingProjects(false);
      }
    };

    fetchProjects();
  }, [user, pathname]);

  const deleteProject = async (projectId: string) => {
    if (!confirm("Are you sure you want to delete this project?")) return;

    try {
      const res = await fetch(`/api/v1/code/${projectId}`, {
        method: 'DELETE',
        credentials: 'include', // Include cookies
      });
      
      if (res.ok) {
        setProjects(projects.filter(p => p._id !== projectId));
        alert("Project deleted successfully");
      }
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  if (isLoading || fetchingProjects) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-56px)] text-white text-xl">
        Loading Profile...
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  return (
    <div className="py-10 px-5 max-w-[1000px] mx-auto min-h-[calc(100vh-56px)]">
      <div className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] p-10 rounded-[24px] border border-[#334155] mb-10 text-center shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
        <div className="w-[100px] h-[100px] bg-gradient-to-br from-[#38bdf8] to-[#2563eb] rounded-full flex items-center justify-center text-[42px] font-bold text-white mx-auto mb-5 shadow-[0_0_25px_rgba(56,189,248,0.4)]">
          {user.name?.[0]?.toUpperCase() || 'U'}
        </div>
        <h1 className="text-[28px] font-extrabold text-[#f8fafc] mb-2 tracking-tight">{user.name}</h1>
        <p className="text-[#94a3b8] text-[15px] mb-6">{user.email}</p>
        
        <div className="flex justify-center gap-10 mt-2.5">
            <div className="text-center">
                <p className="text-[#38bdf8] font-extrabold text-[22px] mb-1">{projects.length}</p>
                <p className="text-[#64748b] text-[11px] font-semibold uppercase tracking-widest">Sessions</p>
            </div>
            <div className="h-10 w-[1px] bg-[#334155]"></div>
            <div className="text-center">
                <p className="text-[#10b981] font-extrabold text-[22px] mb-1">Active</p>
                <p className="text-[#64748b] text-[11px] font-semibold uppercase tracking-widest">Member Since {user.createdAt ? new Date(user.createdAt).getFullYear() : '2026'}</p>
            </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-[#f1f5f9] flex items-center gap-3">
               <span className="text-[#38bdf8]">📂</span> My Projects
            </h2>
            <span className="text-[#64748b] text-[13px]">{projects.length} Total Projects</span>
        </div>

        {projects.length === 0 ? (
          <div className="bg-[#1e293b] py-[60px] px-5 rounded-[20px] border border-dashed border-[#334155] text-center">
            <div className="text-[40px] mb-[15px] opacity-50">🏗️</div>
            <p className="text-[#94a3b8] text-base">No projects found yet.</p>
            <button 
                onClick={() => router.push('/editor')}
                className="mt-5 bg-[#38bdf8] text-[#0f172a] border-none px-6 py-2.5 rounded-lg font-bold cursor-pointer transition-opacity hover:opacity-90 active:scale-95"
            >
                Create New Project
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {projects.map((proj) => (
              <div 
                key={proj._id} 
                className="group bg-[#1e293b] px-6 py-5 rounded-2xl border border-[#334155] flex justify-between items-center transition-all relative overflow-hidden hover:border-[#38bdf8]/50"
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-[#38bdf8]"></div>
                <div className="flex-1 min-w-0 pr-4">
                  <h3 className="text-lg font-bold text-[#f8fafc] mb-1 truncate">
                    {proj.name}
                  </h3>
                  <p className="text-[12px] text-[#64748b] mb-3">
                    Last updated: {new Date(proj.updatedAt).toLocaleString()}
                  </p>
                  <div className="flex gap-2">
                    <span className="text-[11px] bg-[#0f172a] text-[#38bdf8] px-2.5 py-1 rounded-md font-semibold border border-[#1e293b]">
                        HTML
                    </span>
                    <span className="text-[11px] bg-[#0f172a] text-[#10b981] px-2.5 py-1 rounded-md font-semibold border border-[#1e293b]">
                        CSS
                    </span>
                    <span className="text-[11px] bg-[#0f172a] text-[#fbbf24] px-2.5 py-1 rounded-md font-semibold border border-[#1e293b]">
                        JS
                    </span>
                  </div>
                </div>
                <div className="flex gap-3 shrink-0">
                    <button 
                        onClick={() => router.push(`/editor?projectId=${proj._id}`)}
                        className="bg-[#38bdf8] text-[#0f172a] border-none px-5 py-2.5 rounded-xl text-[13px] font-bold cursor-pointer transition-all hover:opacity-90 active:scale-95"
                    >
                      Open in Editor
                    </button>
                    <button 
                        onClick={() => deleteProject(proj._id)}
                        className="bg-red-500/10 text-red-500 border border-red-500/20 px-[15px] py-2.5 rounded-xl text-[13px] font-semibold cursor-pointer transition-all hover:bg-red-500/20 active:scale-95"
                    >
                      Delete
                    </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
