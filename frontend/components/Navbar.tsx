"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showProfileCard, setShowProfileCard] = useState(false);
  const [userInfo, setUserInfo] = useState({ username: "", email: "" });

  useEffect(() => {
    setMounted(true);
    let token = localStorage.getItem("token");
    
    // Recovery: If token in localStorage is missing but cookie exists, restore it
    if (!token) {
      const match = document.cookie.match(new RegExp('(^| )token=([^;]+)'));
      if (match) {
        token = match[2];
        localStorage.setItem("token", token);
      }
    }

    setIsLoggedIn(!!token);
    
    if (token) {
      // Fetch fresh profile
      fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/v1/user/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => {
        if (res.status === 401) {
          logout();
          return null;
        }
        return res.ok ? res.json() : null;
      })
      .then(data => {
        if (data && data.name) {
          setUserInfo({ username: data.name, email: data.email });
          localStorage.setItem("username", data.name);
          localStorage.setItem("email", data.email);
        }
      })
      .catch(err => console.error("Profile fetch in navbar failed", err));
    }
  }, [pathname]);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("email");
    // Clear cookie for middleware
    document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Strict";
    setIsLoggedIn(false);
    router.push("/login");
  };

  if (!mounted) return <nav className="navbar" />;

  return (
    <nav className="navbar">
      <div className="nav-left">
        <span className="logo">CodeEditor</span>
      </div>

      <div className="nav-right">
        <Link href="/editor" className={pathname === "/editor" ? "active" : ""}>
          Editor
        </Link>

        {!isLoggedIn ? (
          <>
            <Link href="/login" className={pathname === "/login" ? "active" : ""}>
              Login
            </Link>
            <Link href="/register" className={pathname === "/register" ? "active" : ""}>
              Register
            </Link>
          </>
        ) : (
          <>
            <div 
              className="profile-container"
              onMouseEnter={() => setShowProfileCard(true)}
              onMouseLeave={() => setShowProfileCard(false)}
            >
              <Link href="/profile" className={`profile-icon-link ${pathname === "/profile" ? "active" : ""}`}>
                <span className="profile-emoji">👨🏻‍💻</span>
              </Link>
              
              {showProfileCard && (
                <div className="profile-card">
                  <div className="profile-card-header">
                    <span className="profile-card-emoji">👨🏻‍💻</span>
                  </div>
                  <div className="profile-card-body">
                    <p className="profile-username">{userInfo.username}</p>
                    <p className="profile-email">{userInfo.email}</p>
                  </div>
                </div>
              )}
            </div>
            <button className="logout-btn" onClick={logout}>
              Logout
            </button>
          </>
        )}
      </div>
    </nav>
  );
}