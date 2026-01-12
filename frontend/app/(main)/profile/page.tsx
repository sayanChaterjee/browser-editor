"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Submission {
  _id: string;
  html: string;
  css: string;
  js: string;
  createdAt: string;
}

interface UserProfile {
  name: string;
  email: string;
  createdAt: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
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
        if (profRes.ok) {
          const profData = await profRes.json();
          console.log("Profile Page Data:", profData);
          setUser(profData);
        }

        // Fetch Submissions
        const subRes = await fetch(`${apiUrl}/api/v1/code/submissions`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (subRes.ok) {
          const subData = await subRes.json();
          setSubmissions(subData);
        }
      } catch (err) {
        console.error("Profile page load failed", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

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
                <p style={{ color: '#38bdf8', fontWeight: '800', fontSize: '22px', marginBottom: '4px' }}>{submissions.length}</p>
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
               <span style={{ color: '#38bdf8' }}>📦</span> Submission History
            </h2>
            <span style={{ color: '#64748b', fontSize: '13px' }}>{submissions.length} Total Snapshots</span>
        </div>

        {submissions.length === 0 ? (
          <div style={{ 
            background: '#1e293b', 
            padding: '60px 20px', 
            borderRadius: '20px', 
            border: '1px dashed #334155', 
            textAlign: 'center' 
          }}>
            <div style={{ fontSize: '40px', marginBottom: '15px', opacity: 0.5 }}>📝</div>
            <p style={{ color: '#94a3b8', fontSize: '16px' }}>No code submissions found yet.</p>
            <button 
                onClick={() => router.push('/editor')}
                style={{ marginTop: '20px', background: '#38bdf8', color: '#0f172a', border: 'none', padding: '10px 24px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
            >
                Start Coding
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {submissions.map((sub) => (
              <div 
                key={sub._id} 
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
                  <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#f1f5f9', marginBottom: '8px' }}>
                    Snapshot: {new Date(sub.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                  </h3>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ fontSize: '11px', background: '#0f172a', color: '#38bdf8', padding: '4px 10px', borderRadius: '6px', fontWeight: '600', border: '1px solid #1e293b' }}>
                        HTML ({sub.html.length})
                    </span>
                    <span style={{ fontSize: '11px', background: '#0f172a', color: '#10b981', padding: '4px 10px', borderRadius: '6px', fontWeight: '600', border: '1px solid #1e293b' }}>
                        CSS ({sub.css.length})
                    </span>
                    <span style={{ fontSize: '11px', background: '#0f172a', color: '#fbbf24', padding: '4px 10px', borderRadius: '6px', fontWeight: '600', border: '1px solid #1e293b' }}>
                        JS ({sub.js.length})
                    </span>
                  </div>
                </div>
                <button 
                    onClick={() => {
                        alert("Direct restoration from profile is coming soon! For now, your work is safely persisted.");
                    }}
                    className="view-btn"
                    style={{ 
                        background: '#334155', 
                        color: '#f8fafc', 
                        border: 'none', 
                        padding: '10px 20px', 
                        borderRadius: '10px', 
                        fontSize: '13px', 
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                  View Details
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
