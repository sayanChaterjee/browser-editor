"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/lib/auth-client";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, isAuthenticated } = useAuth();

  const [showProfileCard, setShowProfileCard] = useState(false);

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

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

        {isLoading ? (
          <span className="ml-4 text-[13px] text-[#9ca3af]">Loading...</span>
        ) : !isAuthenticated ? (
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
              
              {showProfileCard && user && (
                <div className="absolute top-full right-0 mt-[10px] bg-[#111827] border border-[#1f2937] rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] p-4 min-w-[240px] z-[1000] animate-[fadeIn_0.2s_ease-out] before:content-[''] before:absolute before:-top-2 before:right-5 before:w-0 before:h-0 before:border-x-8 before:border-x-transparent before:border-b-8 before:border-b-[#1f2937]">
                  <div className="text-center mb-4 pb-4 border-b border-[#1f2937]">
                    <span className="text-3xl block mx-auto">👨🏻‍💻</span>
                  </div>
                  <div className="flex flex-col gap-2.5">
                    <p className="font-semibold text-[15px] text-[#f3f4f6] m-0">{user.name}</p>
                    <p className="text-[13px] text-[#9ca3af] m-0 break-all">{user.email}</p>
                  </div>
                </div>
              )}
            </div>
            <button 
              className="ml-4 px-4 py-1.5 bg-[#00ffcc] text-black border-none rounded font-bold text-[13px] cursor-pointer font-mono transition-colors hover:bg-[#00e6b8]" 
              onClick={handleLogout}
            >
              Logout
            </button>
          </>
        )}
      </div>
    </nav>
  );
}