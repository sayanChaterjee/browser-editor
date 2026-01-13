"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

interface Project {
  _id: string;
  name: string;
  html: string;
  css: string;
  js: string;
  createdAt: string;
  updatedAt: string;
}

interface UserProfile {
  name: string;
  email: string;
  createdAt: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    const fetchData = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
        
        // Fetch Profile
        const profRes = await fetch(`${apiUrl}/api/v1/user/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (profRes.status === 401) {
          localStorage.clear();
          document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
          router.push("/login");
          return;
        }

        if (profRes.ok) {
          const profData = await profRes.json();
          setUser(profData);
        }

        // Fetch Projects
        const projRes = await fetch(`${apiUrl}/api/v1/code`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (projRes.ok) {
          const projData = await projRes.json();
          if (Array.isArray(projData)) {
            setProjects(projData);
          } else {
            setProjects([]);
          }
        } else {
        }
      } catch (err) {
        console.error("Profile page load failed", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router, pathname]);

  const deleteProject = async (projectId: string) => {
    if (!confirm("Are you sure you want to delete this project?")) return;

    const token = localStorage.getItem("token");
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
      const res = await fetch(`${apiUrl}/api/v1/code/${projectId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setProjects(projects.filter(p => p._id !== projectId));
        alert("Project deleted successfully");
      }
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  if (loading) {
    return <div className="loading-screen">Loading Profile...</div>;
  }

  return (
    <div className="profile-page-wrapper" style={{ padding: '40px 20px', maxWidth: '1000px', margin: '0 auto', minHeight: 'calc(100vh - 56px)' }}>
      <div className="profile-header" style={{ 
        background: 'linear-gradient(145deg, #1e293b, #0f172a)', 
        padding: '40px', 
        borderRadius: '24px', 
        border: '1px solid #334155', 
        marginBottom: '40px', 
        textAlign: 'center',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{ 
          width: '100px', 
          height: '100px', 
          background: 'linear-gradient(135deg, #38bdf8, #2563eb)', 
          borderRadius: '50%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          fontSize: '42px', 
          fontWeight: 'bold',
          color: 'white',
          margin: '0 auto 20px',
          boxShadow: '0 0 25px rgba(56, 189, 248, 0.4)'
        }}>
          {user?.name?.[0]?.toUpperCase() || 'U'}
        </div>
        <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#f8fafc', marginBottom: '8px', letterSpacing: '-0.025em' }}>{user?.name}</h1>
        <p style={{ color: '#94a3b8', fontSize: '15px', marginBottom: '24px' }}>{user?.email}</p>
        
        <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', marginTop: '10px' }}>
            <div style={{ textAlign: 'center' }}>
                <p style={{ color: '#38bdf8', fontWeight: '800', fontSize: '22px', marginBottom: '4px' }}>{projects.length}</p>
                <p style={{ color: '#64748b', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Sessions</p>
            </div>
            <div style={{ height: '40px', width: '1px', background: '#334155' }}></div>
            <div style={{ textAlign: 'center' }}>
                <p style={{ color: '#10b981', fontWeight: '800', fontSize: '22px', marginBottom: '4px' }}>Active</p>
                <p style={{ color: '#64748b', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Member Since {user?.createdAt ? new Date(user.createdAt).getFullYear() : '2026'}</p>
            </div>
        </div>
      </div>

      <div className="submissions-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '12px' }}>
               <span style={{ color: '#38bdf8' }}>📂</span> My Projects
            </h2>
            <span style={{ color: '#64748b', fontSize: '13px' }}>{projects.length} Total Projects</span>
        </div>

        {projects.length === 0 ? (
          <div style={{ 
            background: '#1e293b', 
            padding: '60px 20px', 
            borderRadius: '20px', 
            border: '1px dashed #334155', 
            textAlign: 'center' 
          }}>
            <div style={{ fontSize: '40px', marginBottom: '15px', opacity: 0.5 }}>🏗️</div>
            <p style={{ color: '#94a3b8', fontSize: '16px' }}>No projects found yet.</p>
            <button 
                onClick={() => router.push('/editor')}
                style={{ marginTop: '20px', background: '#38bdf8', color: '#0f172a', border: 'none', padding: '10px 24px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
            >
                Create New Project
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {Array.isArray(projects) && projects.map((proj) => (
              <div 
                key={proj._id} 
                className="submission-card" 
                style={{ 
                    background: '#1e293b', 
                    padding: '20px 24px', 
                    borderRadius: '16px', 
                    border: '1px solid #334155', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                    overflow: 'hidden'
                }}
              >
                <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#38bdf8' }}></div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#f8fafc', marginBottom: '4px' }}>
                    {proj.name}
                  </h3>
                  <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
                    Last updated: {new Date(proj.updatedAt).toLocaleString()}
                  </p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ fontSize: '11px', background: '#0f172a', color: '#38bdf8', padding: '4px 10px', borderRadius: '6px', fontWeight: '600', border: '1px solid #1e293b' }}>
                        HTML
                    </span>
                    <span style={{ fontSize: '11px', background: '#0f172a', color: '#10b981', padding: '4px 10px', borderRadius: '6px', fontWeight: '600', border: '1px solid #1e293b' }}>
                        CSS
                    </span>
                    <span style={{ fontSize: '11px', background: '#0f172a', color: '#fbbf24', padding: '4px 10px', borderRadius: '6px', fontWeight: '600', border: '1px solid #1e293b' }}>
                        JS
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button 
                        onClick={() => router.push(`/editor?projectId=${proj._id}`)}
                        className="view-btn"
                        style={{ 
                            background: '#38bdf8', 
                            color: '#0f172a', 
                            border: 'none', 
                            padding: '10px 20px', 
                            borderRadius: '10px', 
                            fontSize: '13px', 
                            fontWeight: '700',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                      Open in Editor
                    </button>
                    <button 
                        onClick={() => deleteProject(proj._id)}
                        style={{ 
                            background: 'rgba(239, 68, 68, 0.1)', 
                            color: '#ef4444', 
                            border: '1px solid rgba(239, 68, 68, 0.2)', 
                            padding: '10px 15px', 
                            borderRadius: '10px', 
                            fontSize: '13px', 
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
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
