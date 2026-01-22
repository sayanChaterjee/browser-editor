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

  if (!mounted) return <nav className="h-[56px] bg-[#1e1e1e] flex items-center justify-between px-6 border-b border-[#333] sticky top-0 z-[1000]" />;

  return (
    <nav className="h-[56px] bg-[#1e1e1e] flex items-center justify-between px-6 border-b border-[#333] sticky top-0 z-[1000]">
      <div className="flex items-center">
        <span className="text-[14px] font-bold text-[#00ffcc]">CodeEditor</span>
      </div>

      <div className="flex items-center">
        <Link 
          href="/editor" 
          className={`ml-4 text-[13px] no-underline transition-colors ${pathname === "/editor" ? "text-[#00ffcc]" : "text-[#ccc] hover:text-white"}`}
        >
          Editor
        </Link>

        {!isLoggedIn ? (
          <>
            <Link 
              href="/login" 
              className={`ml-4 text-[13px] no-underline transition-colors ${pathname === "/login" ? "text-[#00ffcc]" : "text-[#ccc] hover:text-white"}`}
            >
              Login
            </Link>
            <Link 
              href="/register" 
              className={`ml-4 text-[13px] no-underline transition-colors ${pathname === "/register" ? "text-[#00ffcc]" : "text-[#ccc] hover:text-white"}`}
            >
              Register
            </Link>
          </>
        ) : (
          <>
            <div 
              className="relative ml-4 inline-block"
              onMouseEnter={() => setShowProfileCard(true)}
              onMouseLeave={() => setShowProfileCard(false)}
            >
              <Link 
                href="/profile" 
                className={`flex items-center justify-center p-1 rounded-full transition-colors ${pathname === "/profile" ? "text-[#00ffcc] bg-white/10" : "text-[#ccc] hover:bg-white/10"}`}
              >
                <span className="text-[1.4rem] transition-transform hover:scale-110 inline-block">👨🏻‍💻</span>
              </Link>
              
              {showProfileCard && (
                <div className="absolute top-full right-0 mt-[10px] bg-[#111827] border border-[#1f2937] rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] p-4 min-w-[240px] z-[1000] animate-[fadeIn_0.2s_ease-out] before:content-[''] before:absolute before:-top-2 before:right-5 before:w-0 before:h-0 before:border-x-8 before:border-x-transparent before:border-b-8 before:border-b-[#1f2937]">
                  <div className="text-center mb-4 pb-4 border-b border-[#1f2937]">
                    <span className="text-3xl block mx-auto">👨🏻‍💻</span>
                  </div>
                  <div className="flex flex-col gap-2.5">
                    <p className="font-semibold text-[15px] text-[#f3f4f6] m-0">{userInfo.username}</p>
                    <p className="text-[13px] text-[#9ca3af] m-0 break-all">{userInfo.email}</p>
                  </div>
                </div>
              )}
            </div>
            <button 
              className="ml-4 px-4 py-1.5 bg-[#00ffcc] text-black border-none rounded font-bold text-[13px] cursor-pointer font-mono transition-colors hover:bg-[#00e6b8]" 
              onClick={logout}
            >
              Logout
            </button>
          </>
        )}
      </div>
    </nav>
  );
}